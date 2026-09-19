import { NormalizedEndpoint } from "@/lib/openapi";
import {
  checkAuthenticationEnforcement,
  checkErrorDisclosure,
  checkInputValidation,
  checkSecurityHeaders,
  checkInjectionDelimiterHandling,
} from "./security-checks";
import { calculateSecurityScore } from "./security-score";
import {
  SecurityCheckResult,
  SecurityCheckFinding,
  SecurityScanSummary,
} from "./security-types";

export interface SecurityRunnerOptions {
  projectId: string;
  baseUrl: string;
  endpoints: NormalizedEndpoint[];
  concurrency?: number;
}

/**
 * Orchestrates deterministic security checks across all normalized endpoints
 * with bounded concurrency and generates structured scan summaries.
 */
export async function executeSecurityScan(
  options: SecurityRunnerOptions
): Promise<SecurityScanSummary> {
  const { projectId, baseUrl, endpoints } = options;
  const start = performance.now();

  const results: SecurityCheckResult[] = [];
  const findings: SecurityCheckFinding[] = [];

  let passedCount = 0;
  let confirmedCount = 0;
  let potentialCount = 0;
  let inconclusiveCount = 0;

  // Process endpoints with bounded concurrency
  const concurrency = Math.max(1, options.concurrency || 3);

  for (let i = 0; i < endpoints.length; i += concurrency) {
    const batch = endpoints.slice(i, i + concurrency);

    const batchPromises = batch.flatMap((endpoint) => [
      checkAuthenticationEnforcement(baseUrl, endpoint),
      checkErrorDisclosure(baseUrl, endpoint),
      checkInputValidation(baseUrl, endpoint),
      checkSecurityHeaders(baseUrl, endpoint),
      checkInjectionDelimiterHandling(baseUrl, endpoint),
    ]);

    const batchResults = await Promise.all(batchPromises);

    for (const res of batchResults) {
      results.push(res);

      if (res.status === "PASSED") {
        passedCount++;
      } else if (res.status === "CONFIRMED") {
        confirmedCount++;
        if (res.finding) findings.push(res.finding);
      } else if (res.status === "POTENTIAL") {
        potentialCount++;
        if (res.finding) findings.push(res.finding);
      } else if (res.status === "INCONCLUSIVE") {
        inconclusiveCount++;
      }
    }
  }

  const durationMs = Math.round(performance.now() - start);
  const score = calculateSecurityScore(findings, inconclusiveCount);

  return {
    projectId,
    totalChecks: results.length,
    passedCount,
    confirmedCount,
    potentialCount,
    inconclusiveCount,
    durationMs,
    score,
    results,
  };
}
