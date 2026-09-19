import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * Validates AI configuration and returns server-side Gemini client.
 * Enforces that API keys remain strictly on the server side.
 */
export function getGeminiClient(): { client: GoogleGenerativeAI; modelName: string } {
  const apiKey = process.env.AI_API_KEY;
  if (!apiKey || apiKey.trim() === "") {
    throw new Error(
      "AI_API_KEY environment variable is not configured. Please set AI_API_KEY in .env.local."
    );
  }

  const modelName = process.env.AI_MODEL || "gemini-1.5-pro";
  const client = new GoogleGenerativeAI(apiKey);

  return { client, modelName };
}
