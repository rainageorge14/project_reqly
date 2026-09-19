import { TestResultStatus } from "@prisma/client";

export interface ValidationInput {
  expectedStatus: number;
  actualStatus: number | null;
  responseTimeMs: number | null;
  networkError?: string | null;
}

export interface ValidationOutput {
  status: TestResultStatus;
  error: string | null;
}

/**
 * Validates actual HTTP response properties against test case assertions.
 */
export function validateResponse(input: ValidationInput): ValidationOutput {
  const { expectedStatus, actualStatus, networkError } = input;

  // 1. Check for connection / network / timeout errors
  if (networkError) {
    return {
      status: "ERROR",
      error: networkError,
    };
  }

  if (actualStatus === null || actualStatus === undefined) {
    return {
      status: "ERROR",
      error: "No HTTP status was received from the target server.",
    };
  }

  // 2. Exact match check
  if (actualStatus === expectedStatus) {
    return {
      status: "PASSED",
      error: null,
    };
  }

  // 3. Status family tolerance (WARNING)
  // 200 OK vs 201 Created vs 204 No Content
  const isExpected2xx = expectedStatus >= 200 && expectedStatus < 300;
  const isActual2xx = actualStatus >= 200 && actualStatus < 300;
  if (isExpected2xx && isActual2xx) {
    return {
      status: "WARNING",
      error: `Expected HTTP ${expectedStatus}, but received acceptable success code HTTP ${actualStatus}.`,
    };
  }

  // 400 Bad Request vs 422 Unprocessable Entity
  const isValidationMismatch =
    (expectedStatus === 400 && actualStatus === 422) ||
    (expectedStatus === 422 && actualStatus === 400);
  if (isValidationMismatch) {
    return {
      status: "WARNING",
      error: `Expected validation HTTP ${expectedStatus}, but received related validation code HTTP ${actualStatus}.`,
    };
  }

  // 4. Mismatch check
  return {
    status: "FAILED",
    error: `Expected HTTP status ${expectedStatus}, but received HTTP status ${actualStatus}.`,
  };
}
