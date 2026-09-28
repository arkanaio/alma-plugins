import { z } from "zod";

// The contract delivers absent optional fields as null, never as a missing key.
export const configurationSchema = z.object({
  organization_id: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9][A-Za-z0-9-]{0,99}$/),
});

/**
 * The continuation between pages: the site being read and Atlassian's own
 * cursor inside it. Only this connector reads it; ALMA stores it opaquely.
 */
export const cursorSchema = z
  .object({
    version: z.literal(1),
    workspace: z.string().min(1).max(500),
    users: z.string().min(1).max(1500).nullable(),
  })
  .strict();

export type Cursor = z.infer<typeof cursorSchema>;

const nullableText = z.string().trim().max(500).nullish();

// Atlassian names the plan inside a relationship whose shape varies by
// product; only the plan name is read, and anything else is ignored.
const relationshipSchema = z.array(
  z.object({
    attributes: z
      .object({ plan: z.string().trim().max(200).nullish() })
      .nullish(),
  }),
);

export const workspacePageSchema = z.object({
  data: z
    .array(
      z.object({
        id: z.string().trim().min(1).max(500),
        attributes: z.object({
          name: nullableText,
          type: nullableText,
          typeKey: z.string().trim().min(1).max(200),
          status: z.string().max(50).nullish(),
          sandbox: z.object({ type: z.string().max(50).nullish() }).nullish(),
          hostUrl: z.string().max(500).nullish(),
        }),
        relationships: z.record(z.string(), relationshipSchema).nullish(),
      }),
    )
    .max(1000)
    .default([]),
  links: z.object({ next: z.string().min(1).max(2000).nullish() }).nullish(),
});

export type Workspace = z.infer<typeof workspacePageSchema>["data"][number];

export const userPageSchema = z.object({
  data: z
    .array(
      z.object({
        accountId: z.string().trim().min(1).max(200),
        name: nullableText,
        email: nullableText,
        productAccess: z
          .array(
            z.object({
              id: z.string().max(500).nullish(),
              lastActiveTimestamp: z.string().max(100).nullish(),
            }),
          )
          .nullish(),
      }),
    )
    .max(100)
    .default([]),
  links: z.object({ next: z.string().min(1).max(1500).nullish() }).nullish(),
});
