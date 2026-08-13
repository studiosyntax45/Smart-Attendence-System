import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}


export function apiConfigured() {
  return Boolean(import.meta.env?.VITE_API_BASE_URL);
}



export type Role = "student" | "faculty" | "admin" | "parent";
export type AttendanceStatus = "present" | "late" | "absent" | "partial";


export const COLLEGE_EMAIL_DOMAIN =
  import.meta.env?.VITE_COLLEGE_DOMAIN?.trim().toLowerCase() || "pesu.pes.edu";


export function isCollegeEmail(email: string | null | undefined): boolean {
  const domain = email?.split("@")[1]?.trim().toLowerCase();
  return domain === COLLEGE_EMAIL_DOMAIN;
}

export const ROLE_HOME: Record<Role, string> = {
  student: "/student/dashboard",
  faculty: "/faculty/dashboard",
  admin: "/admin/dashboard",
  parent: "/parent/dashboard",
};


export const FACE_CONFIDENCE_MIN = 0.35;

export function firstRow<T>(embed: T | T[] | null): T | null {
  if (Array.isArray(embed)) return embed[0] ?? null;
  return embed ?? null;
}

export function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

