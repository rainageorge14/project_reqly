"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Trash2 } from "lucide-react";

interface DeleteProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectName: string;
  onDeleted?: () => void;
}

export function DeleteProjectDialog({
  open,
  onOpenChange,
  projectId,
  projectName,
  onDeleted,
}: DeleteProjectDialogProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to delete project");
        setLoading(false);
        return;
      }

      onOpenChange(false);
      if (onDeleted) {
        onDeleted();
      } else {
        router.push("/dashboard");
        router.refresh();
      }
    } catch {
      setError("An unexpected error occurred.");
      setLoading(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="border-zinc-800 bg-zinc-950 text-zinc-100 sm:max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center gap-2 text-red-400">
            <div className="flex h-8 w-8 items-center justify-center rounded-md border border-red-500/20 bg-red-500/10">
              <Trash2 className="h-4 w-4" />
            </div>
            <AlertDialogTitle className="text-base font-semibold text-zinc-100">
              Delete Project
            </AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-xs text-zinc-400">
            Are you sure you want to permanently delete{" "}
            <span className="font-semibold text-zinc-200">
              &quot;{projectName}&quot;
            </span>
            ? All associated test suites, OpenAPI specs, test runs, and security
            findings will be deleted. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {error && (
          <div className="mt-2 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
            {error}
          </div>
        )}

        <AlertDialogFooter className="mt-4 flex gap-2">
          <AlertDialogCancel
            disabled={loading}
            className="h-8 border-zinc-800 bg-transparent text-xs text-zinc-300 hover:bg-zinc-900 hover:text-white"
          >
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={loading}
            className="h-8 bg-red-600 text-xs font-medium text-white hover:bg-red-700"
          >
            {loading ? "Deleting..." : "Delete Project"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
