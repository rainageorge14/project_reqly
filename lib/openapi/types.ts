export type HttpMethod =
  | "GET"
  | "POST"
  | "PUT"
  | "DELETE"
  | "PATCH"
  | "OPTIONS"
  | "HEAD";

export interface NormalizedParameter {
  name: string;
  location: "query" | "path" | "header" | "cookie";
  required: boolean;
  schemaType?: string;
  schema?: unknown;
  description?: string;
  example?: unknown;
}

export interface NormalizedRequestBody {
  required: boolean;
  contentType: string;
  schema?: unknown;
  example?: unknown;
}

export interface NormalizedResponse {
  statusCode: string;
  description: string;
  contentType?: string;
  schema?: unknown;
  example?: unknown;
}

export interface NormalizedEndpoint {
  path: string;
  method: HttpMethod;
  operationId?: string;
  summary?: string;
  description?: string;
  tags: string[];
  parameters: NormalizedParameter[];
  requestBody?: NormalizedRequestBody;
  responses: NormalizedResponse[];
  security?: unknown;
}

export interface OpenApiStats {
  totalEndpoints: number;
  getEndpoints: number;
  postEndpoints: number;
  putPatchEndpoints: number;
  deleteEndpoints: number;
  tags: string[];
}

export interface ParsedOpenApi {
  title: string;
  version: string;
  openapiVersion: string;
  description?: string;
  endpoints: NormalizedEndpoint[];
  stats: OpenApiStats;
}

export interface ParseError {
  code:
    | "EMPTY_CONTENT"
    | "OVERSIZED_CONTENT"
    | "INVALID_JSON"
    | "INVALID_YAML"
    | "MISSING_OPENAPI_VERSION"
    | "UNSUPPORTED_VERSION"
    | "MISSING_INFO"
    | "MISSING_PATHS"
    | "INVALID_STRUCTURE";
  message: string;
}
