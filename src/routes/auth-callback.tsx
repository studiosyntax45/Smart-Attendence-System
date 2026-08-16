import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { apiConfigured, ROLE_HOME, isCollegeEmail, type Role } from "@/lib/utils";
import { setAccessToken } from "@/lib/api-client";
import type { LoginErrorCode } from "@/app/(auth)/login/login-errors";


export default function AuthCallback() {
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const { refresh } = useAuth();
  const [message, setMessage] = useState("Completing sign-in…");
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const bounce = (code: LoginErrorCode) =>
      navigate(`/login?error=${code}`, { replace: true });

    (async () => {
      if (!apiConfigured()) return bounce("config");

      const access = search.get("access");
      const errorParam = search.get("error");
      if (errorParam) return bounce("oauth");
      if (!access) return bounce("cancelled");

      setAccessToken(access);

      const { me, googleOAuthUrl } = await import("@/lib/api-client");
      const user = await me();
      if (!user) {
        return bounce("oauth");
      }

      if (!isCollegeEmail(user.email)) {
        await (await import("@/lib/api-client")).logout();
        return bounce("domain");
      }
      if (user.role !== ("student" as Role)) {
        await (await import("@/lib/api-client")).logout();
        return bounce("not_student");
      }

      setMessage("Signed in — redirecting…");
      await refresh();
      navigate(search.get("next") ?? ROLE_HOME.student, { replace: true });
      void googleOAuthUrl;
    })();
  }, [navigate, refresh, search]);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 text-muted-foreground">
      <Loader2 className="size-6 animate-spin" aria-hidden="true" />
      <p className="text-sm">{message}</p>
    </main>
  );
}
