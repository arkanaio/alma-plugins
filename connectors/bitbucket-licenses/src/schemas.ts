import { z } from "zod";

const identifier = z.string().trim().min(1).max(200);
export const configurationSchema = z.object({
  workspace: z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,99}$/),
  organization_id: z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9-]{0,99}$/),
  account_email: z.email().max(320),
});
const links = z
  .object({ next: z.string().min(1).max(2000).nullish() })
  .nullish();
export const workspacePageSchema = z.object({
  data: z
    .array(
      z.object({
        id: identifier,
        attributes: z.object({
          typeKey: identifier,
          hostUrl: z.string().max(500).nullish(),
        }),
      }),
    )
    .max(1000),
  links,
});
export const memberPageSchema = z.object({
  size: z.int().min(0).max(1_000_000),
  values: z
    .array(
      z.object({
        user: z.object({
          account_id: identifier,
          display_name: z.string().trim().max(500).nullish(),
        }),
      }),
    )
    .max(100),
  next: z.string().min(1).max(2000).nullish(),
});
export const userPageSchema = z.object({
  data: z
    .array(
      z.object({ accountId: identifier, email: z.string().max(320).nullish() }),
    )
    .max(100),
  links,
});
export const cursorSchema = z
  .object({
    version: z.literal(1),
    page: z.int().min(2).max(10000),
    count: z.int().min(0).max(1_000_000),
    total: z.int().min(0).max(1_000_000),
    workspaceId: identifier,
  })
  .strict();
