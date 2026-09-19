import Link from "next/link";
import { notFound } from "next/navigation";
import {
  FileCode2,
  ArrowRight,
  UploadCloud,
  Terminal,
  Tag,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { requireAuth } from "@/lib/auth";
import { getProjectById } from "@/lib/services/project";
import { db } from "@/lib/db";
import { parseAndNormalizeOpenApi } from "@/lib/openapi";

interface ProjectPageProps {
  params: Promise<{ projectId: string }>;
}

export default async function ProjectOverviewPage({ params }: ProjectPageProps) {
  const user = await requireAuth();
  const { projectId } = await params;

  const project = await getProjectById(projectId, user.id);
  if (!project) {
    notFound();
  }

  // Load project's active OpenAPI specification
  const spec = await db.apiSpec.findFirst({
    where: { projectId },
    orderBy: { createdAt: "desc" },
  });

  let parsedSpec = null;
  if (spec) {
    const parseResult = parseAndNormalizeOpenApi(spec.content);
    if (parseResult.success) {
      parsedSpec = parseResult.result;
    }
  }

  return (
    <div className="space-y-6">
      {/* Real Specification Telemetry Banner if imported */}
      {parsedSpec ? (
        <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-6">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-950 text-indigo-400">
                <FileCode2 className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-semibold text-zinc-100">
                    {parsedSpec.title}
                  </h2>
                  <Badge
                    variant="outline"
                    className="border-zinc-800 bg-zinc-950 font-mono text-xs text-zinc-300"
                  >
                    API v{parsedSpec.version}
                  </Badge>
                  <Badge
                    variant="outline"
                    className="border-emerald-500/30 bg-emerald-500/10 font-mono text-xs text-emerald-400"
                  >
                    OpenAPI {parsedSpec.openapiVersion}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-zinc-400">
                  {parsedSpec.description || "Specification loaded and verified."}
                </p>
              </div>
            </div>

            <Link href={`/projects/${project.id}/import`}>
              <Button
                size="sm"
                className="h-8 bg-zinc-100 text-xs font-medium text-zinc-950 hover:bg-zinc-200"
              >
                Explore Endpoints
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>

          {/* Real Metrics Row from Specification */}
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {/* Total Endpoints */}
            <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
              <div className="text-[11px] font-medium text-zinc-400">
                Total Endpoints
              </div>
              <div className="mt-1 text-xl font-semibold text-white">
                {parsedSpec.stats.totalEndpoints}
              </div>
              <div className="mt-0.5 text-[10px] text-zinc-500">
                Normalized routes
              </div>
            </div>

            {/* GET Endpoints */}
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
              <div className="text-[11px] font-mono font-medium text-emerald-400">
                GET
              </div>
              <div className="mt-1 text-xl font-semibold text-white">
                {parsedSpec.stats.getEndpoints}
              </div>
              <div className="mt-0.5 text-[10px] text-zinc-500">
                Read endpoints
              </div>
            </div>

            {/* POST Endpoints */}
            <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3">
              <div className="text-[11px] font-mono font-medium text-blue-400">
                POST
              </div>
              <div className="mt-1 text-xl font-semibold text-white">
                {parsedSpec.stats.postEndpoints}
              </div>
              <div className="mt-0.5 text-[10px] text-zinc-500">
                Creation actions
              </div>
            </div>

            {/* PUT/PATCH Endpoints */}
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
              <div className="text-[11px] font-mono font-medium text-amber-400">
                PUT / PATCH
              </div>
              <div className="mt-1 text-xl font-semibold text-white">
                {parsedSpec.stats.putPatchEndpoints}
              </div>
              <div className="mt-0.5 text-[10px] text-zinc-500">
                Update endpoints
              </div>
            </div>

            {/* DELETE Endpoints */}
            <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 p-3">
              <div className="text-[11px] font-mono font-medium text-rose-400">
                DELETE
              </div>
              <div className="mt-1 text-xl font-semibold text-white">
                {parsedSpec.stats.deleteEndpoints}
              </div>
              <div className="mt-0.5 text-[10px] text-zinc-500">
                Removal actions
              </div>
            </div>

            {/* Tags */}
            <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
              <div className="flex items-center gap-1 text-[11px] font-medium text-zinc-400">
                <Tag className="h-3 w-3 text-zinc-500" />
                API Tags
              </div>
              <div className="mt-1 text-xl font-semibold text-white">
                {parsedSpec.stats.tags.length}
              </div>
              <div className="mt-0.5 text-[10px] text-zinc-500">
                Functional groups
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Empty Spec Banner */
        <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/30 p-6">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-base font-semibold text-zinc-100">
                No OpenAPI Specification Imported
              </h2>
              <p className="mt-1 text-xs text-zinc-400">
                Import an OpenAPI 3.x specification file or paste raw content to
                discover endpoints and generate test coverage telemetry.
              </p>
            </div>
            <Link href={`/projects/${project.id}/import`}>
              <Button
                size="sm"
                className="h-8 bg-zinc-100 text-xs font-medium text-zinc-950 hover:bg-zinc-200"
              >
                <UploadCloud className="mr-1.5 h-3.5 w-3.5" />
                Import Specification
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* Workspace Cards */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* API Explorer Card */}
        <div className="rounded-lg border border-zinc-800/80 bg-zinc-900/30 p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileCode2 className="h-4 w-4 text-indigo-400" />
              <h3 className="text-sm font-semibold text-zinc-200">
                API Explorer
              </h3>
            </div>
            <Link href={`/projects/${project.id}/import`}>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-zinc-400 hover:text-white"
              >
                {parsedSpec ? "Open Explorer" : "Import Spec"}
                <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            </Link>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-zinc-400">
            {parsedSpec
              ? `Interactive explorer actively tracking ${parsedSpec.endpoints.length} routes across ${parsedSpec.stats.tags.length} tags.`
              : "Import an OpenAPI 3.x specification to view routes, request bodies, parameters, and response definitions."}
          </p>
          <div className="mt-4 rounded-md border border-zinc-800/80 bg-zinc-950/60 p-3">
            {parsedSpec ? (
              <div className="flex items-center justify-between font-mono text-xs text-zinc-300">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                  {parsedSpec.title}
                </span>
                <span className="text-zinc-500">v{parsedSpec.version}</span>
              </div>
            ) : (
              <div className="text-center text-xs text-zinc-500">
                No specification connected
              </div>
            )}
          </div>
        </div>

        {/* Verification Suites Card */}
        <div className="rounded-lg border border-zinc-800/80 bg-zinc-900/30 p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Terminal className="h-4 w-4 text-emerald-400" />
              <h3 className="text-sm font-semibold text-zinc-200">
                Test Suites
              </h3>
            </div>
            <Link href={`/projects/${project.id}/tests`}>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-zinc-400 hover:text-white"
              >
                View Tests
                <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            </Link>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-zinc-400">
            Automated test case synthesis and functional assertions against{" "}
            <span className="font-mono text-zinc-300">{project.baseUrl}</span>.
          </p>
          <div className="mt-4 rounded-md border border-zinc-800/80 bg-zinc-950/60 p-3">
            {project._count?.testCases && project._count.testCases > 0 ? (
              <div className="flex items-center justify-between font-mono text-xs text-zinc-300">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                  {project._count.testCases} Active Test Cases
                </span>
                <span className="text-indigo-400">AI Synthesized</span>
              </div>
            ) : (
              <div className="text-center text-xs text-zinc-500">
                No test cases generated yet
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
