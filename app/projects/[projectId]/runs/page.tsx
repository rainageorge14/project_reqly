import { notFound } from "next/navigation";
import { PlayCircle, Info } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { requireAuth } from "@/lib/auth";
import { getProjectById } from "@/lib/services/project";

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

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3 rounded-lg border border-zinc-800/80 bg-zinc-900/30 p-4 text-xs text-zinc-400">
        <Info className="h-4 w-4 shrink-0 text-zinc-500 mt-0.5" />
        <div>
          <span className="font-medium text-zinc-200">Execution History</span>
          <p className="mt-0.5 leading-relaxed">
            Historical test runs, assertion latencies, pass/fail breakdowns, and
            status codes will be cataloged here once test execution is wired in.
          </p>
        </div>
      </div>

      <EmptyState
        icon={PlayCircle}
        title="No test runs recorded"
        description="Run your first verification batch once test suites are initialized to see execution metrics and timelines."
        secondaryAction={
          <div className="rounded border border-zinc-800 bg-zinc-950 px-3 py-1.5 font-mono text-[11px] text-zinc-500">
            Execution Runner • Scheduled for Phase 3
          </div>
        }
      />
    </div>
  );
}
