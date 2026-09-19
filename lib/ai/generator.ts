import { NormalizedEndpoint } from "@/lib/openapi";
import { getGeminiClient } from "./gemini";
import {
  GeneratedTestCase,
  GeneratedTestCaseSchema,
  GeneratedTestSuiteSchema,
} from "./schema";
import { Schema, SchemaType } from "@google/generative-ai";

export interface GenerateTestCasesOptions {
  apiTitle?: string;
  apiVersion?: string;
  baseUrl?: string;
  maxEndpoints?: number;
  batchSize?: number;
}

export interface GenerationResult {
  success: boolean;
  testCases: GeneratedTestCase[];
  totalGenerated: number;
  warnings: string[];
  error?: string;
}

/**
 * Strict JSON schema for Gemini structured output.
 */
const geminiTestCaseResponseSchema: Schema = {
  type: SchemaType.OBJECT,
  description: "Synthesized API test case",
  properties: {
    name: {
      type: SchemaType.STRING,
      description: "Concise descriptive test case name",
    },
    method: {
      type: SchemaType.STRING,
      description: "HTTP method: GET, POST, PUT, DELETE, PATCH, OPTIONS, or HEAD",
    },
    endpoint: {
      type: SchemaType.STRING,
      description: "Endpoint path matching the specification",
    },
    category: {
      type: SchemaType.STRING,
      description: "Exactly one of: Functional, Validation, Edge Case, Authentication, Authorization",
    },
    description: {
      type: SchemaType.STRING,
      description: "1-2 sentence description of the test scenario",
    },
    expectedStatus: {
      type: SchemaType.INTEGER,
      description: "Expected HTTP status code as integer (e.g. 200, 400, 401, 403, 404, 422)",
    },
    expectedBehavior: {
      type: SchemaType.STRING,
      description: "Expected server behavior and response characteristics",
    },
    reasoning: {
      type: SchemaType.STRING,
      description: "Concise rationale explaining why this test is critical",
    },
    requestData: {
      type: SchemaType.OBJECT,
      description: "Request parameters, headers, and payload",
      properties: {
        headers: {
          type: SchemaType.STRING,
          description: "JSON stringified headers object, e.g. {\"Content-Type\": \"application/json\"} or empty string",
        },
        body: {
          type: SchemaType.STRING,
          description: "JSON stringified request payload, or empty string if no body",
        },
        queryParams: {
          type: SchemaType.STRING,
          description: "JSON stringified query parameters, or empty string if none",
        },
        pathParams: {
          type: SchemaType.STRING,
          description: "JSON stringified path parameters, or empty string if none",
        },
      },
    },
  },
  required: [
    "name",
    "method",
    "endpoint",
    "category",
    "description",
    "expectedStatus",
    "expectedBehavior",
    "reasoning",
  ],
};

const geminiTestSuiteResponseSchema: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    testCases: {
      type: SchemaType.ARRAY,
      description: "List of synthesized test cases",
      items: geminiTestCaseResponseSchema,
    },
  },
  required: ["testCases"],
};

/**
 * Safely extracts JSON from raw text without destructive regular expressions.
 * Handles markdown code fences only as a controlled fallback.
 */
function extractJsonFromText(rawText: string): string {
  if (!rawText || typeof rawText !== "string") {
    return "";
  }

  let text = rawText.trim();

  // Controlled fallback for markdown code fences (```json ... ``` or ``` ... ```)
  if (text.startsWith("```")) {
    const firstNewlineIndex = text.indexOf("\n");
    if (firstNewlineIndex !== -1) {
      const lastFenceIndex = text.lastIndexOf("```");
      if (lastFenceIndex > firstNewlineIndex) {
        text = text.slice(firstNewlineIndex + 1, lastFenceIndex).trim();
      }
    }
  }

  // If text contains surrounding commentary, isolate the outer JSON object or array
  const firstBrace = text.indexOf("{");
  const firstBracket = text.indexOf("[");
  let startIdx = -1;
  let endIdx = -1;

  if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
    startIdx = firstBrace;
    endIdx = text.lastIndexOf("}");
  } else if (firstBracket !== -1) {
    startIdx = firstBracket;
    endIdx = text.lastIndexOf("]");
  }

  if (startIdx !== -1 && endIdx > startIdx) {
    text = text.slice(startIdx, endIdx + 1).trim();
  }

  return text;
}

