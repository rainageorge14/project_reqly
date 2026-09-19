import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getProjectById } from "@/lib/services/project";
import { db } from "@/lib/db";
import { parseAndNormalizeOpenApi } from "@/lib/openapi";
import { generateTestCasesFromEndpoints } from "@/lib/ai";
import { saveGeneratedTestCases } from "@/lib/services/test-case";

interface RouteParams {
  params: Promise<{ projectId: string }>;
}

export async function POST(req: Request, { params }: RouteParams) {
  // 1. Verify authentication
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { success: false, error: "Unauthorized", code: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  const { projectId } = await params;

  try {
    // 2. Verify project ownership
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

    // 3. Verify server-side AI configuration
    const apiKey = process.env.AI_API_KEY;
    if (!apiKey || apiKey.trim() === "") {
      return NextResponse.json(
        {
          success: false,
          error:
            "Google Gemini API key (AI_API_KEY) is not configured. Please configure AI_API_KEY in .env.local.",
          code: "MISSING_AI_CONFIG",
        },
        { status: 500 }
      );
    }

    // Parse options from request body (e.g. clearExisting)
    let clearExisting = true;
    try {
      const body = await req.json();
      if (body && typeof body.clearExisting === "boolean") {
        clearExisting = body.clearExisting;
      }
    } catch {
      // Body is optional; default to replacing existing suite for a clean run
      clearExisting = true;
    }

    // 4. Retrieve imported OpenAPI specification
    const spec = await db.apiSpec.findFirst({
      where: { projectId },
      orderBy: { createdAt: "desc" },
    });

    if (!spec || !spec.content || spec.content.trim() === "") {
      return NextResponse.json(
        {
          success: false,
          error:
            "No OpenAPI specification found for this project. Please import a valid OpenAPI 3.x specification first before generating test cases.",
          code: "MISSING_SPECIFICATION",
        },
        { status: 400 }
      );
    }

    // 5. Parse and normalize OpenAPI specification
    const parseResult = parseAndNormalizeOpenApi(spec.content);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: `Failed to parse stored OpenAPI specification: ${parseResult.error.message}`,
          code: "INVALID_SPECIFICATION",
        },
        { status: 400 }
      );
    }

    const { endpoints, title, version } = parseResult.result;
    if (!endpoints || endpoints.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error:
            "The imported OpenAPI specification does not define any endpoints to test.",
          code: "NO_ENDPOINTS",
        },
        { status: 400 }
      );
    }

    // 6. Invoke Google Gemini AI engine
    const generationResult = await generateTestCasesFromEndpoints(endpoints, {
      apiTitle: title || project.name,
      apiVersion: version,
      baseUrl: project.baseUrl,
    });

    if (!generationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: generationResult.error || "AI generation failed.",
          code: "AI_GENERATION_FAILED",
          warnings: generationResult.warnings,
        },
        { status: 502 }
      );
    }

    // 7. Persist valid test cases into database using existing Prisma TestCase model
    const saved = await saveGeneratedTestCases(
      projectId,
      session.id,
      generationResult.testCases,
      {
        clearExisting,
        modelName: process.env.AI_MODEL || "gemini-1.5-pro",
      }
    );

    return NextResponse.json(
      {
        success: true,
        count: saved.count,
        testCases: saved.testCases,
        stats: saved.stats,
        warnings: generationResult.warnings,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("AI test case generation error:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred during AI test generation.",
        code: "INTERNAL_ERROR",
      },
      { status: 500 }
    );
  }
}
