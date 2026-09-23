import { z } from "zod";

// The contract delivers absent optional fields as null, never as a missing key.
export const configurationSchema = z.object({
  workspace_id: z.string().trim().toLowerCase().pipe(z.uuid()),
});

const nullableText = z.string().trim().max(500).nullish();

/**
 * One page of GET /v1/manage/workspaces/{workspace_id}/users. Only the fields
 * the connector uses are read; anything else OpenAI adds is ignored.
 */
export const userPageSchema = z.object({
  data: z
    .array(
      z.object({
        id: z.string().trim().min(1).max(200),
        email: nullableText,
        name: nullableText,
        seat_type: z.string().trim().min(1).max(50),
      }),
    )
    .max(1000),
  last_id: z.string().trim().min(1).max(200).nullish(),
  has_more: z.boolean(),
});

export type User = z.infer<typeof userPageSchema>["data"][number];

/**
 * The continuation between pages: the last user ID read, which OpenAI takes as
 * `after`. Only this connector reads it; ALMA stores it opaquely.
 */
export const cursorSchema = z
  .object({
    version: z.literal(1),
    after: z.string().min(1).max(200),
  })
  .strict();

export type Cursor = z.infer<typeof cursorSchema>;
