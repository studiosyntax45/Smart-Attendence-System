
import { Router, type Request, type Response } from "express";
import { z } from "zod";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { config } from "../config/env";
import { prisma } from "../config/db";
import {
  hashPassword,
  isCollegeEmail,
  pruneExpiredRevokedTokens,
  revokeRefreshToken,
  signAccessToken,
  signRefreshToken,
  verifyPassword,
  verifyRefreshToken,
  type Role,
} from "../services/auth";
import { asyncHandler, badRequest, conflict, HttpError, unauthorized } from "../middleware/error-handler";

export const authRouter = Router();

const REFRESH_COOKIE = "pes_refresh";
const refreshCookieOptions = {
  httpOnly: true,
  secure: false,
  sameSite: "lax" as const,
  path: "/auth",
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

function setRefreshCookie(res: Response, token: string): void {
  res.cookie(REFRESH_COOKIE, token, refreshCookieOptions);
}

function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE, { path: "/auth" });
}

async function issueTokensForUser(userId: string, res: Response) {
  const user = await prisma.profile.findUnique({ where: { id: userId } });
  if (!user) throw unauthorized("Account no longer exists.");
  const emailRow = await prisma.authUser.findUnique({ where: { id: userId }, select: { email: true } });

  const accessToken = signAccessToken({
    sub: userId,
    email: emailRow?.email ?? "",
    role: user.role as Role,
    fullName: user.fullName,
  });
  const { token: refresh, jti } = signRefreshToken(userId);
  setRefreshCookie(res, refresh);

  return {
    user: {
      id: userId,
      email: emailRow?.email ?? "",
      role: user.role as Role,
      fullName: user.fullName,
    },
    accessToken,
    refreshJti: jti,
  };
}

const registerSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  password: z.string().min(8).max(72),
  fullName: z.string().min(1).max(120),
});

authRouter.post(
  "/register",
  asyncHandler(async (req, res) => {
    const { email, password, fullName } = registerSchema.parse(req.body);

    const existing = await prisma.authUser.findUnique({ where: { email } });
    if (existing) throw conflict("An account with that email already exists.");

    const passwordHash = await hashPassword(password);
    const userId = crypto.randomUUID();

    await prisma.$transaction([
      prisma.authUser.create({
        data: { id: userId, email, passwordHash },
      }),
      prisma.profile.create({
        data: { id: userId, fullName, role: "student" },
      }),
    ]);

    const tokens = await issueTokensForUser(userId, res);
    res.status(201).json({ user: tokens.user, accessToken: tokens.accessToken });
  })
);

const loginSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  password: z.string().min(1),
});

authRouter.post(
  "/login",
  asyncHandler(async (req, res) => {
    const { email, password } = loginSchema.parse(req.body);

    const user = await prisma.authUser.findUnique({ where: { email } });
    if (!user || !user.passwordHash) throw unauthorized("Invalid email or password.");

    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) throw unauthorized("Invalid email or password.");

    const tokens = await issueTokensForUser(user.id, res);
    res.json({ user: tokens.user, accessToken: tokens.accessToken });
  })
);

authRouter.post(
  "/refresh",
  asyncHandler(async (req, res) => {
    const refresh = req.cookies?.[REFRESH_COOKIE];
    if (!refresh) throw unauthorized("No refresh token.");

    try {
      payload = await verifyRefreshToken(refresh);
    } catch {
      clearRefreshCookie(res);
      throw unauthorized("Refresh token expired — please sign in again.");
    }

    const expiry = payload.exp ? new Date(payload.exp * 1000) : undefined;
    await revokeRefreshToken(payload.jti, expiry);
    const tokens = await issueTokensForUser(payload.sub, res);
    res.json({ user: tokens.user, accessToken: tokens.accessToken });
  })
);

authRouter.post("/logout", asyncHandler(async (req, res) => {
  const refresh = req.cookies?.[REFRESH_COOKIE];
  if (refresh) {
    try {
      const payload = await verifyRefreshToken(refresh);
      const expiry = payload.exp ? new Date(payload.exp * 1000) : undefined;
      await revokeRefreshToken(payload.jti, expiry);
    } catch {}
  }
  clearRefreshCookie(res);
  res.status(204).end();
}));

authRouter.get(
  "/me",
  asyncHandler(async (req, res) => {
    const auth = req.header("authorization");
    if (!auth?.toLowerCase().startsWith("bearer ")) {
      throw unauthorized();
    }
    const { verifyAccessToken, getUserWithProfile } = await import("../services/auth");
    const payload = verifyAccessToken(auth.slice(7));
    const user = await getUserWithProfile(payload.sub);
    if (!user) throw unauthorized();
    res.json({ user });
  })
);

if (config.google.clientId && config.google.clientSecret) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: config.google.clientId,
        clientSecret: config.google.clientSecret,
        callbackURL: config.google.callbackUrl,
        passReqToCallback: true,
      },
      async (req, accessToken, refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value?.toLowerCase();
          if (!email || !isCollegeEmail(email)) {
            return done(null, false, { message: "domain" });
          }
          let user = await prisma.authUser.findUnique({ where: { email } });
          if (!user) {
            const id = crypto.randomUUID();
            await prisma.$transaction([
              prisma.authUser.create({
                data: { id, email, googleSub: profile.id },
              }),
              prisma.profile.create({
                data: {
                  id,
                  fullName: profile.displayName ?? email.split("@")[0],
                  role: "student",
                },
              }),
            ]);
            user = await prisma.authUser.findUnique({ where: { email } });
          }
          if (!user) return done(null, false, { message: "create_failed" });
          done(null, { id: user.id, email: user.email, role: "student", fullName: "" });
        } catch (err) {
          done(err as Error);
        }
      }
    )
  );

  authRouter.get(
    "/google",
    (req, res, next) => {
      const state = typeof req.query.parentView === "string" ? "?parentView=1" : "";
      passport.authenticate("google", {
        scope: ["profile", "email"],
        session: false,
        state,
      })(req, res, next);
    }
  );

  authRouter.get(
    "/google/callback",
    (req, res, next) => {
      passport.authenticate(
        "google",
        { session: false, failureRedirect: `${config.webOrigin}/login?error=oauth` },
        async (err: unknown, result: unknown, info: { message?: string } | undefined) => {
          if (err || !result) {
            const code = info?.message === "domain" ? "domain" : "oauth";
            return res.redirect(`${config.webOrigin}/login?error=${code}`);
          }
          const { id: userId } = result as { id: string };
          try {
            const tokens = await issueTokensForUser(userId, res);
            const parentView = typeof req.query.state === "string" && req.query.state.includes("parentView=1");
            const target = parentView ? "/parent/dashboard" : "/student/dashboard";
            res.redirect(
              `${config.webOrigin}/auth/callback?access=${encodeURIComponent(tokens.accessToken)}&next=${encodeURIComponent(target)}`
            );
          } catch (e) {
            console.error("[google callback]", e);
            res.redirect(`${config.webOrigin}/login?error=oauth`);
          }
        }
      )(req, res, next);
    }
  );
}

export { REFRESH_COOKIE };
