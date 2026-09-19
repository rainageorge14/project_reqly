"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  PlayCircle,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  RotateCw,
  Globe,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  FlaskConical,
  History,
  Check,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { EnrichedTestRun } from "@/lib/services/test-run";
import { EnrichedTestCase } from "@/lib/services/test-case";
import { TestResultStatus } from "@prisma/client";

interface TestRunsClientProps {
  projectId: string;
  baseUrl: string;
  initialRuns: EnrichedTestRun[];
  availableTestCases: EnrichedTestCase[];
}

const METHOD_STYLES: Record<string, string> = {
  GET: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  POST: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  PUT: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  PATCH: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  DELETE: "bg-rose-500/10 text-rose-400 border-rose-500/30",
  OPTIONS: "bg-zinc-500/10 text-zinc-400 border-zinc-500/30",
  HEAD: "bg-zinc-500/10 text-zinc-400 border-zinc-500/30",
};

function getResultStatusBadge(status: TestResultStatus) {
  switch (status) {
    case "PASSED":
      return {
        label: "PASSED",
        icon: CheckCircle2,
        badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
      };
    case "FAILED":
      return {
        label: "FAILED",
        icon: XCircle,
        badge: "bg-rose-500/10 text-rose-400 border-rose-500/30",
      };
    case "WARNING":
      return {
        label: "WARNING",
        icon: AlertTriangle,
        badge: "bg-amber-500/10 text-amber-400 border-amber-500/30",
      };
    case "ERROR":
    default:
      return {
        label: "ERROR",
        icon: AlertTriangle,
        badge: "bg-rose-500/10 text-rose-400 border-rose-500/30",
      };
  }
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

export function TestRunsClient({
  projectId,
  baseUrl,
  initialRuns,
  availableTestCases,
}: TestRunsClientProps) {
  const [runs, setRuns] = useState<EnrichedTestRun[]>(initialRuns);
  const [activeRunId, setActiveRunId] = useState<string | null>(
    initialRuns.length > 0 ? initialRuns[0].id : null
  );
  const [isRunning, setIsRunning] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Selection mode for individual tests
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedTestCaseIds, setSelectedTestCaseIds] = useState<Set<string>>(
    new Set()
  );

  // Filters for test results
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedResultId, setExpandedResultId] = useState<string | null>(null);

  // Active run data
  const currentRun = useMemo(() => {
    if (!activeRunId) return runs.length > 0 ? runs[0] : null;
    return runs.find((r) => r.id === activeRunId) || (runs.length > 0 ? runs[0] : null);
  }, [runs, activeRunId]);

  // Filtered results of the active run
  const filteredResults = useMemo(() => {
    if (!currentRun) return [];
    return currentRun.results.filter((res) => {
      if (statusFilter !== "ALL" && res.status !== statusFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = res.testCaseName.toLowerCase().includes(q);
        const matchEndpoint = res.endpoint.toLowerCase().includes(q);
        const matchMethod = res.method.toLowerCase().includes(q);
        return matchName || matchEndpoint || matchMethod;
      }
      return true;
    });
  }, [currentRun, statusFilter, searchQuery]);

  // Execute test run
  const handleExecuteRun = async (testCaseIds?: string[]) => {
    if (!baseUrl || !baseUrl.trim()) {
      setErrorMessage("Project target base URL is not configured. Please set a base URL.");
      return;
    }

    if (availableTestCases.length === 0) {
      setErrorMessage("No test cases exist to execute. Please generate test cases first.");
      return;
    }

    setIsRunning(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await fetch(`/api/projects/${projectId}/runs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          testCaseIds: testCaseIds && testCaseIds.length > 0 ? testCaseIds : undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to execute test run.");
      }

      const newRun: EnrichedTestRun = data.run;
      setRuns((prev) => [newRun, ...prev]);
      setActiveRunId(newRun.id);

      const passRate =
        newRun.totalTests > 0
          ? Math.round((newRun.passed / newRun.totalTests) * 100)
          : 0;

      setSuccessMessage(
        `Test run completed in ${formatDuration(newRun.durationMs)} with ${newRun.passed}/${newRun.totalTests} passed (${passRate}% pass rate).`
      );

      // If in selection mode, close selection after run
      if (isSelectionMode) {
        setIsSelectionMode(false);
      }
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : "An unexpected execution error occurred."
      );
    } finally {
      setIsRunning(false);
    }
  };

  const toggleSelectTestCase = (id: string) => {
    setSelectedTestCaseIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAllTestCases = () => {
    setSelectedTestCaseIds(new Set(availableTestCases.map((tc) => tc.id)));
  };

  const deselectAllTestCases = () => {
    setSelectedTestCaseIds(new Set());
  };

  // Compute pass rate of active run
  const activePassRate = useMemo(() => {
    if (!currentRun || currentRun.totalTests === 0) return 0;
    return Math.round((currentRun.passed / currentRun.totalTests) * 100);
  }, [currentRun]);

  return (
    <div className="space-y-6">
      {/* Header with Title, Target Indicator, and Primary Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-semibold tracking-tight text-zinc-100">
              Test Runs
            </h1>
            <Badge
              variant="outline"
              className="border-zinc-800 bg-zinc-900 font-mono text-xs text-zinc-300"
            >
              {runs.length} runs recorded
            </Badge>
          </div>
          <div className="mt-1 flex items-center gap-2 text-xs text-zinc-400">
            <span className="flex items-center gap-1">
              <Globe className="h-3.5 w-3.5 text-zinc-500" />
              Target Base URL:
            </span>
            <span className="font-mono text-zinc-200 bg-zinc-900/60 px-2 py-0.5 rounded border border-zinc-800/60">
              {baseUrl || "No base URL configured"}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {availableTestCases.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsSelectionMode(!isSelectionMode)}
              disabled={isRunning}
              className={`h-9 text-xs transition-colors ${
                isSelectionMode
                  ? "border-indigo-500/50 bg-indigo-500/10 text-indigo-300"
                  : "border-zinc-800 bg-zinc-950 text-zinc-300 hover:bg-zinc-900"
              }`}
            >
              <SlidersHorizontal className="mr-1.5 h-3.5 w-3.5" />
              {isSelectionMode ? "Hide Selection" : "Select Tests"}
            </Button>
          )}

          {isSelectionMode && selectedTestCaseIds.size > 0 && (
            <Button
              size="sm"
              onClick={() => handleExecuteRun(Array.from(selectedTestCaseIds))}
              disabled={isRunning}
              className="h-9 bg-indigo-600 text-xs font-medium text-white hover:bg-indigo-500"
            >
              {isRunning ? (
                <>
                  <RotateCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <PlayCircle className="mr-1.5 h-3.5 w-3.5" />
                  Run Selected ({selectedTestCaseIds.size})
                </>
              )}
            </Button>
          )}

          <Button
            size="sm"
            onClick={() => handleExecuteRun()}
            disabled={isRunning || availableTestCases.length === 0}
            className="h-9 bg-emerald-600 text-xs font-medium text-white shadow hover:bg-emerald-500 disabled:opacity-50"
          >
            {isRunning ? (
              <>
                <RotateCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                Executing Suite...
              </>
            ) : (
              <>
                <PlayCircle className="mr-1.5 h-3.5 w-3.5" />
                Run All Tests ({availableTestCases.length})
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
            <span className="font-semibold text-rose-200">Execution Error:</span>{" "}
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
            <span className="font-semibold text-emerald-200">Execution Complete:</span>{" "}
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

      {/* Test Selection Panel */}
      {isSelectionMode && availableTestCases.length > 0 && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/80 p-4 space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs font-medium text-zinc-200">
              Select Specific Test Cases ({selectedTestCaseIds.size} of{" "}
              {availableTestCases.length} selected)
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={selectAllTestCases}
                className="h-6 px-2 text-[11px] text-zinc-400 hover:text-white"
              >
                Select All
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={deselectAllTestCases}
                className="h-6 px-2 text-[11px] text-zinc-400 hover:text-white"
              >
                Deselect All
              </Button>
            </div>
          </div>

          <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
            {availableTestCases.map((tc) => {
              const isSelected = selectedTestCaseIds.has(tc.id);
              const methodStyle = METHOD_STYLES[tc.method] || METHOD_STYLES.GET;
              return (
                <div
                  key={tc.id}
                  onClick={() => toggleSelectTestCase(tc.id)}
                  className={`flex cursor-pointer items-center justify-between gap-3 rounded-md border p-2 text-xs transition-colors ${
                    isSelected
                      ? "border-indigo-500/40 bg-indigo-500/10 text-zinc-200"
                      : "border-zinc-800/60 bg-zinc-900/30 text-zinc-400 hover:bg-zinc-900/60"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                        isSelected
                          ? "border-indigo-500 bg-indigo-600 text-white"
                          : "border-zinc-700 bg-zinc-950"
                      }`}
                    >
                      {isSelected && <Check className="h-3 w-3" />}
                    </div>
                    <span
                      className={`inline-flex items-center rounded px-1.5 py-0.5 font-mono text-[10px] font-bold border ${methodStyle}`}
                    >
                      {tc.method}
                    </span>
                    <span className="font-mono text-zinc-300 truncate">
                      {tc.endpoint}
                    </span>
                    <span className="truncate text-zinc-500 hidden md:inline">
                      — {tc.name}
                    </span>
                  </div>

                  <span className="text-[11px] font-mono text-zinc-500 shrink-0">
                    Expects {tc.expectedStatus}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Execution Progress Banner */}
      {isRunning && (
        <div className="rounded-lg border border-indigo-500/30 bg-indigo-500/10 p-4">
          <div className="flex items-center gap-3">
            <RotateCw className="h-5 w-5 animate-spin text-indigo-400" />
            <div>
              <div className="text-xs font-semibold text-indigo-200">
                Executing HTTP verification requests...
              </div>
              <div className="mt-0.5 text-[11px] text-indigo-300/80">
                Sending HTTP requests to target base URL:{" "}
                <span className="font-mono">{baseUrl}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      {currentRun ? (
        <div className="space-y-6">
          {/* Run History Selector Bar */}
          {runs.length > 1 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              <span className="text-xs text-zinc-500 flex items-center gap-1 whitespace-nowrap">
                <History className="h-3.5 w-3.5" /> History:
              </span>
              {runs.map((r, index) => {
                const isActive = r.id === currentRun.id;
                const passRate =
                  r.totalTests > 0
                    ? Math.round((r.passed / r.totalTests) * 100)
                    : 0;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setActiveRunId(r.id)}
                    className={`rounded-md border px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-2 ${
                      isActive
                        ? "border-zinc-700 bg-zinc-800 text-white"
                        : "border-zinc-800/80 bg-zinc-950 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
                    }`}
                  >
                    <span>Run #{runs.length - index}</span>
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                        r.failed > 0
                          ? "bg-rose-500/10 text-rose-400"
                          : "bg-emerald-500/10 text-emerald-400"
                      }`}
                    >
                      {passRate}% pass
                    </span>
                    <span className="text-[10px] text-zinc-500">
                      {new Date(r.createdAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Telemetry Metrics Row */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {/* Total Tests */}
            <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
              <div className="text-[11px] font-medium text-zinc-400">
                Total Executed
              </div>
              <div className="mt-1 text-xl font-semibold text-white">
                {currentRun.totalTests}
              </div>
              <div className="mt-0.5 text-[10px] text-zinc-500">
                Automated assertions
              </div>
            </div>

            {/* Passed */}
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
              <div className="text-[11px] font-medium text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" /> Passed
              </div>
              <div className="mt-1 text-xl font-semibold text-white">
                {currentRun.passed}
              </div>
              <div className="mt-0.5 text-[10px] text-zinc-500">
                Exact status match
              </div>
            </div>

            {/* Failed */}
            <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 p-3">
              <div className="text-[11px] font-medium text-rose-400 flex items-center gap-1">
                <XCircle className="h-3 w-3" /> Failed
              </div>
              <div className="mt-1 text-xl font-semibold text-white">
                {currentRun.failed}
              </div>
              <div className="mt-0.5 text-[10px] text-zinc-500">
                Status code mismatch
              </div>
            </div>

            {/* Warnings */}
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
              <div className="text-[11px] font-medium text-amber-400 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> Warnings
              </div>
              <div className="mt-1 text-xl font-semibold text-white">
                {currentRun.warnings}
              </div>
              <div className="mt-0.5 text-[10px] text-zinc-500">
                Related status family
              </div>
            </div>

            {/* Pass Rate */}
            <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
              <div className="text-[11px] font-medium text-zinc-400">
                Pass Rate
              </div>
              <div
                className={`mt-1 text-xl font-semibold ${
                  activePassRate === 100
                    ? "text-emerald-400"
                    : activePassRate >= 70
                    ? "text-zinc-100"
                    : "text-rose-400"
                }`}
              >
                {activePassRate}%
              </div>
              <div className="mt-0.5 text-[10px] text-zinc-500">
                Assertion coverage
              </div>
            </div>

            {/* Execution Duration */}
            <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
              <div className="text-[11px] font-medium text-zinc-400 flex items-center gap-1">
                <Clock className="h-3 w-3 text-zinc-500" /> Duration
              </div>
              <div className="mt-1 text-xl font-semibold text-white">
                {formatDuration(currentRun.durationMs)}
              </div>
              <div className="mt-0.5 text-[10px] text-zinc-500">
                Server execution time
              </div>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-lg border border-zinc-800/80 bg-zinc-900/40 p-3.5">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-500" />
              <Input
                placeholder="Search result by endpoint, test name, or method..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 border-zinc-800 bg-zinc-950 pl-9 text-xs text-zinc-200 placeholder:text-zinc-600 focus-visible:ring-zinc-700"
              />
            </div>

            {/* Status Filters */}
            <div className="flex items-center gap-1 overflow-x-auto">
              {["ALL", "PASSED", "FAILED", "WARNING", "ERROR"].map((st) => {
                const isActive = statusFilter === st;
                return (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setStatusFilter(st)}
                    className={`rounded px-2.5 py-1 font-mono text-[11px] font-medium transition-colors ${
                      isActive
                        ? "bg-zinc-100 text-zinc-950"
                        : "bg-zinc-950 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
                    }`}
                  >
                    {st}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Results List */}
          {filteredResults.length > 0 ? (
            <div className="space-y-2">
              {filteredResults.map((result) => {
                const isExpanded = expandedResultId === result.id;
                const statusBadge = getResultStatusBadge(result.status);
                const StatusIcon = statusBadge.icon;
                const methodStyle =
                  METHOD_STYLES[result.method] || METHOD_STYLES.GET;

                return (
                  <div
                    key={result.id}
                    className={`rounded-lg border transition-all ${
                      isExpanded
                        ? "border-zinc-700 bg-zinc-900/70 shadow-sm"
                        : "border-zinc-800/80 bg-zinc-900/30 hover:border-zinc-700 hover:bg-zinc-900/50"
                    }`}
                  >
                    {/* Collapsed Row */}
                    <div
                      onClick={() =>
                        setExpandedResultId(isExpanded ? null : result.id)
                      }
                      className="flex cursor-pointer items-center justify-between gap-3 p-3.5 select-none"
                    >
                      <div className="flex flex-1 items-center gap-3 min-w-0">
                        {/* Status Icon */}
                        <div
                          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border ${statusBadge.badge}`}
                        >
                          <StatusIcon className="h-3.5 w-3.5" />
                        </div>

                        {/* Method */}
                        <span
                          className={`inline-flex items-center justify-center rounded px-2 py-0.5 font-mono text-[11px] font-bold border ${methodStyle}`}
                        >
                          {result.method}
                        </span>

                        {/* Endpoint */}
                        <span className="font-mono text-xs font-medium text-zinc-200 truncate">
                          {result.endpoint}
                        </span>

                        {/* Name */}
                        <span className="text-xs text-zinc-400 truncate hidden md:inline">
                          — {result.testCaseName}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        {/* Status Comparison */}
                        <div className="flex items-center gap-1.5 font-mono text-xs">
                          <span className="text-zinc-500">Exp:</span>
                          <span className="text-zinc-300 font-medium">
                            {result.expectedStatus}
                          </span>
                          <span className="text-zinc-600">/</span>
                          <span className="text-zinc-500">Got:</span>
                          <span
                            className={`font-semibold ${
                              result.actualStatus === result.expectedStatus
                                ? "text-emerald-400"
                                : result.actualStatus === null
                                ? "text-rose-400"
                                : "text-amber-400"
                            }`}
                          >
                            {result.actualStatus !== null
                              ? result.actualStatus
                              : "ERR"}
                          </span>
                        </div>

                        {/* Latency */}
                        {result.responseTime !== null && (
                          <span
                            className={`font-mono text-[11px] px-2 py-0.5 rounded ${
                              result.responseTime < 300
                                ? "bg-emerald-500/10 text-emerald-400"
                                : result.responseTime < 1000
                                ? "bg-amber-500/10 text-amber-400"
                                : "bg-rose-500/10 text-rose-400"
                            }`}
                          >
                            {result.responseTime}ms
                          </span>
                        )}

                        {/* Expand Chevron */}
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
                      <div className="border-t border-zinc-800/80 p-4 space-y-3 text-xs bg-zinc-950/40">
                        <div>
                          <div className="font-medium text-zinc-200">
                            {result.testCaseName}
                          </div>
                          <div className="mt-1 font-mono text-[11px] text-zinc-400">
                            Target Endpoint:{" "}
                            <span className="text-zinc-300 font-semibold">
                              {result.method} {baseUrl}
                              {result.endpoint}
                            </span>
                          </div>
                        </div>

                        {/* Status Message / Error Message */}
                        {result.error && (
                          <div className="rounded-md border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
                            <span className="font-semibold text-rose-200">
                              Failure Reason:
                            </span>{" "}
                            {result.error}
                          </div>
                        )}

                        {result.status === "PASSED" && (
                          <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300">
                            <span className="font-semibold text-emerald-200">
                              Assertion Passed:
                            </span>{" "}
                            Target server returned expected HTTP status code{" "}
                            {result.expectedStatus} in {result.responseTime}ms.
                          </div>
                        )}

                        {/* Metadata Footer */}
                        <div className="flex items-center justify-between font-mono text-[10px] text-zinc-500 pt-1 border-t border-zinc-800/50">
                          <span>
                            Result ID:{" "}
                            <span className="text-zinc-400">{result.id}</span>
                          </span>
                          <span>
                            Executed:{" "}
                            <span className="text-zinc-400">
                              {new Date(result.createdAt).toLocaleString()}
                            </span>
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-zinc-800 bg-zinc-950/40 p-8 text-center text-xs text-zinc-500">
              No test results match the current filter criteria.
            </div>
          )}
        </div>
      ) : (
        /* Empty State when no runs exist */
        <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-950/60 p-12 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 text-emerald-400">
            <PlayCircle className="h-6 w-6" />
          </div>
          <h3 className="mt-4 text-base font-semibold text-zinc-100">
            No Test Runs Recorded Yet
          </h3>
          <p className="mx-auto mt-1.5 max-w-md text-xs text-zinc-400 leading-relaxed">
            {availableTestCases.length > 0
              ? `You have ${availableTestCases.length} test cases configured. Execute an automated test run to verify endpoints against your target base URL.`
              : "No test cases have been synthesized yet. Generate test cases in the Test Cases tab before running verification suites."}
          </p>

          <div className="mt-6 flex items-center justify-center gap-3">
            {availableTestCases.length > 0 ? (
              <Button
                onClick={() => handleExecuteRun()}
                disabled={isRunning}
                className="h-9 bg-emerald-600 text-xs font-medium text-white shadow hover:bg-emerald-500"
              >
                {isRunning ? (
                  <>
                    <RotateCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    Executing Suite...
                  </>
                ) : (
                  <>
                    <PlayCircle className="mr-1.5 h-3.5 w-3.5" />
                    Run All Test Cases ({availableTestCases.length})
                  </>
                )}
              </Button>
            ) : (
              <Link href={`/projects/${projectId}/tests`}>
                <Button className="h-9 bg-indigo-600 text-xs font-medium text-white hover:bg-indigo-500">
                  <FlaskConical className="mr-1.5 h-3.5 w-3.5" />
                  Configure Test Cases
                </Button>
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
