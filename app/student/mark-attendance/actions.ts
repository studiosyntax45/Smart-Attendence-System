"use client";

import { api } from "@/lib/api-client";
import { effectiveGraceM } from "@/lib/geofence";
import { euclideanDistance, isFaceMatch, isValidDescriptor } from "@/lib/face";
import { fetchGpsSettings } from "@/lib/gps-settings";
import { FACE_CONFIDENCE_MIN } from "@/lib/utils";

export interface MarkResult {
  ok: boolean;
  error?: string;
  status?: "present" | "late";
  
  lateAfterMin?: number;
}


export async function markEntry(input: {
  sessionId: string;
  lat: number;
  lng: number;
  accuracy: number;
  faceConfidence: number;
  descriptor: number[];
  image?: string | null;
}): Promise<MarkResult> {
  if (
    !Number.isFinite(input.lat) ||
    !Number.isFinite(input.lng) ||
    Math.abs(input.lat) > 90 ||
    Math.abs(input.lng) > 180
  ) {
    return { ok: false, error: "Invalid location reading." };
  }
  if (input.faceConfidence < FACE_CONFIDENCE_MIN) {
    return { ok: false, error: "Face confidence too low â€” try again in better lighting." };
  }
  if (!isValidDescriptor(input.descriptor)) {
    return { ok: false, error: "Face capture was invalid â€” please retry." };
  }
  const [session, gps, meProfile] = await Promise.all([
    api.get<{
      session: {
        id: string;
        openedAt: string;
        closedAt: string | null;
        geofence: { lat: string; lng: string; radiusM: number };
      };
    }>(`/sessions/${input.sessionId}`).catch(() => null),
    fetchGpsSettings(),
    api
      .get<{
        profile: {
          faceEmbedding: number[] | null;
          faceEmbeddingServer: number[] | null;
        };
      }>("/profiles/me")
      .catch(() => null),
  ]);

  if (!session?.session) return { ok: false, error: "Session not found." };
  if (session.session.closedAt) return { ok: false, error: "This session has already been closed." };
  if (!meProfile?.profile?.faceEmbedding) {
    return {
      ok: false,
      error: "No enrolled face found â€” enrol your face before marking attendance.",
    };
  }
  const faceDistance = euclideanDistance(input.descriptor, meProfile.profile.faceEmbedding);
  if (!isFaceMatch(faceDistance)) {
    return { ok: false, error: "Face does not match your enrolment â€” please try again." };
  }

  const fence = session.session.geofence;
  const graceM = effectiveGraceM(input.accuracy, gps.accuracyGraceM);
  void graceM;
  void fence;

  try {
    const { attendance, status, lateAfterMin } = await api.post<{
      attendance: unknown;
      status: "present" | "late";
      lateAfterMin: number;
    }>("/attendance", {
      sessionId: input.sessionId,
      lat: input.lat,
      lng: input.lng,
      accuracy: input.accuracy,
      faceConfidence: input.faceConfidence,
      descriptor: input.descriptor,
      image: input.image,
    });
    void attendance;
    return { ok: true, status, lateAfterMin };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Mark failed." };
  }
}


export async function markExit(attendanceId: string): Promise<MarkResult> {
  try {
    await api.post(`/attendance/${attendanceId}/exit`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Exit failed." };
  }
}
