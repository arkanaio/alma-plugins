import {
  type ConnectorContext,
  type ConnectorDefinition,
  ConnectorError,
  type ConnectorLicensePage,
  defineConnector,
} from "@arkanaio/connector-contract";
import { z } from "zod";
import { manifest } from "./manifest.ts";
import {
  type Account,
  accountListSchema,
  type Configuration,
  type CopilotBilling,
  type Cursor,
  configurationSchema,
  copilotBillingSchema,
  copilotSeatPageSchema,
  cursorSchema,
  type Organization,
  organizationSchema,
  type Phase,
  type UserNode,
  userNodesSchema,
} from "./schemas.ts";

const api = "https://api.github.com";
const perPage = 100;
// Each list request is followed by one GraphQL lookup, so a page makes at most
// 2 + 2 × 5 requests and returns at most 500 seats.
const maximumListRequests = 5;
const planNames: Record<string, string> = {
  team: "GitHub Team",
  enterprise: "GitHub Enterprise",
};
const copilotNames: Record<string, string> = {
  business: "GitHub Copilot Business",
  enterprise: "GitHub Copilot Enterprise",
};
const userNodesQuery =
  "query($ids:[ID!]!,$org:String!){nodes(ids:$ids){... on User{databaseId login name organizationVerifiedDomainEmails(login:$org)}}}";

type Seat = ConnectorLicensePage["seats"][number];
type Plan = ConnectorLicensePage["plans"][number];
type Get = (path: string) => Promise<Response>;

function rateLimited(response: Response): boolean {
  return (
    response.status === 429 ||
    response.headers.get("x-ratelimit-remaining") === "0" ||
    response.headers.has("retry-after")
  );
}

// GitHub answers 404 rather than 403 to a token that cannot see a resource, so
// every call names what a 404 means for it.
async function json(response: Response, missing: string): Promise<unknown> {
  if (response.status === 401)
    throw new ConnectorError("credentials", "rejected");
  if (response.status === 403 || response.status === 429) {
    if (rateLimited(response))
      throw new ConnectorError("service", "rate_limited");
    if (response.headers.has("x-github-sso"))
      throw new ConnectorError("permissions", "sso_authorization_required");
    throw new ConnectorError("permissions", "permission_missing");
  }
  if (response.status === 404) throw new ConnectorError("permissions", missing);
  if (response.status >= 500)
    throw new ConnectorError("service", "provider_unavailable");
  if (!response.ok) throw new ConnectorError("contract", "unexpected_status");
  return response.json().catch(() => null);
}

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success)
    throw new ConnectorError("contract", "unexpected_payload");
  return result.data;
}

function decode(cursor: string): Cursor {
  try {
    return cursorSchema.parse(JSON.parse(cursor));
  } catch {
    throw new ConnectorError("contract", "invalid_cursor");
  }
}

function quantity(
  value: number | null | undefined,
  source: string,
  on: string,
) {
  return value == null
    ? null
    : { value, unit: "person" as const, source, observedOn: on };
}

function githubPlan(organization: Organization, on: string): Plan | null {
  const plan = organization.plan;
  if (!plan) throw new ConnectorError("permissions", "plan_not_visible");
  const name = plan.name.toLowerCase();
  // A free organization pays for no seat: there is no license to reconcile.
  if (name === "free") return null;
  return {
    externalId: `plan_${name}`,
    name: planNames[name] ?? `GitHub ${plan.name}`,
    purchasedQuantity: quantity(plan.seats, "plan.seats", on),
    consumedQuantity: quantity(plan.filled_seats, "plan.filled_seats", on),
    pricePerSeat: null,
    currency: null,
    billingCycle: null,
  };
}

function copilotPlan(billing: CopilotBilling, on: string): Plan {
  const type = billing.plan_type?.toLowerCase() ?? null;
  return {
    externalId: type && type !== "unknown" ? `copilot_${type}` : "copilot",
    name: (type && copilotNames[type]) || "GitHub Copilot",
    // Copilot bills each assigned seat; nothing is bought in advance, so there
    // is no purchased quantity and it is not inferred from the seats.
    purchasedQuantity: null,
    consumedQuantity: quantity(
      billing.seat_breakdown.total,
      "seat_breakdown.total",
      on,
    ),
    pricePerSeat: null,
    currency: null,
    billingCycle: null,
  };
}

async function readCopilot(
  get: Get,
  configuration: Configuration,
): Promise<CopilotBilling | null> {
  if (configuration.copilot === "skip") return null;
  const response = await get(
    `/orgs/${configuration.organization}/copilot/billing`,
  );
  // GitHub answers 404 when the organization has no Copilot subscription and
  // 422 when Copilot is not set up for it. Neither is a failure to read.
  if (response.status === 404 || response.status === 422) return null;
  return parse(
    copilotBillingSchema,
    await json(response, "copilot_not_visible"),
  );
}

function email(node: UserNode | undefined): string | null {
  // Only addresses on a domain the organization verified: a public profile
  // email is chosen by the user and proves nothing about who they are here.
  for (const value of [
    ...(node?.organizationVerifiedDomainEmails ?? []),
  ].sort()) {
    const result = z.email().safeParse(value.trim().toLowerCase());
    if (result.success) return result.data;
  }
  return null;
}

function displayName(account: Account, node: UserNode | undefined): string {
  const name = node?.name?.trim();
  if (!name) return account.login;
  return `${name.slice(0, 200 - account.login.length - 3)} (${account.login})`;
}

