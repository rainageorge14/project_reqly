import { db } from "@/lib/db";
import { getProjectById } from "@/lib/services/project";
import { logAudit } from "@/lib/services/audit";
import { enrichTestCase, EnrichedTestCase } from "@/lib/services/test-case";
import { executeTestSuite } from "@/lib/api-testing";
import { TestRunStatus, TestResultStatus } from "@prisma/client";

export interface CreateRunOptions {
  testCaseIds?: string[];
}

export interface EnrichedTestResult {
  id: string;
  runId: string;
  testCaseId: string;
  testCaseName: string;
  method: string;
  endpoint: string;
  expectedStatus: number;
  status: TestResultStatus;
  actualStatus: number | null;
  responseTime: number | null;
  error: string | null;
  createdAt: string;
}

export interface EnrichedTestRun {
  id: string;
  projectId: string;
  status: TestRunStatus;
  totalTests: number;
  passed: number;
  failed: number;
  warnings: number;
  durationMs: number;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  results: EnrichedTestResult[];
}

/**
 * Executes test cases against a project's target base URL and stores the TestRun
 * and individual TestResult rows atomically in PostgreSQL.
 */
export async function createAndExecuteTestRun(
  projectId: string,
  userId: string,
  options: CreateRunOptions = {}
): Promise<EnrichedTestRun> {
  const project = await getProjectById(projectId, userId);
  if (!project) {
    throw new Error("Project not found or unauthorized.");
  }

  if (!project.baseUrl || !project.baseUrl.trim()) {
    throw new Error(
      "Project base URL is not configured. Please set a valid base URL in project settings."
    );
  }

  // 1. Fetch target test cases
  const whereClause: { projectId: string; id?: { in: string[] } } = {
    projectId,
  };

  if (options.testCaseIds && options.testCaseIds.length > 0) {
    whereClause.id = { in: options.testCaseIds };
  }

  const rawTestCases = await db.testCase.findMany({
    where: whereClause,
    orderBy: { createdAt: "asc" },
  });

  if (rawTestCases.length === 0) {
    throw new Error("No test cases found for execution.");
  }

  const enrichedCases: EnrichedTestCase[] = rawTestCases.map(enrichTestCase);

  // 2. Create initial TestRun record
  const initialRun = await db.testRun.create({
    data: {
      projectId,
      status: "RUNNING",
      totalTests: enrichedCases.length,
      startedAt: new Date(),
    },
  });

  // 3. Execute HTTP requests via server-side testing engine
  const executionSummary = await executeTestSuite(project.baseUrl, enrichedCases);

  // 4. Determine final test run status
  const finalStatus: TestRunStatus =
    executionSummary.failed > 0 || executionSummary.errors > 0
      ? "COMPLETED" // Completed with some failures
      : "COMPLETED";

  const completedAt = new Date();

  // 5. Atomic persistence of results and run metrics
  const savedResults = await db.$transaction(async (tx) => {
    // Save each individual test result
    const createdResults = [];
    for (const result of executionSummary.results) {
      const created = await tx.testResult.create({
        data: {
          runId: initialRun.id,
          testCaseId: result.testCaseId,
          status: result.status,
          actualStatus: result.actualStatus,
          responseTime: result.responseTime,
          error: result.error,
        },
      });
      createdResults.push(created);
    }

    // Update TestRun record
    await tx.testRun.update({
      where: { id: initialRun.id },
      data: {
        status: finalStatus,
        totalTests: executionSummary.totalTests,
        passed: executionSummary.passed,
        failed: executionSummary.failed + executionSummary.errors,
        warnings: executionSummary.warnings,
        completedAt,
      },
    });

    return createdResults;
  });

  await logAudit({
    userId,
    action: "TEST_RUN_EXECUTE",
    metadata: {
      projectId,
      runId: initialRun.id,
      totalTests: executionSummary.totalTests,
      passed: executionSummary.passed,
      failed: executionSummary.failed + executionSummary.errors,
      warnings: executionSummary.warnings,
      durationMs: executionSummary.durationMs,
    },
  });

  // 6. Return enriched result structure
  const testCaseMap = new Map(enrichedCases.map((tc) => [tc.id, tc]));

  const formattedResults: EnrichedTestResult[] = savedResults.map((r) => {
    const tc = testCaseMap.get(r.testCaseId);
    return {
      id: r.id,
      runId: r.runId,
      testCaseId: r.testCaseId,
      testCaseName: tc?.name || "Test Case",
      method: tc?.method || "GET",
      endpoint: tc?.endpoint || "",
      expectedStatus: tc?.expectedStatus || 200,
      status: r.status,
      actualStatus: r.actualStatus,
      responseTime: r.responseTime,
      error: r.error,
      createdAt: r.createdAt.toISOString(),
    };
  });

  return {
    id: initialRun.id,
    projectId,
    status: finalStatus,
    totalTests: executionSummary.totalTests,
    passed: executionSummary.passed,
    failed: executionSummary.failed + executionSummary.errors,
    warnings: executionSummary.warnings,
    durationMs: executionSummary.durationMs,
    startedAt: initialRun.startedAt ? initialRun.startedAt.toISOString() : null,
    completedAt: completedAt.toISOString(),
    createdAt: initialRun.createdAt.toISOString(),
    results: formattedResults,
  };
}

/**
 * Retrieves historical test runs for a project.
 */
export async function getProjectTestRuns(
  projectId: string,
  userId: string,
  limit: number = 20
): Promise<EnrichedTestRun[] | null> {
  const project = await getProjectById(projectId, userId);
  if (!project) return null;

  const runs = await db.testRun.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      testResults: {
        include: {
          testCase: {
            select: {
              name: true,
              method: true,
              endpoint: true,
              expectedStatus: true,
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  return runs.map((run) => {
    const durationMs =
      run.startedAt && run.completedAt
        ? Math.max(0, run.completedAt.getTime() - run.startedAt.getTime())
        : 0;

    const results: EnrichedTestResult[] = run.testResults.map((r) => ({
      id: r.id,
      runId: r.runId,
      testCaseId: r.testCaseId,
      testCaseName: r.testCase?.name || "Test Case",
      method: r.testCase?.method || "GET",
      endpoint: r.testCase?.endpoint || "",
      expectedStatus: r.testCase?.expectedStatus || 200,
      status: r.status,
      actualStatus: r.actualStatus,
      responseTime: r.responseTime,
      error: r.error,
      createdAt: r.createdAt.toISOString(),
    }));

    return {
      id: run.id,
      projectId: run.projectId,
      status: run.status,
      totalTests: run.totalTests,
      passed: run.passed,
      failed: run.failed,
      warnings: run.warnings,
      durationMs,
      startedAt: run.startedAt ? run.startedAt.toISOString() : null,
      completedAt: run.completedAt ? run.completedAt.toISOString() : null,
      createdAt: run.createdAt.toISOString(),
      results,
    };
  });
}
