import {
  type ConnectorDefinition,
  ConnectorError,
  defineConnector,
} from "@arkanaio/connector-contract";
import { manifest } from "./manifest.ts";
import { readPurchasedLicenses } from "./reports.ts";
import { assignmentListSchema, configurationSchema } from "./schemas.ts";

export const googleWorkspaceLicensesConnector: ConnectorDefinition =
  defineConnector({
    manifest,
    readers: {
      licenses: async ({ context, cursor }) => {
        const configuration = configurationSchema.safeParse(
          context.configuration,
        );
        if (!configuration.success)
          throw new ConnectorError("contract", "invalid_configuration");
        const token = context.secrets.access_token;
        if (!token || /[\r\n]/.test(token))
          throw new ConnectorError("credentials", "invalid_secret");
        if (configuration.data.read_mode === "purchased") {
          if (!configuration.data.report_date)
            throw new ConnectorError("contract", "missing_report_date");
          return readPurchasedLicenses(
            context,
            {
              customer_id: configuration.data.customer_id,
              report_date: configuration.data.report_date,
            },
            cursor,
          );
        }
        const url = new URL(
          "https://licensing.googleapis.com/apps/licensing/v1/product/Google-Apps/users",
        );
        url.searchParams.set("customerId", configuration.data.customer_id);
        url.searchParams.set("maxResults", "100");
        if (cursor !== null) url.searchParams.set("pageToken", cursor);
        const response = await context.fetch(url.toString(), {
          headers: {
            accept: "application/json",
            authorization: `Bearer ${token}`,
          },
          method: "GET",
          signal: AbortSignal.timeout(15000),
        });
        if (response.status === 401)
          throw new ConnectorError("credentials", "rejected");
        if (response.status === 403)
          throw new ConnectorError("permissions", "seats_scope_missing");
        if (response.status === 429 || response.status >= 500)
          throw new ConnectorError("service", "provider_unavailable");
        if (!response.ok)
          throw new ConnectorError("contract", "unexpected_status");
        const body = assignmentListSchema.safeParse(
          await response.json().catch(() => null),
        );
        if (!body.success)
          throw new ConnectorError("contract", "unexpected_payload");
        const plans = new Map<string, string>();
        for (const assignment of body.data.items) {
          const previousName = plans.get(assignment.skuId);
          if (previousName !== undefined && previousName !== assignment.skuName)
            throw new ConnectorError("contract", "inconsistent_plan");
          plans.set(assignment.skuId, assignment.skuName);
        }
        return {
          cursor: body.data.nextPageToken ?? null,
          plans: [...plans].map(([skuId, name]) => ({
            externalId: `Google-Apps/${skuId}`,
            name,
            billingCycle: null,
            pricePerSeat: null,
            currency: null,
            purchasedQuantity: null,
            consumedQuantity: null,
          })),
          seats: body.data.items.map((assignment) => ({
            // Licensing exposes only the current primary email, not a stable
            // Directory ID. A rename must be treated as a changed account by the
            // host; do not pretend this identifier survives an email rename.
            accountExternalId: assignment.userId.toLowerCase(),
            accountEmail: assignment.userId.toLowerCase(),
            accountName: null,
            lastActivityAt: null,
            planExternalId: `Google-Apps/${assignment.skuId}`,
          })),
        };
      },
    },
  });
