import { FailedTestContext } from "./failure-analysis-schema";

const SENSITIVE_HEADER_KEYS = new Set([
  "authorization",
  "proxy-authorization",
  "cookie",
  "set-cookie",
  "x-api-key",
  "api-key",
  "apikey",
  "x-auth-token",
  "x-access-token",
  "token",
  "bearer",
  "secret",
  "session",
]);

const SENSITIVE_KEY_PATTERN =
  /password|secret|token|apiKey|api_key|access_token|refresh_token|client_secret|private_key|credential|auth/i;

const JWT_BEARER_PATTERN =
  /^(Bearer\s+)?[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*$/;

const MAX_STRING_LENGTH = 2000;

/**
 * Deep-walks an arbitrary object, map, or array and sanitizes any sensitive
 * keys or values, replacing them with [REDACTED].
 */
export function deepRedact(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === "string") {
    if (JWT_BEARER_PATTERN.test(value.trim()) && value.trim().length > 30) {
      return "[REDACTED_TOKEN]";
    }
    if (value.length > MAX_STRING_LENGTH) {
      return `${value.slice(0, MAX_STRING_LENGTH)}... [TRUNCATED]`;
    }
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(deepRedact);
  }

  if (typeof value === "object") {
    const cleaned: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (typeof v === "object" && v !== null) {
        cleaned[k] = deepRedact(v);
      } else if (SENSITIVE_KEY_PATTERN.test(k)) {
        cleaned[k] = "[REDACTED]";
      } else {
        cleaned[k] = deepRedact(v);
      }
    }
    return cleaned;
  }

  return String(value);
}

/**
 * Redacts headers map, removing or masking credentials.
 */
export function redactHeaders(
  headers?: Record<string, string> | null
): Record<string, string> {
  if (!headers || typeof headers !== "object") return {};

  const cleaned: Record<string, string> = {};
  for (const [key, val] of Object.entries(headers)) {
    const lower = key.toLowerCase();
    if (SENSITIVE_HEADER_KEYS.has(lower) || SENSITIVE_KEY_PATTERN.test(lower)) {
      cleaned[key] = "[REDACTED]";
    } else if (typeof val === "string" && JWT_BEARER_PATTERN.test(val.trim())) {
      cleaned[key] = "[REDACTED_TOKEN]";
    } else {
      cleaned[key] =
        typeof val === "string" && val.length > 500
          ? `${val.slice(0, 500)}... [TRUNCATED]`
          : String(val);
    }
  }
  return cleaned;
}

/**
 * Sanitizes and securely redacts a list of failed test execution contexts
 * before passing them to the Gemini AI model.
 */
export function sanitizeFailuresForAi(
  failures: FailedTestContext[]
): FailedTestContext[] {
  return failures.map((f) => {
    // Redact headers
    const sanitizedHeaders = redactHeaders(f.headers);

    // Redact body
    const sanitizedBody = deepRedact(f.requestBody);

    // Redact query params
    let sanitizedParams: Record<string, string> | undefined = undefined;
    if (f.queryParams && typeof f.queryParams === "object") {
      sanitizedParams = {};
      for (const [k, v] of Object.entries(f.queryParams)) {
        if (SENSITIVE_KEY_PATTERN.test(k)) {
          sanitizedParams[k] = "[REDACTED]";
        } else {
          sanitizedParams[k] =
            typeof v === "string" && v.length > 500
              ? `${v.slice(0, 500)}... [TRUNCATED]`
              : String(v);
        }
      }
    }

    // Sanitize error message (cap length and remove local file paths or passwords)
    let sanitizedError = f.error || null;
    if (sanitizedError && sanitizedError.length > MAX_STRING_LENGTH) {
      sanitizedError = `${sanitizedError.slice(0, MAX_STRING_LENGTH)}... [TRUNCATED]`;
    }

    return {
      testCaseId: f.testCaseId,
      name: f.name,
      method: f.method,
      endpoint: f.endpoint,
      expectedStatus: f.expectedStatus,
      actualStatus: f.actualStatus,
      category: f.category,
      responseTimeMs: f.responseTimeMs,
      error: sanitizedError,
      headers: sanitizedHeaders,
      requestBody: sanitizedBody,
      queryParams: sanitizedParams,
    };
  });
}
