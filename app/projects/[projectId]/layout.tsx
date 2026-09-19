import { notFound } from "next/navigation";
import Link from "next/link";
import { Globe, Calendar, ArrowLeft } from "lucide-react";
import { Navbar } from "@/components/navbar";
import { ProjectWorkspaceActions } from "@/components/project-workspace-actions";
import { ProjectWorkspaceTabs } from "@/components/project-workspace-tabs";
import { requireAuth } from "@/lib/auth";
import { getProjectById } from "@/lib/services/project";

interface ProjectLayoutProps {
  children: React.ReactNode;
  params: Promise<{ projectId: string }>;
}

export default async function ProjectLayout({
  children,
  params,
}: ProjectLayoutProps) {
  const user = await requireAuth();
  const { projectId } = await params;

  const project = await getProjectById(projectId, user.id);
  if (!project) {
    notFound();
  }

  const createdDate = new Date(project.createdAt).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 text-zinc-100 selection:bg-zinc-800 selection:text-white">
      <Navbar user={user} />

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
        {/* Breadcrumb */}
        <div className="mb-4">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <ArrowLeft className="h-3 w-3" />
            Back to Dashboard
          </Link>
        </div>

        {/* Project Header */}
        <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/30 p-6">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
            <div className="space-y-1.5">
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-semibold tracking-tight text-white">
                  {project.name}
                </h1>
                <span className="rounded border border-zinc-800 bg-zinc-900 px-2 py-0.5 text-[11px] font-mono text-zinc-400">
                  ID: {project.id.slice(0, 8)}
                </span>
              </div>

              <p className="max-w-2xl text-xs leading-relaxed text-zinc-400">
                {project.description || "No description provided for this project."}
              </p>

              {/* Metadata row */}
              <div className="flex flex-wrap items-center gap-4 pt-2 text-xs text-zinc-400">
                <div className="flex items-center gap-1.5 font-mono text-zinc-300">
                  <Globe className="h-3.5 w-3.5 text-zinc-500" />
                  <span className="rounded border border-zinc-800/80 bg-zinc-950 px-2 py-0.5">
                    {project.baseUrl}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-zinc-500">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>Created on {createdDate}</span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <ProjectWorkspaceActions project={project} />
          </div>

          {/* Navigation Tabs */}
          <div className="mt-6">
            <ProjectWorkspaceTabs projectId={project.id} />
          </div>
        </div>

        {/* Tab Content */}
        <div className="mt-6">{children}</div>
      </main>
    </div>
  );
}
