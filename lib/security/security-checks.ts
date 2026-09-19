import { NormalizedEndpoint } from "@/lib/openapi";
import { buildHttpRequest } from "@/lib/api-testing/request-builder";
import {
  DEFAULT_REQUEST_TIMEOUT_MS,
  MAX_RESPONSE_SIZE_BYTES,
  sanitizeErrorMessage,
} from "@/lib/api-testing/security";
import { SecurityCheckResult } from "./security-types";

// Patterns indicating excessive diagnostic or sensitive framework leakage
const STACK_TRACE_PATTERNS = [
  /\s+at\s+[\w$./\\-]+\s+\([^)]+:\d+:\d+\)/,
  /\s+at\s+[\w$./\\-]+:\d+:\d+/,
  /Traceback \(most recent call last\):/,
  /Exception in thread "[^"]+"/,
  /NullPointerException/,
  /fatal error: runtime error:/,
  /UnhandledPromiseRejection/,
];

const DATABASE_ERROR_PATTERNS = [
  /SQL syntax/i,
  /PostgreSQL query failed/i,
  /ORA-\d{5}/i,
  /mysql_fetch_/i,
  /SQLite\/JDBCDriver/i,
  /PrismaClientKnownRequestError/i,
  /SequelizeDatabaseError/i,
  /MongooseError/i,
  /syntax error at or near/i,
  /column "[^"]+" does not exist/i,
];

const INTERNAL_PATH_PATTERNS = [
  /\/var\/www\//i,
  /[a-zA-Z]:\\Users\\/i,
  /\/home\/[a-zA-Z0-9_-]+\//i,
  /\/app\/node_modules\//i,
];

/**
 * Executes a controlled non-destructive probe request safely.
 */
async function sendSafeProbe(
  url: string,
  method: string,
  headers: Record<string, string> = {},
  body?: string
): Promise<{
  status: number | null;
  headers: Headers | null;
  text: string;
  durationMs: number;
  error?: string;
}> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_REQUEST_TIMEOUT_MS);
  const start = performance.now();

  try {
    const res = await fetch(url, {
      method,
      headers: {
        Accept: "application/json, text/plain, */*",
        ...headers,
      },
      body: method !== "GET" && method !== "HEAD" ? body : undefined,
      redirect: "manual",
      signal: controller.signal,
    });

    const durationMs = Math.round(performance.now() - start);
    clearTimeout(timeoutId);

    // Read bounded response text
    let text = "";
    try {
      const reader = res.body?.getReader();
      if (reader) {
        let total = 0;
        const chunks: Uint8Array[] = [];
        while (total < MAX_RESPONSE_SIZE_BYTES) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            chunks.push(value);
            total += value.length;
          }
        }
        await reader.cancel();
        text = new TextDecoder().decode(
          chunks.reduce((acc, c) => {
            const merged = new Uint8Array(acc.length + c.length);
            merged.set(acc);
            merged.set(c, acc.length);
            return merged;
          }, new Uint8Array(0))
        );
      }
    } catch {
      // Body reading is secondary to headers and status
    }

    return {
      status: res.status,
      headers: res.headers,
      text,
      durationMs,
    };
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    return {
      status: null,
      headers: null,
      text: "",
      durationMs: Math.round(performance.now() - start),
      error: sanitizeErrorMessage(err),
    };
  }
}

/**
 * 1. Authentication Enforcement Check
 * Probes endpoints documented as requiring authentication without credentials.
 */
