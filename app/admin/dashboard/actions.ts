"use client";

import { api } from "@/lib/api-client";
import type { Role } from "@/lib/utils";

export interface AdminActionState {
  error?: string;
  message?: string;
}

const VALID_ROLES: Role[] = ["student", "faculty", "admin"];


export async function setUserRole(userId: string, role: Role): Promise<AdminActionState> {
  if (!VALID_ROLES.includes(role)) return { error: "Invalid role." };
  try {
    await api.patch(`/profiles/${userId}`, { role });
    return { message: "Role updated." };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to update role." };
  }
}


export async function resetFaceEnrollment(userId: string): Promise<AdminActionState> {
  try {
    await api.post(`/profiles/${userId}/reset-face`);
    return { message: "Face enrolment reset — the student can now re-enrol." };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to reset face." };
  }
}


export async function createGeofence(
  _prev: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const roomName = String(formData.get("roomName") ?? "").trim();
  const lat = Number(formData.get("lat"));
  const lng = Number(formData.get("lng"));
  const radiusM = Number(formData.get("radiusM"));

  if (!roomName) return { error: "Enter a room name." };
  if (!Number.isFinite(lat) || Math.abs(lat) > 90) return { error: "Latitude must be between -90 and 90." };
  if (!Number.isFinite(lng) || Math.abs(lng) > 180) return { error: "Longitude must be between -180 and 180." };
  if (!Number.isFinite(radiusM) || radiusM < 5 || radiusM > 2000)
    return { error: "Radius must be between 5 and 2000 metres." };

  try {
    await api.post("/geofences", { roomName, lat, lng, radiusM: Math.round(radiusM) });
    return { message: `Geofence "${roomName}" created.` };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to create geofence." };
  }
}


export async function deleteGeofence(id: string): Promise<AdminActionState> {
  try {
    await api.del(`/geofences/${id}`);
    return { message: "Geofence deleted." };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to delete geofence." };
  }
}
