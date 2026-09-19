"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  ShieldAlert,
  ShieldCheck,
  Shield,
  AlertTriangle,
  CheckCircle2,
  PlayCircle,
  RotateCw,
  Globe,
  Search,
  Info,
  Lock,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ProjectSecurityOverview } from "@/lib/services/security";
import { SecuritySeverity, SecurityStatus } from "@prisma/client";

interface SecurityClientProps {
  projectId: string;
  initialData: ProjectSecurityOverview;
}

const SEVERITY_CONFIG: Record<
  SecuritySeverity,
  { label: string; badge: string; border: string; bg: string; text: string }
> = {
  CRITICAL: {
    label: "CRITICAL",
    badge: "bg-rose-500/10 text-rose-400 border-rose-500/30",
    border: "border-rose-500/30",
    bg: "bg-rose-950/20",
    text: "text-rose-400",
  },
  HIGH: {
    label: "HIGH",
    badge: "bg-amber-500/10 text-amber-400 border-amber-500/30",
    border: "border-amber-500/30",
    bg: "bg-amber-950/20",
    text: "text-amber-400",
  },
  MEDIUM: {
    label: "MEDIUM",
    badge: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
    border: "border-yellow-500/30",
    bg: "bg-yellow-950/20",
    text: "text-yellow-400",
  },
  LOW: {
    label: "LOW",
    badge: "bg-blue-500/10 text-blue-400 border-blue-500/30",
    border: "border-blue-500/30",
    bg: "bg-blue-950/20",
    text: "text-blue-400",
  },
};

const STATUS_CONFIG: Record<
  SecurityStatus,
  { label: string; badge: string; color: string }
> = {
  OPEN: {
    label: "OPEN",
    badge: "bg-rose-500/10 text-rose-400 border-rose-500/30",
    color: "text-rose-400",
  },
  RESOLVED: {
    label: "RESOLVED",
    badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    color: "text-emerald-400",
  },
  MUTED: {
    label: "MUTED",
    badge: "bg-zinc-500/10 text-zinc-400 border-zinc-500/30",
    color: "text-zinc-400",
  },
};

function getGradeColor(grade: string): { text: string; bg: string; border: string } {
  switch (grade) {
    case "A":
      return {
        text: "text-emerald-400",
        bg: "bg-emerald-500/10",
        border: "border-emerald-500/30",
      };
    case "B":
      return {
        text: "text-blue-400",
        bg: "bg-blue-500/10",
        border: "border-blue-500/30",
      };
    case "C":
      return {
        text: "text-yellow-400",
        bg: "bg-yellow-500/10",
        border: "border-yellow-500/30",
      };
    case "D":
      return {
        text: "text-amber-400",
        bg: "bg-amber-500/10",
        border: "border-amber-500/30",
      };
    case "F":
    default:
      return {
        text: "text-rose-400",
        bg: "bg-rose-500/10",
        border: "border-rose-500/30",
      };
  }
}

