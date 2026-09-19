import YAML from "yaml";
import { ParseError } from "./types";

export const MAX_SPEC_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

export type ParseRawResult =
  | { success: true; doc: Record<string, unknown>; format: "json" | "yaml" }
  | { success: false; error: ParseError };

/**
 * Parses raw text input (detecting JSON or YAML format) into an object.
 * Enforces size limits and provides user-friendly error messages.
 */
export function parseRawSpec(
  content: string,
  filenameHint?: string
): ParseRawResult {
  if (!content || typeof content !== "string" || !content.trim()) {
    return {
      success: false,
      error: {
        code: "EMPTY_CONTENT",
        message: "Specification content is empty. Please upload or paste a valid specification.",
      },
    };
  }

  const byteLength = new TextEncoder().encode(content).length;
  if (byteLength > MAX_SPEC_SIZE_BYTES) {
    const sizeMb = (byteLength / (1024 * 1024)).toFixed(2);
    return {
      success: false,
      error: {
        code: "OVERSIZED_CONTENT",
        message: `Specification file is too large (${sizeMb} MB). Maximum allowed size is 5 MB.`,
      },
    };
  }

  const trimmed = content.trim();
  const isLikelyJson =
    (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
    (filenameHint && filenameHint.toLowerCase().endsWith(".json"));

  // Try JSON first if it looks like JSON
  if (isLikelyJson) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return { success: true, doc: parsed as Record<string, unknown>, format: "json" };
      }
      return {
        success: false,
        error: {
          code: "INVALID_STRUCTURE",
          message: "Root of OpenAPI specification must be an object, not an array or primitive.",
        },
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Malformed JSON syntax";
      return {
        success: false,
        error: {
          code: "INVALID_JSON",
          message: `Invalid JSON: ${msg}`,
        },
      };
    }
  }

  // Otherwise, parse as YAML
  try {
    const parsed = YAML.parse(trimmed);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {
        success: false,
        error: {
          code: "INVALID_STRUCTURE",
          message: "Specification document must be a valid YAML/JSON object.",
        },
      };
    }
    return { success: true, doc: parsed as Record<string, unknown>, format: "yaml" };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Malformed YAML syntax";
    // Check if it was supposed to be JSON
    if (trimmed.startsWith("{")) {
      return {
        success: false,
        error: {
          code: "INVALID_JSON",
          message: `Invalid JSON syntax: ${msg}`,
        },
      };
    }
    return {
      success: false,
      error: {
        code: "INVALID_YAML",
        message: `Invalid YAML: ${msg}`,
      },
    };
  }
}
