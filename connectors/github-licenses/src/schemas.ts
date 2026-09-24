import { z } from "zod";

const count = z.int().min(0).max(1_000_000);
const login = z.string().regex(/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/);
const nodeId = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[A-Za-z0-9_=-]+$/);

export const configurationSchema = z.object({
  organization: login,
  copilot: z.enum(["read", "skip"]),
});
export type Configuration = z.infer<typeof configurationSchema>;

export const organizationSchema = z.object({
  login,
  // GitHub only returns the plan to a token allowed to see it; a missing plan
  // is a permission problem, never a free organization.
  plan: z
    .object({
      name: z.string().trim().min(1).max(100),
      seats: count.nullish(),
      filled_seats: count.nullish(),
    })
    .nullish(),
});
export type Organization = z.infer<typeof organizationSchema>;

export const accountSchema = z.object({
  id: z.int().positive(),
  login,
  node_id: nodeId,
  type: z.string().max(50),
});
export type Account = z.infer<typeof accountSchema>;

export const accountListSchema = z.array(accountSchema).max(100);

export const copilotBillingSchema = z.object({
  seat_breakdown: z.object({ total: count }),
  plan_type: z.string().trim().max(50).nullish(),
});
export type CopilotBilling = z.infer<typeof copilotBillingSchema>;

export const copilotSeatPageSchema = z.object({
  total_seats: count,
  seats: z
    .array(
      z.object({
        // The assignee of a seat can be missing once the account is deleted.
        assignee: accountSchema.nullish(),
        last_activity_at: z.iso.datetime({ offset: true }).nullish(),
      }),
    )
    .max(100),
});

const userNodeSchema = z.object({
  databaseId: z.int().positive(),
  login,
  name: z.string().nullish(),
  organizationVerifiedDomainEmails: z.array(z.string().max(320)).max(50),
});
export type UserNode = z.infer<typeof userNodeSchema>;

export const userNodesSchema = z.object({
  data: z
    .object({
      nodes: z
        .array(
          z.union([
            userNodeSchema,
            // A node that is not a user comes back as an empty object.
            z
              .object({})
              .strict()
              .transform(() => null),
            z.null(),
          ]),
        )
        .max(100),
    })
    .nullish(),
  errors: z
    .array(z.object({ type: z.string().max(100).nullish() }))
    .max(200)
    .nullish(),
});

export const phases = ["members", "outside_collaborators", "copilot"] as const;
export type Phase = (typeof phases)[number];

export const cursorSchema = z
  .object({
    version: z.literal(1),
    phase: z.enum(phases),
    page: z.int().min(1).max(10_000),
  })
  .strict();
export type Cursor = z.infer<typeof cursorSchema>;
