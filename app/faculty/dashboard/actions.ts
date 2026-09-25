"use client";

import { api } from "@/lib/api-client";

export interface SessionFormState {
  error?: string;
  message?: string;
}


export async function openSession(
  _prev: SessionFormState,
  formData: FormData
): Promise<SessionFormState> {
  const course = String(formData.get("course") ?? "").trim();
  const geofenceId = String(formData.get("geofenceId") ?? "");
  const radiusM = Math.round(Number(formData.get("radiusM")));
  if (!course) return { error: "Choose a course." };
  if (!geofenceId) return { error: "Choose a classroom geofence." };
  if (!Number.isFinite(radiusM) || radiusM < 5 || radiusM > 2000)
    return { error: "GPS radius must be between 5 and 2000 metres." };

  try {
    await api.post("/sessions", { course, geofenceId, radiusM });
    return { message: `Session "${course}" is open — students can mark now.` };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to open session." };
  }
}


export async function closeSession(sessionId: string): Promise<SessionFormState> {
  try {
    await api.post(`/sessions/${sessionId}/close`);
    return { message: "Session closed — open records stamped with exit time." };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to close session." };
  }
}
