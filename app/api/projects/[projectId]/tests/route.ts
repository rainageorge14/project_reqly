import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getProjectTestCases, clearProjectTestCases } from "@/lib/services/test-case";

interface RouteParams {
  params: Promise<{ projectId: string }>;
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
    const data = await getProjectTestCases(projectId, session.id);
    if (!data) {
      return NextResponse.json(
        {
          success: false,
          error: "Project not found or access denied.",
          code: "NOT_FOUND",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      testCases: data.testCases,
      stats: data.stats,
    });
  } catch (error) {
    console.error("Error fetching test cases:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error fetching test cases.",
        code: "INTERNAL_ERROR",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(_req: Request, { params }: RouteParams) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { success: false, error: "Unauthorized", code: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  const { projectId } = await params;

  try {
    const result = await clearProjectTestCases(projectId, session.id);
    return NextResponse.json({
      success: true,
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    console.error("Error deleting test cases:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Internal server error deleting test cases.",
        code: "INTERNAL_ERROR",
      },
      { status: 500 }
    );
  }
}
