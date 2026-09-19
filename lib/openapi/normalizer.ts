import {
  HttpMethod,
  NormalizedEndpoint,
  NormalizedParameter,
  NormalizedRequestBody,
  NormalizedResponse,
  OpenApiStats,
  ParsedOpenApi,
  ParseError,
} from "./types";
import { parseRawSpec } from "./parser";
import { validateOpenApiStructure, ValidatedOpenApiDoc } from "./validator";
import { OpenApiRefResolver } from "./resolver";

const HTTP_METHODS: HttpMethod[] = [
  "GET",
  "POST",
  "PUT",
  "DELETE",
  "PATCH",
  "OPTIONS",
  "HEAD",
];

/**
 * Normalizes an OpenAPI 3.x document into strongly typed, uniform endpoint models.
 */
export function normalizeOpenApi(
  validated: ValidatedOpenApiDoc
): ParsedOpenApi {
  const resolver = new OpenApiRefResolver(validated.rawDoc);
  const endpoints: NormalizedEndpoint[] = [];
  const allTags = new Set<string>();

  const paths = validated.paths;

  for (const [pathKey, pathItemRaw] of Object.entries(paths)) {
    if (!pathItemRaw || typeof pathItemRaw !== "object") continue;

    const pathItem = resolver.deepResolve(
      pathItemRaw as Record<string, unknown>
    );

    // Extract path-level parameters if defined
    const pathLevelParams: NormalizedParameter[] = [];
    if (Array.isArray(pathItem.parameters)) {
      for (const p of pathItem.parameters) {
        const resolvedP = resolver.deepResolve(p as Record<string, unknown>);
        const normalized = normalizeParameter(resolvedP);
        if (normalized) pathLevelParams.push(normalized);
      }
    }

    // Inspect each HTTP method
    for (const method of HTTP_METHODS) {
      const lowerMethod = method.toLowerCase();
      const operationRaw = pathItem[lowerMethod];

      if (!operationRaw || typeof operationRaw !== "object") continue;

      const operation = resolver.deepResolve(
        operationRaw as Record<string, unknown>
      );

      // Extract operation-level parameters
      const operationParams: NormalizedParameter[] = [];
      if (Array.isArray(operation.parameters)) {
        for (const p of operation.parameters) {
          const resolvedP = resolver.deepResolve(p as Record<string, unknown>);
          const normalized = normalizeParameter(resolvedP);
          if (normalized) operationParams.push(normalized);
        }
      }

      // Merge path-level and operation-level parameters (operation overrides path by name+location)
      const paramMap = new Map<string, NormalizedParameter>();
      for (const p of pathLevelParams) {
        paramMap.set(`${p.location}:${p.name}`, p);
      }
      for (const p of operationParams) {
        paramMap.set(`${p.location}:${p.name}`, p);
      }
      const parameters = Array.from(paramMap.values());

      // Extract tags
      const tags: string[] = Array.isArray(operation.tags)
        ? operation.tags
            .filter((t): t is string => typeof t === "string" && t.trim().length > 0)
            .map((t) => t.trim())
        : [];
      tags.forEach((t) => allTags.add(t));

      // Extract Request Body
      let requestBody: NormalizedRequestBody | undefined = undefined;
      if (
        operation.requestBody &&
        typeof operation.requestBody === "object"
      ) {
        const rb = resolver.deepResolve(
          operation.requestBody as Record<string, unknown>
        );
        requestBody = normalizeRequestBody(rb);
      }

      // Extract Responses
      const responses: NormalizedResponse[] = [];
      if (
        operation.responses &&
        typeof operation.responses === "object"
      ) {
        const resps = resolver.deepResolve(
          operation.responses as Record<string, unknown>
        );
        for (const [code, respObj] of Object.entries(resps)) {
          if (respObj && typeof respObj === "object") {
            const resp = normalizeResponse(
              code,
              respObj as Record<string, unknown>
            );
            responses.push(resp);
          }
        }
      }

      // Security
      const security =
        operation.security ??
        (Array.isArray(validated.rawDoc.security)
          ? validated.rawDoc.security
          : undefined);

      endpoints.push({
        path: pathKey,
        method,
        operationId:
          typeof operation.operationId === "string"
            ? operation.operationId
            : undefined,
        summary:
          typeof operation.summary === "string" ? operation.summary : undefined,
        description:
          typeof operation.description === "string"
            ? operation.description
            : undefined,
        tags,
        parameters,
        requestBody,
        responses,
        security,
      });
    }
  }

  // Calculate statistics
  let getEndpoints = 0;
  let postEndpoints = 0;
  let putPatchEndpoints = 0;
  let deleteEndpoints = 0;

  for (const ep of endpoints) {
    if (ep.method === "GET") getEndpoints++;
    else if (ep.method === "POST") postEndpoints++;
    else if (ep.method === "PUT" || ep.method === "PATCH") putPatchEndpoints++;
    else if (ep.method === "DELETE") deleteEndpoints++;
  }

  const stats: OpenApiStats = {
    totalEndpoints: endpoints.length,
    getEndpoints,
    postEndpoints,
    putPatchEndpoints,
    deleteEndpoints,
    tags: Array.from(allTags).sort(),
  };

  return {
    title: validated.title,
    version: validated.version,
    openapiVersion: validated.openapiVersion,
    description: validated.description,
    endpoints,
    stats,
  };
}

