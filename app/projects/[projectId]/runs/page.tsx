import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { getProjectById } from "@/lib/services/project";
import { getProjectTestCases } from "@/lib/services/test-case";
import { getProjectTestRuns } from "@/lib/services/test-run";
import { TestRunsClient } from "@/components/test-runs-client";

interface RunsPageProps {
  params: Promise<{ projectId: string }>;
}

export default async function ProjectRunsPage({ params }: RunsPageProps) {
  const user = await requireAuth();
  const { projectId } = await params;

  const project = await getProjectById(projectId, user.id);
  if (!project) {
    notFound();
  }

  // Load available test cases and past execution runs
  const [testData, runs] = await Promise.all([
    getProjectTestCases(projectId, user.id),
    getProjectTestRuns(projectId, user.id, 20),
  ]);

  return (
    <TestRunsClient
      projectId={projectId}
      baseUrl={project.baseUrl}
      initialRuns={runs || []}
      availableTestCases={testData?.testCases || []}
    />
  );
}