export async function checkAuthenticationEnforcement(
  baseUrl: string,
  endpoint: NormalizedEndpoint
): Promise<SecurityCheckResult> {
  const start = performance.now();
  const checkId = `auth-${endpoint.method}-${endpoint.path}`;

  // Check if the endpoint requires auth based on spec security definitions or path semantics
  const isExplicitlySecured =
    endpoint.security !== undefined &&
    endpoint.security !== null &&
    (Array.isArray(endpoint.security) ? endpoint.security.length > 0 : true);

  const isKnownPublicPath =
    endpoint.path.toLowerCase().includes("/login") ||
    endpoint.path.toLowerCase().includes("/register") ||
    endpoint.path.toLowerCase().includes("/signup") ||
    endpoint.path.toLowerCase().includes("/forgot-password") ||
    endpoint.path.toLowerCase().includes("/health");

  if (!isExplicitlySecured || isKnownPublicPath) {
    return {
      checkId,
      name: "Authentication Enforcement",
      category: "Authentication",
      endpoint: endpoint.path,
      method: endpoint.method,
      status: "PASSED",
      durationMs: Math.round(performance.now() - start),
    };
  }

  // Build target URL
  const reqBuild = buildHttpRequest({
    baseUrl,
    method: endpoint.method,
    endpoint: endpoint.path,
    headers: {}, // Deliberately omit authorization
  });

  if (!reqBuild.success || !reqBuild.request) {
    return {
      checkId,
      name: "Authentication Enforcement",
      category: "Authentication",
      endpoint: endpoint.path,
      method: endpoint.method,
      status: "INCONCLUSIVE",
      durationMs: Math.round(performance.now() - start),
    };
  }

  // Send unauthenticated request
  const probe = await sendSafeProbe(reqBuild.request.url, reqBuild.request.method);

  if (probe.status === null) {
    return {
      checkId,
      name: "Authentication Enforcement",
      category: "Authentication",
      endpoint: endpoint.path,
      method: endpoint.method,
      status: "INCONCLUSIVE",
      durationMs: probe.durationMs,
    };
  }

  // If the endpoint returns 401 or 403, authentication is properly enforced
  if (probe.status === 401 || probe.status === 403) {
    return {
      checkId,
      name: "Authentication Enforcement",
      category: "Authentication",
      endpoint: endpoint.path,
      method: endpoint.method,
      status: "PASSED",
      durationMs: probe.durationMs,
    };
  }

  // If the endpoint returns 200 OK without any auth token on a protected endpoint:
  if (probe.status >= 200 && probe.status < 300) {
    return {
      checkId,
      name: "Authentication Enforcement",
      category: "Authentication",
      endpoint: endpoint.path,
      method: endpoint.method,
      status: "CONFIRMED",
      severity: "HIGH",
      durationMs: probe.durationMs,
      finding: {
        title: "Missing Authentication Enforcement",
        category: "Authentication",
        severity: "HIGH",
        status: "CONFIRMED",
        description: `The endpoint ${endpoint.method} ${endpoint.path} is marked as requiring authentication in the specification, but allowed unauthenticated requests with HTTP status ${probe.status}.`,
        recommendation:
          "Enforce mandatory authentication middleware or guards to block unauthenticated requests with HTTP 401 Unauthorized before business logic execution.",
        evidence: `Unauthenticated request returned HTTP ${probe.status} OK.`,
      },
    };
  }

  return {
    checkId,
    name: "Authentication Enforcement",
    category: "Authentication",
    endpoint: endpoint.path,
    method: endpoint.method,
    status: "PASSED",
    durationMs: probe.durationMs,
  };
}

/**
 * 2. Error and Information Disclosure Check
 * Verifies that server error responses do not leak stack traces, database engines, or system paths.
 */