function normalizeParameter(
  p: Record<string, unknown>
): NormalizedParameter | null {
  if (!p || typeof p.name !== "string" || !p.in) return null;

  const validLocations = ["query", "path", "header", "cookie"] as const;
  const inLoc = String(p.in).toLowerCase();
  if (!validLocations.includes(inLoc as (typeof validLocations)[number])) {
    return null;
  }

  const location = inLoc as "query" | "path" | "header" | "cookie";
  const required = location === "path" ? true : Boolean(p.required);

  const schema = p.schema && typeof p.schema === "object" ? p.schema : undefined;
  const schemaType =
    schema && typeof (schema as Record<string, unknown>).type === "string"
      ? (schema as Record<string, unknown>).type as string
      : undefined;

  const example =
    p.example !== undefined
      ? p.example
      : schema && (schema as Record<string, unknown>).example !== undefined
      ? (schema as Record<string, unknown>).example
      : undefined;

  return {
    name: p.name,
    location,
    required,
    schemaType,
    schema,
    description: typeof p.description === "string" ? p.description : undefined,
    example,
  };
}

function normalizeRequestBody(
  rb: Record<string, unknown>
): NormalizedRequestBody | undefined {
  const content =
    rb.content && typeof rb.content === "object"
      ? (rb.content as Record<string, unknown>)
      : undefined;

  if (!content) {
    return {
      required: Boolean(rb.required),
      contentType: "application/json",
    };
  }

  // Pick primary contentType: prefer application/json
  const contentTypes = Object.keys(content);
  const preferredType =
    contentTypes.find((t) => t.includes("json")) ||
    contentTypes[0] ||
    "application/json";

  const mediaTypeObj = content[preferredType] as
    | Record<string, unknown>
    | undefined;

  const schema =
    mediaTypeObj && typeof mediaTypeObj.schema === "object"
      ? mediaTypeObj.schema
      : undefined;

  const example =
    mediaTypeObj?.example !== undefined
      ? mediaTypeObj.example
      : schema && (schema as Record<string, unknown>).example !== undefined
      ? (schema as Record<string, unknown>).example
      : undefined;

  return {
    required: Boolean(rb.required),
    contentType: preferredType,
    schema,
    example,
  };
}

function normalizeResponse(
  statusCode: string,
  resp: Record<string, unknown>
): NormalizedResponse {
  const description =
    typeof resp.description === "string" ? resp.description : "";

  const content =
    resp.content && typeof resp.content === "object"
      ? (resp.content as Record<string, unknown>)
      : undefined;

  if (!content) {
    return {
      statusCode,
      description,
    };
  }

  const contentTypes = Object.keys(content);
  const preferredType =
    contentTypes.find((t) => t.includes("json")) ||
    contentTypes[0] ||
    "application/json";

  const mediaTypeObj = content[preferredType] as
    | Record<string, unknown>
    | undefined;

  const schema =
    mediaTypeObj && typeof mediaTypeObj.schema === "object"
      ? mediaTypeObj.schema
      : undefined;

  const example =
    mediaTypeObj?.example !== undefined
      ? mediaTypeObj.example
      : schema && (schema as Record<string, unknown>).example !== undefined
      ? (schema as Record<string, unknown>).example
      : undefined;

  return {
    statusCode,
    description,
    contentType: preferredType,
    schema,
    example,
  };
}

/**
 * Complete pipeline: parses raw JSON or YAML text, validates OpenAPI 3.x,
 * resolves local references, and normalizes into typed endpoints.
 */
export function parseAndNormalizeOpenApi(
  content: string,
  filenameHint?: string
): { success: true; result: ParsedOpenApi } | { success: false; error: ParseError } {
  // 1. Raw parse
  const parseResult = parseRawSpec(content, filenameHint);
  if (!parseResult.success) {
    return { success: false, error: parseResult.error };
  }

  // 2. Validate structure
  const valResult = validateOpenApiStructure(parseResult.doc);
  if (!valResult.success) {
    return { success: false, error: valResult.error };
  }

  // 3. Normalize & resolve
  const normalized = normalizeOpenApi(valResult.validated);
  return { success: true, result: normalized };
}
