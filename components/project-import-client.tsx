"use client";

import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SpecUploader } from "@/components/spec-uploader";
import { ApiExplorer } from "@/components/api-explorer";
import { NormalizedEndpoint, OpenApiStats } from "@/lib/openapi";

interface ProjectImportClientProps {
  projectId: string;
  initialSpec: {
    id: string;
    title: string;
    version: string;
    openapiVersion?: string | null;
  } | null;
  initialEndpoints: NormalizedEndpoint[];
  initialStats: OpenApiStats | null;
}

export function ProjectImportClient({
  projectId,
  initialSpec,
  initialEndpoints,
  initialStats,
}: ProjectImportClientProps) {
  const [showUploader, setShowUploader] = useState(!initialSpec);

  return (
    <div className="space-y-6">
      {/* If spec exists and uploader is hidden: show Explorer with Re-import button */}
      {initialSpec && !showUploader ? (
        <div className="space-y-4">
          <ApiExplorer
            endpoints={initialEndpoints}
            stats={initialStats}
            specMeta={initialSpec}
            onReimportClick={() => setShowUploader(true)}
          />
        </div>
      ) : (
        /* Uploader View */
        <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/30 p-6">
          {initialSpec && (
            <div className="mb-4 flex items-center justify-between border-b border-zinc-800/80 pb-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowUploader(false)}
                className="h-8 text-xs text-zinc-400 hover:text-white"
              >
                <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
                Back to API Explorer
              </Button>
              <span className="font-mono text-xs text-zinc-500">
                Re-importing will replace current spec: {initialSpec.title}
              </span>
            </div>
          )}

          <SpecUploader
            projectId={projectId}
            onCancel={initialSpec ? () => setShowUploader(false) : undefined}
          />
        </div>
      )}
    </div>
  );
}
