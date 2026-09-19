import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { projectSchema } from "@/lib/validations/project";
import {
  getProjectById,
  updateProject,
  deleteProject,
} from "@/lib/services/project";

interface RouteParams {
  params: Promise<{ projectId: string }>;
}

export async function GET(_req: Request, { params }: RouteParams) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { projectId } = await params;

  try {
    const project = await getProjectById(projectId, session.id);
    if (!project) {
      return NextResponse.json(
        { error: "Project not found or access denied" },
        { status: 404 }
      );
    }

    return NextResponse.json({ project });
  } catch (error) {
    console.error("Error fetching project:", error);
    return NextResponse.json(
      { error: "Failed to fetch project" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request, { params }: RouteParams) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { projectId } = await params;

  try {
    const json = await req.json();
    const result = projectSchema.safeParse(json);

    if (!result.success) {
      const issue = result.error.issues[0];
      return NextResponse.json(
        { error: issue?.message || "Invalid project details" },
        { status: 400 }
      );
    }

    const updated = await updateProject(projectId, session.id, result.data);
    return NextResponse.json({ success: true, project: updated });
  } catch (error) {
    console.error("Error updating project:", error);
    return NextResponse.json(
      { error: "Project not found or unauthorized to update" },
      { status: 404 }
    );
  }
}

export async function DELETE(_req: Request, { params }: RouteParams) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { projectId } = await params;

  try {
    await deleteProject(projectId, session.id);
    return NextResponse.json({ success: true, message: "Project deleted" });
  } catch (error) {
    console.error("Error deleting project:", error);
    return NextResponse.json(
      { error: "Project not found or unauthorized to delete" },
      { status: 404 }
    );
  }
}