/**
 * Multi-stage safe JSON parser that handles minor formatting quirks without saving partial data.
 */
function safeParseJson(jsonString: string): { success: true; data: unknown } | { success: false; error: string } {
  // Stage 1: Standard parse
  try {
    const data = JSON.parse(jsonString);
    return { success: true, data };
  } catch (err1: unknown) {
    const origError = err1 instanceof Error ? err1.message : "Invalid JSON syntax";

    // Stage 2: Clean trailing commas before closing braces/brackets (common model quirk)
    try {
      const cleaned = jsonString.replace(/,\s*([}\]])/g, "$1");
      const data = JSON.parse(cleaned);
      return { success: true, data };
    } catch {
      // Return clear error without partial save
    }

    return {
      success: false,
      error: `${origError} (content length: ${jsonString.length} characters)`,
    };
  }
}

/**
 * Normalizes stringified subfields from structured output into valid objects for Zod validation.
 */
function normalizeRawTestCase(item: unknown): unknown {
  if (!item || typeof item !== "object") return item;
  const tc = { ...(item as Record<string, unknown>) };

  if (tc.requestData && typeof tc.requestData === "object") {
    const rd = { ...(tc.requestData as Record<string, unknown>) };

    // Normalize headers
    if (typeof rd.headers === "string") {
      const trimmed = rd.headers.trim();
      if (!trimmed || trimmed === "null" || trimmed === "{}") {
        rd.headers = {};
      } else {
        try {
          const parsed = JSON.parse(trimmed);
          rd.headers = typeof parsed === "object" && parsed !== null ? parsed : {};
        } catch {
          rd.headers = {};
        }
      }
    }

    // Normalize request body
    if (typeof rd.body === "string") {
      const trimmed = rd.body.trim();
      if (!trimmed || trimmed === "null") {
        rd.body = null;
      } else if (
        (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
        (trimmed.startsWith("[") && trimmed.endsWith("]"))
      ) {
        try {
          rd.body = JSON.parse(trimmed);
        } catch {
          // Keep as string if parsing fails
        }
      }
    }

    // Normalize queryParams
    if (typeof rd.queryParams === "string") {
      const trimmed = rd.queryParams.trim();
      if (!trimmed || trimmed === "null" || trimmed === "{}") {
        rd.queryParams = {};
      } else {
        try {
          const parsed = JSON.parse(trimmed);
          rd.queryParams = typeof parsed === "object" && parsed !== null ? parsed : {};
        } catch {
          rd.queryParams = {};
        }
      }
    }

    // Normalize pathParams
    if (typeof rd.pathParams === "string") {
      const trimmed = rd.pathParams.trim();
      if (!trimmed || trimmed === "null" || trimmed === "{}") {
        rd.pathParams = {};
      } else {
        try {
          const parsed = JSON.parse(trimmed);
          rd.pathParams = typeof parsed === "object" && parsed !== null ? parsed : {};
        } catch {
          rd.pathParams = {};
        }
      }
    }

    tc.requestData = rd;
  }

  return tc;
}

/**
 * Generates test cases for a single batch of endpoints.
 */
async function generateBatch(
  batchEndpoints: NormalizedEndpoint[],
  options: GenerateTestCasesOptions,
  batchIndex: number,
  totalBatches: number
): Promise<{ success: true; testCases: GeneratedTestCase[]; warnings: string[] } | { success: false; error: string }> {
  const { client, modelName } = getGeminiClient();

  const endpointsDigest = batchEndpoints.map((ep) => ({
    path: ep.path,
    method: ep.method,
    summary: ep.summary || "",
    description: ep.description || "",
    parameters: ep.parameters.map((p) => ({
      name: p.name,
      location: p.location,
      required: p.required,
      type: p.schemaType,
    })),
    requestBody: ep.requestBody
      ? {
          required: ep.requestBody.required,
          contentType: ep.requestBody.contentType,
          schema: ep.requestBody.schema,
          example: ep.requestBody.example,
        }
      : undefined,
    responses: ep.responses.map((r) => ({
      statusCode: r.statusCode,
      description: r.description,
    })),
  }));

  const systemInstruction = `You are a Senior QA Automation Architect and API Security Engineer.
Your task is to synthesize rigorous, high-quality test cases for OpenAPI endpoints.

For each endpoint, generate at most 1 concise test case per category:
1. "Functional": Valid parameters/payloads (expected 200, 201, 204).
2. "Validation": Invalid parameters, missing required fields, boundary violations (expected 400, 422).
3. "Edge Case": Extreme boundary values, empty strings, unusual characters, non-existent entity IDs (expected 400, 404, 422).
4. "Authentication": Missing tokens, invalid/expired tokens, malformed headers (expected 401).
5. "Authorization": Access with insufficient privileges or forbidden operations (expected 403).

CRITICAL CONSTRAINTS:
- Output ONLY a single raw JSON object matching the requested schema with a "testCases" array.
- DO NOT use markdown fences (\`\`\`json), comments, or introductory/explanatory text.
- Keep descriptions and reasoning CONCISE (1-2 sentences maximum, under 200 characters each) to prevent response truncation.
- Ensure all string values have properly escaped quotes.`;

  const userPrompt = `API Title: ${options.apiTitle || "API Specification"}
API Version: ${options.apiVersion || "1.0.0"}
Base URL: ${options.baseUrl || "http://localhost:3000"}
Batch: ${batchIndex + 1} of ${totalBatches}

ENDPOINTS:
${JSON.stringify(endpointsDigest, null, 2)}

Synthesize concise, high-value test cases for these endpoints now.`;

  // Attempt generation with structured responseSchema; fallback gracefully if model doesn't support schema
  let response;
  let usedStructuredSchema = true;

  try {
    const model = client.getGenerativeModel({
      model: modelName,
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: geminiTestSuiteResponseSchema,
        maxOutputTokens: 8192,
        temperature: 0.2,
      },
      systemInstruction,
    });

    response = await model.generateContent(userPrompt);
  } catch {
    // Safe diagnostic log (no secrets)
    console.warn(
      `[AI Test Gen] Structured schema not accepted by model ${modelName}. Falling back to standard JSON mime type.`
    );
    usedStructuredSchema = false;

    const fallbackModel = client.getGenerativeModel({
      model: modelName,
      generationConfig: {
        responseMimeType: "application/json",
        maxOutputTokens: 8192,
        temperature: 0.2,
      },
      systemInstruction,
    });

    response = await fallbackModel.generateContent(userPrompt);
  }

  // Safe diagnostics
  const candidate = response.response.candidates?.[0];
  const finishReason = candidate?.finishReason;
  const responseText = response.response.text();

  console.log(
    `[AI Test Gen] Batch ${batchIndex + 1}/${totalBatches}: model=${modelName}, endpoints=${batchEndpoints.length}, finishReason=${finishReason || "unknown"}, length=${responseText?.length || 0}, structuredSchema=${usedStructuredSchema}`
  );

  if (finishReason === "MAX_TOKENS") {
    return {
      success: false,
      error: `Gemini response exceeded maximum output token limits and was truncated (length: ${responseText.length} chars). Try reducing endpoints or configuring smaller batches.`,
    };
  }

  if (finishReason === "SAFETY") {
    return {
      success: false,
      error: "Gemini response was blocked by safety filters.",
    };
  }

  if (!responseText || responseText.trim() === "") {
    return {
      success: false,
      error: "Gemini returned an empty response.",
    };
  }

  // Controlled extraction and parsing
  const extractedJson = extractJsonFromText(responseText);
  const parseResult = safeParseJson(extractedJson);

  if (!parseResult.success) {
    return {
      success: false,
      error: `Failed to parse AI JSON response: ${parseResult.error}`,
    };
  }

  const parsedRaw = parseResult.data;
  let rawList: unknown[] = [];

  if (Array.isArray(parsedRaw)) {
    rawList = parsedRaw;
  } else if (
    parsedRaw &&
    typeof parsedRaw === "object" &&
    "testCases" in parsedRaw &&
    Array.isArray((parsedRaw as { testCases: unknown[] }).testCases)
  ) {
    rawList = (parsedRaw as { testCases: unknown[] }).testCases;
  } else {
    const suiteCheck = GeneratedTestSuiteSchema.safeParse(parsedRaw);
    if (suiteCheck.success) {
      rawList = suiteCheck.data.testCases;
    } else {
      return {
        success: false,
        error: "AI response did not contain a 'testCases' array.",
      };
    }
  }

  // Validate each item with Zod after normalization
  const validatedCases: GeneratedTestCase[] = [];
  const warnings: string[] = [];

  for (let i = 0; i < rawList.length; i++) {
    const normalized = normalizeRawTestCase(rawList[i]);
    const zodResult = GeneratedTestCaseSchema.safeParse(normalized);
    if (zodResult.success) {
      validatedCases.push(zodResult.data);
    } else {
      const msgs = zodResult.error.issues
        .map((iss) => `${iss.path.join(".")}: ${iss.message}`)
        .join("; ");
      warnings.push(`Batch ${batchIndex + 1} item #${i + 1} skipped: ${msgs}`);
    }
  }

  if (validatedCases.length === 0) {
    return {
      success: false,
      error: `All ${rawList.length} generated test cases failed Zod validation.`,
    };
  }

  return {
    success: true,
    testCases: validatedCases,
    warnings,
  };
}

