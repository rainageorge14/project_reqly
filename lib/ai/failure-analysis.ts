import { Schema, SchemaType } from "@google/generative-ai";
import { getGeminiClient } from "./gemini";
import {
  FailedTestContext,
  FailureAnalysis,
  FailureAnalysisSchema,
} from "./failure-analysis-schema";
import { sanitizeFailuresForAi } from "./failure-analysis-redactor";

/**
 * Strict JSON schema for Gemini structured output
 */
const geminiFailureAnalysisSchema: Schema = {
  type: SchemaType.OBJECT,
  description: "Diagnostic root cause analysis of API test failures",
  properties: {
    summary: {
      type: SchemaType.STRING,
      description: "Concise executive summary of what failed and why",
    },
    possibleCauses: {
      type: SchemaType.ARRAY,
      description: "List of possible root causes based on observed behavior",
      items: { type: SchemaType.STRING },
    },
    recommendedFixes: {
      type: SchemaType.ARRAY,
      description: "Practical developer troubleshooting and remediation steps",
      items: { type: SchemaType.STRING },
    },
    category: {
      type: SchemaType.STRING,
      description:
        "Exactly one of: Request Configuration, Authentication / Authorization, Validation, Server Error, Network / Timeout, Unexpected Response, Unknown Cause",
    },
    confidence: {
      type: SchemaType.STRING,
      description: "Diagnosis confidence level: LOW, MEDIUM, or HIGH",
    },
    evidence: {
      type: SchemaType.ARRAY,
      description: "Concrete facts, status codes, and error traces observed",
      items: { type: SchemaType.STRING },
    },
    limitations: {
      type: SchemaType.ARRAY,
      description:
        "Explicit limitations of the diagnosis where evidence was incomplete",
      items: { type: SchemaType.STRING },
    },
  },
  required: [
    "summary",
    "possibleCauses",
    "recommendedFixes",
    "category",
    "confidence",
    "evidence",
    "limitations",
  ],
};

function extractJsonCandidate(text: string): string {
  let cleaned = text.trim();
  // Strip markdown code block fences if present
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "");
    cleaned = cleaned.replace(/\s*```$/, "");
  }

  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return cleaned.slice(firstBrace, lastBrace + 1);
  }

  return cleaned;
}

/**
 * Executes AI diagnostic analysis of failed API test results using Google Gemini.
 */
export async function generateFailureAnalysis(
  rawFailures: FailedTestContext[]
): Promise<FailureAnalysis> {
  if (!rawFailures || rawFailures.length === 0) {
    throw new Error("Cannot run failure analysis on empty test failures list.");
  }

  const { client, modelName } = getGeminiClient();

  // 1. Sanitize and redact all sensitive information
  const failures = sanitizeFailuresForAi(rawFailures);

  const systemInstruction = `You are a Principal API Diagnostic Architect and QA Reliability Engineer.
Your role is to diagnose real automated API test failures and provide rigorous root-cause analysis.

STRICT OPERATIONAL RULES:
1. Grounding in Evidence: Rely ONLY on the supplied test results, status codes, response times, and error messages. Do NOT invent hypothetical endpoints or fabricate response data.
2. Distinguish Facts from Hypotheses: Concrete status codes and error messages are facts. Suggested root causes are hypotheses.
3. Category Classification: You MUST classify the primary failure category as EXACTLY one of:
   - "Request Configuration" (e.g. invalid URL, missing required query param, bad JSON syntax)
   - "Authentication / Authorization" (e.g. 401 Unauthorized, 403 Forbidden, expired/missing credentials)
   - "Validation" (e.g. 400 Bad Request, 422 Unprocessable Entity, schema violation)
   - "Server Error" (e.g. 500 Internal Server Error, 502 Bad Gateway, unhandled exception in backend)
   - "Network / Timeout" (e.g. ECONNREFUSED, socket timeout, host unreachable)
   - "Unexpected Response" (e.g. expected 200 but received 204 or unexpected payload format)
   - "Unknown Cause" (when logs or status codes are insufficient to infer reason)
4. Confidence Evaluation: Set confidence to:
   - "HIGH": When exact error messages or standard HTTP status codes clearly indicate the failure mode (e.g. 401 for auth, 422 with validation errors).
   - "MEDIUM": When status codes suggest a cause but server logs/body are minimal.
   - "LOW": When a 500 error or generic timeout occurred without stack trace or explanation.
5. Actionable Fixes: Suggest practical, concrete debugging steps (e.g. checking backend routes, environment variables, validation rules, or auth headers).
6. Limitations: Always explicitly state what cannot be confirmed (e.g. "Backend server application logs and database queries were not visible to the test runner").
7. Output format: Return ONLY valid JSON matching the requested schema.`;

  const userPrompt = `Analyze the following failed API test execution results and diagnose the root cause:

${JSON.stringify(failures, null, 2)}

Provide your structured diagnostic analysis adhering strictly to the JSON schema.`;

  let responseText: string | null = null;

  try {
    const model = client.getGenerativeModel({
      model: modelName,
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: geminiFailureAnalysisSchema,
        maxOutputTokens: 2048,
        temperature: 0.2,
      },
      systemInstruction,
    });

    const result = await model.generateContent(userPrompt);
    responseText = result.response.text();
  } catch (schemaError) {
    console.warn(
      `[AI Failure Analysis] Structured schema failed with ${modelName}, falling back to prompt instructions:`,
      schemaError instanceof Error ? schemaError.message : schemaError
    );

    // Fallback without structured schema
    const fallbackModel = client.getGenerativeModel({
      model: modelName,
      generationConfig: {
        maxOutputTokens: 2048,
        temperature: 0.2,
      },
      systemInstruction,
    });

    const result = await fallbackModel.generateContent(userPrompt);
    responseText = result.response.text();
  }

  if (!responseText || !responseText.trim()) {
    throw new Error("Gemini AI returned an empty response.");
  }

  const jsonCandidate = extractJsonCandidate(responseText);
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonCandidate);
  } catch (parseErr) {
    console.error("Failed to parse Gemini response as JSON:", responseText);
    throw new Error(
      `Failed to parse Gemini failure analysis response: ${
        parseErr instanceof Error ? parseErr.message : "Invalid JSON"
      }`
    );
  }

  const validation = FailureAnalysisSchema.safeParse(parsed);
  if (!validation.success) {
    console.error(
      "Gemini failure analysis did not match schema:",
      validation.error.format()
    );
    throw new Error(
      `AI analysis validation error: ${validation.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join(", ")}`
    );
  }

  return validation.data;
}
