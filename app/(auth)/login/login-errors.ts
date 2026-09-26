import { COLLEGE_EMAIL_DOMAIN } from "@/lib/utils";

export type LoginErrorCode =
  | "domain"
  | "not_student"
  | "oauth"
  | "config"
  | "cancelled"
  | "google_unavailable";

const MESSAGES: Record<LoginErrorCode, string> = {
  domain: `Please sign in with your college Google account (@${COLLEGE_EMAIL_DOMAIN}).`,
  not_student:
    "Google sign-in is for students only. Faculty and admin sign in with a password.",
  oauth: "Google sign-in could not be completed. Please try again.",
  config: "Backend API is not configured.",
  cancelled: "Sign-in was cancelled before it completed.",
  google_unavailable:
    "Google sign-in isn't set up on this server. Students can sign in below with their college email and password (default Pes@12345).",
};

export function loginErrorMessage(code: string | undefined): string | null {
  if (!code) return null;
  return (
    MESSAGES[code as LoginErrorCode] ??
    "Sign-in could not be completed. Please try again."
  );
}
