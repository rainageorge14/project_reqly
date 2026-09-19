import { db } from "@/lib/db";
import { getProjectById } from "@/lib/services/project";
import { logAudit } from "@/lib/services/audit";
import { parseAndNormalizeOpenApi } from "@/lib/openapi";
import {
  executeSecurityScan,
  calculateSecurityScore,
  SecurityScoreDetails,
  SecurityScanSummary,
  SecurityCheckFinding,
} from "@/lib/security";
import { SecurityFinding, SecuritySeverity, SecurityStatus } from "@prisma/client";

export interface ProjectSecurityOverview {
  projectId: string;
  projectName: string;
  baseUrl: string;
  score: SecurityScoreDetails;
  totalFindings: number;
  openFindings: number;
  resolvedFindings: number;
  mutedFindings: number;
  bySeverity: Record<SecuritySeverity, number>;
  findings: SecurityFinding[];
  lastScanDate: string | null;
}

/**
 * Executes an automated deterministic security scan on a project,
 * verifies ownership, records findings in PostgreSQL, and logs audit events.
 */
export async function runProjectSecurityScan(
  projectId: string,
  userId: string
): Promise<{ summary: SecurityScanSummary; findings: SecurityFinding[] }> {
  const project = await getProjectById(projectId, userId);
  if (!project) {
    throw new Error("Project not found or unauthorized.");
  }

  if (!project.baseUrl || !project.baseUrl.trim()) {
    throw new Error(
      "Project base URL is not configured. Please configure a valid base URL in project settings."
    );
  }

  // 1. Fetch active OpenAPI specification
  const spec = await db.apiSpec.findFirst({
    where: { projectId },
    orderBy: { createdAt: "desc" },
  });

  if (!spec || !spec.content || !spec.content.trim()) {
    throw new Error(
      "No OpenAPI specification found for this project. Please import an API specification before running security scans."
    );
  }

  const parsed = parseAndNormalizeOpenApi(spec.content);
  if (!parsed.success || parsed.result.endpoints.length === 0) {
    throw new Error(
      "The imported OpenAPI specification contains no valid endpoints to scan."
    );
  }

  // 2. Execute non-destructive security scan
  const scanSummary = await executeSecurityScan({
    projectId,
    baseUrl: project.baseUrl,
    endpoints: parsed.result.endpoints,
  });

  // 3. Persist findings to database atomically
  const savedFindings = await db.$transaction(async (tx) => {
    // Delete existing OPEN findings for fresh scan results
    await tx.securityFinding.deleteMany({
      where: { projectId, status: "OPEN" },
    });

    const created: SecurityFinding[] = [];

    for (const result of scanSummary.results) {
      if (result.finding && (result.status === "CONFIRMED" || result.status === "POTENTIAL")) {
        const item = await tx.securityFinding.create({
          data: {
            projectId,
            endpoint: `${result.method} ${result.endpoint}`,
            severity: result.finding.severity,
            title: result.finding.title,
            description: `${result.finding.description}${
              result.finding.evidence ? ` Evidence: ${result.finding.evidence}` : ""
            }`,
            recommendation: result.finding.recommendation,
            status: "OPEN",
          },
        });
        created.push(item);
      }
    }

    return created;
  });

  await logAudit({
    userId,
    action: "SECURITY_SCAN_EXECUTE",
    metadata: {
      projectId,
      totalChecks: scanSummary.totalChecks,
      findingsCount: savedFindings.length,
      score: scanSummary.score.score,
      grade: scanSummary.score.grade,
      durationMs: scanSummary.durationMs,
    },
  });

  return {
    summary: scanSummary,
    findings: savedFindings,
  };
}

/**
 * Retrieves the security posture and findings history for a project.
 */
export async function getProjectSecurityOverview(
  projectId: string,
  userId: string
): Promise<ProjectSecurityOverview | null> {
  const project = await getProjectById(projectId, userId);
  if (!project) return null;

  const findings = await db.securityFinding.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
  });

  const bySeverity: Record<SecuritySeverity, number> = {
    CRITICAL: 0,
    HIGH: 0,
    MEDIUM: 0,
    LOW: 0,
  };

  let openFindings = 0;
  let resolvedFindings = 0;
  let mutedFindings = 0;

  // Convert open findings into SecurityCheckFinding format to compute live score
  const activeCheckFindings: SecurityCheckFinding[] = [];

  for (const f of findings) {
    bySeverity[f.severity] = (bySeverity[f.severity] || 0) + 1;

    if (f.status === "OPEN") {
      openFindings++;
      activeCheckFindings.push({
        title: f.title,
        category: "Input Validation",
        severity: f.severity,
        status: "CONFIRMED",
        description: f.description,
        recommendation: f.recommendation,
      });
    } else if (f.status === "RESOLVED") {
      resolvedFindings++;
    } else if (f.status === "MUTED") {
      mutedFindings++;
    }
  }

  const score = calculateSecurityScore(activeCheckFindings, 0);

  const lastScanDate =
    findings.length > 0 ? findings[0].createdAt.toISOString() : null;

  return {
    projectId,
    projectName: project.name,
    baseUrl: project.baseUrl,
    score,
    totalFindings: findings.length,
    openFindings,
    resolvedFindings,
    mutedFindings,
    bySeverity,
    findings,
    lastScanDate,
  };
}

/**
 * Updates a finding's remediation status (OPEN, RESOLVED, MUTED).
 */
export async function updateFindingStatus(
  findingId: string,
  projectId: string,
  userId: string,
  status: SecurityStatus
): Promise<SecurityFinding> {
  const project = await getProjectById(projectId, userId);
  if (!project) {
    throw new Error("Project not found or unauthorized.");
  }

  const existing = await db.securityFinding.findFirst({
    where: { id: findingId, projectId },
  });

  if (!existing) {
    throw new Error("Security finding not found.");
  }

  const updated = await db.securityFinding.update({
    where: { id: findingId },
    data: { status },
  });

  await logAudit({
    userId,
    action: "SECURITY_FINDING_STATUS_UPDATE",
    metadata: {
      projectId,
      findingId,
      oldStatus: existing.status,
      newStatus: status,
    },
  });

  return updated;
}