async function userNodes(
  context: ConnectorContext,
  token: string,
  organization: string,
  accounts: readonly Account[],
): Promise<Map<number, UserNode>> {
  const found = new Map<number, UserNode>();
  if (accounts.length === 0) return found;
  const body = parse(
    userNodesSchema,
    await json(
      await context.fetch(`${api}/graphql`, {
        method: "POST",
        headers: { ...headers(token), "content-type": "application/json" },
        body: JSON.stringify({
          query: userNodesQuery,
          variables: {
            ids: accounts.map((account) => account.node_id),
            org: organization,
          },
        }),
        signal: AbortSignal.timeout(15000),
      }),
      "graphql_not_found",
    ),
  );
  for (const error of body.errors ?? []) {
    // An account deleted during the scan comes back as a null node.
    if (error.type === "NOT_FOUND") continue;
    if (error.type === "RATE_LIMITED")
      throw new ConnectorError("service", "rate_limited");
    if (error.type === "FORBIDDEN" || error.type === "INSUFFICIENT_SCOPES")
      throw new ConnectorError("permissions", "permission_missing");
    throw new ConnectorError("contract", "unexpected_payload");
  }
  if (!body.data || body.data.nodes.length !== accounts.length)
    throw new ConnectorError("contract", "unexpected_payload");
  for (const node of body.data.nodes)
    if (node) found.set(node.databaseId, node);
  return found;
}

function headers(token: string): Record<string, string> {
  return {
    accept: "application/vnd.github+json",
    authorization: `Bearer ${token}`,
    "user-agent": "arkanaio-alma-connector-github-licenses",
    "x-github-api-version": "2022-11-28",
  };
}

export const githubLicensesConnector: ConnectorDefinition = defineConnector({
  manifest,
  readers: {
    licenses: async ({ context, cursor }) => {
      const configuration = configurationSchema.safeParse(
        context.configuration,
      );
      if (!configuration.success)
        throw new ConnectorError("contract", "invalid_configuration");
      const config = configuration.data;
      const token = context.secrets.access_token;
      // GitHub tokens are letters, digits and underscores. Anything else would
      // be a header injection, not a token.
      if (!token || !/^[A-Za-z0-9_]{1,255}$/.test(token))
        throw new ConnectorError("credentials", "invalid_secret");
      const state = cursor === null ? null : decode(cursor);
      const get: Get = (path) =>
        context.fetch(`${api}${path}`, {
          headers: headers(token),
          signal: AbortSignal.timeout(15000),
        });
      const org = `/orgs/${config.organization}`;
      const on = context.now().toISOString().slice(0, 10);

      const plan = githubPlan(
        parse(
          organizationSchema,
          await json(await get(org), "organization_not_found"),
        ),
        on,
      );
      const billing = await readCopilot(get, config);
      const copilot = billing ? copilotPlan(billing, on) : null;

      const active: { phase: Phase; plan: Plan }[] = [];
      if (plan) {
        active.push({ phase: "members", plan });
        active.push({ phase: "outside_collaborators", plan });
      }
      if (copilot) active.push({ phase: "copilot", plan: copilot });

      let index = state
        ? active.findIndex((entry) => entry.phase === state.phase)
        : 0;
      // A plan or subscription that disappeared mid-scan invalidates the
      // position; never publish a partial snapshot as if it were complete.
      if (index === -1) throw new ConnectorError("contract", "catalog_changed");
      let page = state?.page ?? 1;

      const seats: Seat[] = [];
      const seen = new Set<string>();
      for (
        let requests = 0;
        index < active.length && requests < maximumListRequests;
        requests++
      ) {
        const entry = active[index];
        if (!entry) break;
        const query = `per_page=${perPage}&page=${page}`;
        let accounts: { account: Account; activity: string | null }[];
        let done: boolean;
        if (entry.phase === "copilot") {
          const body = parse(
            copilotSeatPageSchema,
            await json(
              await get(`${org}/copilot/billing/seats?${query}`),
              "copilot_not_visible",
            ),
          );
          accounts = body.seats.flatMap((seat) =>
            seat.assignee
              ? [
                  {
                    account: seat.assignee,
                    activity: seat.last_activity_at ?? null,
                  },
                ]
              : [],
          );
          done =
            body.seats.length < perPage || page * perPage >= body.total_seats;
        } else {
          const path =
            entry.phase === "members"
              ? `${org}/members?filter=all&role=all&${query}`
              : `${org}/outside_collaborators?filter=all&${query}`;
          const list = parse(
            accountListSchema,
            await json(await get(path), "members_not_visible"),
          );
          accounts = list.map((account) => ({ account, activity: null }));
          done = list.length < perPage;
        }
        // Teams, bots and organizations cannot hold a person's seat.
        const users = accounts.filter(({ account }) => account.type === "User");
        const nodes = await userNodes(
          context,
          token,
          config.organization,
          users.map(({ account }) => account),
        );
        for (const { account, activity } of users) {
          const key = `${entry.plan.externalId}:${account.id}`;
          if (seen.has(key)) continue;
          seen.add(key);
          const node = nodes.get(account.id);
          seats.push({
            planExternalId: entry.plan.externalId,
            accountExternalId: String(account.id),
            accountEmail: email(node),
            accountName: displayName(account, node),
            lastActivityAt: activity,
          });
        }
        if (done) {
          index++;
          page = 1;
        } else {
          page++;
        }
      }

      const current = active[index];
      return {
        cursor: current
          ? JSON.stringify({ version: 1, phase: current.phase, page })
          : null,
        plans: [plan, copilot].filter((value): value is Plan => value !== null),
        seats,
      };
    },
  },
});
