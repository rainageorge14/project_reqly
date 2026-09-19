import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { updateFindingStatus } from "@/lib/services/security";
import { SecurityStatus } from "@prisma/client";

interface RouteParams {
  params: Promise<{ projectId: string; findingId: string }>;
}

const updateStatusSchema = z.object({
  status: z.enum(["OPEN", "RESOLVED", "MUTED"]),
});

export async function PATCH(req: Request, { params }: RouteParams) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { success: false, error: "Unauthorized", code: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  const { projectId, findingId } = await params;

  try {
    const body = await req.json();
    const parsed = updateStatusSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid status. Allowed values: OPEN, RESOLVED, MUTED.",
          code: "VALIDATION_ERROR",
        },
        { status: 400 }
      );
    }

    const updated = await updateFindingStatus(
      findingId,
      projectId,
      session.id,
      parsed.data.status as SecurityStatus
    );

    return NextResponse.json(
      {
        success: true,
        finding: updated,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Update finding status error:", error);
    const message =
      error instanceof Error ? error.message : "Internal server error.";
    const isNotFound =
      message.includes("not found") || message.includes("unauthorized");

    return NextResponse.json(
      {
        success: false,
        error: message,
        code: isNotFound ? "NOT_FOUND" : "INTERNAL_ERROR",
      },
      { status: isNotFound ? 404 : 500 }
    );
  }
}
