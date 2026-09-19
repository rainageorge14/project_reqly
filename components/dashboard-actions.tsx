"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProjectModal } from "@/components/project-modal";

export function DashboardActions() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        size="sm"
        onClick={() => setOpen(true)}
        className="h-8 bg-zinc-100 text-xs font-medium text-zinc-950 hover:bg-zinc-200"
      >
        <Plus className="mr-1.5 h-3.5 w-3.5" />
        New Project
      </Button>
      <ProjectModal open={open} onOpenChange={setOpen} mode="create" />
    </>
  );
}
