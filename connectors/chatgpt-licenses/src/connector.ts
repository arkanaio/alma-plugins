import {
  type ConnectorDefinition,
  ConnectorError,
  type ConnectorLicensePage,
  defineConnector,
} from "@arkanaio/connector-contract";
import { z } from "zod";
import { manifest } from "./manifest.ts";
import {
  type Cursor,
  configurationSchema,
  cursorSchema,
  type User,
  userPageSchema,
} from "./schemas.ts";

const apiRoot = "https://api.chatgpt.com/v1/manage";
// The largest page OpenAI serves, and the contract's limit of seats per page.
const pageSize = 1000;

/**
 * The seat types OpenAI documents for a workspace member. Each one is a plan.
 * A type not listed here fails the read instead of being guessed: it may be a
 * paid seat or not, and only a reviewed version of this connector can say.
 */
const seatTypes: Record<string, string> = {
  chatgpt: "ChatGPT",
  codex: "Codex",
};

function planExternalId(workspaceId: string, seatType: string): string {
  return `${workspaceId}/${seatType}`;
}

function planFor(workspaceId: string, seatType: string) {
  const name = seatTypes[seatType];
  if (!name) throw new ConnectorError("contract", "unknown_seat_type");
  return {
    externalId: planExternalId(workspaceId, seatType),
    name,
    billingCycle: null,
    pricePerSeat: null,
    currency: null,
    // The Admin API does not publish how many seats were purchased. Unknown is
    // null, never the number of members detected.
    seatCount: null,
  };
}

function encodeCursor(cursor: Cursor): string {
  return JSON.stringify(cursor);
}

function decodeCursor(cursor: string): Cursor {
  try {
    return cursorSchema.parse(JSON.parse(cursor));
  } catch {
    throw new ConnectorError("contract", "invalid_cursor");
  }
}

const emailSchema = z.email().max(320);

export const chatgptLicensesConnector: ConnectorDefinition = defineConnector({
  manifest,
  readers: {
    licenses: async ({ context, cursor }) => {
      const configuration = configurationSchema.safeParse(
        context.configuration,
      );
      if (!configuration.success)
        throw new ConnectorError("contract", "invalid_configuration");
      const apiKey = context.secrets.api_key;
      if (!apiKey || /[\r\n]/.test(apiKey))
        throw new ConnectorError("credentials", "invalid_secret");
      const workspaceId = configuration.data.workspace_id;
      const state = cursor === null ? null : decodeCursor(cursor);

      const url = new URL(
        `${apiRoot}/workspaces/${encodeURIComponent(workspaceId)}/users`,
      );
      url.searchParams.set("limit", String(pageSize));
      if (state) url.searchParams.set("after", state.after);
      const response = await context.fetch(url.toString(), {
        method: "GET",
        headers: {
          accept: "application/json",
          authorization: `Bearer ${apiKey}`,
        },
        signal: AbortSignal.timeout(15000),
      });
      if (response.status === 401)
        throw new ConnectorError("credentials", "rejected");
      if (response.status === 403)
        throw new ConnectorError("permissions", "users_read_missing");
      // OpenAI answers 404 both for a workspace the key cannot see and for a
      // workspace whose plan does not offer this API.
      if (response.status === 404)
        throw new ConnectorError("permissions", "workspace_not_found");
      if (response.status === 429 || response.status >= 500)
        throw new ConnectorError("service", "provider_unavailable");
      if (!response.ok)
        throw new ConnectorError("contract", "unexpected_status");
      const body = userPageSchema.safeParse(
        await response.json().catch(() => null),
      );
      if (!body.success)
        throw new ConnectorError("contract", "unexpected_payload");

      const users: User[] = body.data.data;
      const plans = new Map<string, ReturnType<typeof planFor>>();
      const seats: ConnectorLicensePage["seats"][number][] = [];
      for (const user of users) {
        const plan =
          plans.get(user.seat_type) ?? planFor(workspaceId, user.seat_type);
        plans.set(user.seat_type, plan);
        const email = emailSchema.safeParse(user.email?.toLowerCase());
        seats.push({
          accountExternalId: user.id,
          accountEmail: email.success ? email.data : null,
          accountName: user.name || null,
          lastActivityAt: null,
          planExternalId: plan.externalId,
        });
      }

      let next: Cursor | null = null;
      if (body.data.has_more) {
        const after = body.data.last_id ?? users.at(-1)?.id;
        if (!after || after === state?.after)
          throw new ConnectorError("contract", "pagination_did_not_advance");
        next = { version: 1, after };
      }

      return {
        cursor: next === null ? null : encodeCursor(next),
        plans: [...plans.values()],
        seats,
      };
    },
  },
});
