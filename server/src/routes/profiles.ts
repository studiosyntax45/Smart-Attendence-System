import { Router } from "express";
import { z } from "zod";
import { prisma } from "../config/db";
import { asyncHandler, badRequest, forbidden, notFound } from "../middleware/error-handler";
import { requireAuth, requireRole } from "../middleware/auth";
import { writeAudit } from "../services/audit";
import { hashPassword } from "../services/auth";

export const profileRouter = Router();

profileRouter.use(requireAuth);
// Must stay above "/:id", otherwise Express matches "me" as an id.
profileRouter.get(
  "/me",
  asyncHandler(async (req, res) => {
    const me = req.user!;
    const profile = await prisma.profile.findUnique({ where: { id: me.id } });
    if (!profile) throw notFound("Profile not found.");
    res.json({ profile: serializeProfile(profile) });
  })
);
profileRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const me = req.user!;
    const isStaff = me.role === "faculty" || me.role === "admin";
    if (me.id !== req.params.id && !isStaff) throw forbidden();

    const profile = await prisma.profile.findUnique({ where: { id: req.params.id } });
    if (!profile) throw notFound("Profile not found.");
    res.json({ profile: serializeProfile(profile) });
  })
);
profileRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const me = req.user!;
    if (me.role === "student") throw forbidden();

    const role = typeof req.query.role === "string" ? req.query.role : undefined;
    const profiles = await prisma.profile.findMany({
      where: role ? { role: role as never } : undefined,
      orderBy: { fullName: "asc" },
      select: {
        id: true,
        fullName: true,
        rollNo: true,
        role: true,
        faceEnrolled: true,
        user: { select: { email: true } },
      },
    });
    res.json({ profiles: profiles.map(({ user, ...p }) => ({ ...p, email: user?.email ?? null })) });
  })
);

const updateProfileSchema = z.object({
  fullName: z.string().min(1).max(120).optional(),
  rollNo: z.string().max(40).nullable().optional(),
  parentPhone: z.string().max(20).nullable().optional(),
  role: z.enum(["student", "faculty", "admin"]).optional(),
});
profileRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const me = req.user!;
    const data = updateProfileSchema.parse(req.body);

    if (me.id !== req.params.id && me.role !== "admin") throw forbidden();

    if (data.role && data.role !== (await getRoleOrCurrent(req.params.id))) {
      if (me.role !== "admin") throw forbidden("Only admins can change roles.");
      if (me.id === req.params.id) throw badRequest("You cannot change your own role.");
    }

    const update: Record<string, unknown> = {};
    if (data.fullName !== undefined) update.fullName = data.fullName;
    if (data.rollNo !== undefined) update.rollNo = data.rollNo;
    if (data.parentPhone !== undefined) update.parentPhone = data.parentPhone;
    if (data.role !== undefined) update.role = data.role;

    const before = await prisma.profile.findUnique({
      where: { id: req.params.id },
      select: { fullName: true, rollNo: true, role: true, parentPhone: true },
    });
    const profile = await prisma.profile.update({
      where: { id: req.params.id },
      data: update,
    });
    await writeAudit({ id: me.id, role: me.role }, data.role && data.role !== before?.role ? "change_role" : "update_user", "user", {
      entityId: req.params.id,
      summary:
        data.role && data.role !== before?.role
          ? `Changed ${profile.fullName}'s role from ${before?.role} to ${data.role}.`
          : `Updated ${profile.fullName}'s profile.`,
      before,
      after: update,
    });
    res.json({ profile: serializeProfile(profile) });
  })
);
profileRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const me = req.user!;
    if (me.role !== "admin") throw forbidden();
    if (me.id === req.params.id) throw badRequest("You cannot delete your own account.");
    await prisma.authUser.delete({ where: { id: req.params.id } });
    res.status(204).end();
  })
);
const resetPasswordSchema = z.object({
  password: z.string().min(8, "New password must be at least 8 characters.").max(72),
});
profileRouter.post(
  "/:id/reset-password",
  asyncHandler(async (req, res) => {
    const me = req.user!;
    if (me.role !== "admin") throw forbidden("Only admins can reset passwords.");
    const { password } = resetPasswordSchema.parse(req.body);
    await prisma.authUser.update({
      where: { id: req.params.id },
      data: { passwordHash: await hashPassword(password) },
    });
    const target = await prisma.profile.findUnique({ where: { id: req.params.id }, select: { fullName: true } });
    await writeAudit({ id: me.id, role: me.role }, "reset_password", "user", {
      entityId: req.params.id,
      summary: `Reset password for ${target?.fullName ?? "a user"}.`,
    });
    res.json({ message: "Password reset. Share the new password with the user." });
  })
);
profileRouter.post(
  "/:id/reset-face",
  asyncHandler(async (req, res) => {
    const me = req.user!;
    if (me.role !== "admin") throw forbidden();
    const { Prisma } = await import("@prisma/client");
    await prisma.profile.update({
      where: { id: req.params.id },
      data: {
        faceEmbedding: Prisma.JsonNull,
        faceEmbeddingServer: Prisma.JsonNull,
        faceEnrolled: false,
      },
    });
    res.json({ message: "Face enrolment reset." });
  })
);
const enrollFaceSchema = z.object({
  descriptor: z.array(z.number()).length(128),
  image: z.string().nullable().optional(),
  serverVerification: z.boolean().optional(),
});

