"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  UploadCloud,
  FileCode,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  FileText,
  Code2,
  X,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface SpecUploaderProps {
  projectId: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function SpecUploader({
  projectId,
  onSuccess,
  onCancel,
}: SpecUploaderProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<"file" | "paste">("file");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [pastedContent, setPastedContent] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState<string>("");
  const [error, setError] = useState<{ message: string; code?: string } | null>(
    null
  );
  const [successInfo, setSuccessInfo] = useState<{
    title: string;
    version: string;
    endpointCount: number;
  } | null>(null);

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    setError(null);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      validateAndSetFile(files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    if (e.target.files && e.target.files.length > 0) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const validateAndSetFile = (file: File) => {
    const validExtensions = [".json", ".yaml", ".yml"];
    const hasValidExt = validExtensions.some((ext) =>
      file.name.toLowerCase().endsWith(ext)
    );

    if (!hasValidExt) {
      setError({
        code: "UNSUPPORTED_EXTENSION",
        message:
          "Unsupported file format. Please upload an OpenAPI file with .json, .yaml, or .yml extension.",
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError({
        code: "OVERSIZED_CONTENT",
        message: `File exceeds the 5 MB limit (${(file.size / (1024 * 1024)).toFixed(2)} MB).`,
      });
      return;
    }

    setSelectedFile(file);
  };

  const handleUpload = async () => {
    if (activeTab === "file") {
      if (!selectedFile) {
        setError({
          code: "EMPTY_FILE",
          message: "Please choose or drag-and-drop an OpenAPI file first.",
        });
        return;
      }

      setLoading(true);
      setLoadingStatus("Reading specification file...");
      setError(null);

      try {
        const formData = new FormData();
        formData.append("file", selectedFile);

        setLoadingStatus("Validating OpenAPI 3.x schema and normalizing endpoints...");
        const res = await fetch(`/api/projects/${projectId}/spec`, {
          method: "POST",
          body: formData,
        });

        const data = await res.json();

        if (!res.ok) {
          setError({
            code: data.code || "VALIDATION_FAILED",
            message: data.error || "Failed to parse specification.",
          });
          setLoading(false);
          return;
        }

        setSuccessInfo({
          title: data.spec.title,
          version: data.spec.version,
          endpointCount: data.spec.endpointCount,
        });

        if (onSuccess) {
          onSuccess();
        } else {
          router.refresh();
        }
      } catch {
        setError({
          code: "NETWORK_ERROR",
          message: "A network error occurred while uploading. Please try again.",
        });
      } finally {
        setLoading(false);
      }
    } else {
      // Paste mode
      if (!pastedContent.trim()) {
        setError({
          code: "EMPTY_CONTENT",
          message: "Please paste your OpenAPI JSON or YAML content into the editor.",
        });
        return;
      }

      setLoading(true);
      setLoadingStatus("Parsing and validating specification...");
      setError(null);

      try {
        const res = await fetch(`/api/projects/${projectId}/spec`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: pastedContent }),
        });

        const data = await res.json();

        if (!res.ok) {
          setError({
            code: data.code || "VALIDATION_FAILED",
            message: data.error || "Failed to parse specification.",
          });
          setLoading(false);
          return;
        }

        setSuccessInfo({
          title: data.spec.title,
          version: data.spec.version,
          endpointCount: data.spec.endpointCount,
        });

        if (onSuccess) {
          onSuccess();
        } else {
          router.refresh();
        }
      } catch {
        setError({
          code: "NETWORK_ERROR",
          message: "A network error occurred while processing. Please try again.",
        });
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Title & Mode Switcher */}
      <div className="flex flex-col justify-between gap-3 border-b border-zinc-800/80 pb-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-base font-semibold text-zinc-100">Import API</h2>
          <p className="mt-0.5 text-xs text-zinc-400">
            Import an OpenAPI 3.x specification to generate endpoints and explorer telemetry.
          </p>
        </div>

        {/* Tab switch */}
        <div className="flex items-center rounded-lg border border-zinc-800 bg-zinc-950 p-1 text-xs">
          <button
            type="button"
            onClick={() => {
              setActiveTab("file");
              setError(null);
            }}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1 font-medium transition-colors ${
              activeTab === "file"
                ? "bg-zinc-800 text-white"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <UploadCloud className="h-3.5 w-3.5" />
            File Upload
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab("paste");
              setError(null);
            }}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1 font-medium transition-colors ${
              activeTab === "paste"
                ? "bg-zinc-800 text-white"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Code2 className="h-3.5 w-3.5" />
            Paste Raw Content
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-xs text-red-300">
          <AlertTriangle className="h-4 w-4 shrink-0 text-red-400 mt-0.5" />
          <div className="flex-1 space-y-1">
            <div className="font-semibold text-red-200">
              Specification Import Failed
              {error.code && (
                <span className="ml-2 rounded border border-red-500/40 bg-red-500/20 px-1.5 py-0.2 font-mono text-[10px]">
                  {error.code}
                </span>
              )}
            </div>
            <p className="leading-relaxed text-red-300">{error.message}</p>
          </div>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-red-400 hover:text-red-200"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Success Notification */}
      {successInfo && (
        <div className="flex items-start justify-between gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs text-emerald-300">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
            <div>
              <div className="font-semibold text-emerald-200">
                Specification Imported Successfully
              </div>
              <p className="mt-0.5 text-emerald-300">
                Parsed <span className="font-mono">{successInfo.title}</span> (v
                {successInfo.version}) with{" "}
                <span className="font-semibold text-white">
                  {successInfo.endpointCount} endpoints
                </span>
                .
              </p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => router.refresh()}
            className="h-7 bg-emerald-500 text-xs font-medium text-black hover:bg-emerald-400"
          >
            View Explorer
            <ArrowRight className="ml-1 h-3 w-3" />
          </Button>
        </div>
      )}

      {/* Mode 1: Drag-and-drop File Upload */}
      {activeTab === "file" && (
        <div className="space-y-4">
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`group flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center transition-all ${
              isDragging
                ? "border-indigo-500 bg-indigo-500/10"
                : "border-zinc-800 bg-zinc-900/30 hover:border-zinc-700 hover:bg-zinc-900/50"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,.yaml,.yml"
              onChange={handleFileChange}
              className="hidden"
            />

            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-zinc-800 bg-zinc-900 text-zinc-400 transition-transform group-hover:scale-105">
              <UploadCloud className="h-6 w-6 text-zinc-300" />
            </div>

            <div className="mt-4">
              <p className="text-sm font-medium text-zinc-200">
                Drag and drop your OpenAPI specification here
              </p>
              <p className="mt-1 text-xs text-zinc-400">
                or <span className="text-indigo-400 underline underline-offset-2">browse files</span> from your computer
              </p>
            </div>

            <div className="mt-4 flex items-center gap-2 text-[11px] font-mono text-zinc-500">
              <span className="rounded border border-zinc-800 bg-zinc-950 px-2 py-0.5">
                .json
              </span>
              <span className="rounded border border-zinc-800 bg-zinc-950 px-2 py-0.5">
                .yaml
              </span>
              <span className="rounded border border-zinc-800 bg-zinc-950 px-2 py-0.5">
                .yml
              </span>
              <span>• Max 5 MB</span>
            </div>
          </div>

          {/* Selected File Details */}
          {selectedFile && (
            <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/60 p-3 text-xs">
              <div className="flex items-center gap-2.5 overflow-hidden">
                <FileCode className="h-4 w-4 shrink-0 text-indigo-400" />
                <div className="truncate">
                  <span className="font-mono font-medium text-zinc-200">
                    {selectedFile.name}
                  </span>
                  <span className="ml-2 font-mono text-[11px] text-zinc-500">
                    ({(selectedFile.size / 1024).toFixed(1)} KB)
                  </span>
                </div>
              </div>

              <Button
                variant="ghost"
                size="icon-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedFile(null);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
                className="h-6 w-6 text-zinc-400 hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}

          {/* Action Row */}
          <div className="flex items-center justify-end gap-2 pt-2">
            {onCancel && (
              <Button
                variant="outline"
                size="sm"
                onClick={onCancel}
                disabled={loading}
                className="h-8 border-zinc-800 bg-transparent text-xs text-zinc-400 hover:bg-zinc-900 hover:text-white"
              >
                Cancel
              </Button>
            )}
            <Button
              size="sm"
              onClick={handleUpload}
              disabled={!selectedFile || loading}
              className="h-8 bg-zinc-100 text-xs font-medium text-zinc-950 hover:bg-zinc-200"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  {loadingStatus || "Processing..."}
                </>
              ) : (
                "Upload specification"
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Mode 2: Paste Raw Content */}
      {activeTab === "paste" && (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span className="flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5" />
                Paste OpenAPI JSON or YAML content:
              </span>
              <span className="font-mono text-[11px] text-zinc-500">
                OpenAPI 3.x only
              </span>
            </div>

            <Textarea
              value={pastedContent}
              onChange={(e) => setPastedContent(e.target.value)}
              placeholder={`openapi: 3.0.3\ninfo:\n  title: My Microservice API\n  version: 1.0.0\npaths:\n  /users:\n    get:\n      summary: Get all users\n      responses:\n        '200':\n          description: Success`}
              rows={14}
              className="font-mono text-xs leading-relaxed border-zinc-800 bg-zinc-950/80 text-zinc-200 placeholder:text-zinc-600 focus-visible:border-zinc-700"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            {onCancel && (
              <Button
                variant="outline"
                size="sm"
                onClick={onCancel}
                disabled={loading}
                className="h-8 border-zinc-800 bg-transparent text-xs text-zinc-400 hover:bg-zinc-900 hover:text-white"
              >
                Cancel
              </Button>
            )}
            <Button
              size="sm"
              onClick={handleUpload}
              disabled={!pastedContent.trim() || loading}
              className="h-8 bg-zinc-100 text-xs font-medium text-zinc-950 hover:bg-zinc-200"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  {loadingStatus || "Parsing..."}
                </>
              ) : (
                "Parse specification"
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
