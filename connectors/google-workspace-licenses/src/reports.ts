import {
  type ConnectorContext,
  ConnectorError,
  type ConnectorLicensePage,
} from "@arkanaio/connector-contract";
import { z } from "zod";

// Only documented purchased-license metrics; never request account activity.
const metrics = [
  [
    "accounts:gsuite_basic_total_licenses",
    "Google-Apps/Google-Apps-For-Business",
    "G Suite Basic",
  ],
  [
    "accounts:apps_total_licenses",
    "Google-Apps/Google-Apps-For-Business",
    "G Suite Basic",
  ],
  [
    "accounts:gsuite_unlimited_total_licenses",
    "Google-Apps/Google-Apps-Unlimited",
    "G Suite Business",
  ],
  [
    "accounts:gsuite_enterprise_total_licenses",
    "Google-Apps/1010020020",
    "Google Workspace Enterprise Plus",
  ],
  [
    "accounts:vault_total_licenses",
    "Google-Vault/Google-Vault",
    "Google Vault",
  ],
] as const;

const countSchema = z
  .string()
  .regex(/^\d+$/)
  .transform(Number)
  .pipe(z.number().int().min(0).max(1000000));
const responseSchema = z.object({
  kind: z.literal("admin#reports#usageReports"),
  nextPageToken: z.string().min(1).max(2048).optional(),
  warnings: z.array(z.object({ code: z.string() })).default([]),
  usageReports: z
    .array(
      z.object({
        date: z.iso.date(),
        entity: z.object({
          customerId: z.string(),
          type: z.literal("CUSTOMER"),
        }),
        parameters: z
          .array(
            z.object({ name: z.string(), intValue: countSchema.optional() }),
          )
          .max(100),
      }),
    )
    .max(100)
    .default([]),
});

const errorBodySchema = z.object({
  error: z.object({
    message: z.string().optional(),
    errors: z.array(z.object({ message: z.string() })).default([]),
  }),
});

export async function readPurchasedLicenses(
  context: ConnectorContext,
  configuration: { customer_id: string; report_date: string },
  cursor: string | null,
): Promise<ConnectorLicensePage> {
  const url = new URL(
    `https://admin.googleapis.com/admin/reports/v1/usage/dates/${configuration.report_date}`,
  );
  url.searchParams.set("customerId", configuration.customer_id);
  url.searchParams.set("parameters", metrics.map(([name]) => name).join(","));
  if (cursor !== null) url.searchParams.set("pageToken", cursor);
  const response = await context.fetch(url.toString(), {
    method: "GET",
    headers: {
      accept: "application/json",
      authorization: `Bearer ${context.secrets.access_token}`,
    },
    signal: AbortSignal.timeout(15000),
  });
  if (response.status === 401)
    throw new ConnectorError("credentials", "rejected");
  if (response.status === 403)
    throw new ConnectorError("permissions", "reports_scope_missing");
  if (response.status === 429 || response.status >= 500)
    throw new ConnectorError("service", "provider_unavailable");
  if (response.status === 400) {
    // A date with no usage report yet can answer 400. The host then tries
    // older dates, while unrelated 400 responses remain contract failures.
    const errorBody = errorBodySchema.safeParse(
      await response.json().catch(() => null),
    );
    const pending = errorBody.success
      ? [
          errorBody.data.error.message,
          ...errorBody.data.error.errors.map((entry) => entry.message),
        ].some(
          (message) =>
            message?.startsWith("Data for dates later than ") &&
            message.includes(" is not yet available"),
        )
      : false;
    if (pending) throw new ConnectorError("contract", "report_not_available");
    throw new ConnectorError("contract", "unexpected_status");
  }
  if (!response.ok) throw new ConnectorError("contract", "unexpected_status");
  const body = responseSchema.safeParse(
    await response.json().catch(() => null),
  );
  if (!body.success) throw new ConnectorError("contract", "unexpected_payload");
  // Incomplete daily reports are not authoritative totals. The host can try an older date.
  if (body.data.warnings.length)
    throw new ConnectorError("contract", "report_not_available");
  const plans = new Map<string, ConnectorLicensePage["plans"][number]>();
  for (const report of body.data.usageReports) {
    if (
      report.entity.customerId !== configuration.customer_id ||
      report.date !== configuration.report_date
    )
      throw new ConnectorError("contract", "report_identity_mismatch");
    for (const parameter of report.parameters) {
      const metric = metrics.find(([name]) => name === parameter.name);
      if (!metric) continue;
      if (parameter.intValue === undefined)
        throw new ConnectorError("contract", "missing_license_count");
      const [, externalId, name] = metric;
      const previous = plans.get(externalId);
      if (previous && previous.purchasedQuantity?.value !== parameter.intValue)
        throw new ConnectorError("contract", "conflicting_license_count");
      plans.set(externalId, {
        externalId,
        name,
        purchasedQuantity: {
          value: parameter.intValue,
          unit: "person",
          source: parameter.name,
          observedOn: report.date,
        },
        consumedQuantity: null,
        pricePerSeat: null,
        currency: null,
        billingCycle: null,
      });
    }
  }
  return {
    cursor: body.data.nextPageToken ?? null,
    plans: [...plans.values()],
    seats: [],
  };
}
