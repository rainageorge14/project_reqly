import { EnrichedTestCase } from "@/lib/services/test-case";
import { TestResultStatus } from "@prisma/client";
import {
  DEFAULT_REQUEST_TIMEOUT_MS,
  MAX_RESPONSE_SIZE_BYTES,
  sanitizeErrorMessage,
} from "./security";
import { buildHttpRequest } from "./request-builder";
import { validateResponse } from "./response-validator";

export interface SingleTestExecutionResult {
  testCaseId: string;
  testCaseName: string;
  method: string;
  endpoint: string;
  targetUrl: string;
  expectedStatus: number;
  actualStatus: number | null;
  responseTime: number | null;
  status: TestResultStatus;
  error: string | null;
}

export interface TestSuiteExecutionSummary {
  totalTests: number;
  passed: number;
  failed: number;
  warnings: number;
  errors: number;
  durationMs: number;
  results: SingleTestExecutionResult[];
}

/**
 * Executes a single test case against the target server with security protections:
 * - Abort timeout (10s)
 * - Manual redirect policy (prevents SSRF redirection bypass)
 * - Response body length cap (1MB)
 * - Exact response latency measurement
 */
export async function executeSingleTestCase(
  baseUrl: string,
  testCase: EnrichedTestCase,
  timeoutMs: number = DEFAULT_REQUEST_TIMEOUT_MS
): Promise<SingleTestExecutionResult> {
  // 1. Build and validate HTTP request
  const buildResult = buildHttpRequest({
    baseUrl,
    method: testCase.method,
    endpoint: testCase.endpoint,
    headers: testCase.headers,
    requestBody: testCase.requestBody,
    queryParams: testCase.queryParams,
  });

  if (!buildResult.success || !buildResult.request) {
    return {
      testCaseId: testCase.id,
      testCaseName: testCase.name,
      method: testCase.method,
      endpoint: testCase.endpoint,
      targetUrl: baseUrl,
      expectedStatus: testCase.expectedStatus,
      actualStatus: null,
      responseTime: null,
      status: "ERROR",
      error: buildResult.error || "Failed to construct valid HTTP request.",
    };
  }

  const { url, method, headers, body } = buildResult.request;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const startTime = performance.now();

  try {
    const response = await fetch(url, {
      method,
      headers,
      body: method !== "GET" && method !== "HEAD" ? body : undefined,
      redirect: "manual", // Prevent arbitrary SSRF redirects
      signal: controller.signal,
    });

    const elapsedMs = Math.round(performance.now() - startTime);
    clearTimeout(timeoutId);

    // Drain response safely within size limits to avoid memory bloat
    try {
      const reader = response.body?.getReader();
      if (reader) {
        let bytesRead = 0;
        while (bytesRead < MAX_RESPONSE_SIZE_BYTES) {
          const { done, value } = await reader.read();
          if (done) break;
          bytesRead += value ? value.length : 0;
        }
        await reader.cancel();
      }
    } catch {
      // Ignore reader drain failures; headers and status are already received
    }

    const validation = validateResponse({
      expectedStatus: testCase.expectedStatus,
      actualStatus: response.status,
      responseTimeMs: elapsedMs,
    });

    return {
      testCaseId: testCase.id,
      testCaseName: testCase.name,
      method: testCase.method,
      endpoint: testCase.endpoint,
      targetUrl: url,
      expectedStatus: testCase.expectedStatus,
      actualStatus: response.status,
      responseTime: elapsedMs,
      status: validation.status,
      error: validation.error,
    };
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    const elapsedMs = Math.round(performance.now() - startTime);
    const cleanError = sanitizeErrorMessage(err);

    return {
      testCaseId: testCase.id,
      testCaseName: testCase.name,
      method: testCase.method,
      endpoint: testCase.endpoint,
      targetUrl: url,
      expectedStatus: testCase.expectedStatus,
      actualStatus: null,
      responseTime: elapsedMs,
      status: "ERROR",
      error: cleanError,
    };
  }
}

/**
 * Executes a collection of test cases with bounded concurrency (default 3 concurrent requests)
 * to avoid overloading target servers.
 */
export async function executeTestSuite(
  baseUrl: string,
  testCases: EnrichedTestCase[],
  options: {
    concurrency?: number;
    timeoutMs?: number;
    onProgress?: (completed: number, total: number) => void;
  } = {}
): Promise<TestSuiteExecutionSummary> {
  const concurrency = Math.max(1, options.concurrency || 3);
  const timeoutMs = options.timeoutMs || DEFAULT_REQUEST_TIMEOUT_MS;
  const total = testCases.length;

  const results: SingleTestExecutionResult[] = [];
  let passed = 0;
  let failed = 0;
  let warnings = 0;
  let errors = 0;

  const suiteStartTime = performance.now();

  // Execute in batches of `concurrency`
  for (let i = 0; i < total; i += concurrency) {
    const slice = testCases.slice(i, i + concurrency);
    const sliceResults = await Promise.all(
      slice.map((tc) => executeSingleTestCase(baseUrl, tc, timeoutMs))
    );

    for (const r of sliceResults) {
      results.push(r);
      if (r.status === "PASSED") passed++;
      else if (r.status === "FAILED") failed++;
      else if (r.status === "WARNING") warnings++;
      else errors++;
    }

    if (options.onProgress) {
      options.onProgress(results.length, total);
    }
  }

  const durationMs = Math.round(performance.now() - suiteStartTime);

  return {
    totalTests: total,
    passed,
    failed,
    warnings,
    errors,
    durationMs,
    results,
  };
}
