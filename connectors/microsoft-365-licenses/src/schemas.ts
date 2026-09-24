import { z } from "zod";

const guid = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
  .transform((value) => value.toLowerCase());
const count = z.int().min(0).max(1_000_000);
export const configurationSchema = z.object({
  tenant_id: guid,
  client_id: guid,
});
export const tokenSchema = z.object({
  token_type: z.string().regex(/^Bearer$/i),
  access_token: z
    .string()
    .min(1)
    .max(32768)
    .regex(/^[^\s]+$/),
});
export const skuSchema = z.object({
  skuId: guid,
  skuPartNumber: z.string().trim().min(1).max(200),
  appliesTo: z.enum(["User", "Company"]),
  consumedUnits: count.nullish(),
  prepaidUnits: z.object({ enabled: count.nullish() }).nullish(),
});
export const skuPageSchema = z.object({
  value: z.array(skuSchema).max(1000),
  // Graph documents no pagination for subscribedSkus. Fail instead of dropping it.
  "@odata.nextLink": z.null().optional(),
});
export const userPageSchema = z.object({
  value: z
    .array(
      z.object({
        id: guid,
        displayName: z.string().max(200).nullish(),
        mail: z.string().nullish(),
        userPrincipalName: z.string().nullish(),
      }),
    )
    .max(100),
  "@odata.nextLink": z.string().min(1).max(4096).nullish(),
});
export const cursorSchema = z
  .object({
    version: z.literal(1),
    sku: guid,
    token: z.string().min(1).max(1700).nullable(),
  })
  .strict();
export type Cursor = z.infer<typeof cursorSchema>;
export type Sku = z.infer<typeof skuSchema>;
