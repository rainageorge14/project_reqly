import { notFound } from "next/navigation";
import Link from "next/link";
import {
  Sparkles,
  Info,
  AlertTriangle,
  Wrench,
  ArrowRight,
} from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { requireAuth } from "@/lib/auth";
import { getProjectById } from "@/lib/services/project";
import { getProjectTestRuns } from "@/lib/services/test-run";

interface AiAnalysisPageProps {
  params: Promise<{ projectId: string }>;
}

function getConfidenceBadge(confidence: "LOW" | "MEDIUM" | "HIGH") {
  switch (confidence) {
    case "HIGH":
      return "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
    case "MEDIUM":
      return "bg-amber-500/10 text-amber-400 border-amber-500/30";
    case "LOW":
    default:
      return "bg-zinc-500/10 text-zinc-400 border-zinc-500/30";
  }
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

  const runs = (await getProjectTestRuns(projectId, user.id, 20)) || [];
  const analyzedRuns = runs.filter((r) => r.aiAnalysis);
  const unanalyzedFailedRuns = runs.filter((r) => r.failed > 0 && !r.aiAnalysis);

  return (
    <div className="space-y-6">
      {/* Information Banner */}
      <div className="flex items-start gap-3 rounded-lg border border-zinc-800/80 bg-zinc-900/30 p-4 text-xs text-zinc-400">
        <Info className="h-4 w-4 shrink-0 text-zinc-500 mt-0.5" />
        <div>
          <span className="font-medium text-zinc-200">
            AI Failure Intelligence & Root Cause Engine
          </span>
          <p className="mt-0.5 leading-relaxed">
            Gemini AI analyzes observed HTTP failure codes, response latencies,
            and error traces to correlate exact root causes and suggest developer
            remediation fixes.
          </p>
        </div>
      </div>

      {/* Unanalyzed Failures Notification */}
      {unanalyzedFailedRuns.length > 0 && (
        <div className="flex items-center justify-between rounded-lg border border-amber-500/30 bg-amber-950/10 p-4 text-xs">
          <div className="flex items-center gap-2.5 text-amber-300">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
            <span>
              {unanalyzedFailedRuns.length} test run(s) with failures are waiting
              for AI diagnostic analysis.
            </span>
          </div>
          <Link href={`/projects/${projectId}/runs`}>
            <Button
              size="sm"
              variant="outline"
              className="border-amber-500/30 text-amber-300 hover:bg-amber-500/10 text-xs h-7 gap-1"
            >
              Go to Test Runs <ArrowRight className="h-3 w-3" />
            </Button>
          </Link>
        </div>
      )}

      {/* Analyzed Reports Ledger */}
      {analyzedRuns.length > 0 ? (
        <div className="space-y-6">
          <h2 className="text-sm font-semibold text-zinc-200">
            Recent Failure Diagnoses ({analyzedRuns.length})
          </h2>

          <div className="space-y-4">
            {analyzedRuns.map((run) => {
              const analysis = run.aiAnalysis!;
              return (
                <div
                  key={run.id}
                  className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-5 space-y-4"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-zinc-800/60 pb-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Sparkles className="h-4 w-4 text-indigo-400" />
                      <span className="text-xs font-semibold text-zinc-200">
                        Run on {new Date(run.createdAt).toLocaleString()}
                      </span>
                      <Badge
                        variant="outline"
                        className="border-indigo-500/30 bg-indigo-500/10 text-indigo-300 font-mono text-[10px]"
                      >
                        {analysis.category}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={`text-[10px] font-mono uppercase ${getConfidenceBadge(
                          analysis.confidence
                        )}`}
                      >
                        {analysis.confidence} Confidence
                      </Badge>
                    </div>

                    <Link href={`/projects/${projectId}/runs`}>
                      <span className="text-xs text-indigo-400 hover:underline font-mono">
                        View Run Details →
                      </span>
                    </Link>
                  </div>

                  {/* Summary */}
                  <div className="text-xs leading-relaxed text-zinc-300 bg-zinc-950/60 p-3 rounded-lg border border-zinc-800/60">
                    {analysis.summary}
                  </div>

                  {/* Causes & Fixes */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div className="rounded-lg border border-zinc-800/60 bg-zinc-950/40 p-3.5 space-y-1.5">
                      <span className="font-semibold text-zinc-300 flex items-center gap-1.5">
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                        Possible Causes
                      </span>
                      <ul className="space-y-1 text-zinc-400">
                        {analysis.possibleCauses.map((c, i) => (
                          <li key={i} className="flex items-start gap-1.5">
                            <span className="text-indigo-400 mt-0.5">•</span>
                            <span>{c}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="rounded-lg border border-zinc-800/60 bg-zinc-950/40 p-3.5 space-y-1.5">
                      <span className="font-semibold text-zinc-300 flex items-center gap-1.5">
                        <Wrench className="h-3.5 w-3.5 text-emerald-400" />
                        Recommended Fixes
                      </span>
                      <ul className="space-y-1 text-zinc-300">
                        {analysis.recommendedFixes.map((f, i) => (
                          <li key={i} className="flex items-start gap-1.5">
                            <span className="text-emerald-400 mt-0.5">✓</span>
                            <span>{f}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Evidence */}
                  {analysis.evidence.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <span className="text-[10px] uppercase font-semibold text-zinc-500 mr-1">
                        Observed Evidence:
                      </span>
                      {analysis.evidence.map((ev, i) => (
                        <span
                          key={i}
                          className="rounded bg-zinc-950 px-2 py-0.5 font-mono text-[11px] text-zinc-400 border border-zinc-800"
                        >
                          {ev}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Empty State */
        <EmptyState
          icon={Sparkles}
          title="No failure intelligence reports generated"
          description="When test suites encounter failures, click 'Analyze Failures' in the test runs view to diagnose root causes and recommended fixes."
          secondaryAction={
            <Link href={`/projects/${projectId}/runs`}>
              <Button
                variant="outline"
                size="sm"
                className="border-zinc-800 text-xs gap-1.5"
              >
                Go to Test Runs <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          }
        />
      )}
    </div>
  );
}
