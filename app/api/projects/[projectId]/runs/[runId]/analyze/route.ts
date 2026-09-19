import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  analyzeTestRunFailures,
  NoFailuresError,
} from "@/lib/services/failure-analysis";

interface RouteParams {
  params: Promise<{ projectId: string; runId: string }>;
}

export async function POST(_req: Request, { params }: RouteParams) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { success: false, error: "Unauthorized", code: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  const { projectId, runId } = await params;

  try {
    const analysis = await analyzeTestRunFailures(
      projectId,
      runId,
      session.id
    );

    return NextResponse.json(
      {
        success: true,
        analysis,
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    console.error("AI failure analysis error:", error);

    if (error instanceof NoFailuresError) {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
          code: "NO_FAILURES",
        },
        { status: 400 }
      );
    }

    const message =
      error instanceof Error ? error.message : "Unknown error during failure analysis.";

    const isNotFound =
      message.includes("not found") || message.includes("access denied");

    const isRateLimit =
      message.includes("429") ||
      message.includes("quota") ||
      message.includes("rate limit") ||
      message.includes("ResourceExhausted");

    if (isNotFound) {
      return NextResponse.json(
        {
          success: false,
          error: message,
          code: "NOT_FOUND",
        },
        { status: 404 }
      );
    }

    if (isRateLimit) {
      return NextResponse.json(
        {
          success: false,
          error:
            "AI service rate limit or quota exceeded. Please wait a moment and try again.",
          code: "RATE_LIMIT_EXCEEDED",
        },
        { status: 429 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: message,
        code: "INTERNAL_ERROR",
      },
      { status: 500 }
    );
  }
}
