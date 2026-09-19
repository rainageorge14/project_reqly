import { validateTargetUrl } from "./security";

export interface RequestBuilderInput {
  baseUrl: string;
  method: string;
  endpoint: string;
  headers?: Record<string, string> | null;
  requestBody?: unknown;
  queryParams?: Record<string, string> | null;
  pathParams?: Record<string, string> | null;
}

export interface PreparedHttpRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
}

export interface BuildRequestResult {
  success: boolean;
  request?: PreparedHttpRequest;
  error?: string;
}

/**
 * Replaces templated path parameters (e.g., /users/{id} or /users/:id)
 * with provided pathParams or sensible defaults.
 */
function substitutePathParams(
  endpoint: string,
  pathParams?: Record<string, string> | null
): string {
  let resolved = endpoint;
  const params = pathParams || {};

  // Handle {param} format
  resolved = resolved.replace(/\{([a-zA-Z0-9_-]+)\}/g, (match, paramName) => {
    if (params[paramName] !== undefined && params[paramName] !== "") {
      return encodeURIComponent(params[paramName]);
    }
    // Fallback: If no value provided, substitute a default value
    if (paramName.toLowerCase().includes("id")) return "1";
    return "test";
  });

  // Handle :param format
  resolved = resolved.replace(/:([a-zA-Z0-9_-]+)/g, (match, paramName) => {
    if (params[paramName] !== undefined && params[paramName] !== "") {
      return encodeURIComponent(params[paramName]);
    }
    if (paramName.toLowerCase().includes("id")) return "1";
    return "test";
  });

  return resolved;
}

/**
 * Builds and validates a clean HTTP request from base URL and test case definition.
 */
export function buildHttpRequest(input: RequestBuilderInput): BuildRequestResult {
  const { baseUrl, method, endpoint, headers, requestBody, queryParams, pathParams } =
    input;

  if (!baseUrl || typeof baseUrl !== "string" || !baseUrl.trim()) {
    return {
      success: false,
      error: "Project base URL is not configured. Please set a valid base URL in project settings.",
    };
  }

  // 1. Resolve path parameters
  const resolvedPath = substitutePathParams(endpoint.trim(), pathParams);

  // 2. Join base URL and resolved path cleanly
  let fullUrlString: string;
  try {
    const trimmedBase = baseUrl.trim().replace(/\/+$/, "");
    const trimmedPath = resolvedPath.startsWith("/") ? resolvedPath : `/${resolvedPath}`;
    fullUrlString = `${trimmedBase}${trimmedPath}`;
  } catch {
    return {
      success: false,
      error: `Could not combine base URL "${baseUrl}" and endpoint "${endpoint}".`,
    };
  }

  // 3. Append query parameters
  let targetUrl: URL;
  try {
    targetUrl = new URL(fullUrlString);
    if (queryParams && typeof queryParams === "object") {
      for (const [key, value] of Object.entries(queryParams)) {
        if (value !== undefined && value !== null && value !== "") {
          targetUrl.searchParams.append(key, String(value));
        }
      }
    }
  } catch {
    return {
      success: false,
      error: `Failed to construct valid target URL from "${fullUrlString}".`,
    };
  }

  // 4. Validate security constraints on final target URL
  const securityCheck = validateTargetUrl(targetUrl.toString());
  if (!securityCheck.valid) {
    return {
      success: false,
      error: securityCheck.error || "Target URL failed security verification.",
    };
  }

  // 5. Build and normalize headers
  const upperMethod = method.toUpperCase().trim();
  const requestHeaders: Record<string, string> = {
    Accept: "application/json, text/plain, */*",
    ...headers,
  };

  // 6. Build request body for non-GET/HEAD methods
  let bodyPayload: string | undefined = undefined;
  const methodsWithBody = new Set(["POST", "PUT", "PATCH", "DELETE"]);

  if (methodsWithBody.has(upperMethod) && requestBody !== undefined && requestBody !== null) {
    if (typeof requestBody === "string") {
      bodyPayload = requestBody;
    } else {
      try {
        bodyPayload = JSON.stringify(requestBody);
      } catch (err: unknown) {
        return {
          success: false,
          error: `Failed to serialize request body to JSON: ${err instanceof Error ? err.message : "Unknown serialization error"}`,
        };
      }
    }

    if (!requestHeaders["Content-Type"] && !requestHeaders["content-type"]) {
      requestHeaders["Content-Type"] = "application/json";
    }
  }

  return {
    success: true,
    request: {
      url: targetUrl.toString(),
      method: upperMethod,
      headers: requestHeaders,
      body: bodyPayload,
    },
  };
}
