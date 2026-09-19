import {
  FolderGit2,
  PlayCircle,
  CheckCircle2,
  Percent,
  Clock,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";
import { Navbar } from "@/components/navbar";
import { ProjectCard } from "@/components/project-card";
import { DashboardActions } from "@/components/dashboard-actions";
import { EmptyProjectsTrigger } from "@/components/empty-projects-trigger";
import { requireAuth } from "@/lib/auth";
import { getDashboardMetrics } from "@/lib/services/project";

export default async function DashboardPage() {
  const user = await requireAuth("/dashboard");
  const metrics = await getDashboardMetrics(user.id);

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 text-zinc-100 selection:bg-zinc-800 selection:text-white">
      <Navbar user={user} />

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        {/* Page Header */}
        <div className="flex flex-col justify-between gap-4 border-b border-zinc-800/80 pb-6 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-zinc-500">
              <span>WORKSPACE</span>
              <span>/</span>
              <span className="text-zinc-300 font-medium">OVERVIEW</span>
            </div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">
              Engineering Dashboard
            </h1>
            <p className="mt-0.5 text-xs text-zinc-400">
              Real-time telemetry and API test coverage across your services.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <DashboardActions />
          </div>
        </div>

        {/* Real Metrics Row */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {/* Stat 1: Projects */}
          <div className="rounded-lg border border-zinc-800/80 bg-zinc-900/40 p-4">
            <div className="flex items-center justify-between text-zinc-400">
              <span className="text-xs font-medium">Active Projects</span>
              <FolderGit2 className="h-3.5 w-3.5 text-zinc-500" />
            </div>
            <div className="mt-2 text-2xl font-semibold tracking-tight text-white">
              {metrics.projectCount}
            </div>
            <p className="mt-1 text-[11px] text-zinc-500">
              {metrics.projectCount === 1 ? "1 service target" : `${metrics.projectCount} service targets`}
            </p>
          </div>

          {/* Stat 2: Total Test Runs */}
          <div className="rounded-lg border border-zinc-800/80 bg-zinc-900/40 p-4">
            <div className="flex items-center justify-between text-zinc-400">
              <span className="text-xs font-medium">Test Runs</span>
              <PlayCircle className="h-3.5 w-3.5 text-zinc-500" />
            </div>
            <div className="mt-2 text-2xl font-semibold tracking-tight text-white">
              {metrics.totalTestRuns}
            </div>
            <p className="mt-1 text-[11px] text-zinc-500">
              {metrics.totalTestRuns === 0 ? "No runs recorded" : "Across all targets"}
            </p>
          </div>

          {/* Stat 3: Total Tests Executed */}
          <div className="rounded-lg border border-zinc-800/80 bg-zinc-900/40 p-4">
            <div className="flex items-center justify-between text-zinc-400">
              <span className="text-xs font-medium">Tests Executed</span>
              <CheckCircle2 className="h-3.5 w-3.5 text-zinc-500" />
            </div>
            <div className="mt-2 text-2xl font-semibold tracking-tight text-white">
              {metrics.totalTestsExecuted}
            </div>
            <p className="mt-1 text-[11px] text-zinc-500">
              {metrics.totalTestsExecuted === 0 ? "Zero assertions run" : "Total assertions"}
            </p>
          </div>

          {/* Stat 4: Overall Pass Rate */}
          <div className="rounded-lg border border-zinc-800/80 bg-zinc-900/40 p-4">
            <div className="flex items-center justify-between text-zinc-400">
              <span className="text-xs font-medium">Pass Rate</span>
              <Percent className="h-3.5 w-3.5 text-zinc-500" />
            </div>
            <div className="mt-2 text-2xl font-semibold tracking-tight text-white">
              {metrics.totalTestsExecuted > 0
                ? `${metrics.overallPassRate}%`
                : "—"}
            </div>
            <p className="mt-1 text-[11px] text-zinc-500">
              {metrics.totalTestsExecuted > 0
                ? "Calculated from completed runs"
                : "No run data available"}
            </p>
          </div>
        </div>

        {/* Projects Section */}
        <section className="mt-10">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-zinc-100">
                Connected Projects
              </h2>
              <p className="text-xs text-zinc-400">
                API targets configured for automated verification and security inspection.
              </p>
            </div>
            {metrics.projects.length > 0 && (
              <span className="font-mono text-xs text-zinc-500">
                {metrics.projects.length}{" "}
                {metrics.projects.length === 1 ? "project" : "projects"}
              </span>
            )}
          </div>

          <div className="mt-4">
            {metrics.projects.length === 0 ? (
              <EmptyProjectsTrigger />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {metrics.projects.map((proj) => (
                  <ProjectCard key={proj.id} project={proj} />
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Activity & Insights Columns */}
        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          {/* Recent Test Runs */}
          <div className="rounded-lg border border-zinc-800/80 bg-zinc-900/30 p-5">
            <div className="flex items-center justify-between border-b border-zinc-800/60 pb-3">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-zinc-400" />
                <h3 className="text-xs font-semibold text-zinc-200">
                  Recent Test Runs
                </h3>
              </div>
              <span className="font-mono text-[11px] text-zinc-500">
                Latest 5
              </span>
            </div>

            <div className="mt-4">
              {metrics.recentRuns.length === 0 ? (
                <div className="py-8 text-center">
                  <PlayCircle className="mx-auto h-6 w-6 text-zinc-600" />
                  <p className="mt-2 text-xs font-medium text-zinc-300">
                    No test runs executed yet
                  </p>
                  <p className="mt-1 text-[11px] text-zinc-500">
                    Test execution will be available once suites are configured in the next phase.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-zinc-800/60 font-mono text-xs">
                  {metrics.recentRuns.map((run) => (
                    <div
                      key={run.id}
                      className="flex items-center justify-between py-2.5"
                    >
                      <div>
                        <div className="text-zinc-200">{run.project.name}</div>
                        <div className="text-[11px] text-zinc-500">
                          {run.passed} passed • {run.failed} failed
                        </div>
                      </div>
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] uppercase ${
                          run.status === "COMPLETED"
                            ? "bg-emerald-500/10 text-emerald-400"
                            : run.status === "FAILED"
                            ? "bg-rose-500/10 text-rose-400"
                            : "bg-zinc-800 text-zinc-400"
                        }`}
                      >
                        {run.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Security & Intelligence Telemetry */}
          <div className="rounded-lg border border-zinc-800/80 bg-zinc-900/30 p-5">
            <div className="flex items-center justify-between border-b border-zinc-800/60 pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
                <h3 className="text-xs font-semibold text-zinc-200">
                  Security & Vulnerability Feed
                </h3>
              </div>
              <span className="font-mono text-[11px] text-zinc-500">
                Audit Status
              </span>
            </div>

            <div className="mt-4">
              {metrics.recentFindings.length === 0 ? (
                <div className="py-8 text-center">
                  <AlertTriangle className="mx-auto h-6 w-6 text-zinc-600" />
                  <p className="mt-2 text-xs font-medium text-zinc-300">
                    No security vulnerabilities detected
                  </p>
                  <p className="mt-1 text-[11px] text-zinc-500">
                    Automated security inspection and OWASP scanning will trigger in the scanning engine phase.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-zinc-800/60 font-mono text-xs">
                  {metrics.recentFindings.map((finding) => (
                    <div
                      key={finding.id}
                      className="flex items-center justify-between py-2.5"
                    >
                      <div>
                        <div className="text-zinc-200">{finding.title}</div>
                        <div className="text-[11px] text-zinc-500">
                          {finding.endpoint}
                        </div>
                      </div>
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] uppercase ${
                          finding.severity === "CRITICAL"
                            ? "bg-rose-500/10 text-rose-400"
                            : finding.severity === "HIGH"
                            ? "bg-amber-500/10 text-amber-400"
                            : "bg-zinc-800 text-zinc-400"
                        }`}
                      >
                        {finding.severity}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
