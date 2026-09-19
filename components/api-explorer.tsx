"use client";

import { useState, useMemo } from "react";
import {
  Search,
  Filter,
  ChevronDown,
  ChevronUp,
  Tag,
  Lock,
  Layers,
  Code2,
  CheckCircle2,
  FileCode2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  NormalizedEndpoint,
  HttpMethod,
  OpenApiStats,
} from "@/lib/openapi";

interface ApiExplorerProps {
  endpoints: NormalizedEndpoint[];
  stats?: OpenApiStats | null;
  specMeta?: {
    title: string;
    version: string;
    openapiVersion?: string | null;
  };
  onReimportClick?: () => void;
}

const METHOD_COLORS: Record<HttpMethod, { badge: string; border: string; bg: string }> = {
  GET: {
    badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    border: "border-emerald-500/30",
    bg: "hover:bg-emerald-500/5",
  },
  POST: {
    badge: "bg-blue-500/10 text-blue-400 border-blue-500/30",
    border: "border-blue-500/30",
    bg: "hover:bg-blue-500/5",
  },
  PUT: {
    badge: "bg-amber-500/10 text-amber-400 border-amber-500/30",
    border: "border-amber-500/30",
    bg: "hover:bg-amber-500/5",
  },
  PATCH: {
    badge: "bg-amber-500/10 text-amber-400 border-amber-500/30",
    border: "border-amber-500/30",
    bg: "hover:bg-amber-500/5",
  },
  DELETE: {
    badge: "bg-rose-500/10 text-rose-400 border-rose-500/30",
    border: "border-rose-500/30",
    bg: "hover:bg-rose-500/5",
  },
  OPTIONS: {
    badge: "bg-purple-500/10 text-purple-400 border-purple-500/30",
    border: "border-purple-500/30",
    bg: "hover:bg-purple-500/5",
  },
  HEAD: {
    badge: "bg-zinc-500/10 text-zinc-400 border-zinc-500/30",
    border: "border-zinc-500/30",
    bg: "hover:bg-zinc-500/5",
  },
};

