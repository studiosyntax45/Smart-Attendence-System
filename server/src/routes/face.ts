
import { Router } from "express";
import { z } from "zod";
import { config } from "../config/env";
import { prisma } from "../config/db";
import { asyncHandler, badRequest, HttpError, notFound } from "../middleware/error-handler";
import { requireAuth } from "../middleware/auth";
import { isValidServerEmbedding } from "../services/face-service-client";

export const faceRouter = Router();

faceRouter.use(requireAuth);

const imageSchema = z.object({ image: z.string().min(8) });
faceRouter.post(
  "/represent",
  asyncHandler(async (req, res) => {
    const me = req.user!;
    const { image } = imageSchema.parse(req.body);

    const { representFace } = await import("../services/face-service-client");
    const result = await representFace(image);
    if (!result.ok) throw new HttpError(result.status, result.reason);
    if (!isValidServerEmbedding(result.data.embedding)) {
      throw badRequest("Face service returned an unexpected response.");
    }
    const { Prisma } = await import("@prisma/client");
    await prisma.profile.updateMany({
      where: { id: me.id, faceEmbeddingServer: { equals: Prisma.JsonNull } },
      data: { faceEmbeddingServer: result.data.embedding },
    });
    res.json({
      embedding: result.data.embedding,
      dims: result.data.dims,
      model: result.data.model,
    });
  })
);

const verifySchema = z.object({
  image: z.string().min(8),
});
faceRouter.post(
  "/verify",
  asyncHandler(async (req, res) => {
    const me = req.user!;
    const { image } = verifySchema.parse(req.body);

    const profile = await prisma.profile.findUnique({
      where: { id: me.id },
      select: { faceEmbeddingServer: true, faceEmbedding: true },
    });
    if (!profile) throw notFound("Profile not found.");

    const reference = isValidServerEmbedding(profile.faceEmbeddingServer)
      ? profile.faceEmbeddingServer
      : null;
    if (!reference) {
      throw badRequest(
        "No server-side face enrolment found. Enrol first with face verification enabled."
      );
    }

    const { verifyFace } = await import("../services/face-service-client");
    const result = await verifyFace({ image, referenceEmbedding: reference });
    if (!result.ok) throw new HttpError(result.status, result.reason);
    res.json(result.data);
  })
);
faceRouter.get("/configured", (_req, res) => {
  res.json({ configured: !!config.faceService.url });
});
