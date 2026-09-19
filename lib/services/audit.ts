import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";

export async function logAudit({
  userId,
  action,
  metadata,
}: {
  userId?: string | null;
  action: string;
  metadata?: Prisma.InputJsonValue;
}) {
  try {
    await db.auditLog.create({
      data: {
        userId: userId ?? null,
        action,
        metadata: metadata ?? Prisma.JsonNull,
      },
    });
  } catch (err) {
    // Non-blocking: audit logging failures should not break user operations
    console.error("Failed to write audit log:", err);
  }
}
