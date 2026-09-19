"use client";

import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProjectModal } from "@/components/project-modal";
import { DeleteProjectDialog } from "@/components/delete-project-dialog";

interface ProjectWorkspaceActionsProps {
  project: {
    id: string;
    name: string;
    description: string | null;
    baseUrl: string;
  };
}

export function ProjectWorkspaceActions({
  project,
}: ProjectWorkspaceActionsProps) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setEditOpen(true)}
        className="h-8 border-zinc-800 bg-zinc-900/60 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-white"
      >
        <Pencil className="mr-1.5 h-3.5 w-3.5 text-zinc-400" />
        Edit Project
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setDeleteOpen(true)}
        className="h-8 border-zinc-800 bg-zinc-900/60 text-xs text-red-400 hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-300"
      >
        <Trash2 className="mr-1.5 h-3.5 w-3.5" />
        Delete
      </Button>

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
    </div>
  );
}
