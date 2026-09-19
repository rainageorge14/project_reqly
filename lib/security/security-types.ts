import { SecuritySeverity } from "@prisma/client";

export type CheckStatus = "CONFIRMED" | "POTENTIAL" | "INCONCLUSIVE" | "PASSED";

export type SecurityCategory =
  | "Authentication"
  | "Authorization"
  | "Input Validation"
  | "Error Disclosure"
  | "Security Headers";

export interface SecurityCheckFinding {
  title: string;
  category: SecurityCategory;
  severity: SecuritySeverity;
  status: CheckStatus;
  description: string;
  recommendation: string;
  evidence?: string;
}

export interface SecurityCheckResult {
  checkId: string;
  name: string;
  category: SecurityCategory;
  endpoint: string;
  method: string;
  status: CheckStatus;
  severity?: SecuritySeverity;
  finding?: SecurityCheckFinding;
  durationMs: number;
}

export interface SecurityScoreDetails {
  score: number; // 0 to 100
  grade: "A+" | "A" | "B" | "C" | "D" | "F";
  summary: string;
  deductions: Array<{
    reason: string;
    points: number;
    severity: SecuritySeverity;
  }>;
  limitations: string[];
}

export interface SecurityScanSummary {
  projectId: string;
  totalChecks: number;
  passedCount: number;
  confirmedCount: number;
  potentialCount: number;
  inconclusiveCount: number;
  durationMs: number;
  score: SecurityScoreDetails;
  results: SecurityCheckResult[];
}
