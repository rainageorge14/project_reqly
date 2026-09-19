"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  Sparkles,
  Search,
  FlaskConical,
  CheckCircle2,
  AlertTriangle,
  FileCode2,
  ChevronDown,
  ChevronUp,
  RotateCw,
  Trash2,
  ArrowRight,
  SlidersHorizontal,
  Code2,
  Copy,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { EnrichedTestCase, TestCaseStats } from "@/lib/services/test-case";
import { HttpMethod } from "@prisma/client";

interface TestCasesClientProps {
  projectId: string;
  initialTestCases: EnrichedTestCase[];
  initialStats: TestCaseStats;
  hasSpec: boolean;
  specTitle?: string;
  specEndpointCount?: number;
}

const METHOD_STYLES: Record<
  HttpMethod,
  { badge: string; border: string; bg: string }
> = {
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
    badge: "bg-zinc-500/10 text-zinc-400 border-zinc-500/30",
    border: "border-zinc-500/30",
    bg: "hover:bg-zinc-500/5",
  },
  HEAD: {
    badge: "bg-zinc-500/10 text-zinc-400 border-zinc-500/30",
    border: "border-zinc-500/30",
    bg: "hover:bg-zinc-500/5",
  },
};

const CATEGORY_STYLES: Record<string, { badge: string; indicator: string }> = {
  Functional: {
    badge: "bg-indigo-500/10 text-indigo-400 border-indigo-500/30",
    indicator: "bg-indigo-400",
  },
  Validation: {
    badge: "bg-amber-500/10 text-amber-400 border-amber-500/30",
    indicator: "bg-amber-400",
  },
  "Edge Case": {
    badge: "bg-purple-500/10 text-purple-400 border-purple-500/30",
    indicator: "bg-purple-400",
  },
  Authentication: {
    badge: "bg-blue-500/10 text-blue-400 border-blue-500/30",
    indicator: "bg-blue-400",
  },
  Authorization: {
    badge: "bg-rose-500/10 text-rose-400 border-rose-500/30",
    indicator: "bg-rose-400",
  },
};

function getStatusBadge(status: number) {
  if (status >= 200 && status < 300) {
    return {
      style: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
      label: `${status} OK`,
    };
  }
  if (status === 400) {
    return {
      style: "bg-amber-500/10 text-amber-400 border-amber-500/30",
      label: `${status} Bad Request`,
    };
  }
  if (status === 401) {
    return {
      style: "bg-blue-500/10 text-blue-400 border-blue-500/30",
      label: `${status} Unauthorized`,
    };
  }
  if (status === 403) {
    return {
      style: "bg-rose-500/10 text-rose-400 border-rose-500/30",
      label: `${status} Forbidden`,
    };
  }
  if (status === 404) {
    return {
      style: "bg-zinc-500/10 text-zinc-300 border-zinc-500/30",
      label: `${status} Not Found`,
    };
  }
  if (status === 422) {
    return {
      style: "bg-amber-500/10 text-amber-400 border-amber-500/30",
      label: `${status} Unprocessable`,
    };
  }
  return {
    style: "bg-zinc-500/10 text-zinc-400 border-zinc-500/30",
    label: `${status}`,
  };
}

