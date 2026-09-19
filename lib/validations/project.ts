import { z } from "zod";

export const projectSchema = z.object({
  name: z
    .string()
    .min(2, "Project name must be at least 2 characters")
    .max(100, "Project name cannot exceed 100 characters")
    .trim(),
  description: z
    .string()
    .max(500, "Description cannot exceed 500 characters")
    .optional()
    .nullable()
    .transform((val) => (val && val.trim() ? val.trim() : null)),
  baseUrl: z
    .string()
    .trim()
    .refine(
      (val) => {
        try {
          const url = new URL(val);
          return url.protocol === "http:" || url.protocol === "https:";
        } catch {
          return false;
        }
      },
      {
        message: "Base URL must be a valid HTTP or HTTPS URL (e.g. https://api.example.com)",
      }
    ),
});

export type ProjectInput = z.infer<typeof projectSchema>;
