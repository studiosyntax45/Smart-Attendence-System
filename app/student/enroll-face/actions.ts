"use client";

import { api } from "@/lib/api-client";
import { isValidDescriptor } from "@/lib/face";

export const FACE_VERIFICATION_ENABLED =
  import.meta.env.VITE_FACE_VERIFICATION === "true";

export interface EnrollResult {
  ok: boolean;
  error?: string;
}

export interface EnrollInput {
  descriptor: number[];
  image?: string | null;
}


export async function enrollFace(input: EnrollInput): Promise<EnrollResult> {
  if (!isValidDescriptor(input.descriptor)) {
    return { ok: false, error: "Face data was malformed — please retry enrolment." };
  }

  try {
    await api.post("/profiles/me/face", {
      descriptor: input.descriptor,
      image: input.image,
      serverVerification: FACE_VERIFICATION_ENABLED,
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to enrol face." };
  }
}
