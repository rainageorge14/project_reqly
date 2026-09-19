import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { getProjectById } from "@/lib/services/project";
import { logAudit } from "@/lib/services/audit";
import {
  FailedTestContext,
  FailureAnalysis,
  generateFailureAnalysis,
} from "@/lib/ai";

export class NoFailuresError extends Error {
  constructor(message: string = "No failed tests found in this test run.") {
    super(message);
    this.name = "NoFailuresError";
  }
}

/**
 * Analyzes the failures of a specific test run using Gemini AI.
 * Enforces project ownership, secret redaction, and caches the analysis in PostgreSQL.
 */
export async function analyzeTestRunFailures(
  projectId: string,
  runId: string,
  userId: string
): Promise<FailureAnalysis> {
  const project = await getProjectById(projectId, userId);
  if (!project) {
    throw new Error("Project not found or access denied.");
  }

  const run = await db.testRun.findFirst({
    where: { id: runId, projectId },
    include: {
      testResults: {
        include: {
          testCase: true,
        },
      },
    },
  });

  if (!run) {
    throw new Error("Test run not found in this project.");
  }

  // Filter for failed or error results
  const failedResults = run.testResults.filter(
    (r) => r.status === "FAILED" || r.status === "ERROR"
  );

  if (failedResults.length === 0) {
    throw new NoFailuresError(
      "No failed tests to analyze in this test run. All executed tests passed."
    );
  }

  // Map to sanitized diagnostic context
  const failureContexts: FailedTestContext[] = failedResults.map((r) => ({
    testCaseId: r.testCaseId,
    name: r.testCase?.name || "Test Case",
    method: r.testCase?.method || "GET",
    endpoint: r.testCase?.endpoint || "",
    expectedStatus: r.testCase?.expectedStatus || 200,
    actualStatus: r.actualStatus,
    category: r.testCase?.category || "Functional",
    responseTimeMs: r.responseTime,
    error: r.error,
    headers: (r.testCase?.headers as Record<string, string>) || undefined,
    requestBody: r.testCase?.body || undefined,
  }));

  // Execute Gemini AI analysis
  const analysis = await generateFailureAnalysis(failureContexts);

  // Persist structured analysis to PostgreSQL on TestRun
  await db.testRun.update({
    where: { id: runId },
    data: {
      aiAnalysis: analysis as unknown as Prisma.InputJsonValue,
    },
  });

  await logAudit({
    userId,
    action: "AI_FAILURE_ANALYSIS_EXECUTE",
    metadata: {
      projectId,
      runId,
      totalFailures: failedResults.length,
      category: analysis.category,
      confidence: analysis.confidence,
    },
  });

  return analysis;
}
