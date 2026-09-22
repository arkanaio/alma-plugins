import { z } from "zod";

// The contract delivers absent optional fields as null, never as a missing key.
export const configurationSchema = z.object({
  read_mode: z
    .enum(["assignments", "purchased"])
    .nullish()
    .transform((value) => value ?? "assignments"),
  report_date: z.iso.date().nullish(),
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
