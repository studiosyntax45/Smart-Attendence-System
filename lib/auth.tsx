import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { api, googleOAuthUrl, login, logout, me, refreshBootstrap, type SessionUser } from "./api-client";
import {
  ROLE_HOME,
  apiConfigured,
  COLLEGE_EMAIL_DOMAIN,
  isCollegeEmail,
  type Role,
} from "./utils";


const PARENT_VIEW_KEY = "pes-parent-view";

export function getParentView(): boolean {
  try {
    return localStorage.getItem(PARENT_VIEW_KEY) === "1";
  } catch {
    return false;
  }
}
export function setParentView(on: boolean) {
  try {
    if (on) localStorage.setItem(PARENT_VIEW_KEY, "1");
    else localStorage.removeItem(PARENT_VIEW_KEY);
  } catch {
  }
}

export interface SessionProfile {
  id: string;
  fullName: string;
  rollNo: string | null;
  role: Role;
}

interface AuthContextValue {
  loading: boolean;
  user: SessionUser | null;
  
  profile: SessionProfile | null;
  
  parentView: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function fetchProfile(userId: string): Promise<SessionProfile | null> {
  const { profile } = await api.get<{ profile: { id: string; fullName: string; rollNo: string | null; role: string } }>(
    `/profiles/${userId}`
  );
  return {
    id: profile.id,
    fullName: profile.fullName,
    rollNo: profile.rollNo,
    role: profile.role as Role,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [profile, setProfile] = useState<SessionProfile | null>(null);
  const [parentView, setParentViewState] = useState<boolean>(getParentView());

  const applyUser = useCallback(async (u: SessionUser | null) => {
    setUser(u);
    setProfile(u ? await fetchProfile(u.id) : null);
    setParentViewState(getParentView());
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!apiConfigured()) {
      setLoading(false);
      return;
    }
    (async () => {
      const restored = await refreshBootstrap();
      if (restored) await applyUser(restored);
      else setLoading(false);
    })();
  }, [applyUser]);

  const refresh = useCallback(async () => {
    if (user) setProfile(await fetchProfile(user.id));
    setParentViewState(getParentView());
  }, [user]);

  const signOut = useCallback(async () => {
    await logout();
    setParentView(false);
    setParentViewState(false);
    setUser(null);
    setProfile(null);
  }, []);

  const value = useMemo(
    () => ({ loading, user, profile, parentView, refresh, signOut }),
    [loading, user, profile, parentView, refresh, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}


export function roleHome(role: Role): string {
  return ROLE_HOME[role];
}

export interface AuthResult {
  error?: string;
  role?: Role;
}

const NOT_CONFIGURED =
  "API backend is not configured. Set VITE_API_BASE_URL in .env.local.";


export async function signInWithPassword(
  email: string,
  password: string
): Promise<AuthResult & { role?: Role }> {
  if (!apiConfigured()) return { error: NOT_CONFIGURED };
  if (!email || !password) return { error: "Enter both email and password." };
  try {
    const res = await login(email.trim(), password);
    setParentView(false);
    const m = await me();
    return { role: (m?.role as Role) ?? "student" };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Sign-in failed." };
  }
}


export async function signInAsParent(
  email: string,
  password: string
): Promise<AuthResult> {
  if (!apiConfigured()) return { error: NOT_CONFIGURED };
  if (!email || !password)
    return { error: "Enter your child's student email and password." };
  try {
    const res = await login(email.trim(), password);
    const m = await me();
    if (m?.role !== "student") {
      await logout();
      return {
        error:
          "Parent sign-in works only with a student account's email and password.",
      };
    }
    setParentView(true);
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Sign-in failed." };
  }
}


export async function signInWithGoogle(
  redirectOrigin: string
): Promise<AuthResult> {
  if (!apiConfigured()) return { error: NOT_CONFIGURED };
  if (!redirectOrigin)
    return { error: "Could not determine the site URL for Google sign-in." };
  setParentView(false);
  window.location.href = googleOAuthUrl();
  return {};
}


export { isCollegeEmail };
export type { SessionUser };
void login;
void me;
