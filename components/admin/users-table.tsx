
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { KeyRound, LoaderCircle, RotateCcw, ScanFace, ShieldCheck } from "lucide-react";
import { resetFaceEnrollment, resetUserPassword, setUserRole } from "@/app/admin/dashboard/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Role } from "@/lib/utils";

export interface UserRow {
  id: string;
  full_name: string;
  roll_no: string | null;
  role: Role;
  created_at: string;
  
  face_enrolled: boolean;
}

function tempPassword(): string {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  // No 0/O/1/I: easy to misread aloud.
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return `Pes@${out}`;
}

const ROLE_BADGE: Record<Role, "default" | "secondary" | "outline"> = {
  admin: "default",
  faculty: "secondary",
  student: "outline",
  parent: "outline",
};


export function UsersTable({
  users,
  currentUserId,
}: {
  users: UserRow[];
  currentUserId: string;
}) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [pwUserId, setPwUserId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const qc = useQueryClient();

  async function changeRole(userId: string, role: Role) {
    setPendingId(userId);
    setError(null);
    const res = await setUserRole(userId, role);
    if (res.error) setError(res.error);
    else qc.invalidateQueries({ queryKey: ["admin-dashboard"] });
    setPendingId(null);
  }
  async function resetFace(userId: string) {
    setResettingId(userId);
    setConfirmId(null);
    setError(null);
    setNotice(null);
    const res = await resetFaceEnrollment(userId);
    if (res.error) setError(res.error);
    else {
      setNotice(res.message ?? "Face enrolment reset.");
      qc.invalidateQueries({ queryKey: ["admin-dashboard"] });
    }
    setResettingId(null);
  }

  async function savePassword(user: UserRow) {
    setPwSaving(true);
    setError(null);
    setNotice(null);
    const res = await resetUserPassword(user.id, newPassword);
    setPwSaving(false);
    if (res.error) setError(res.error);
    else {
      setNotice(`Password for ${user.full_name} is now "${newPassword}". Share it with them.`);
      setPwUserId(null);
    }
  }

  return (
    <div className="space-y-3">
      {error && (
        <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="rounded-md bg-status-present/10 p-3 text-sm text-status-present">
          {notice}
        </p>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th scope="col" className="py-2 pr-4 font-medium">Name</th>
              <th scope="col" className="py-2 pr-4 font-medium">Roll no</th>
              <th scope="col" className="py-2 pr-4 font-medium">Role</th>
              <th scope="col" className="py-2 pr-4 font-medium">Change role</th>
              <th scope="col" className="py-2 pr-4 font-medium">Face</th>
              <th scope="col" className="py-2 font-medium">Password</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const isSelf = u.id === currentUserId;
              return (
                <tr key={u.id} className="border-b transition-colors last:border-0 hover:bg-muted/50">
                  <td className="py-2.5 pr-4 font-medium">
                    <span className="flex items-center gap-1.5">
                      {u.full_name}
                      {isSelf && (
                        <span className="text-xs text-muted-foreground">(you)</span>
                      )}
                    </span>
                  </td>
                  <td className="py-2.5 pr-4 font-mono text-xs">{u.roll_no ?? "—"}</td>
                  <td className="py-2.5 pr-4">
                    <Badge variant={ROLE_BADGE[u.role]}>
                      {u.role === "admin" && (
                        <ShieldCheck className="size-3" aria-hidden="true" />
                      )}
                      {u.role}
                    </Badge>
                  </td>
                  <td className="py-2.5 pr-4">
                    {isSelf ? (
                      <span className="text-xs text-muted-foreground">Locked</span>
                    ) : pendingId === u.id ? (
                      <LoaderCircle className="size-4 animate-spin text-muted-foreground" aria-label="Updating role" />
                    ) : (
                      <select
                        suppressHydrationWarning
                        aria-label={`Change role for ${u.full_name}`}
                        value={u.role}
                        onChange={(e) => changeRole(u.id, e.target.value as Role)}
                        className="h-8 cursor-pointer rounded-md border border-input bg-card px-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <option value="student">student</option>
                        <option value="faculty">faculty</option>
                        <option value="admin">admin</option>
                      </select>
                    )}
                  </td>
                  <td className="py-2.5 pr-4">
                    {!u.face_enrolled ? (
                      <span className="text-xs text-muted-foreground">
                        Not enrolled
                      </span>
                    ) : resettingId === u.id ? (
                      <LoaderCircle
                        className="size-4 animate-spin text-muted-foreground"
                        aria-label="Resetting face enrolment"
                      />
                    ) : confirmId === u.id ? (
                      <span className="flex items-center gap-1.5">
                        <Button
                          size="sm"
                          variant="destructive"
                          className="h-7 px-2 text-xs"
                          onClick={() => resetFace(u.id)}
                        >
                          Confirm reset
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs"
                          onClick={() => setConfirmId(null)}
                        >
                          Cancel
                        </Button>
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <Badge variant="secondary">
                          <ScanFace className="size-3" aria-hidden="true" />
                          Enrolled
                        </Badge>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs"
                          onClick={() => setConfirmId(u.id)}
                          aria-label={`Reset face enrolment for ${u.full_name}`}
                        >
                          <RotateCcw className="size-3" aria-hidden="true" />
                          Reset
                        </Button>
                      </span>
                    )}
                  </td>
                  <td className="py-2.5">
                    {pwUserId === u.id ? (
                      <form
                        className="flex items-center gap-1.5"
                        onSubmit={(e) => {
                          e.preventDefault();
                          savePassword(u);
                        }}
                      >
                        <Input
                          aria-label={`New password for ${u.full_name}`}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          minLength={8}
                          required
                          className="h-7 w-28 font-mono text-xs"
                        />
                        <Button size="sm" className="h-7 px-2 text-xs" disabled={pwSaving}>
                          {pwSaving ? <LoaderCircle className="size-3 animate-spin" aria-hidden="true" /> : "Save"}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs"
                          onClick={() => setPwUserId(null)}
                        >
                          Cancel
                        </Button>
                      </form>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-xs"
                        onClick={() => {
                          setPwUserId(u.id);
                          setNewPassword(tempPassword());
                        }}
                        aria-label={`Reset password for ${u.full_name}`}
                      >
                        <KeyRound className="size-3" aria-hidden="true" />
                        Reset
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
