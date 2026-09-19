import { SecurityCheckFinding, SecurityScoreDetails } from "./security-types";

/**
 * Transparent, deterministic score calculation based on identified security findings.
 * Starts at 100 points and applies severity-weighted deductions.
 */
export function calculateSecurityScore(
  findings: SecurityCheckFinding[],
  inconclusiveCount: number = 0
): SecurityScoreDetails {
  let score = 100;
  const deductions: SecurityScoreDetails["deductions"] = [];

  for (const finding of findings) {
    let points = 0;

    if (finding.severity === "CRITICAL") {
      points = finding.status === "CONFIRMED" ? 30 : 15;
    } else if (finding.severity === "HIGH") {
      points = finding.status === "CONFIRMED" ? 20 : 10;
    } else if (finding.severity === "MEDIUM") {
      points = finding.status === "CONFIRMED" ? 10 : 5;
    } else if (finding.severity === "LOW") {
      points = finding.status === "CONFIRMED" ? 3 : 1;
    }

    if (points > 0) {
      score = Math.max(0, score - points);
      deductions.push({
        reason: `${finding.title} (${finding.status})`,
        points,
        severity: finding.severity,
      });
    }
  }

  // Determine letter grade
  let grade: SecurityScoreDetails["grade"] = "F";
  if (score >= 95) grade = "A+";
  else if (score >= 90) grade = "A";
  else if (score >= 80) grade = "B";
  else if (score >= 70) grade = "C";
  else if (score >= 60) grade = "D";
  else grade = "F";

  const limitations = [
    "Deterministic Rule Base: The score is computed strictly from automated, non-destructive HTTP checks.",
    "No Active Penetration Testing: The engine does not perform stateful multi-step exploit chains, token extraction, or denial-of-service tests.",
    "Inconclusive Checks: Inconclusive checks (due to network timeout or unconfigured environments) do not reduce the score but indicate unverified attack surface.",
    "Context Limitations: Automated tools cannot assess business logic authorization rules that depend on proprietary domain knowledge.",
  ];

  let summary = `Security posture index evaluated at ${score}/100 (Grade ${grade}).`;
  if (findings.length === 0) {
    summary += " All executed deterministic security checks passed with zero findings.";
  } else {
    summary += ` ${findings.length} findings resulted in ${100 - score} deduction points.`;
  }

  if (inconclusiveCount > 0) {
    summary += ` Note: ${inconclusiveCount} checks were inconclusive.`;
  }

  return {
    score,
    grade,
    summary,
    deductions,
    limitations,
  };
}
