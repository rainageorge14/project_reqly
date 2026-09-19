import { z } from "zod";

export const HttpMethodSchema = z.enum([
  "GET",
  "POST",
  "PUT",
  "DELETE",
  "PATCH",
  "OPTIONS",
  "HEAD",
]);

export type HttpMethod = z.infer<typeof HttpMethodSchema>;

export const TestCaseCategorySchema = z.enum([
  "Functional",
  "Validation",
  "Edge Case",
  "Authentication",
  "Authorization",
]);

export type TestCaseCategory = z.infer<typeof TestCaseCategorySchema>;

export const TestCaseRequestDataSchema = z.object({
  headers: z.record(z.string(), z.string()).optional(),
  body: z.any().optional().nullable(),
  queryParams: z.record(z.string(), z.string()).optional(),
  pathParams: z.record(z.string(), z.string()).optional(),
});

export type TestCaseRequestData = z.infer<typeof TestCaseRequestDataSchema>;

export const GeneratedTestCaseSchema = z.object({
  name: z.string().min(1, "Test case name is required"),
  method: HttpMethodSchema,
  endpoint: z.string().min(1, "Endpoint path is required"),
  category: TestCaseCategorySchema,
  description: z.string().min(1, "Description is required"),
  requestData: TestCaseRequestDataSchema.optional().default({}),
  expectedStatus: z.number().int().min(100).max(599),
  expectedBehavior: z.string().min(1, "Expected behavior is required"),
  reasoning: z.string().min(1, "Reasoning is required"),
});

export type GeneratedTestCase = z.infer<typeof GeneratedTestCaseSchema>;

export const GeneratedTestSuiteSchema = z.object({
  testCases: z.array(GeneratedTestCaseSchema),
});

export type GeneratedTestSuite = z.infer<typeof GeneratedTestSuiteSchema>;
