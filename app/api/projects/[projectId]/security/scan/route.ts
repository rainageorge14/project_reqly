import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getProjectById } from "@/lib/services/project";
import {
  runProjectSecurityScan,
  getProjectSecurityOverview,
} from "@/lib/services/security";

interface RouteParams {
  params: Promise<{ projectId: string }>;
}

export async function POST(_req: Request, { params }: RouteParams) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { success: false, error: "Unauthorized", code: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  const { projectId } = await params;

  try {
    const project = await getProjectById(projectId, session.id);
    if (!project) {
      return NextResponse.json(
        {
          success: false,
          error: "Project not found or access denied.",
          code: "NOT_FOUND",
        },
        { status: 404 }
      );
    }

    const { summary, findings } = await runProjectSecurityScan(
      projectId,
      session.id
    );

    return NextResponse.json(
      {
        success: true,
        summary,
        findings,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Security scan execution error:", error);
    const message =
      error instanceof Error ? error.message : "Unknown execution error.";
    const isValidationError =
      message.includes("base URL") ||
      message.includes("OpenAPI") ||
      message.includes("specification");

    return NextResponse.json(
      {
        success: false,
        error: message,
        code: isValidationError ? "BAD_REQUEST" : "INTERNAL_ERROR",
      },
      { status: isValidationError ? 400 : 500 }
    );
  }
}

export async function GET(_req: Request, { params }: RouteParams) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { success: false, error: "Unauthorized", code: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  const { projectId } = await params;

  try {
    const overview = await getProjectSecurityOverview(projectId, session.id);
    if (!overview) {
      return NextResponse.json(
        {
          success: false,
          error: "Project not found or access denied.",
          code: "NOT_FOUND",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: overview }, { status: 200 });
  } catch (error) {
    console.error("Fetch security overview error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal error",
        code: "INTERNAL_ERROR",
      },
      { status: 500 }
    );
  }
}
