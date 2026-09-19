import { ParseError } from "./types";

export interface ValidatedOpenApiDoc {
  title: string;
  version: string;
  openapiVersion: string;
  description?: string;
  paths: Record<string, unknown>;
  rawDoc: Record<string, unknown>;
}

export type ValidationResult =
  | { success: true; validated: ValidatedOpenApiDoc }
  | { success: false; error: ParseError };

/**
 * Validates basic OpenAPI 3.x structural requirements.
 */
export function validateOpenApiStructure(
  doc: Record<string, unknown>
): ValidationResult {
  if (!doc || typeof doc !== "object" || Array.isArray(doc)) {
    return {
      success: false,
      error: {
        code: "INVALID_STRUCTURE",
        message: "Invalid specification format: root must be an object.",
      },
    };
  }

  // 1. OpenAPI Version verification
  const openapiVal = doc.openapi;
  const swaggerVal = doc.swagger;

  if (typeof swaggerVal === "string" && !openapiVal) {
    return {
      success: false,
      error: {
        code: "UNSUPPORTED_VERSION",
        message: `Unsupported OpenAPI version. Detected Swagger ${swaggerVal}. Only OpenAPI 3.x specifications are supported.`,
      },
    };
  }

  if (typeof openapiVal !== "string" || !openapiVal.trim()) {
    return {
      success: false,
      error: {
        code: "MISSING_OPENAPI_VERSION",
        message: "Missing OpenAPI version. The document must contain a top-level 'openapi: 3.x' field.",
      },
    };
  }

  const openapiVersion = openapiVal.trim();
  if (!openapiVersion.startsWith("3.")) {
    return {
      success: false,
      error: {
        code: "UNSUPPORTED_VERSION",
        message: `Unsupported OpenAPI version: "${openapiVersion}". Only OpenAPI 3.x is supported.`,
      },
    };
  }

  // 2. Info Object verification
  const info = doc.info;
  if (!info || typeof info !== "object" || Array.isArray(info)) {
    return {
      success: false,
      error: {
        code: "MISSING_INFO",
        message: "Missing required 'info' object in the specification.",
      },
    };
  }

  const infoObj = info as Record<string, unknown>;
  const title =
    typeof infoObj.title === "string" && infoObj.title.trim()
      ? infoObj.title.trim()
      : "Untitled API";

  const rawVersion = infoObj.version;
  const version =
    rawVersion !== undefined && rawVersion !== null
      ? String(rawVersion).trim() || "1.0.0"
      : "1.0.0";

  const description =
    typeof infoObj.description === "string"
      ? infoObj.description.trim()
      : undefined;

  // 3. Paths Object verification
  const paths = doc.paths;
  if (!paths || typeof paths !== "object" || Array.isArray(paths)) {
    return {
      success: false,
      error: {
        code: "MISSING_PATHS",
        message: "Missing required 'paths' object in the specification.",
      },
    };
  }

  return {
    success: true,
    validated: {
      title,
      version,
      openapiVersion,
      description,
      paths: paths as Record<string, unknown>,
      rawDoc: doc,
    },
  };
}
