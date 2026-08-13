
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../config/db";
import { asyncHandler, badRequest, forbidden, notFound } from "../middleware/error-handler";
import { requireAuth } from "../middleware/auth";

export const studentDetailsRouter = Router();

studentDetailsRouter.use(requireAuth);

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

const upsertSchema = z.object({
  pesuId: z.string().nullable().optional(),
  branch: z.string().nullable().optional(),
  section: z.string().nullable().optional(),
  dob: z.string().nullable().optional(),
  bloodGroup: z.string().nullable().optional(),
  sslcPct: z.number().min(0).max(100).nullable().optional(),
  pucPct: z.number().min(0).max(100).nullable().optional(),
  fatherName: z.string().nullable().optional(),
  fatherPhone: z.string().nullable().optional(),
  motherName: z.string().nullable().optional(),
  motherPhone: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  state: z.string().nullable().optional(),
  pincode: z.string().nullable().optional(),
  aadhaarLast4: z
    .string()
    .regex(/^\d{4}$/)
    .nullable()
    .optional(),
});

studentDetailsRouter.put(
  "/",
  asyncHandler(async (req, res) => {
    const me = req.user!;
    const data = upsertSchema.parse(req.body);
    if (me.role !== "admin" && me.role !== "student") throw forbidden();

    const row = await prisma.studentDetails.upsert({
      where: { studentId: me.id },
      create: { studentId: me.id, ...data },
      update: { ...data, updatedAt: new Date() },
    });
    res.json({ details: row });
  })
);
