import { db } from "@/lib/db";
import { getProjectById } from "@/lib/services/project";
import { logAudit } from "@/lib/services/audit";
import { GeneratedTestCase } from "@/lib/ai/schema";
import { HttpMethod } from "@prisma/client";

export interface EnrichedTestCase {
  id: string;
  projectId: string;
  name: string;
  method: HttpMethod;
  endpoint: string;
  category: string;
  source: "MANUAL" | "AI_GENERATED";
  expectedStatus: number;
  description: string;
  expectedBehavior: string;
  reasoning: string;
  headers: Record<string, string>;
  requestBody: unknown;
  queryParams: Record<string, string>;
  createdAt: string;
}

export interface TestCaseStats {
  total: number;
  aiGenerated: number;
  manual: number;
  byCategory: Record<string, number>;
  byMethod: Record<string, number>;
  categories: string[];
}

/**
 * Normalizes raw Prisma TestCase records into enriched structures,
 * unpacking the description, reasoning, expectedBehavior, and payload
 * stored safely inside headers and body JSON fields.
 */
export function enrichTestCase(record: {
  id: string;
  projectId: string;
  name: string;
  method: HttpMethod;
  endpoint: string;
  category: string;
  expectedStatus: number;
  source: "MANUAL" | "AI_GENERATED";
  headers: unknown;
  body: unknown;
  createdAt: Date;
}): EnrichedTestCase {
  const bodyObj = (record.body && typeof record.body === "object" ? record.body : {}) as Record<
    string,
    unknown
  >;
  const headersObj = (record.headers && typeof record.headers === "object"
    ? record.headers
    : {}) as Record<string, string>;

  const description =
    typeof bodyObj.description === "string"
      ? bodyObj.description
      : record.name;

  const expectedBehavior =
    typeof bodyObj.expectedBehavior === "string"
      ? bodyObj.expectedBehavior
      : `Expects HTTP status ${record.expectedStatus}`;

  const reasoning =
    typeof bodyObj.reasoning === "string"
      ? bodyObj.reasoning
      : `Synthesized ${record.category} verification for ${record.method} ${record.endpoint}.`;

  const requestBody =
    "requestBody" in bodyObj
      ? bodyObj.requestBody
      : "payload" in bodyObj
      ? bodyObj.payload
      : bodyObj.data !== undefined
      ? bodyObj.data
      : null;

  const queryParams =
    bodyObj.queryParams && typeof bodyObj.queryParams === "object"
      ? (bodyObj.queryParams as Record<string, string>)
      : {};

  return {
    id: record.id,
    projectId: record.projectId,
    name: record.name,
    method: record.method,
    endpoint: record.endpoint,
    category: record.category,
    source: record.source,
    expectedStatus: record.expectedStatus,
    description,
    expectedBehavior,
    reasoning,
    headers: headersObj,
    requestBody,
    queryParams,
    createdAt: record.createdAt.toISOString(),
  };
}

/**
 * Computes strictly real statistics from saved test cases.
 * No mock data or fake stats.
 */
export function calculateTestCaseStats(testCases: EnrichedTestCase[]): TestCaseStats {
  const byCategory: Record<string, number> = {
    Functional: 0,
    Validation: 0,
    "Edge Case": 0,
    Authentication: 0,
    Authorization: 0,
  };

  const byMethod: Record<string, number> = {};

  let aiGenerated = 0;
  let manual = 0;

  for (const tc of testCases) {
    if (tc.source === "AI_GENERATED") {
      aiGenerated++;
    } else {
      manual++;
    }

    byCategory[tc.category] = (byCategory[tc.category] || 0) + 1;
    byMethod[tc.method] = (byMethod[tc.method] || 0) + 1;
  }

  const uniqueCategories = Object.keys(byCategory).filter((c) => byCategory[c] > 0);

  return {
    total: testCases.length,
    aiGenerated,
    manual,
    byCategory,
    byMethod,
    categories: uniqueCategories,
  };
}

/**
 * Fetches all test cases for a project, verifying user ownership.
 */
export async function getProjectTestCases(
  projectId: string,
  userId: string
): Promise<{ testCases: EnrichedTestCase[]; stats: TestCaseStats } | null> {
  const project = await getProjectById(projectId, userId);
  if (!project) return null;

  const records = await db.testCase.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
  });

  const enriched = records.map(enrichTestCase);
  const stats = calculateTestCaseStats(enriched);

  return { testCases: enriched, stats };
}

/**
 * Persists AI-generated test cases into the database using Prisma TestCase model.
 */
export async function saveGeneratedTestCases(
  projectId: string,
  userId: string,
  generatedCases: GeneratedTestCase[],
  options: { clearExisting?: boolean; modelName?: string } = {}
): Promise<{ count: number; testCases: EnrichedTestCase[]; stats: TestCaseStats }> {
  const project = await getProjectById(projectId, userId);
  if (!project) {
    throw new Error("Project not found or unauthorized.");
  }

  const createdRecords = await db.$transaction(async (tx) => {
    if (options.clearExisting) {
      await tx.testCase.deleteMany({
        where: { projectId },
      });
    }

    const created = [];
    for (const tc of generatedCases) {
      const record = await tx.testCase.create({
        data: {
          projectId,
          name: tc.name,
          method: tc.method as HttpMethod,
          endpoint: tc.endpoint,
          category: tc.category,
          expectedStatus: tc.expectedStatus,
          source: "AI_GENERATED",
          headers: tc.requestData?.headers || {},
          body: {
            description: tc.description,
            expectedBehavior: tc.expectedBehavior,
            reasoning: tc.reasoning,
            requestBody: tc.requestData?.body ?? null,
            queryParams: tc.requestData?.queryParams ?? {},
            pathParams: tc.requestData?.pathParams ?? {},
          },
        },
      });
      created.push(record);
    }

    return created;
  });

  await logAudit({
    userId,
    action: "TEST_CASES_GENERATE",
    metadata: {
      projectId,
      count: createdRecords.length,
      model: options.modelName || process.env.AI_MODEL || "gemini-1.5-pro",
      clearedPrevious: !!options.clearExisting,
    },
  });

  // Re-fetch all current test cases for real stats
  const allRecords = await db.testCase.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
  });

  const enriched = allRecords.map(enrichTestCase);
  const stats = calculateTestCaseStats(enriched);

  return {
    count: createdRecords.length,
    testCases: enriched,
    stats,
  };
}

/**
 * Deletes all test cases for a project.
 */
export async function clearProjectTestCases(
  projectId: string,
  userId: string
): Promise<{ deletedCount: number }> {
  const project = await getProjectById(projectId, userId);
  if (!project) {
    throw new Error("Project not found or unauthorized.");
  }

  const deleted = await db.testCase.deleteMany({
    where: { projectId },
  });

  await logAudit({
    userId,
    action: "TEST_CASES_DELETE_ALL",
    metadata: { projectId, deletedCount: deleted.count },
  });

  return { deletedCount: deleted.count };
}
