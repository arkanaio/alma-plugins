import { z } from "zod";

export const configurationSchema = z.object({
  customer_id: z.string().regex(/^C[a-zA-Z0-9]{3,99}$/),
});

export const assignmentListSchema = z.object({
  kind: z.literal("licensing#licenseAssignmentList"),
  nextPageToken: z.string().min(1).max(2048).optional(),
  items: z
    .array(
      z.object({
        productId: z.literal("Google-Apps"),
        skuId: z.string().min(1).max(100),
        skuName: z.string().trim().min(1).max(200),
        userId: z.email().max(320),
      }),
    )
    .max(1000)
    .default([]),
});
