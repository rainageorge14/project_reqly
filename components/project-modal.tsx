"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { projectSchema } from "@/lib/validations/project";
import { Globe, FolderGit2 } from "lucide-react";

interface ProjectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode?: "create" | "edit";
  initialData?: {
    id?: string;
    name: string;
    description: string | null;
    baseUrl: string;
  };
  onSuccess?: () => void;
}

export function ProjectModal({
  open,
  onOpenChange,
  mode = "create",
  initialData,
  onSuccess,
}: ProjectModalProps) {
  const router = useRouter();
  const [name, setName] = useState(initialData?.name ?? "");
  const [description, setDescription] = useState(initialData?.description ?? "");
  const [baseUrl, setBaseUrl] = useState(initialData?.baseUrl ?? "");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Reset or update state when opening
  const isEdit = mode === "edit" && !!initialData?.id;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const validation = projectSchema.safeParse({
      name,
      description: description || null,
      baseUrl,
    });

    if (!validation.success) {
      setError(validation.error.issues[0]?.message || "Invalid inputs");
      return;
    }

    setLoading(true);

    try {
      const url = isEdit
        ? `/api/projects/${initialData?.id}`
        : "/api/projects";
      const method = isEdit ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validation.data),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to save project");
        setLoading(false);
        return;
      }

      onOpenChange(false);
      if (mode === "create") {
        setName("");
        setDescription("");
        setBaseUrl("");
      }

      if (onSuccess) {
        onSuccess();
      }
      router.refresh();
    } catch {
      setError("An unexpected network error occurred.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-zinc-800 bg-zinc-950 text-zinc-100 sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2 text-zinc-100">
            <div className="flex h-8 w-8 items-center justify-center rounded-md border border-zinc-800 bg-zinc-900 text-zinc-300">
              <FolderGit2 className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold">
                {isEdit ? "Edit Project" : "Create New Project"}
              </DialogTitle>
              <DialogDescription className="text-xs text-zinc-400">
                {isEdit
                  ? "Update your API endpoint configuration and project metadata."
                  : "Connect an API target to start managing tests and security suites."}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="mt-2 space-y-4">
          {error && (
            <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="projectName" className="text-xs font-medium text-zinc-300">
              Project Name <span className="text-red-400">*</span>
            </Label>
            <Input
              id="projectName"
              placeholder="e.g. Payments Gateway API"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="h-9 border-zinc-800 bg-zinc-900/60 text-xs text-zinc-100 placeholder:text-zinc-500 focus-visible:border-zinc-700"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="projectBaseUrl" className="text-xs font-medium text-zinc-300">
              Target Base URL <span className="text-red-400">*</span>
            </Label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5 text-zinc-500">
                <Globe className="h-3.5 w-3.5" />
              </div>
              <Input
                id="projectBaseUrl"
                placeholder="https://api.example.com"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                required
                className="h-9 border-zinc-800 bg-zinc-900/60 pl-8 font-mono text-xs text-zinc-100 placeholder:text-zinc-500 focus-visible:border-zinc-700"
              />
            </div>
            <p className="text-[11px] text-zinc-500">
              The root URL that test suites will execute requests against.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="projectDescription" className="text-xs font-medium text-zinc-300">
              Description <span className="text-zinc-500">(Optional)</span>
            </Label>
            <Textarea
              id="projectDescription"
              placeholder="e.g. Core microservice for payment orchestration and webhook dispatching."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="resize-none border-zinc-800 bg-zinc-900/60 text-xs text-zinc-100 placeholder:text-zinc-500 focus-visible:border-zinc-700"
            />
          </div>

          <DialogFooter className="mt-6 flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              className="h-8 border-zinc-800 bg-transparent text-xs text-zinc-300 hover:bg-zinc-900 hover:text-white"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={loading}
              className="h-8 bg-zinc-100 text-xs font-medium text-zinc-950 hover:bg-zinc-200"
            >
              {loading
                ? isEdit
                  ? "Saving..."
                  : "Creating..."
                : isEdit
                ? "Save Changes"
                : "Create Project"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
