import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { getProjectById } from "@/lib/services/project";
import { db } from "@/lib/db";
import { parseAndNormalizeOpenApi, NormalizedEndpoint, OpenApiStats } from "@/lib/openapi";
import { ProjectImportClient } from "@/components/project-import-client";

interface ImportPageProps {
  params: Promise<{ projectId: string }>;
}

export default async function ProjectImportPage({ params }: ImportPageProps) {
  const user = await requireAuth();
  const { projectId } = await params;

  const project = await getProjectById(projectId, user.id);
  if (!project) {
    notFound();
  }

  // Fetch the project's specification if already imported
  const spec = await db.apiSpec.findFirst({
    where: { projectId },
    orderBy: { createdAt: "desc" },
  });

  let initialSpec = null;
  let initialEndpoints: NormalizedEndpoint[] = [];
  let initialStats: OpenApiStats | null = null;

  if (spec) {
    const parsed = parseAndNormalizeOpenApi(spec.content);
    if (parsed.success) {
      initialSpec = {
        id: spec.id,
        title: spec.name,
        version: spec.version,
        openapiVersion: spec.openapiVersion,
      };
      initialEndpoints = parsed.result.endpoints;
      initialStats = parsed.result.stats;
    }
  }

  return (
    <div className="space-y-6">
      <ProjectImportClient
        projectId={project.id}
        initialSpec={initialSpec}
        initialEndpoints={initialEndpoints}
        initialStats={initialStats}
      />
    </div>
  );
}
