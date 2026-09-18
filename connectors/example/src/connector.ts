import type {
  ExecutionContext,
  LicenseConnector,
  LicenseContract,
  LicenseSeat,
  OutboundRequest,
  Page,
} from "@alma/connector-contract";

import { manifest } from "./manifest.ts";
import {
  type Configuration,
  configurationSchema,
  membersResponseSchema,
  subscriptionsResponseSchema,
} from "./schemas.ts";

const base = "https://api.example.test/v1";

/** The provider's opaque cursor. null means there are no more pages. */
type Cursor = string;

class ProviderError extends Error {
  readonly retryable: boolean;

  constructor(message: string, retryable: boolean) {
    super(message);
    this.name = "ProviderError";
    this.retryable = retryable;
  }
}

async function readJson(
  context: ExecutionContext<Configuration>,
  input: OutboundRequest,
): Promise<unknown> {
  const response = await context.request(input);
  if (response.status === 401 || response.status === 403) {
    // The host turns this into "reauthentication required". The connector does
    // not retry a credential the provider has already rejected.
    throw new ProviderError("The provider rejected the credential.", false);
  }
  if (response.status === 429 || response.status >= 500) {
    throw new ProviderError(`The provider answered ${response.status}.`, true);
  }
  if (!response.ok) {
    throw new ProviderError(`The provider answered ${response.status}.`, false);
  }
  return await response.json();
}

function route(
  context: ExecutionContext<Configuration>,
  resource: string,
  cursor: Cursor | null,
): OutboundRequest {
  const url = new URL(`${base}/${resource}`);
  url.searchParams.set("workspace", context.configuration.workspace);
  if (cursor) url.searchParams.set("cursor", cursor);
  return {
    url: url.toString(),
    method: "GET",
    headers: { accept: "application/json" },
  };
}

export const exampleConnector: LicenseConnector<Configuration, Cursor> = {
  manifest,
  configurationSchema,

  async verifyAccess(context) {
    await readJson(context, route(context, "subscriptions", null));
  },

  async listContracts(context, cursor): Promise<Page<LicenseContract, Cursor>> {
    const body = subscriptionsResponseSchema.parse(
      await readJson(context, route(context, "subscriptions", cursor)),
    );
    context.log("Read a page of contracts", {
      contracts: body.subscriptions.length,
    });
    return {
      items: body.subscriptions.map((subscription) => ({
        externalId: subscription.id,
        product: subscription.product,
        plan: subscription.plan,
        totalSeats: subscription.seats,
        // An amount without a currency is not an amount: drop it whole rather
        // than assume the organisation's currency.
        seatPrice:
          subscription.unit_price && subscription.currency
            ? {
                amount: subscription.unit_price,
                currency: subscription.currency,
              }
            : null,
        billingCycle: subscription.billing_cycle,
        renewsOn: subscription.renews_on,
      })),
      cursor: body.next_cursor,
    };
  },

  async listSeats(context, cursor): Promise<Page<LicenseSeat, Cursor>> {
    const readAt = new Date().toISOString();
    const body = membersResponseSchema.parse(
      await readJson(context, route(context, "members", cursor)),
    );
    // The trace counts seats, never who holds them.
    context.log("Read a page of seats", { seats: body.members.length });
    return {
      items: body.members.map((member) => ({
        externalId: member.id,
        contractExternalId: member.subscription_id,
        email: member.email,
        displayName: member.display_name,
        status: member.status,
        // No value from the provider means no reading. It is not replaced by
        // the sync date or the assignment date, and the account is never
        // inferred to be inactive.
        lastActivity: member.last_active_at
          ? { providerDate: member.last_active_at, readAt }
          : null,
      })),
      cursor: body.next_cursor,
    };
  },
};

export { ProviderError };