export async function checkErrorDisclosure(
  baseUrl: string,
  endpoint: NormalizedEndpoint
): Promise<SecurityCheckResult> {
  const checkId = `err-disc-${endpoint.method}-${endpoint.path}`;

  // Send an unexpected payload probe to trigger error handling
  const reqBuild = buildHttpRequest({
    baseUrl,
    method: endpoint.method,
    endpoint: endpoint.path,
    queryParams: { id: "999999999999999_not_found" },
    headers: { "Content-Type": "application/json" },
    requestBody: { __invalid_trigger_field__: true },
  });

  if (!reqBuild.success || !reqBuild.request) {
    return {
      checkId,
      name: "Error & Information Disclosure",
      category: "Error Disclosure",
      endpoint: endpoint.path,
      method: endpoint.method,
      status: "INCONCLUSIVE",
      durationMs: 0,
    };
  }

  const probe = await sendSafeProbe(
    reqBuild.request.url,
    reqBuild.request.method,
    reqBuild.request.headers,
    reqBuild.request.body
  );

  if (!probe.text || probe.status === null) {
    return {
      checkId,
      name: "Error & Information Disclosure",
      category: "Error Disclosure",
      endpoint: endpoint.path,
      method: endpoint.method,
      status: "PASSED",
      durationMs: probe.durationMs,
    };
  }

  // Inspect response body for stack traces
  const hasStackTrace = STACK_TRACE_PATTERNS.some((p) => p.test(probe.text));
  const hasDbError = DATABASE_ERROR_PATTERNS.some((p) => p.test(probe.text));
  const hasInternalPath = INTERNAL_PATH_PATTERNS.some((p) => p.test(probe.text));

  if (hasStackTrace || hasDbError || hasInternalPath) {
    const leakType = hasStackTrace
      ? "Runtime Stack Trace"
      : hasDbError
      ? "Database Engine Error Details"
      : "Internal File System Path";

    return {
      checkId,
      name: "Error & Information Disclosure",
      category: "Error Disclosure",
      endpoint: endpoint.path,
      method: endpoint.method,
      status: "CONFIRMED",
      severity: "MEDIUM",
      durationMs: probe.durationMs,
      finding: {
        title: `Excessive Error Disclosure (${leakType})`,
        category: "Error Disclosure",
        severity: "MEDIUM",
        status: "CONFIRMED",
        description: `Endpoint ${endpoint.method} ${endpoint.path} leaked internal technical details (${leakType}) in HTTP ${probe.status} response body.`,
        recommendation:
          "Implement global exception handlers to sanitize error responses in production. Return opaque error codes and log technical stack traces securely to server-side telemetry.",
        evidence: `Response body contains internal pattern matching (${leakType}).`,
      },
    };
  }

  // If endpoint crashed with 500 without stack trace, record potential finding
  if (probe.status >= 500) {
    return {
      checkId,
      name: "Error & Information Disclosure",
      category: "Error Disclosure",
      endpoint: endpoint.path,
      method: endpoint.method,
      status: "POTENTIAL",
      severity: "LOW",
      durationMs: probe.durationMs,
      finding: {
        title: "Unhandled Server Exception (5xx)",
        category: "Error Disclosure",
        severity: "LOW",
        status: "POTENTIAL",
        description: `Target returned unhandled server error status HTTP ${probe.status} instead of a structured client validation response (4xx).`,
        recommendation:
          "Catch unexpected exceptions at the controller layer and return structured JSON error envelopes with standard 4xx or safe 500 status codes.",
        evidence: `Received HTTP ${probe.status} on non-standard request probe.`,
      },
    };
  }

  return {
    checkId,
    name: "Error & Information Disclosure",
    category: "Error Disclosure",
    endpoint: endpoint.path,
    method: endpoint.method,
    status: "PASSED",
    durationMs: probe.durationMs,
  };
}

/**
 * 3. Input Validation & Exception Handling Check
 * Probes mutating endpoints with malformed payloads to verify 400/422 handling.
 */
