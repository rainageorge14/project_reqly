import { notFound } from "next/navigation";
import { Sparkles, Info } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { requireAuth } from "@/lib/auth";
import { getProjectById } from "@/lib/services/project";

interface AiAnalysisPageProps {
  params: Promise<{ projectId: string }>;
}

export default async function ProjectAiAnalysisPage({
  params,
}: AiAnalysisPageProps) {
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
          <span className="font-medium text-zinc-200">
            Failure Intelligence & Root Cause Analysis
          </span>
          <p className="mt-0.5 leading-relaxed">
            When API tests fail, the AI engine correlates payload diffs, HTTP
            headers, and error traces to hypothesize exact regression causes.
          </p>
        </div>
      </div>

      <EmptyState
        icon={Sparkles}
        title="No failure intelligence reports generated"
        description="Run test suites with failures to trigger automated root-cause explanations and remediation suggestions."
        secondaryAction={
          <div className="rounded border border-zinc-800 bg-zinc-950 px-3 py-1.5 font-mono text-[11px] text-zinc-500">
            AI Failure Analysis Engine • Ready for Intelligence Phase
          </div>
        }
      />
    </div>
  );
}