profileRouter.post(
  "/me/face",
  requireRole("student"),
  asyncHandler(async (req, res) => {
    const me = req.user!;
    const { descriptor, image, serverVerification } = enrollFaceSchema.parse(req.body);

    if (!isValidDescriptorLocal(descriptor)) {
      throw badRequest("Face data was malformed — please retry enrolment.");
    }

    const existing = await prisma.profile.findUnique({
      where: { id: me.id },
      select: { faceEmbedding: true },
    });
    if (existing?.faceEmbedding) {
      throw badRequest(
        "A face is already enrolled for this account. Ask an admin to reset it before enrolling again."
      );
    }

    let serverEmbedding: number[] | null = null;
    if (serverVerification) {
      if (!image) throw badRequest("Camera capture was missing — please retry enrolment.");
      const { representFace } = await import("../services/face-service-client");
      const result = await representFace(image);
      if (!result.ok) throw badRequest(result.reason);
      serverEmbedding = result.data.embedding;
    }

    const { Prisma } = await import("@prisma/client");
    const updated = await prisma.profile.updateMany({
      // faceEnrolled, not faceEmbedding: a never-set JSON column is SQL NULL, which JsonNull doesn't match.
      where: { id: me.id, faceEnrolled: false },
      data: {
        faceEmbedding: descriptor,
        faceEmbeddingServer: serverEmbedding ?? Prisma.JsonNull,
        faceEnrolled: true,
      },
    });
    if (updated.count === 0) {
      throw badRequest(
        "A face is already enrolled for this account. Ask an admin to reset it before enrolling again."
      );
    }
    res.json({ ok: true });
  })
);

function isValidDescriptorLocal(v: unknown): boolean {
  return (
    Array.isArray(v) &&
    v.length === 128 &&
    v.every((x) => typeof x === "number" && Number.isFinite(x))
  );
}

function serializeProfile(p: {
  id: string;
  fullName: string;
  rollNo: string | null;
  role: string;
  parentPhone: string | null;
  faceEnrolled: boolean;
  faceEmbedding: unknown;
  faceEmbeddingServer: unknown;
}) {
  return {
    id: p.id,
    fullName: p.fullName,
    rollNo: p.rollNo,
    role: p.role,
    parentPhone: p.parentPhone,
    faceEnrolled: p.faceEnrolled,
    hasFaceEmbedding: !!p.faceEmbedding,
    hasFaceEmbeddingServer: !!p.faceEmbeddingServer,
  };
}

async function getRoleOrCurrent(id: string): Promise<string> {
  const p = await prisma.profile.findUnique({ where: { id }, select: { role: true } });
  return p?.role ?? "student";
}
