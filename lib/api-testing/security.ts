/**
 * Security and sanitization utilities for the HTTP test execution engine.
 * Protects against SSRF, arbitrary protocol execution, resource exhaustion,
 * and sensitive credential leakage.
 */

export const DEFAULT_REQUEST_TIMEOUT_MS = 10000; // 10 seconds
export const MAX_RESPONSE_SIZE_BYTES = 1024 * 1024; // 1 MB limit to prevent DoS

// Cloud metadata and internal infrastructure destinations that must always be blocked
const BLOCKED_HOSTNAMES = new Set([
  "169.254.169.254", // AWS, GCP, Azure, OpenStack instance metadata
  "metadata.google.internal", // Google Cloud metadata
  "instance-data", // EC2 metadata alias
  "100.100.100.200", // Alibaba Cloud metadata
]);

/**
 * Validates that a target URL is safe for server-side HTTP execution.
 * Enforces http/https protocols and prevents cloud metadata SSRF.
 */
export function validateTargetUrl(rawUrl: string): {
  valid: boolean;
  error?: string;
  url?: URL;
} {
  if (!rawUrl || typeof rawUrl !== "string" || !rawUrl.trim()) {
    return { valid: false, error: "Target URL is empty." };
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    return { valid: false, error: `Invalid URL format: "${rawUrl}"` };
  }

  // 1. Protocol validation: Only http: and https: are permitted
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return {
      valid: false,
      error: `Forbidden protocol "${parsed.protocol}". Only HTTP and HTTPS are supported.`,
    };
  }

  // 2. Cloud metadata & sensitive internal hostnames blocklist
  const hostnameLower = parsed.hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(hostnameLower)) {
    return {
      valid: false,
      error: `Access to cloud metadata destination "${parsed.hostname}" is forbidden.`,
    };
  }

  // Block IPv4 link-local (169.254.x.x)
  if (hostnameLower.startsWith("169.254.")) {
    return {
      valid: false,
      error: `Access to link-local IP range (${parsed.hostname}) is forbidden.`,
    };
  }

  return { valid: true, url: parsed };
}

/**
 * Sensitive header keys that must be redacted for safe display and audit logs.
 */
const SENSITIVE_HEADER_KEYS = new Set([
  "authorization",
  "cookie",
  "set-cookie",
  "x-api-key",
  "apikey",
  "proxy-authorization",
  "x-auth-token",
  "access-token",
  "secret",
]);

/**
 * Redacts sensitive authentication tokens and headers before logging or storing in the database.
 */
export function sanitizeHeaders(
  headers: Record<string, string> | undefined | null
): Record<string, string> {
  if (!headers || typeof headers !== "object") {
    return {};
  }

  const sanitized: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (typeof value !== "string") continue;
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_HEADER_KEYS.has(lowerKey)) {
      sanitized[key] = "[REDACTED]";
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Formats a clean, safe diagnostic error message without leaking sensitive internal details.
 */
export function sanitizeErrorMessage(error: unknown): string {
  if (!error) return "Unknown execution error";

  if (error instanceof Error) {
    // Check for common network error patterns
    if (error.name === "AbortError" || error.message.includes("timeout")) {
      return "Request timed out after 10 seconds.";
    }
    if (error.message.includes("ECONNREFUSED")) {
      return "Connection refused: The target server is unreachable or offline.";
    }
    if (error.message.includes("ENOTFOUND")) {
      return "DNS lookup failed: Could not resolve target host.";
    }
    if (error.message.includes("fetch failed")) {
      return error.cause instanceof Error
        ? `Network connection failed: ${error.cause.message}`
        : "Network connection failed. Check target server availability.";
    }
    return error.message;
  }

  return String(error);
}
