"use client";

import { useState } from "react";
import Link from "next/link";
import { Globe, MoreVertical, Pencil, Trash2, ArrowUpRight, FlaskConical, PlayCircle, ShieldAlert } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ProjectModal } from "@/components/project-modal";
import { DeleteProjectDialog } from "@/components/delete-project-dialog";

export interface ProjectCardData {
  id: string;
  name: string;
  description: string | null;
  baseUrl: string;
  createdAt: Date | string;
  _count?: {
    testCases: number;
    testRuns: number;
    securityFindings: number;
    apiSpecs?: number;
  };
}

interface ProjectCardProps {
  project: ProjectCardData;
}

export function ProjectCard({ project }: ProjectCardProps) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const formattedDate = new Date(project.createdAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <>
      <div className="group relative flex flex-col justify-between rounded-lg border border-zinc-800/80 bg-zinc-900/40 p-4 transition-all hover:border-zinc-700 hover:bg-zinc-900/70">
        <div>
          {/* Header */}
          <div className="flex items-start justify-between gap-2">
            <Link
              href={`/projects/${project.id}`}
              className="group/title flex items-center gap-1.5 focus:outline-none"
            >
              <h3 className="text-sm font-medium text-zinc-100 transition-colors group-hover/title:text-white">
                {project.name}
              </h3>
              <ArrowUpRight className="h-3.5 w-3.5 text-zinc-500 opacity-0 transition-opacity group-hover/title:opacity-100" />
            </Link>

            <DropdownMenu>
              <DropdownMenuTrigger className="flex h-6 w-6 items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 outline-none transition-colors">
                <MoreVertical className="h-3.5 w-3.5" />
                <span className="sr-only">Project options</span>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-36 border-zinc-800 bg-zinc-950 text-zinc-200"
              >
                <DropdownMenuItem
                  onClick={() => setEditOpen(true)}
                  className="cursor-pointer text-xs focus:bg-zinc-800 focus:text-white"
                >
                  <Pencil className="mr-2 h-3.5 w-3.5 text-zinc-400" />
                  Edit Project
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setDeleteOpen(true)}
                  className="cursor-pointer text-xs text-red-400 focus:bg-red-500/10 focus:text-red-300"
                >
                  <Trash2 className="mr-2 h-3.5 w-3.5" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Description */}
          <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-zinc-400">
            {project.description || "No description provided."}
          </p>

          {/* Base URL badge */}
          <div className="mt-3 flex items-center gap-1.5 rounded border border-zinc-800/80 bg-zinc-950/60 px-2 py-1 font-mono text-[11px] text-zinc-300">
            <Globe className="h-3 w-3 shrink-0 text-zinc-500" />
            <span className="truncate">{project.baseUrl}</span>
          </div>
        </div>

        {/* Footer info & stats */}
        <div className="mt-4 flex items-center justify-between border-t border-zinc-800/60 pt-3 text-[11px] text-zinc-500">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1" title="Test Cases">
              <FlaskConical className="h-3 w-3 text-zinc-400" />
              {project._count?.testCases ?? 0}
            </span>
            <span className="flex items-center gap-1" title="Test Runs">
              <PlayCircle className="h-3 w-3 text-zinc-400" />
              {project._count?.testRuns ?? 0}
            </span>
            <span className="flex items-center gap-1" title="Security Findings">
              <ShieldAlert className="h-3 w-3 text-zinc-400" />
              {project._count?.securityFindings ?? 0}
            </span>
          </div>
          <span>Created {formattedDate}</span>
        </div>
      </div>

      {/* Edit & Delete Dialogs */}
      <ProjectModal
        open={editOpen}
        onOpenChange={setEditOpen}
        mode="edit"
        initialData={{
          id: project.id,
          name: project.name,
          description: project.description,
          baseUrl: project.baseUrl,
        }}
      />
      <DeleteProjectDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        projectId={project.id}
        projectName={project.name}
      />
    </>
  );
}