export function TestCasesClient({
  projectId,
  initialTestCases,
  initialStats,
  hasSpec,
  specTitle,
  specEndpointCount,
}: TestCasesClientProps) {
  const [testCases, setTestCases] = useState<EnrichedTestCase[]>(initialTestCases);
  const [stats, setStats] = useState<TestCaseStats>(initialStats);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  // Filtering state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [selectedMethod, setSelectedMethod] = useState<string>("ALL");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const categories = useMemo(() => {
    return [
      "Functional",
      "Validation",
      "Edge Case",
      "Authentication",
      "Authorization",
    ];
  }, []);

  const methods: HttpMethod[] = useMemo(
    () => ["GET", "POST", "PUT", "PATCH", "DELETE"],
    []
  );

  const filteredTestCases = useMemo(() => {
    return testCases.filter((tc) => {
      if (selectedCategory !== "ALL" && tc.category !== selectedCategory) {
        return false;
      }
      if (selectedMethod !== "ALL" && tc.method !== selectedMethod) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = tc.name.toLowerCase().includes(q);
        const matchEndpoint = tc.endpoint.toLowerCase().includes(q);
        const matchDesc = tc.description.toLowerCase().includes(q);
        return matchName || matchEndpoint || matchDesc;
      }
      return true;
    });
  }, [testCases, selectedCategory, selectedMethod, searchQuery]);

  // AI Test Generation Handler
  const handleGenerateTests = async () => {
    if (!hasSpec) {
      setErrorMessage(
        "Cannot generate tests without an OpenAPI specification. Please import a specification first."
      );
      return;
    }

    setIsGenerating(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    setWarnings([]);

    try {
      const response = await fetch(`/api/projects/${projectId}/tests/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clearExisting: true }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to generate test cases.");
      }

      setTestCases(data.testCases || []);
      setStats(data.stats);
      setSuccessMessage(
        `Successfully generated and persisted ${data.count} structured test cases with Google Gemini.`
      );
      if (data.warnings && data.warnings.length > 0) {
        setWarnings(data.warnings);
      }
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "An unexpected error occurred during test generation."
      );
    } finally {
      setIsGenerating(false);
    }
  };

  // Clear Tests Handler
  const handleClearTests = async () => {
    if (!confirm("Are you sure you want to clear all test cases for this project?")) {
      return;
    }

    setIsClearing(true);
    setErrorMessage(null);
    try {
      const response = await fetch(`/api/projects/${projectId}/tests`, {
        method: "DELETE",
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to clear test cases.");
      }

      setTestCases([]);
      setStats({
        total: 0,
        aiGenerated: 0,
        manual: 0,
        byCategory: {
          Functional: 0,
          Validation: 0,
          "Edge Case": 0,
          Authentication: 0,
          Authorization: 0,
        },
        byMethod: {},
        categories: [],
      });
      setSuccessMessage("All test cases have been cleared.");
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to clear test cases."
      );
    } finally {
      setIsClearing(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header with Title & Primary Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-semibold tracking-tight text-zinc-100">
              Test Cases
            </h1>
            <Badge
              variant="outline"
              className="border-zinc-800 bg-zinc-900 font-mono text-xs text-zinc-300"
            >
              {stats.total} total
            </Badge>
            {stats.aiGenerated > 0 && (
              <Badge
                variant="outline"
                className="border-indigo-500/30 bg-indigo-500/10 font-mono text-xs text-indigo-400"
              >
                <Sparkles className="mr-1 h-3 w-3" />
                {stats.aiGenerated} AI-Generated
              </Badge>
            )}
          </div>
          <p className="mt-1 text-xs text-zinc-400">
            Automated test cases across Functional, Validation, Edge Case,
            Authentication, and Authorization categories synthesized by Google
            Gemini.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {testCases.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearTests}
              disabled={isClearing || isGenerating}
              className="h-9 border-zinc-800 bg-zinc-950 text-xs text-zinc-400 hover:bg-zinc-900 hover:text-rose-400"
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              Clear Tests
            </Button>
          )}

          <Button
            size="sm"
            onClick={handleGenerateTests}
            disabled={isGenerating || !hasSpec}
            className="h-9 bg-indigo-600 text-xs font-medium text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50"
          >
            {isGenerating ? (
              <>
                <RotateCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                Synthesizing with Gemini...
              </>
            ) : (
              <>
                <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                {testCases.length > 0 ? "Regenerate Tests" : "Generate Tests"}
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Notifications / Alerts */}
      {errorMessage && (
        <div className="flex items-start gap-3 rounded-lg border border-rose-500/30 bg-rose-500/10 p-4 text-xs text-rose-300">
          <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
          <div className="flex-1">
            <span className="font-semibold text-rose-200">Error:</span>{" "}
            {errorMessage}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setErrorMessage(null)}
            className="h-6 px-2 text-[11px] text-rose-400 hover:bg-rose-500/20 hover:text-rose-200"
          >
            Dismiss
          </Button>
        </div>
      )}

      {successMessage && (
        <div className="flex items-start gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs text-emerald-300">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
          <div className="flex-1">
            <span className="font-semibold text-emerald-200">Success:</span>{" "}
            {successMessage}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSuccessMessage(null)}
            className="h-6 px-2 text-[11px] text-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-200"
          >
            Dismiss
          </Button>
        </div>
      )}

      {warnings.length > 0 && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-300">
          <div className="flex items-center gap-2 font-semibold text-amber-200">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
            Generation Notice ({warnings.length} items flagged during Zod validation):
          </div>
          <ul className="mt-2 list-inside list-disc space-y-1 text-amber-300/90 text-[11px]">
            {warnings.slice(0, 3).map((w, idx) => (
              <li key={idx}>{w}</li>
            ))}
            {warnings.length > 3 && (
              <li>...and {warnings.length - 3} more items.</li>
            )}
          </ul>
        </div>
      )}

      {/* No Spec Warning Banner */}
      {!hasSpec && (
        <div className="flex items-start justify-between gap-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-300">
          <div className="flex items-start gap-3">
            <FileCode2 className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
            <div>
              <span className="font-semibold text-amber-200">
                No OpenAPI Specification Linked
              </span>
              <p className="mt-0.5 text-amber-300/90 leading-relaxed">
                To enable automated AI test generation, please import an OpenAPI
                3.x specification file or paste your API schema.
              </p>
            </div>
          </div>
          <Link href={`/projects/${projectId}/import`}>
            <Button
              size="sm"
              className="h-7 whitespace-nowrap bg-amber-500 text-xs font-medium text-zinc-950 hover:bg-amber-400"
            >
              Import Spec
              <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      )}

      {/* Real Metrics Cards */}
      {stats.total > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {/* Total Test Cases */}
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
            <div className="text-[11px] font-medium text-zinc-400">
              Total Tests
            </div>
            <div className="mt-1 text-xl font-semibold text-white">
              {stats.total}
            </div>
            <div className="mt-0.5 text-[10px] text-zinc-500">
              Saved in database
            </div>
          </div>

          {/* Functional */}
          <div className="rounded-lg border border-indigo-500/20 bg-indigo-500/5 p-3">
            <div className="text-[11px] font-medium text-indigo-400">
              Functional
            </div>
            <div className="mt-1 text-xl font-semibold text-white">
              {stats.byCategory["Functional"] || 0}
            </div>
            <div className="mt-0.5 text-[10px] text-zinc-500">
              Happy path flows
            </div>
          </div>

          {/* Validation */}
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
            <div className="text-[11px] font-medium text-amber-400">
              Validation
            </div>
            <div className="mt-1 text-xl font-semibold text-white">
              {stats.byCategory["Validation"] || 0}
            </div>
            <div className="mt-0.5 text-[10px] text-zinc-500">
              Schema & inputs
            </div>
          </div>

          {/* Edge Case */}
          <div className="rounded-lg border border-purple-500/20 bg-purple-500/5 p-3">
            <div className="text-[11px] font-medium text-purple-400">
              Edge Case
            </div>
            <div className="mt-1 text-xl font-semibold text-white">
              {stats.byCategory["Edge Case"] || 0}
            </div>
            <div className="mt-0.5 text-[10px] text-zinc-500">
              Boundary & limits
            </div>
          </div>

          {/* Authentication */}
          <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3">
            <div className="text-[11px] font-medium text-blue-400">
              Authentication
            </div>
            <div className="mt-1 text-xl font-semibold text-white">
              {stats.byCategory["Authentication"] || 0}
            </div>
            <div className="mt-0.5 text-[10px] text-zinc-500">
              Token & credentials
            </div>
          </div>

          {/* Authorization */}
          <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 p-3">
            <div className="text-[11px] font-medium text-rose-400">
              Authorization
            </div>
            <div className="mt-1 text-xl font-semibold text-white">
              {stats.byCategory["Authorization"] || 0}
            </div>
            <div className="mt-0.5 text-[10px] text-zinc-500">
              Permissions & scopes
            </div>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      {testCases.length > 0 && (
        <div className="space-y-3 rounded-lg border border-zinc-800/80 bg-zinc-900/40 p-3.5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-500" />
              <Input
                placeholder="Search test name, endpoint, or description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 border-zinc-800 bg-zinc-950 pl-9 text-xs text-zinc-200 placeholder:text-zinc-600 focus-visible:ring-zinc-700"
              />
            </div>

            {/* HTTP Method Filters */}
            <div className="flex items-center gap-1 overflow-x-auto">
              <button
                type="button"
                onClick={() => setSelectedMethod("ALL")}
                className={`rounded px-2.5 py-1 font-mono text-[11px] font-medium transition-colors ${
                  selectedMethod === "ALL"
                    ? "bg-zinc-100 text-zinc-950"
                    : "bg-zinc-950 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
                }`}
              >
                ALL METHODS
              </button>
              {methods.map((method) => {
                const count = stats.byMethod[method] || 0;
                if (count === 0 && selectedMethod !== method) return null;
                return (
                  <button
                    key={method}
                    type="button"
                    onClick={() => setSelectedMethod(method)}
                    className={`rounded px-2.5 py-1 font-mono text-[11px] font-medium transition-colors ${
                      selectedMethod === method
                        ? "bg-zinc-100 text-zinc-950"
                        : "bg-zinc-950 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
                    }`}
                  >
                    {method}
                    {count > 0 && (
                      <span className="ml-1 opacity-60">({count})</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Category Pills */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-zinc-800/50">
            <span className="text-[11px] font-medium text-zinc-500 mr-1 flex items-center gap-1">
              <SlidersHorizontal className="h-3 w-3" /> Category:
            </span>
            <button
              type="button"
              onClick={() => setSelectedCategory("ALL")}
              className={`rounded-full px-3 py-0.5 text-xs font-medium transition-colors ${
                selectedCategory === "ALL"
                  ? "bg-zinc-200 text-zinc-950"
                  : "bg-zinc-950 text-zinc-400 border border-zinc-800 hover:border-zinc-700 hover:text-zinc-200"
              }`}
            >
              All Categories ({testCases.length})
            </button>
            {categories.map((cat) => {
              const count = stats.byCategory[cat] || 0;
              const isActive = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`rounded-full px-3 py-0.5 text-xs font-medium transition-colors ${
                    isActive
                      ? "bg-zinc-200 text-zinc-950"
                      : "bg-zinc-950 text-zinc-400 border border-zinc-800 hover:border-zinc-700 hover:text-zinc-200"
                  }`}
                >
                  {cat} ({count})
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Test Cases List */}
      {filteredTestCases.length > 0 ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-zinc-500 px-1">
            <span>
              Showing {filteredTestCases.length} of {testCases.length} test cases
            </span>
            <span>Click any test case to inspect payload, reasoning & behavior</span>
          </div>

          <div className="space-y-2">
            {filteredTestCases.map((tc) => {
              const isExpanded = expandedId === tc.id;
              const methodStyle =
                METHOD_STYLES[tc.method] || METHOD_STYLES.GET;
              const catStyle =
                CATEGORY_STYLES[tc.category] || CATEGORY_STYLES.Functional;
              const statusBadge = getStatusBadge(tc.expectedStatus);

              return (
                <div
                  key={tc.id}
                  className={`rounded-lg border transition-all ${
                    isExpanded
                      ? "border-zinc-700 bg-zinc-900/70 shadow-sm"
                      : "border-zinc-800/80 bg-zinc-900/30 hover:border-zinc-700 hover:bg-zinc-900/50"
                  }`}
                >
                  {/* Collapsed Header */}
                  <div
                    onClick={() =>
                      setExpandedId(isExpanded ? null : tc.id)
                    }
                    className="flex cursor-pointer items-center justify-between gap-3 p-3.5 select-none"
                  >
                    <div className="flex flex-1 items-center gap-3 min-w-0">
                      {/* Method Badge */}
                      <span
                        className={`inline-flex items-center justify-center rounded px-2 py-0.5 font-mono text-[11px] font-bold border ${methodStyle.badge}`}
                      >
                        {tc.method}
                      </span>

                      {/* Category Badge */}
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium border ${catStyle.badge}`}
                      >
                        {tc.category}
                      </span>

                      {/* Endpoint */}
                      <span className="font-mono text-xs font-medium text-zinc-200 truncate">
                        {tc.endpoint}
                      </span>

                      {/* Name / Description */}
                      <span className="text-xs text-zinc-400 truncate hidden md:inline">
                        — {tc.name}
                      </span>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      {/* Expected Status Badge */}
                      <span
                        className={`inline-flex items-center rounded px-2 py-0.5 font-mono text-[11px] font-semibold border ${statusBadge.style}`}
                      >
                        {statusBadge.label}
                      </span>

                      {/* Expand/Collapse Chevron */}
                      <div className="text-zinc-500 hover:text-zinc-300">
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Expanded Detail Panel */}
                  {isExpanded && (
                    <div className="border-t border-zinc-800/80 p-4 space-y-4 text-xs bg-zinc-950/40">
                      {/* Name & Description */}
                      <div>
                        <div className="font-medium text-zinc-200">
                          {tc.name}
                        </div>
                        <p className="mt-1 text-zinc-400 leading-relaxed">
                          {tc.description}
                        </p>
                      </div>

                      {/* Grid: Reasoning and Expected Behavior */}
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-md border border-zinc-800/80 bg-zinc-900/40 p-3">
                          <div className="flex items-center gap-1.5 font-medium text-indigo-400">
                            <Sparkles className="h-3.5 w-3.5" />
                            AI Test Reasoning
                          </div>
                          <p className="mt-1.5 text-zinc-300 text-[11px] leading-relaxed">
                            {tc.reasoning}
                          </p>
                        </div>

                        <div className="rounded-md border border-zinc-800/80 bg-zinc-900/40 p-3">
                          <div className="flex items-center gap-1.5 font-medium text-emerald-400">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Expected Server Behavior
                          </div>
                          <p className="mt-1.5 text-zinc-300 text-[11px] leading-relaxed">
                            {tc.expectedBehavior}
                          </p>
                        </div>
                      </div>

                      {/* Request Data Inspector */}
                      <div className="rounded-md border border-zinc-800 bg-zinc-950 p-3 space-y-3">
                        <div className="flex items-center justify-between text-[11px] text-zinc-400 font-medium">
                          <span className="flex items-center gap-1.5 text-zinc-300">
                            <Code2 className="h-3.5 w-3.5 text-zinc-500" />
                            Synthesized Request Data
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              copyToClipboard(
                                JSON.stringify(
                                  {
                                    method: tc.method,
                                    endpoint: tc.endpoint,
                                    headers: tc.headers,
                                    body: tc.requestBody,
                                    queryParams: tc.queryParams,
                                  },
                                  null,
                                  2
                                ),
                                tc.id
                              )
                            }
                            className="flex items-center gap-1 text-zinc-400 hover:text-white transition-colors"
                          >
                            {copiedId === tc.id ? (
                              <>
                                <Check className="h-3 w-3 text-emerald-400" />
                                <span className="text-emerald-400">Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="h-3 w-3" />
                                <span>Copy Payload</span>
                              </>
                            )}
                          </button>
                        </div>

                        {/* Headers */}
                        {Object.keys(tc.headers || {}).length > 0 && (
                          <div>
                            <span className="text-[10px] uppercase font-mono tracking-wider text-zinc-500">
                              Headers
                            </span>
                            <pre className="mt-1 overflow-x-auto rounded bg-zinc-900/70 p-2 font-mono text-[11px] text-zinc-300">
                              {JSON.stringify(tc.headers, null, 2)}
                            </pre>
                          </div>
                        )}

                        {/* Query Params */}
                        {Object.keys(tc.queryParams || {}).length > 0 && (
                          <div>
                            <span className="text-[10px] uppercase font-mono tracking-wider text-zinc-500">
                              Query Parameters
                            </span>
                            <pre className="mt-1 overflow-x-auto rounded bg-zinc-900/70 p-2 font-mono text-[11px] text-zinc-300">
                              {JSON.stringify(tc.queryParams, null, 2)}
                            </pre>
                          </div>
                        )}

                        {/* Body / Payload */}
                        {tc.requestBody !== null &&
                          tc.requestBody !== undefined && (
                            <div>
                              <span className="text-[10px] uppercase font-mono tracking-wider text-zinc-500">
                                Request Body
                              </span>
                              <pre className="mt-1 max-h-48 overflow-auto rounded bg-zinc-900/70 p-2 font-mono text-[11px] text-zinc-300">
                                {typeof tc.requestBody === "object"
                                  ? JSON.stringify(tc.requestBody, null, 2)
                                  : String(tc.requestBody)}
                              </pre>
                            </div>
                          )}

                        {Object.keys(tc.headers || {}).length === 0 &&
                          Object.keys(tc.queryParams || {}).length === 0 &&
                          (tc.requestBody === null ||
                            tc.requestBody === undefined) && (
                            <div className="font-mono text-[11px] text-zinc-500">
                              No request body or custom headers required (standard
                              GET request).
                            </div>
                          )}
                      </div>

                      {/* Footer Metadata */}
                      <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500 pt-1">
                        <span>
                          Source:{" "}
                          <span className="text-zinc-400">{tc.source}</span>
                        </span>
                        <span>
                          ID: <span className="text-zinc-400">{tc.id}</span>
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : testCases.length > 0 ? (
        /* No matches for active search/filters */
        <div className="rounded-lg border border-dashed border-zinc-800 bg-zinc-950/40 p-8 text-center">
          <FlaskConical className="mx-auto h-6 w-6 text-zinc-600" />
          <h3 className="mt-2 text-xs font-semibold text-zinc-200">
            No test cases match filter criteria
          </h3>
          <p className="mt-1 text-[11px] text-zinc-500">
            Try adjusting your search keywords or resetting the category and method
            filters.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setSearchQuery("");
              setSelectedCategory("ALL");
              setSelectedMethod("ALL");
            }}
            className="mt-3 h-7 border-zinc-800 bg-zinc-900 text-[11px] text-zinc-300 hover:bg-zinc-800 hover:text-white"
          >
            Reset Filters
          </Button>
        </div>
      ) : (
        /* Empty State when no test cases exist yet */
        <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-950/60 p-12 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 text-indigo-400">
            <FlaskConical className="h-6 w-6" />
          </div>
          <h3 className="mt-4 text-base font-semibold text-zinc-100">
            No Test Cases Configured Yet
          </h3>
          <p className="mx-auto mt-1.5 max-w-md text-xs text-zinc-400 leading-relaxed">
            {hasSpec
              ? `Your project has a verified OpenAPI specification "${specTitle || "API"}" with ${specEndpointCount || 0} endpoints. Generate comprehensive test suites covering functional, validation, edge cases, authentication, and authorization.`
              : "Import an OpenAPI 3.x specification to automatically synthesize high-coverage test cases using Google Gemini."}
          </p>

          <div className="mt-6 flex items-center justify-center gap-3">
            {hasSpec ? (
              <Button
                onClick={handleGenerateTests}
                disabled={isGenerating}
                className="h-9 bg-indigo-600 text-xs font-medium text-white shadow hover:bg-indigo-500"
              >
                {isGenerating ? (
                  <>
                    <RotateCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    Synthesizing with Gemini...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                    Generate AI Test Cases
                  </>
                )}
              </Button>
            ) : (
              <Link href={`/projects/${projectId}/import`}>
                <Button className="h-9 bg-zinc-100 text-xs font-medium text-zinc-950 hover:bg-zinc-200">
                  <FileCode2 className="mr-1.5 h-3.5 w-3.5" />
                  Import API Specification
                </Button>
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
