import { z } from "zod";

// The configuration the organisation fills in, validated before any request.
// The fields declared in the manifest and this schema have to match: the
// manifest test checks it.
export const configurationSchema = z.object({
  workspace: z.string().min(1).max(64),
});
export type Configuration = z.infer<typeof configurationSchema>;

// Provider responses. Always validated before their contents reach any other
// part of the connector: a response that changes shape has to fail here, not
// produce wrong data further down.
export const subscriptionsResponseSchema = z.object({
  subscriptions: z.array(
    z.object({
      id: z.string().min(1),
      product: z.string().min(1),
      plan: z.string().min(1).nullable(),
      seats: z.number().int().nonnegative().nullable(),
      unit_price: z.string().nullable(),
      currency: z.string().length(3).nullable(),
      billing_cycle: z.enum(["monthly", "yearly"]).nullable(),
      renews_on: z.iso.date().nullable(),
    }),
  ),
  next_cursor: z.string().min(1).nullable(),
});

export const membersResponseSchema = z.object({
  members: z.array(
    z.object({
      id: z.string().min(1),
      subscription_id: z.string().min(1),
      email: z.email().nullable(),
      display_name: z.string().min(1).nullable(),
      status: z.enum(["active", "suspended", "invited"]),
      last_active_at: z.iso.datetime({ offset: true }).nullable(),
    }),
  ),
  next_cursor: z.string().min(1).nullable(),
});