export function ApiExplorer({
  endpoints,
  stats,
  specMeta,
  onReimportClick,
}: ApiExplorerProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMethod, setSelectedMethod] = useState<string>("ALL");
  const [selectedTag, setSelectedTag] = useState<string>("ALL");
  const [expandedEndpoints, setExpandedEndpoints] = useState<Record<string, boolean>>({});

  // Unique tags list
  const availableTags = useMemo(() => {
    if (stats?.tags && stats.tags.length > 0) return stats.tags;
    const tagSet = new Set<string>();
    endpoints.forEach((ep) => ep.tags.forEach((t) => tagSet.add(t)));
    return Array.from(tagSet).sort();
  }, [endpoints, stats]);

  // Filtered endpoints
  const filteredEndpoints = useMemo(() => {
    return endpoints.filter((ep) => {
      // Method filter
      if (selectedMethod !== "ALL" && ep.method !== selectedMethod) {
        return false;
      }

      // Tag filter
      if (selectedTag !== "ALL" && !ep.tags.includes(selectedTag)) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesPath = ep.path.toLowerCase().includes(q);
        const matchesSummary = ep.summary?.toLowerCase().includes(q) ?? false;
        const matchesOpId = ep.operationId?.toLowerCase().includes(q) ?? false;
        const matchesTags = ep.tags.some((t) => t.toLowerCase().includes(q));
        if (!matchesPath && !matchesSummary && !matchesOpId && !matchesTags) {
          return false;
        }
      }

      return true;
    });
  }, [endpoints, selectedMethod, selectedTag, searchQuery]);

  const toggleExpand = (key: string) => {
    setExpandedEndpoints((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const expandAll = () => {
    const next: Record<string, boolean> = {};
    filteredEndpoints.forEach((ep) => {
      next[`${ep.method}-${ep.path}`] = true;
    });
    setExpandedEndpoints(next);
  };

  const collapseAll = () => {
    setExpandedEndpoints({});
  };

  return (
    <div className="space-y-4">
      {/* Spec Overview Header if meta available */}
      {specMeta && (
        <div className="flex flex-col justify-between gap-3 rounded-lg border border-zinc-800/80 bg-zinc-900/40 p-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md border border-zinc-800 bg-zinc-950 text-indigo-400">
              <FileCode2 className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-zinc-100">
                  {specMeta.title}
                </h2>
                <Badge
                  variant="outline"
                  className="border-zinc-800 bg-zinc-950 font-mono text-[10px] text-zinc-400"
                >
                  v{specMeta.version}
                </Badge>
                {specMeta.openapiVersion && (
                  <Badge
                    variant="outline"
                    className="border-emerald-500/30 bg-emerald-500/10 font-mono text-[10px] text-emerald-400"
                  >
                    OpenAPI {specMeta.openapiVersion}
                  </Badge>
                )}
              </div>
              <p className="mt-0.5 text-xs text-zinc-400">
                {endpoints.length} endpoints normalized across{" "}
                {availableTags.length} tag groupings.
              </p>
            </div>
          </div>

          {onReimportClick && (
            <Button
              variant="outline"
              size="sm"
              onClick={onReimportClick}
              className="h-8 border-zinc-800 bg-zinc-900/60 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-white"
            >
              Re-import Spec
            </Button>
          )}
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3 rounded-lg border border-zinc-800/80 bg-zinc-900/30 p-3 lg:flex-row lg:items-center lg:justify-between">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
          <Input
            placeholder="Filter endpoints by path, summary, or operationId..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9 border-zinc-800 bg-zinc-950/80 pl-9 font-mono text-xs text-zinc-100 placeholder:text-zinc-500 focus-visible:border-zinc-700"
          />
        </div>

        {/* Method and Tag Selectors */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Method Pills */}
          <div className="flex items-center rounded-md border border-zinc-800 bg-zinc-950 p-0.5 text-[11px] font-mono">
            {["ALL", "GET", "POST", "PUT", "DELETE"].map((m) => (
              <button
                key={m}
                onClick={() => setSelectedMethod(m)}
                className={`rounded px-2 py-1 transition-colors ${
                  selectedMethod === m
                    ? "bg-zinc-800 font-semibold text-white"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {m}
              </button>
            ))}
          </div>

          {/* Tag Selector */}
          {availableTags.length > 0 && (
            <div className="flex items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1 text-xs text-zinc-300">
              <Tag className="h-3 w-3 text-zinc-500" />
              <select
                value={selectedTag}
                onChange={(e) => setSelectedTag(e.target.value)}
                className="bg-transparent text-xs text-zinc-300 outline-none focus:text-white"
              >
                <option value="ALL" className="bg-zinc-900 text-zinc-100">
                  All Tags
                </option>
                {availableTags.map((tag) => (
                  <option
                    key={tag}
                    value={tag}
                    className="bg-zinc-900 text-zinc-100"
                  >
                    {tag}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Expand/Collapse All Buttons */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="xs"
              onClick={expandAll}
              className="h-7 text-[11px] text-zinc-400 hover:text-white"
            >
              Expand All
            </Button>
            <Button
              variant="ghost"
              size="xs"
              onClick={collapseAll}
              className="h-7 text-[11px] text-zinc-400 hover:text-white"
            >
              Collapse
            </Button>
          </div>
        </div>
      </div>

      {/* Endpoints List */}
      <div className="space-y-2">
        {filteredEndpoints.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-800 bg-zinc-900/20 py-12 text-center">
            <Filter className="mx-auto h-6 w-6 text-zinc-600" />
            <p className="mt-2 text-xs font-medium text-zinc-300">
              No matching endpoints found
            </p>
            <p className="mt-1 text-[11px] text-zinc-500">
              Try adjusting your search query or filter parameters.
            </p>
          </div>
        ) : (
          filteredEndpoints.map((ep) => {
            const key = `${ep.method}-${ep.path}`;
            const isExpanded = !!expandedEndpoints[key];
            const colors = METHOD_COLORS[ep.method] || METHOD_COLORS.GET;

            return (
              <div
                key={key}
                className="overflow-hidden rounded-lg border border-zinc-800/80 bg-zinc-900/30 transition-all hover:border-zinc-700"
              >
                {/* Header Row */}
                <div
                  onClick={() => toggleExpand(key)}
                  className={`flex cursor-pointer items-center justify-between gap-3 px-4 py-3 transition-colors ${colors.bg}`}
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    {/* Method Badge */}
                    <span
                      className={`inline-flex w-16 shrink-0 items-center justify-center rounded border px-2 py-0.5 font-mono text-[11px] font-semibold ${colors.badge}`}
                    >
                      {ep.method}
                    </span>

                    {/* Path */}
                    <span className="truncate font-mono text-xs font-medium text-zinc-200">
                      {ep.path}
                    </span>

                    {/* Summary */}
                    {ep.summary && (
                      <span className="hidden truncate text-xs text-zinc-400 sm:inline">
                        — {ep.summary}
                      </span>
                    )}
                  </div>

                  <div className="flex shrink-0 items-center gap-2.5">
                    {/* Tags */}
                    {ep.tags.map((tag) => (
                      <span
                        key={tag}
                        className="hidden rounded border border-zinc-800 bg-zinc-950 px-1.5 py-0.5 text-[10px] text-zinc-400 md:inline"
                      >
                        {tag}
                      </span>
                    ))}

                    {/* Security Pill */}
                    {!!ep.security && (
                      <span title="Authenticated Endpoint">
                        <Lock className="h-3 w-3 text-amber-400" />
                      </span>
                    )}

                    {/* Expand Chevron */}
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 text-zinc-500" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-zinc-500" />
                    )}
                  </div>
                </div>

                {/* Expanded Details Panel */}
                {isExpanded && (
                  <div className="border-t border-zinc-800/80 bg-zinc-950/60 p-4 text-xs">
                    {/* Summary & Description */}
                    {(ep.summary || ep.description) && (
                      <div className="mb-4 space-y-1">
                        {ep.summary && (
                          <div className="font-medium text-zinc-200">
                            {ep.summary}
                          </div>
                        )}
                        {ep.description && (
                          <p className="leading-relaxed text-zinc-400">
                            {ep.description}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Operation Meta */}
                    <div className="mb-4 flex flex-wrap items-center gap-3 text-[11px] text-zinc-500 font-mono">
                      {ep.operationId && (
                        <div>
                          operationId:{" "}
                          <span className="text-zinc-300">{ep.operationId}</span>
                        </div>
                      )}
                      <div>
                        parameters:{" "}
                        <span className="text-zinc-300">
                          {ep.parameters.length}
                        </span>
                      </div>
                      {ep.requestBody && (
                        <div>
                          body:{" "}
                          <span className="text-zinc-300">
                            {ep.requestBody.contentType}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Parameters Table */}
                    {ep.parameters.length > 0 && (
                      <div className="mb-4">
                        <div className="mb-1.5 flex items-center gap-1.5 font-semibold text-zinc-300">
                          <Layers className="h-3.5 w-3.5 text-zinc-500" />
                          Parameters
                        </div>
                        <div className="overflow-x-auto rounded border border-zinc-800 bg-zinc-900/40">
                          <table className="w-full text-left font-mono text-[11px]">
                            <thead className="border-b border-zinc-800 bg-zinc-900/80 text-zinc-400">
                              <tr>
                                <th className="px-3 py-1.5">Name</th>
                                <th className="px-3 py-1.5">In</th>
                                <th className="px-3 py-1.5">Type</th>
                                <th className="px-3 py-1.5">Required</th>
                                <th className="px-3 py-1.5">Description</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
                              {ep.parameters.map((param, idx) => (
                                <tr key={idx}>
                                  <td className="px-3 py-2 font-semibold text-zinc-100">
                                    {param.name}
                                  </td>
                                  <td className="px-3 py-2">
                                    <span className="rounded border border-zinc-800 bg-zinc-950 px-1 py-0.5 text-[10px] uppercase text-zinc-400">
                                      {param.location}
                                    </span>
                                  </td>
                                  <td className="px-3 py-2 text-zinc-400">
                                    {param.schemaType || "any"}
                                  </td>
                                  <td className="px-3 py-2">
                                    {param.required ? (
                                      <span className="text-rose-400">required</span>
                                    ) : (
                                      <span className="text-zinc-500">optional</span>
                                    )}
                                  </td>
                                  <td className="px-3 py-2 font-sans text-xs text-zinc-400">
                                    {param.description || "—"}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Request Body */}
                    {ep.requestBody && (
                      <div className="mb-4">
                        <div className="mb-1.5 flex items-center justify-between">
                          <span className="flex items-center gap-1.5 font-semibold text-zinc-300">
                            <Code2 className="h-3.5 w-3.5 text-zinc-500" />
                            Request Body ({ep.requestBody.contentType})
                          </span>
                          {ep.requestBody.required && (
                            <span className="font-mono text-[10px] text-rose-400">
                              required
                            </span>
                          )}
                        </div>
                        {ep.requestBody.schema ? (
                          <pre className="max-h-48 overflow-auto rounded border border-zinc-800 bg-zinc-950 p-3 font-mono text-[11px] leading-relaxed text-zinc-300">
                            {JSON.stringify(ep.requestBody.schema, null, 2)}
                          </pre>
                        ) : (
                          <div className="rounded border border-zinc-800 bg-zinc-900/40 p-2 text-zinc-500">
                            No body schema specified
                          </div>
                        )}
                      </div>
                    )}

                    {/* Responses */}
                    {ep.responses.length > 0 && (
                      <div>
                        <div className="mb-1.5 flex items-center gap-1.5 font-semibold text-zinc-300">
                          <CheckCircle2 className="h-3.5 w-3.5 text-zinc-500" />
                          Responses
                        </div>
                        <div className="space-y-2">
                          {ep.responses.map((resp, idx) => (
                            <div
                              key={idx}
                              className="rounded border border-zinc-800/80 bg-zinc-900/30 p-2.5 font-mono text-[11px]"
                            >
                              <div className="flex items-center justify-between">
                                <span
                                  className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                                    resp.statusCode.startsWith("2")
                                      ? "bg-emerald-500/10 text-emerald-400"
                                      : resp.statusCode.startsWith("4")
                                      ? "bg-amber-500/10 text-amber-400"
                                      : resp.statusCode.startsWith("5")
                                      ? "bg-rose-500/10 text-rose-400"
                                      : "bg-zinc-800 text-zinc-300"
                                  }`}
                                >
                                  {resp.statusCode}
                                </span>
                                <span className="font-sans text-xs text-zinc-300">
                                  {resp.description || "No description provided"}
                                </span>
                              </div>
                              {!!resp.schema && (
                                <div className="mt-2">
                                  <pre className="max-h-36 overflow-auto rounded border border-zinc-800 bg-zinc-950 p-2 text-[10px] text-zinc-400">
                                    {JSON.stringify(resp.schema, null, 2)}
                                  </pre>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
