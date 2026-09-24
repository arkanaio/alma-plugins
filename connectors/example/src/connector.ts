import {
  type ConnectorContext,
  type ConnectorDefinition,
  ConnectorError,
  defineConnector,
} from "@arkanaio/connector-contract";

import { manifest } from "./manifest.ts";
import { seatsResponseSchema } from "./schemas.ts";

const base = "https://api.example.invalid/v1";

async function readSeatsPage(context: ConnectorContext, cursor: string | null) {
  const url = new URL(`${base}/seats`);
  url.searchParams.set("workspace", context.configuration.workspace ?? "");
  if (context.configuration.region !== null) {
    url.searchParams.set("region", context.configuration.region ?? "");
  }
  if (cursor !== null) url.searchParams.set("cursor", cursor);

  const response = await context.fetch(url.toString(), {
    headers: {
      accept: "application/json",
      // The credential goes in a header. In the address it would end up in
      // every log of the request.
      authorization: `Bearer ${context.secrets.api_token}`,
    },
  });

  if (response.status === 401) {
    // A credential the provider has already rejected is not retried: ALMA
    // marks the connection as needing reauthentication.
    throw new ConnectorError("credentials", "rejected");
  }
  if (response.status === 403) {
    throw new ConnectorError("permissions", "seats_scope_missing");
  }
  if (response.status === 429 || response.status >= 500) {
    throw new ConnectorError("service", "provider_unavailable");
  }
  if (!response.ok) {
    throw new ConnectorError("contract", "unexpected_status");
  }

  // The provider's body never travels inside the error: the parse failure is
  // reported as a code, and the original stays in `cause` for local debugging.
  const parsed = seatsResponseSchema.safeParse(await response.json());
  if (!parsed.success) {
    throw new ConnectorError("contract", "unexpected_payload", {
      cause: parsed.error,
    });
  }
  return parsed.data;
}

export const exampleConnector: ConnectorDefinition = defineConnector({
  manifest,
  readers: {
    licenses: async ({ context, cursor }) => {
      const body = await readSeatsPage(context, cursor);

      return {
        cursor: body.next_cursor,
        plans: body.subscriptions.map((subscription) => ({
          billingCycle: subscription.billing_cycle,
          // An amount without a currency is not an amount: it is dropped whole
          // rather than assuming the organisation's currency.
          currency: subscription.unit_price ? subscription.currency : null,
          externalId: subscription.id,
          name: subscription.product,
          pricePerSeat: subscription.currency ? subscription.unit_price : null,
          purchasedQuantity:
            subscription.seats === null
              ? null
              : {
                  value: subscription.seats,
                  unit: "person" as const,
                  source: "subscriptions.seats",
                  observedOn: context.now().toISOString().slice(0, 10),
                },
          consumedQuantity: null,
        })),
        seats: body.members.map((member) => ({
          accountEmail: member.email,
          accountExternalId: member.id,
          accountName: member.display_name,
          // No value from the provider means no reading. It is not replaced by
          // the sync date or the assignment date, and the account is never
          // inferred to be inactive: ALMA turns this into "unavailable", which
          // is not the same claim as "not used".
          lastActivityAt: member.last_active_at,
          planExternalId: member.subscription_id,
        })),
      };
    },
  },
});
