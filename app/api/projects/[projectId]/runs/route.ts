import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getProjectById } from "@/lib/services/project";
import {
  createAndExecuteTestRun,
  getProjectTestRuns,
} from "@/lib/services/test-run";

interface RouteParams {
  params: Promise<{ projectId: string }>;
}

export async function POST(req: Request, { params }: RouteParams) {
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

    let testCaseIds: string[] | undefined = undefined;
    try {
      const body = await req.json();
      if (body && Array.isArray(body.testCaseIds)) {
        testCaseIds = body.testCaseIds;
      }
    } catch {
      // Body is optional; executing all tests by default
    }

    const run = await createAndExecuteTestRun(projectId, session.id, {
      testCaseIds,
    });

    return NextResponse.json({ success: true, run }, { status: 201 });
  } catch (error) {
    console.error("Test execution error:", error);
    const message =
      error instanceof Error ? error.message : "Unknown execution error.";
    const isValidationError =
      message.includes("base URL") || message.includes("No test cases");

    return NextResponse.json(
      {
        success: false,
        error: message,
        code: isValidationError ? "VALIDATION_ERROR" : "INTERNAL_ERROR",
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
    const runs = await getProjectTestRuns(projectId, session.id);
    if (runs === null) {
      return NextResponse.json(
        {
          success: false,
          error: "Project not found or access denied.",
          code: "NOT_FOUND",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, runs });
  } catch (error) {
    console.error("Error fetching test runs:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error fetching test runs.",
        code: "INTERNAL_ERROR",
      },
      { status: 500 }
    );
  }
}
