import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { getProjectById } from "@/lib/services/project";
import { getProjectTestCases } from "@/lib/services/test-case";
import { db } from "@/lib/db";
import { parseAndNormalizeOpenApi } from "@/lib/openapi";
import { TestCasesClient } from "@/components/test-cases-client";

interface TestsPageProps {
  params: Promise<{ projectId: string }>;
}

export default async function ProjectTestsPage({ params }: TestsPageProps) {
  const user = await requireAuth();
  const { projectId } = await params;

  const project = await getProjectById(projectId, user.id);
  if (!project) {
    notFound();
  }

  // Load active OpenAPI specification to check readiness
  const spec = await db.apiSpec.findFirst({
    where: { projectId },
    orderBy: { createdAt: "desc" },
  });

  let hasSpec = false;
  let specTitle: string | undefined;
  let specEndpointCount: number | undefined;

  if (spec && spec.content) {
    const parsed = parseAndNormalizeOpenApi(spec.content);
    if (parsed.success) {
      hasSpec = true;
      specTitle = parsed.result.title;
      specEndpointCount = parsed.result.endpoints.length;
    }
  }

  // Load real saved test cases and compute real statistics
  const testData = await getProjectTestCases(projectId, user.id);

  const initialTestCases = testData?.testCases || [];
  const initialStats = testData?.stats || {
    total: 0,
    aiGenerated: 0,
    manual: 0,
    byCategory: {
      Functional: 0,
      Validation: 0,
      "Edge Case": 0,
      Authentication: 0,
      Authorization: 0,
    },
    byMethod: {},
    categories: [],
  };

  return (
    <TestCasesClient
      projectId={projectId}
      initialTestCases={initialTestCases}
      initialStats={initialStats}
      hasSpec={hasSpec}
      specTitle={specTitle}
      specEndpointCount={specEndpointCount}
    />
  );
}
