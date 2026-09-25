import { prisma } from "../config/db";

export interface AuditActor {
  id: string;
  role: string;
}

/** Never throws: a failed audit write must not undo the action it records. */
export async function writeAudit(
  actor: AuditActor | null,
  action: string,
  entity: string,
  opts: { entityId?: string; summary: string; before?: unknown; after?: unknown } = { summary: "" }
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: actor?.id ?? null,
        actorRole: actor?.role ?? "system",
        action,
        entity,
        entityId: opts.entityId ?? null,
        summary: opts.summary.slice(0, 300),
        before: (opts.before ?? undefined) as never,
        after: (opts.after ?? undefined) as never,
      },
    });
  } catch (err) {
    console.error("[audit] failed to write", action, entity, err);
  }
}
