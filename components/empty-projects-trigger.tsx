"use client";

import { useState } from "react";
import { FolderPlus } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { ProjectModal } from "@/components/project-modal";

export function EmptyProjectsTrigger() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <EmptyState
        icon={FolderPlus}
        title="No projects configured yet"
        description="Connect your first API target or OpenAPI spec to generate tests, run automated verification, and track security insights."
        actionLabel="Create Project"
        onAction={() => setOpen(true)}
      />
      <ProjectModal open={open} onOpenChange={setOpen} mode="create" />
    </>
  );
}
