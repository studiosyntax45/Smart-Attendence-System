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
  if (!course) return { error: "Enter a course name." };
  if (!geofenceId) return { error: "Choose a classroom geofence." };

  try {
    await api.post("/sessions", { course, geofenceId });
    return { message: `Session "${course}" is open â€” students can mark now.` };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to open session." };
  }
}


export async function closeSession(sessionId: string): Promise<SessionFormState> {
  try {
    await api.post(`/sessions/${sessionId}/close`);
    return { message: "Session closed â€” open records stamped with exit time." };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to close session." };
  }
}