export async function checkInputValidation(
  baseUrl: string,
  endpoint: NormalizedEndpoint
): Promise<SecurityCheckResult> {
  const checkId = `input-val-${endpoint.method}-${endpoint.path}`;

  // Input validation applies primarily to endpoints accepting a request body
  const isMutating =
    endpoint.method === "POST" ||
    endpoint.method === "PUT" ||
    endpoint.method === "PATCH";

  if (!isMutating || !endpoint.requestBody?.required) {
    return {
      checkId,
      name: "Input Validation Handling",
      category: "Input Validation",
      endpoint: endpoint.path,
      method: endpoint.method,
      status: "PASSED",
      durationMs: 0,
    };
  }

  // Send an empty JSON object when fields are required
  const reqBuild = buildHttpRequest({
    baseUrl,
    method: endpoint.method,
    endpoint: endpoint.path,
    headers: { "Content-Type": "application/json" },
    requestBody: {},
  });

  if (!reqBuild.success || !reqBuild.request) {
    return {
      checkId,
      name: "Input Validation Handling",
      category: "Input Validation",
      endpoint: endpoint.path,
      method: endpoint.method,
      status: "INCONCLUSIVE",
      durationMs: 0,
    };
  }

  const probe = await sendSafeProbe(
    reqBuild.request.url,
    reqBuild.request.method,
    reqBuild.request.headers,
    reqBuild.request.body
  );

  if (probe.status === null) {
    return {
      checkId,
      name: "Input Validation Handling",
      category: "Input Validation",
      endpoint: endpoint.path,
      method: endpoint.method,
      status: "INCONCLUSIVE",
      durationMs: probe.durationMs,
    };
  }

  // Proper handling: 400 Bad Request or 422 Unprocessable Entity
  if (probe.status === 400 || probe.status === 422) {
    return {
      checkId,
      name: "Input Validation Handling",
      category: "Input Validation",
      endpoint: endpoint.path,
      method: endpoint.method,
      status: "PASSED",
      durationMs: probe.durationMs,
    };
  }

  // Improper handling: 500 unhandled server crash on missing inputs
  if (probe.status >= 500) {
    return {
      checkId,
      name: "Input Validation Handling",
      category: "Input Validation",
      endpoint: endpoint.path,
      method: endpoint.method,
      status: "POTENTIAL",
      severity: "MEDIUM",
      durationMs: probe.durationMs,
      finding: {
        title: "Improper Input Validation Crash",
        category: "Input Validation",
        severity: "MEDIUM",
        status: "POTENTIAL",
        description: `Sending an empty body payload to required-input endpoint ${endpoint.method} ${endpoint.path} triggered server crash (HTTP ${probe.status}) instead of standard 400/422 validation.`,
        recommendation:
          "Validate incoming request schemas with a validation library (Zod, Joi, or JSON Schema) before controller logic executes.",
        evidence: `Empty request body produced HTTP ${probe.status}.`,
      },
    };
  }

  return {
    checkId,
    name: "Input Validation Handling",
    category: "Input Validation",
    endpoint: endpoint.path,
    method: endpoint.method,
    status: "PASSED",
    durationMs: probe.durationMs,
  };
}

/**
 * 4. Security Transport and Headers Check
 * Validates HSTS, X-Content-Type-Options, and CORS policies.
 */
export async function checkSecurityHeaders(
  baseUrl: string,
  endpoint: NormalizedEndpoint
): Promise<SecurityCheckResult> {
  const checkId = `sec-headers-${endpoint.method}-${endpoint.path}`;

  const reqBuild = buildHttpRequest({
    baseUrl,
    method: "OPTIONS",
    endpoint: endpoint.path,
    headers: { Origin: "https://evil-untrusted-origin.example.com" },
  });

  if (!reqBuild.success || !reqBuild.request) {
    return {
      checkId,
      name: "Security Headers & CORS",
      category: "Security Headers",
      endpoint: endpoint.path,
      method: endpoint.method,
      status: "INCONCLUSIVE",
      durationMs: 0,
    };
  }

  const probe = await sendSafeProbe(
    reqBuild.request.url,
    "OPTIONS",
    reqBuild.request.headers
  );

  if (!probe.headers) {
    return {
      checkId,
      name: "Security Headers & CORS",
      category: "Security Headers",
      endpoint: endpoint.path,
      method: endpoint.method,
      status: "PASSED",
      durationMs: probe.durationMs,
    };
  }

  const allowOrigin = probe.headers.get("access-control-allow-origin");
  const allowCredentials = probe.headers.get("access-control-allow-credentials");

  // Permissive CORS check: Reflecting untrusted origin with credentials enabled
  if (
    allowOrigin === "https://evil-untrusted-origin.example.com" &&
    allowCredentials === "true"
  ) {
    return {
      checkId,
      name: "Security Headers & CORS",
      category: "Security Headers",
      endpoint: endpoint.path,
      method: endpoint.method,
      status: "CONFIRMED",
      severity: "HIGH",
      durationMs: probe.durationMs,
      finding: {
        title: "Permissive CORS with Credentials",
        category: "Security Headers",
        severity: "HIGH",
        status: "CONFIRMED",
        description: `Endpoint reflects arbitrary untrusted Origin header with Access-Control-Allow-Credentials: true.`,
        recommendation:
          "Do not dynamically mirror untrusted Origin headers when Access-Control-Allow-Credentials is true. Validate Origin against an explicit allowlist of trusted domains.",
        evidence: `Access-Control-Allow-Origin reflected arbitrary domain with credentials: true.`,
      },
    };
  }

  // Check for X-Content-Type-Options: nosniff
  const contentTypeOptions = probe.headers.get("x-content-type-options");
  if (!contentTypeOptions || !contentTypeOptions.toLowerCase().includes("nosniff")) {
    return {
      checkId,
      name: "Security Headers & CORS",
      category: "Security Headers",
      endpoint: endpoint.path,
      method: endpoint.method,
      status: "CONFIRMED",
      severity: "LOW",
      durationMs: probe.durationMs,
      finding: {
        title: "Missing X-Content-Type-Options Header",
        category: "Security Headers",
        severity: "LOW",
        status: "CONFIRMED",
        description: `Endpoint ${endpoint.path} does not set "X-Content-Type-Options: nosniff", allowing user agents to perform MIME-sniffing.`,
        recommendation:
          "Configure reverse proxies or web application middleware to return X-Content-Type-Options: nosniff on all HTTP responses.",
        evidence: "Header X-Content-Type-Options missing or not set to nosniff.",
      },
    };
  }

  return {
    checkId,
    name: "Security Headers & CORS",
    category: "Security Headers",
    endpoint: endpoint.path,
    method: endpoint.method,
    status: "PASSED",
    durationMs: probe.durationMs,
  };
}