/**
 * Generates structured, comprehensive test cases using Google Gemini from normalized OpenAPI endpoints.
 * Batches endpoints into small groups (default 3 endpoints per batch) to guarantee output stays
 * well under token limits, uses structured output schemas, and strictly validates all test cases with Zod.
 */
export async function generateTestCasesFromEndpoints(
  endpoints: NormalizedEndpoint[],
  options: GenerateTestCasesOptions = {}
): Promise<GenerationResult> {
  if (!endpoints || endpoints.length === 0) {
    return {
      success: false,
      testCases: [],
      totalGenerated: 0,
      warnings: [],
      error: "No endpoints provided for test case generation.",
    };
  }

  // Limit endpoints if requested
  const targetEndpoints = options.maxEndpoints
    ? endpoints.slice(0, options.maxEndpoints)
    : endpoints;

  // Batch endpoints (3 endpoints per batch is optimal for token headroom and depth)
  const batchSize = Math.max(1, options.batchSize || 3);
  const batches: NormalizedEndpoint[][] = [];
  for (let i = 0; i < targetEndpoints.length; i += batchSize) {
    batches.push(targetEndpoints.slice(i, i + batchSize));
  }

  const allTestCases: GeneratedTestCase[] = [];
  const allWarnings: string[] = [];

  for (let b = 0; b < batches.length; b++) {
    const batchResult = await generateBatch(
      batches[b],
      options,
      b,
      batches.length
    );

    if (!batchResult.success) {
      // Do not save partial test cases if a batch completely fails
      return {
        success: false,
        testCases: [],
        totalGenerated: 0,
        warnings: allWarnings,
        error: batchResult.error,
      };
    }

    allTestCases.push(...batchResult.testCases);
    allWarnings.push(...batchResult.warnings);
  }

  return {
    success: true,
    testCases: allTestCases,
    totalGenerated: allTestCases.length,
    warnings: allWarnings,
  };
}
