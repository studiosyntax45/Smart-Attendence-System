import { Router } from "express";
import { z } from "zod";
import { prisma } from "../config/db";
import { asyncHandler, forbidden, notFound } from "../middleware/error-handler";
import { requireAuth, requireRole } from "../middleware/auth";
import { writeAudit } from "../services/audit";

export const studentDetailsRouter = Router();

studentDetailsRouter.use(requireAuth);

studentDetailsRouter.get(
  "/",
  requireRole("faculty", "admin"),
  asyncHandler(async (_req, res) => {
    const students = await prisma.profile.findMany({
      where: { role: "student" },
      orderBy: [{ rollNo: "asc" }, { fullName: "asc" }],
      select: {
        id: true,
        fullName: true,
        rollNo: true,
        user: { select: { email: true } },
        studentDetails: { select: { branch: true, section: true, year: true, dob: true, fatherName: true, address: true } },
      },
    });
    res.json({
      students: students.map((s) => ({
        id: s.id,
        fullName: s.fullName,
        rollNo: s.rollNo,
        email: s.user?.email ?? null,
        branch: s.studentDetails?.branch ?? null,
        section: s.studentDetails?.section ?? null,
        year: s.studentDetails?.year ?? null,
        personalFilled: Boolean(s.studentDetails?.dob || s.studentDetails?.fatherName || s.studentDetails?.address),
      })),
    });
  })
);

studentDetailsRouter.get(
  "/:studentId",
  asyncHandler(async (req, res) => {
    const me = req.user!;
    const isStaff = me.role === "faculty" || me.role === "admin";
    if (!isStaff && req.params.studentId !== me.id) throw forbidden();

    const row = await prisma.studentDetails.findUnique({
      where: { studentId: req.params.studentId },
    });
    res.json({ details: row });
  })
);

// Blank strings clear a field, so a form can send every field as typed.
const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((v) => (v ? v : v === undefined ? undefined : null));
const pattern = (re: RegExp, message: string) =>
  z
    .string()
    .trim()
    .nullable()
    .optional()
    .transform((v) => (v ? v : v === undefined ? undefined : null))
    .refine((v) => v == null || re.test(v), message);
const pct = z.number().min(0).max(100).nullable().optional();

const upsertSchema = z.object({
  pesuId: text(40),
  branch: text(60),
  section: text(10),
  year: z.number().int().min(1).max(4).nullable().optional(),
  parentEmail: pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Parent email is not a valid email address."),
  dob: pattern(/^\d{4}-\d{2}-\d{2}$/, "Date of birth must be a date (YYYY-MM-DD)."),
  bloodGroup: pattern(/^(A|B|AB|O)[+-]$/, "Blood group must be one of A+, A-, B+, B-, AB+, AB-, O+, O-."),
  sslcPct: pct,
  pucPct: pct,
  fatherName: text(120),
  fatherPhone: pattern(/^[+\d][\d\s-]{6,19}$/, "Father's phone must be a phone number."),
  motherName: text(120),
  motherPhone: pattern(/^[+\d][\d\s-]{6,19}$/, "Mother's phone must be a phone number."),
  address: text(300),
  city: text(80),
  state: text(80),
  pincode: pattern(/^\d{6}$/, "PIN code must be 6 digits."),
  aadhaarLast4: pattern(/^\d{4}$/, "Aadhaar: enter only the last 4 digits."),
});

studentDetailsRouter.put(
  "/:studentId",
  requireRole("faculty", "admin"),
  asyncHandler(async (req, res) => {
    const me = req.user!;
    const { dob, ...fields } = upsertSchema.parse(req.body);
    const studentId = req.params.studentId;

    const student = await prisma.profile.findUnique({ where: { id: studentId }, select: { role: true, fullName: true } });
    if (!student || student.role !== "student") throw notFound("Student not found.");

    const data = { ...fields, ...(dob !== undefined ? { dob: dob ? new Date(`${dob}T00:00:00Z`) : null } : {}) };
    const before = await prisma.studentDetails.findUnique({ where: { studentId } });
    const row = await prisma.studentDetails.upsert({
      where: { studentId },
      create: { studentId, ...data },
      update: { ...data, updatedAt: new Date() },
    });
    await writeAudit({ id: me.id, role: me.role }, "update_student_details", "student_details", {
      entityId: studentId,
      summary: `Updated ${student.fullName}'s student details.`,
      before,
      after: row,
    });
    res.json({ details: row });
  })
);