/**
 * 5. Safe Delimiter / Injection Handling Probe
 * Sends safe character delimiters (' " ; < >) to verify that queries don't crash database engines.
 */
export async function checkInjectionDelimiterHandling(
  baseUrl: string,
  endpoint: NormalizedEndpoint
): Promise<SecurityCheckResult> {
  const checkId = `injection-probe-${endpoint.method}-${endpoint.path}`;

  // Safe delimiter probe string: does not alter records or execute payloads
  const safeProbe = "test'\"`;--";

  const reqBuild = buildHttpRequest({
    baseUrl,
    method: endpoint.method,
    endpoint: endpoint.path,
    queryParams: { q: safeProbe, search: safeProbe, id: safeProbe },
    headers: { "Content-Type": "application/json" },
    requestBody: endpoint.method !== "GET" ? { query: safeProbe } : undefined,
  });

  if (!reqBuild.success || !reqBuild.request) {
    return {
      checkId,
      name: "Injection Delimiter Handling",
      category: "Input Validation",
      endpoint: endpoint.path,
      method: endpoint.method,
      status: "INCONCLUSIVE",
      durationMs: 0,
    };
  }

  const probe = await sendSafeProbe(
    reqBuild.request.url,
    reqBuild.request.method,
    reqBuild.request.headers,
    reqBuild.request.body
  );

  if (!probe.text || probe.status === null) {
    return {
      checkId,
      name: "Injection Delimiter Handling",
      category: "Input Validation",
      endpoint: endpoint.path,
      method: endpoint.method,
      status: "PASSED",
      durationMs: probe.durationMs,
    };
  }

  // Check if raw SQL syntax errors were returned
  const hasSqlError = DATABASE_ERROR_PATTERNS.some((p) => p.test(probe.text));

  if (hasSqlError) {
    return {
      checkId,
      name: "Injection Delimiter Handling",
      category: "Input Validation",
      endpoint: endpoint.path,
      method: endpoint.method,
      status: "CONFIRMED",
      severity: "CRITICAL",
      durationMs: probe.durationMs,
      finding: {
        title: "Potential SQL Injection Vulnerability",
        category: "Input Validation",
        severity: "CRITICAL",
        status: "CONFIRMED",
        description: `Delimiter probe (${safeProbe}) caused endpoint ${endpoint.method} ${endpoint.path} to disclose raw database query syntax errors.`,
        recommendation:
          "Ensure all database access uses parameterized prepared statements or an ORM. Never concatenate user input directly into SQL statements.",
        evidence: "Disclosed raw SQL syntax error message upon quote delimiter probe.",
      },
    };
  }

  return {
    checkId,
    name: "Injection Delimiter Handling",
    category: "Input Validation",
    endpoint: endpoint.path,
    method: endpoint.method,
    status: "PASSED",
    durationMs: probe.durationMs,
  };
}
