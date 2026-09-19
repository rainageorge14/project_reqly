import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getProjectById } from "@/lib/services/project";
import { db } from "@/lib/db";
import { parseAndNormalizeOpenApi, MAX_SPEC_SIZE_BYTES } from "@/lib/openapi";
import { logAudit } from "@/lib/services/audit";

interface RouteParams {
  params: Promise<{ projectId: string }>;
}

export async function GET(_req: Request, { params }: RouteParams) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }

  const { projectId } = await params;

  try {
    const project = await getProjectById(projectId, session.id);
    if (!project) {
      return NextResponse.json(
        { success: false, error: "Project not found or access denied", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    const spec = await db.apiSpec.findFirst({
      where: { projectId },
      orderBy: { createdAt: "desc" },
    });

    if (!spec) {
      return NextResponse.json({
        success: true,
        spec: null,
        endpoints: [],
        stats: null,
      });
    }

    const parsed = parseAndNormalizeOpenApi(spec.content);
    if (!parsed.success) {
      // In unlikely event stored spec fails parsing
      return NextResponse.json({
        success: true,
        spec: {
          id: spec.id,
          title: spec.name,
          version: spec.version,
          openapiVersion: spec.openapiVersion,
          endpointCount: 0,
          createdAt: spec.createdAt,
        },
        endpoints: [],
        stats: null,
      });
    }

    return NextResponse.json({
      success: true,
      spec: {
        id: spec.id,
        title: spec.name,
        version: spec.version,
        openapiVersion: spec.openapiVersion || parsed.result.openapiVersion,
        endpointCount: parsed.result.endpoints.length,
        createdAt: spec.createdAt,
        updatedAt: spec.updatedAt,
      },
      stats: parsed.result.stats,
      endpoints: parsed.result.endpoints,
    });
  } catch (error) {
    console.error("Error fetching specification:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error fetching specification", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request, { params }: RouteParams) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }

  const { projectId } = await params;

  try {
    const project = await getProjectById(projectId, session.id);
    if (!project) {
      return NextResponse.json(
        { success: false, error: "Project not found or access denied", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    let content = "";
    let filenameHint: string | undefined = undefined;

    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;

      if (!file) {
        return NextResponse.json(
          { success: false, error: "No specification file was provided in the upload.", code: "EMPTY_CONTENT" },
          { status: 400 }
        );
      }

      filenameHint = file.name;
      const lowerName = file.name.toLowerCase();
      const hasValidExt =
        lowerName.endsWith(".json") ||
        lowerName.endsWith(".yaml") ||
        lowerName.endsWith(".yml");

      if (!hasValidExt) {
        return NextResponse.json(
          {
            success: false,
            error: "Unsupported file extension. Only .json, .yaml, and .yml files are accepted.",
            code: "UNSUPPORTED_EXTENSION",
          },
          { status: 400 }
        );
      }

      if (file.size > MAX_SPEC_SIZE_BYTES) {
        return NextResponse.json(
          {
            success: false,
            error: `File size exceeds the 5 MB limit (${(file.size / (1024 * 1024)).toFixed(2)} MB).`,
            code: "OVERSIZED_CONTENT",
          },
          { status: 400 }
        );
      }

      content = await file.text();
    } else {
      // JSON body: { content: string, filename?: string }
      const body = await req.json();
      if (!body || typeof body.content !== "string") {
        return NextResponse.json(
          { success: false, error: "Invalid request payload: 'content' string is required.", code: "EMPTY_CONTENT" },
          { status: 400 }
        );
      }
      content = body.content;
      filenameHint = typeof body.filename === "string" ? body.filename : undefined;
    }

    // Parse and normalize the OpenAPI specification
    const parsed = parseAndNormalizeOpenApi(content, filenameHint);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: parsed.error.message,
          code: parsed.error.code,
        },
        { status: 400 }
      );
    }

    // Persist to PostgreSQL (sensible re-import replacement behavior)
    const savedSpec = await db.$transaction(async (tx) => {
      // Replace existing specification for this project
      await tx.apiSpec.deleteMany({
        where: { projectId },
      });

      return tx.apiSpec.create({
        data: {
          projectId,
          name: parsed.result.title,
          version: parsed.result.version,
          openapiVersion: parsed.result.openapiVersion,
          content,
        },
      });
    });

    await logAudit({
      userId: session.id,
      action: "SPEC_IMPORT",
      metadata: {
        projectId,
        specId: savedSpec.id,
        title: parsed.result.title,
        version: parsed.result.version,
        openapiVersion: parsed.result.openapiVersion,
        endpointCount: parsed.result.endpoints.length,
      },
    });

    return NextResponse.json(
      {
        success: true,
        spec: {
          id: savedSpec.id,
          title: savedSpec.name,
          version: savedSpec.version,
          openapiVersion: savedSpec.openapiVersion,
          endpointCount: parsed.result.endpoints.length,
          createdAt: savedSpec.createdAt,
        },
        stats: parsed.result.stats,
        endpoints: parsed.result.endpoints,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error importing specification:", error);
    return NextResponse.json(
      {
        success: false,
        error: "An unexpected server error occurred while processing the specification.",
        code: "INTERNAL_ERROR",
      },
      { status: 500 }
    );
  }
}
