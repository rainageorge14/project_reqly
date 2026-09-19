import { NormalizedEndpoint } from "@/lib/openapi";
import { getGeminiClient } from "./gemini";
import {
  GeneratedTestCase,
  GeneratedTestSuiteSchema,
  GeneratedTestCaseSchema,
} from "./schema";

export interface GenerateTestCasesOptions {
  apiTitle?: string;
  apiVersion?: string;
  baseUrl?: string;
  maxEndpoints?: number;
}

export interface GenerationResult {
  success: boolean;
  testCases: GeneratedTestCase[];
  totalGenerated: number;
  warnings: string[];
  error?: string;
}

/**
 * Sanitizes and extracts JSON text from Gemini response,
 * stripping markdown wrappers if present.
 */
function cleanJsonOutput(text: string): string {
  let cleaned = text.trim();
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.replace(/^```json\s*/, "").replace(/\s*```$/, "");
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```\s*/, "").replace(/\s*```$/, "");
  }
  return cleaned.trim();
}

/**
 * Generates structured, comprehensive test cases using Google Gemini from normalized OpenAPI endpoints.
 * Validates all AI outputs with Zod schemas across Functional, Validation, Edge Case,
 * Authentication, and Authorization categories.
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

  const { client, modelName } = getGeminiClient();

  // Limit endpoint count if large to stay within optimal generation quality
  const targetEndpoints = options.maxEndpoints
    ? endpoints.slice(0, options.maxEndpoints)
    : endpoints;

  // Prepare a concise, high-signal representation of the API specification
  const endpointsDigest = targetEndpoints.map((ep) => ({
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

  const systemPrompt = `You are a Senior QA Automation Architect and API Security Engineer.
Your task is to synthesize rigorous, high-quality test cases from an OpenAPI specification.

For each endpoint provided, generate test cases across ALL five categories:
1. "Functional": Happy path verification with valid parameters and payloads (expected status 200, 201, or 204).
2. "Validation": Invalid inputs, missing required fields, boundary violations, malformed data types (expected status 400 or 422).
3. "Edge Case": Extreme values, empty strings, max strings, special characters, unicode, non-existent entity IDs (expected status 400, 404, or 422).
4. "Authentication": Requests with missing authorization tokens, invalid/expired tokens, or malformed headers (expected status 401).
5. "Authorization": Requests with tokens lacking appropriate scopes or attempting forbidden cross-tenant access (expected status 403).

CRITICAL REQUIREMENTS:
- Produce ONLY valid JSON matching this schema:
{
  "testCases": [
    {
      "name": "string (clear, descriptive test name)",
      "method": "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "OPTIONS" | "HEAD",
      "endpoint": "string (the endpoint path, e.g. /users or /items/1)",
      "category": "Functional" | "Validation" | "Edge Case" | "Authentication" | "Authorization",
      "description": "string (what this test verifies)",
      "requestData": {
        "headers": { "headerName": "headerValue" },
        "body": null or { ...valid or invalid JSON payload... },
        "queryParams": { "queryParam": "value" },
        "pathParams": { "paramName": "value" }
      },
      "expectedStatus": 200 (integer HTTP status code),
      "expectedBehavior": "string (concrete expected response behavior and message)",
      "reasoning": "string (engineering explanation of why this test is critical and what vulnerability/defect it detects)"
    }
  ]
}
- Do not output any Markdown or text outside the JSON object.
- Generate realistic, high-fidelity headers and request bodies based on the schema and examples.
- Ensure all expectedStatus values are standard integer HTTP status codes (e.g. 200, 201, 400, 401, 403, 404, 422, 500).`;

  const userPrompt = `API Title: ${options.apiTitle || "API Specification"}
API Version: ${options.apiVersion || "1.0.0"}
Base URL: ${options.baseUrl || "http://localhost:3000"}

ENDPOINTS DEFINITION:
${JSON.stringify(endpointsDigest, null, 2)}

Synthesize comprehensive test cases covering Functional, Validation, Edge Case, Authentication, and Authorization for these endpoints now.`;

  try {
    const model = client.getGenerativeModel({
      model: modelName,
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.2,
      },
      systemInstruction: systemPrompt,
    });

    const response = await model.generateContent(userPrompt);
    const responseText = response.response.text();

    if (!responseText || responseText.trim() === "") {
      return {
        success: false,
        testCases: [],
        totalGenerated: 0,
        warnings: [],
        error: "Google Gemini returned an empty response.",
      };
    }

    const cleanedJson = cleanJsonOutput(responseText);
    let parsedRaw: unknown;
    try {
      parsedRaw = JSON.parse(cleanedJson);
    } catch (parseErr) {
      return {
        success: false,
        testCases: [],
        totalGenerated: 0,
        warnings: [],
        error: `Failed to parse AI JSON response: ${parseErr instanceof Error ? parseErr.message : "Invalid JSON"}`,
      };
    }

    // Support both { testCases: [...] } and direct array [...]
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
      // Try validating root with Zod
      const suiteCheck = GeneratedTestSuiteSchema.safeParse(parsedRaw);
      if (suiteCheck.success) {
        return {
          success: true,
          testCases: suiteCheck.data.testCases,
          totalGenerated: suiteCheck.data.testCases.length,
          warnings: [],
        };
      }
      return {
        success: false,
        testCases: [],
        totalGenerated: 0,
        warnings: [],
        error: "AI response did not contain a 'testCases' array.",
      };
    }

    const validatedTestCases: GeneratedTestCase[] = [];
    const warnings: string[] = [];

    for (let i = 0; i < rawList.length; i++) {
      const item = rawList[i];
      const result = GeneratedTestCaseSchema.safeParse(item);
      if (result.success) {
        validatedTestCases.push(result.data);
      } else {
        const errorMessages = result.error.issues
          .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
          .join("; ");
        warnings.push(`Test case #${i + 1} rejected: ${errorMessages}`);
      }
    }

    if (validatedTestCases.length === 0) {
      return {
        success: false,
        testCases: [],
        totalGenerated: 0,
        warnings,
        error: `AI output validation failed: None of the ${rawList.length} generated test cases passed Zod validation.`,
      };
    }

    return {
      success: true,
      testCases: validatedTestCases,
      totalGenerated: validatedTestCases.length,
      warnings,
    };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Unknown error during AI generation";
    return {
      success: false,
      testCases: [],
      totalGenerated: 0,
      warnings: [],
      error: `Gemini API execution failure: ${message}`,
    };
  }
}