export function SecurityClient({ projectId, initialData }: SecurityClientProps) {
  const [data, setData] = useState<ProjectSecurityOverview>(initialData);
  const [isScanning, setIsScanning] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Filters & State
  const [selectedSeverity, setSelectedSeverity] = useState<string>("ALL");
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedFindingId, setExpandedFindingId] = useState<string | null>(null);

  const gradeColors = getGradeColor(data.score.grade);

  // Trigger Security Scan
  async function handleRunScan() {
    setIsScanning(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await fetch(`/api/projects/${projectId}/security/scan`, {
        method: "POST",
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Security scan execution failed.");
      }

      // Re-fetch overview for updated state
      const overviewRes = await fetch(`/api/projects/${projectId}/security/scan`);
      const overviewJson = await overviewRes.json();
      if (overviewRes.ok && overviewJson.success) {
        setData(overviewJson.data);
      }

      setSuccessMessage(
        `Security inspection completed. Found ${json.summary.findingsCount} issue(s) across ${json.summary.totalChecks} checks.`
      );
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Security scan execution failed."
      );
    } finally {
      setIsScanning(false);
    }
  }

  // Update remediation status
  async function handleStatusChange(findingId: string, newStatus: SecurityStatus) {
    setUpdatingId(findingId);
    setErrorMessage(null);

    try {
      const res = await fetch(
        `/api/projects/${projectId}/security/findings/${findingId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: newStatus }),
        }
      );

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to update finding status.");
      }

      // Refresh overview data
      const overviewRes = await fetch(`/api/projects/${projectId}/security/scan`);
      const overviewJson = await overviewRes.json();
      if (overviewRes.ok && overviewJson.success) {
        setData(overviewJson.data);
      }
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to update status."
      );
    } finally {
      setUpdatingId(null);
    }
  }

  // Filtered findings list
  const filteredFindings = useMemo(() => {
    return data.findings.filter((f) => {
      if (selectedSeverity !== "ALL" && f.severity !== selectedSeverity) {
        return false;
      }
      if (selectedStatus !== "ALL" && f.status !== selectedStatus) {
        return false;
      }
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = f.title.toLowerCase().includes(query);
        const matchesEndpoint = f.endpoint.toLowerCase().includes(query);
        const matchesDesc = f.description.toLowerCase().includes(query);
        if (!matchesTitle && !matchesEndpoint && !matchesDesc) return false;
      }
      return true;
    });
  }, [data.findings, selectedSeverity, selectedStatus, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Top Banner & Action */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-5 backdrop-blur">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-indigo-400" />
            <h2 className="text-lg font-semibold text-zinc-100">
              API Security Inspection Engine
            </h2>
          </div>
          <p className="text-xs text-zinc-400">
            Deterministic vulnerability heuristics, authentication boundary
            enforcement, transport hygiene, and information leak probes.
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] text-zinc-500 font-mono">
            <span className="flex items-center gap-1">
              <Globe className="h-3 w-3 text-zinc-400" />
              Target:{" "}
              {data.baseUrl ? (
                <span className="text-zinc-300">{data.baseUrl}</span>
              ) : (
                <span className="text-amber-400">Not configured</span>
              )}
            </span>
            {data.lastScanDate && (
              <span>
                • Last Scan: {new Date(data.lastScanDate).toLocaleString()}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!data.baseUrl && (
            <Link href={`/projects/${projectId}/settings`}>
              <Button
                variant="outline"
                size="sm"
                className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10 text-xs"
              >
                Configure Base URL
              </Button>
            </Link>
          )}
          <Button
            onClick={handleRunScan}
            disabled={isScanning || !data.baseUrl}
            className="bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm gap-2 text-xs font-medium"
          >
            {isScanning ? (
              <>
                <RotateCw className="h-4 w-4 animate-spin" />
                Scanning Endpoints...
              </>
            ) : (
              <>
                <PlayCircle className="h-4 w-4" />
                Run Security Checks
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Messages */}
      {errorMessage && (
        <div className="flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-950/20 px-4 py-3 text-xs text-rose-300">
          <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
          <span>{errorMessage}</span>
        </div>
      )}
      {successMessage && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-950/20 px-4 py-3 text-xs text-emerald-300">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Score & Metrics Grid */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        {/* Security Score Card */}
        <div className="flex flex-col justify-between rounded-xl border border-zinc-800/80 bg-zinc-900/30 p-5 lg:col-span-1">
          <div>
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span className="font-medium">Security Posture</span>
              <span className="font-mono text-[11px]">Deterministic Rules</span>
            </div>

            <div className="mt-4 flex items-baseline gap-3">
              <div
                className={`flex h-14 w-14 items-center justify-center rounded-xl border font-mono text-3xl font-bold ${gradeColors.bg} ${gradeColors.text} ${gradeColors.border}`}
              >
                {data.score.grade}
              </div>
              <div>
                <div className="text-2xl font-bold text-zinc-100 font-mono">
                  {data.score.score}
                  <span className="text-sm font-normal text-zinc-500">/100</span>
                </div>
                <div className="text-xs text-zinc-400">
                  {data.openFindings === 0
                    ? "Zero active vulnerabilities"
                    : `${data.openFindings} unresolved issue(s)`}
                </div>
              </div>
            </div>
          </div>

          {/* Deductions Breakdown */}
          <div className="mt-4 border-t border-zinc-800/80 pt-3">
            <span className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">
              Score Deductions
            </span>
            <div className="mt-2 space-y-1.5 text-xs max-h-40 overflow-y-auto pr-1">
              <div className="flex justify-between text-zinc-400">
                <span>Baseline Score</span>
                <span className="font-mono text-zinc-200">100 pts</span>
              </div>
              {data.score.deductions.length === 0 ? (
                <div className="text-[11px] text-emerald-400">
                  No penalty deductions applied.
                </div>
              ) : (
                data.score.deductions.map((d, i) => (
                  <div key={i} className="flex justify-between text-rose-400">
                    <span className="truncate pr-2">{d.reason}</span>
                    <span className="font-mono shrink-0">-{d.points} pts</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Severity Metrics */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:col-span-3">
          {/* Critical */}
          <div className="flex flex-col justify-between rounded-xl border border-rose-500/20 bg-rose-950/10 p-4">
            <div className="flex items-center justify-between text-xs text-rose-400">
              <span className="font-medium">Critical</span>
              <ShieldAlert className="h-4 w-4 text-rose-400" />
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold font-mono text-rose-300">
                {data.bySeverity.CRITICAL}
              </div>
              <div className="text-[11px] text-zinc-400 mt-0.5">
                Auth bypass & stack leaks
              </div>
            </div>
          </div>

          {/* High */}
          <div className="flex flex-col justify-between rounded-xl border border-amber-500/20 bg-amber-950/10 p-4">
            <div className="flex items-center justify-between text-xs text-amber-400">
              <span className="font-medium">High</span>
              <AlertTriangle className="h-4 w-4 text-amber-400" />
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold font-mono text-amber-300">
                {data.bySeverity.HIGH}
              </div>
              <div className="text-[11px] text-zinc-400 mt-0.5">
                500 errors & input crashes
              </div>
            </div>
          </div>

          {/* Medium */}
          <div className="flex flex-col justify-between rounded-xl border border-yellow-500/20 bg-yellow-950/10 p-4">
            <div className="flex items-center justify-between text-xs text-yellow-400">
              <span className="font-medium">Medium</span>
              <ShieldCheck className="h-4 w-4 text-yellow-400" />
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold font-mono text-yellow-300">
                {data.bySeverity.MEDIUM}
              </div>
              <div className="text-[11px] text-zinc-400 mt-0.5">
                Missing security headers
              </div>
            </div>
          </div>

          {/* Low / Status */}
          <div className="flex flex-col justify-between rounded-xl border border-zinc-800/80 bg-zinc-900/30 p-4">
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span className="font-medium">Remediation</span>
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="mt-3 space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-zinc-400">Resolved</span>
                <span className="font-mono text-emerald-400">
                  {data.resolvedFindings}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-zinc-400">Muted</span>
                <span className="font-mono text-zinc-400">
                  {data.mutedFindings}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-zinc-400">Open</span>
                <span className="font-mono text-rose-400 font-bold">
                  {data.openFindings}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Supported Security Heuristics Card */}
      <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/20 p-4">
        <div className="flex items-center gap-2 text-xs font-semibold text-zinc-300 uppercase tracking-wider">
          <Lock className="h-3.5 w-3.5 text-indigo-400" />
          Automated Non-Destructive Heuristic Suite
        </div>
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 text-[11px]">
          <div className="rounded-lg border border-zinc-800/60 bg-zinc-950/40 p-2.5">
            <div className="font-medium text-zinc-200">1. Auth Enforcement</div>
            <p className="mt-0.5 text-zinc-500">
              Unauthenticated probe against secured endpoints.
            </p>
          </div>
          <div className="rounded-lg border border-zinc-800/60 bg-zinc-950/40 p-2.5">
            <div className="font-medium text-zinc-200">2. Error Disclosure</div>
            <p className="mt-0.5 text-zinc-500">
              Inspects for stack traces, DBMS signatures & paths.
            </p>
          </div>
          <div className="rounded-lg border border-zinc-800/60 bg-zinc-950/40 p-2.5">
            <div className="font-medium text-zinc-200">3. Input Validation</div>
            <p className="mt-0.5 text-zinc-500">
              Safe boundary probes: null bytes, long strings & type confusion.
            </p>
          </div>
          <div className="rounded-lg border border-zinc-800/60 bg-zinc-950/40 p-2.5">
            <div className="font-medium text-zinc-200">4. Transport & Headers</div>
            <p className="mt-0.5 text-zinc-500">
              Audits HSTS, X-Content-Type-Options, & CORS wildcard credentials.
            </p>
          </div>
          <div className="rounded-lg border border-zinc-800/60 bg-zinc-950/40 p-2.5">
            <div className="font-medium text-zinc-200">5. Injection Delimiters</div>
            <p className="mt-0.5 text-zinc-500">
              Passive delimiter tests (&apos;, &quot;, ;) for unhandled 500 crashes.
            </p>
          </div>
        </div>
      </div>

      {/* Findings Ledger Section */}
      <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/30 overflow-hidden">
        {/* Filter Bar */}
        <div className="flex flex-col gap-3 border-b border-zinc-800/80 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-500" />
              <Input
                placeholder="Search findings or endpoints..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 pl-8 text-xs bg-zinc-950 border-zinc-800"
              />
            </div>

            {/* Severity Filter */}
            <select
              value={selectedSeverity}
              onChange={(e) => setSelectedSeverity(e.target.value)}
              className="h-8 rounded-md border border-zinc-800 bg-zinc-950 px-2.5 text-xs text-zinc-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="ALL">All Severities</option>
              <option value="CRITICAL">Critical</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>

            {/* Status Filter */}
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="h-8 rounded-md border border-zinc-800 bg-zinc-950 px-2.5 text-xs text-zinc-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="OPEN">Open</option>
              <option value="RESOLVED">Resolved</option>
              <option value="MUTED">Muted</option>
            </select>
          </div>

          <div className="text-xs text-zinc-500 font-mono">
            Showing {filteredFindings.length} of {data.totalFindings} findings
          </div>
        </div>

        {/* Findings List */}
        {filteredFindings.length === 0 ? (
          <div className="p-12 text-center">
            <ShieldCheck className="mx-auto h-10 w-10 text-emerald-500/50" />
            <div className="mt-3 text-sm font-medium text-zinc-200">
              No findings match current criteria
            </div>
            <p className="mt-1 text-xs text-zinc-500">
              {data.totalFindings === 0
                ? "No security findings recorded yet. Click 'Run Security Checks' to scan active endpoints."
                : "Try adjusting your search or severity filters."}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-800/60">
            {filteredFindings.map((finding) => {
              const isExpanded = expandedFindingId === finding.id;
              const sev = SEVERITY_CONFIG[finding.severity];
              const st = STATUS_CONFIG[finding.status];

              return (
                <div
                  key={finding.id}
                  className="p-4 transition-colors hover:bg-zinc-800/20"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-mono font-bold ${sev.badge}`}
                        >
                          {sev.label}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-mono ${st.badge}`}
                        >
                          {st.label}
                        </Badge>
                        <span className="font-semibold text-sm text-zinc-100 truncate">
                          {finding.title}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-xs font-mono text-zinc-400">
                        <span className="rounded bg-zinc-950 px-2 py-0.5 border border-zinc-800">
                          {finding.endpoint}
                        </span>
                        <span className="text-[11px] text-zinc-500">
                          Discovered {new Date(finding.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    {/* Status Actions & Toggle */}
                    <div className="flex items-center gap-2 shrink-0">
                      <select
                        disabled={updatingId === finding.id}
                        value={finding.status}
                        onChange={(e) =>
                          handleStatusChange(
                            finding.id,
                            e.target.value as SecurityStatus
                          )
                        }
                        className="h-7 rounded border border-zinc-800 bg-zinc-950 px-2 text-[11px] text-zinc-300 font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      >
                        <option value="OPEN">Mark Open</option>
                        <option value="RESOLVED">Mark Resolved</option>
                        <option value="MUTED">Mute Finding</option>
                      </select>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setExpandedFindingId(isExpanded ? null : finding.id)
                        }
                        className="h-7 w-7 p-0 text-zinc-400 hover:text-zinc-200"
                      >
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Expanded Detail Panel */}
                  {isExpanded && (
                    <div className="mt-4 space-y-3 rounded-lg border border-zinc-800/80 bg-zinc-950/60 p-4 text-xs">
                      <div>
                        <span className="font-semibold text-zinc-300 uppercase tracking-wider text-[10px]">
                          Vulnerability Description & Evidence
                        </span>
                        <p className="mt-1 text-zinc-400 leading-relaxed whitespace-pre-wrap font-mono text-[11px] bg-zinc-900/60 p-2.5 rounded border border-zinc-800/60">
                          {finding.description}
                        </p>
                      </div>

                      {finding.recommendation && (
                        <div>
                          <span className="font-semibold text-emerald-400 uppercase tracking-wider text-[10px] flex items-center gap-1">
                            <Sparkles className="h-3 w-3" />
                            Remediation Guidance
                          </span>
                          <p className="mt-1 text-zinc-300 leading-relaxed">
                            {finding.recommendation}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Deterministic Disclaimer Card */}
      <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/30 p-4 text-xs text-zinc-400">
        <div className="flex items-start gap-3">
          <Info className="h-4 w-4 shrink-0 text-zinc-500 mt-0.5" />
          <div className="space-y-1.5 flex-1">
            <span className="font-medium text-zinc-200">
              Deterministic Security Engine Disclosure & Limitations
            </span>
            <p className="leading-relaxed text-zinc-400">
              {data.score.summary}
            </p>
            <ul className="list-disc list-inside space-y-1 text-[11px] text-zinc-500">
              {data.score.limitations.map((limitation, i) => (
                <li key={i}>{limitation}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
