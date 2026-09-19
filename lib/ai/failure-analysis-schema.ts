import { z } from "zod";

export const FailureCategoryEnum = z.enum([
  "Request Configuration",
  "Authentication / Authorization",
  "Validation",
  "Server Error",
  "Network / Timeout",
  "Unexpected Response",
  "Unknown Cause",
]);

export type FailureCategory = z.infer<typeof FailureCategoryEnum>;

export const ConfidenceLevelEnum = z.enum(["LOW", "MEDIUM", "HIGH"]);

export type ConfidenceLevel = z.infer<typeof ConfidenceLevelEnum>;

export const FailureAnalysisSchema = z.object({
  summary: z.string().min(1, "Summary is required"),
  possibleCauses: z
    .array(z.string().min(1))
    .min(1, "At least one possible cause must be identified"),
  recommendedFixes: z
    .array(z.string().min(1))
    .min(1, "At least one recommended fix must be provided"),
  category: FailureCategoryEnum,
  confidence: ConfidenceLevelEnum,
  evidence: z
    .array(z.string().min(1))
    .min(1, "At least one concrete piece of evidence must be supplied"),
  limitations: z.array(z.string().min(1)).default([]),
});

export type FailureAnalysis = z.infer<typeof FailureAnalysisSchema>;

/**
 * Context input prepared for AI analysis of failed tests
 */
export interface FailedTestContext {
  testCaseId: string;
  name: string;
  method: string;
  endpoint: string;
  expectedStatus: number;
  actualStatus: number | null;
  category: string;
  responseTimeMs: number | null;
  error: string | null;
  headers?: Record<string, string>;
  requestBody?: unknown;
  queryParams?: Record<string, string>;
}
