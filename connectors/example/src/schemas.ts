import { z } from "zod";

/**
 * The provider's responses.
 *
 * They are validated before their contents reach any other part of the
 * connector. ALMA validates the page this connector returns, but that check
 * cannot tell a missing field from one the provider renamed: this one can, and
 * it fails loudly instead of quietly returning nulls.
 */
export const seatsResponseSchema = z.object({
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
  subscriptions: z.array(
    z.object({
      id: z.string().min(1),
      product: z.string().min(1),
      seats: z.number().int().nonnegative().nullable(),
      unit_price: z.string().nullable(),
      currency: z.string().length(3).nullable(),
      billing_cycle: z.enum(["monthly", "yearly"]).nullable(),
    }),
  ),
});

export type SeatsResponse = z.infer<typeof seatsResponseSchema>;
