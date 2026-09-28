import {
  type ConnectorContext,
  type ConnectorDefinition,
  ConnectorError,
  defineConnector,
} from "@arkanaio/connector-contract";
import { z } from "zod";
import { manifest } from "./manifest.ts";
import {
  configurationSchema,
  cursorSchema,
  memberPageSchema,
  userPageSchema,
  workspacePageSchema,
} from "./schemas.ts";

async function request(
  context: ConnectorContext,
  url: string,
  authorization: string,
  body?: unknown,
) {
  const response = await context.fetch(url, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      accept: "application/json",
      authorization,
      "content-type": "application/json",
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(15000),
  });
  if (response.status === 401)
    throw new ConnectorError("credentials", "rejected");
  if (response.status === 403 || response.status === 404)
    throw new ConnectorError("permissions", "workspace_access_missing");
  if (response.status === 429 || response.status >= 500)
    throw new ConnectorError("service", "provider_unavailable");
  if (response.status !== 200)
    throw new ConnectorError("contract", "unexpected_status");
  return response.json().catch(() => null);
}

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success)
    throw new ConnectorError("contract", "unexpected_payload");
  return result.data;
}

// Extract a token, never follow a provider URL with either credential.
function nextToken(value: string, endpoint: string): string {
  if (!/^https?:/i.test(value)) return value;
  const url = new URL(value);
  const expected = new URL(endpoint);
  if (
    url.origin !== expected.origin ||
    url.pathname !== expected.pathname ||
    url.username ||
    url.password ||
    url.hash
  )
    throw new ConnectorError("contract", "unexpected_payload");
  const token = url.searchParams.get("cursor");
  if (!token) throw new ConnectorError("contract", "unexpected_payload");
  return token;
}

async function organizationPages<T>(
  context: ConnectorContext,
  endpoint: string,
  authorization: string,
  schema: z.ZodType<{
    data: T[];
    links?: { next?: string | null | undefined } | null | undefined;
  }>,
  body: Record<string, unknown>,
): Promise<T[]> {
  const results: T[] = [];
  const seen = new Set<string>();
  let cursor: string | null = null;
  for (let page = 0; page < 100; page++) {
    const result = parse(
      schema,
      await request(context, endpoint, authorization, {
        ...body,
        ...(cursor === null ? {} : { cursor }),
      }),
    );
    results.push(...result.data);
    if (!result.links?.next) return results;
    cursor = nextToken(result.links.next, endpoint);
    if (seen.has(cursor))
      throw new ConnectorError("contract", "pagination_did_not_advance");
    seen.add(cursor);
  }
  throw new ConnectorError("contract", "pagination_limit");
}

function matchesWorkspace(
  hostUrl: string | null | undefined,
  slug: string,
): boolean {
  if (!hostUrl) return false;
  try {
    const url = new URL(hostUrl);
    return (
      url.origin === "https://bitbucket.org" &&
      !url.username &&
      !url.password &&
      url.pathname.replace(/\/$/, "") === `/${slug}`
    );
  } catch {
    return false;
  }
}

export const bitbucketLicensesConnector: ConnectorDefinition = defineConnector({
  manifest,
  readers: {
    licenses: async ({ context, cursor }) => {
      const configuration = configurationSchema.safeParse(
        context.configuration,
      );
      if (!configuration.success)
        throw new ConnectorError("contract", "invalid_configuration");
      const { workspace, organization_id, account_email } = configuration.data;
      const token = context.secrets.api_token;
      const key = context.secrets.api_key;
      if (!token || !key || /[\r\n]/.test(token + key))
        throw new ConnectorError("credentials", "invalid_secret");
      let state: z.infer<typeof cursorSchema> | null = null;
      if (cursor !== null) {
        try {
          state = cursorSchema.parse(JSON.parse(cursor));
        } catch {
          throw new ConnectorError("contract", "invalid_cursor");
        }
      }
      const root = `https://api.atlassian.com/admin/v2/orgs/${encodeURIComponent(organization_id)}`;
      const authorization = `Bearer ${key}`;
      const workspaces = await organizationPages(
        context,
        `${root}/workspaces`,
        authorization,
        workspacePageSchema,
        { limit: 1000 },
      );
      const owned = workspaces.filter(
        (item) =>
          item.attributes.typeKey.toLowerCase() === "bitbucket" &&
          matchesWorkspace(item.attributes.hostUrl, workspace),
      );
      const site = owned[0];
      if (owned.length !== 1 || !site)
        throw new ConnectorError("permissions", "workspace_access_missing");
      if (state && state.workspaceId !== site.id)
        throw new ConnectorError("contract", "invalid_cursor");
      const endpoint = `https://api.bitbucket.org/2.0/workspaces/${encodeURIComponent(workspace)}/members`;
      const page = state?.page ?? 1;
      const members = parse(
        memberPageSchema,
        await request(
          context,
          `${endpoint}?pagelen=100&page=${page}`,
          `Basic ${Buffer.from(`${account_email}:${token}`, "utf8").toString("base64")}`,
        ),
      );
      if (state && state.total !== members.size)
        throw new ConnectorError("service", "membership_changed");
      const ids = members.values.map((member) => member.user.account_id);
      if (new Set(ids).size !== ids.length)
        throw new ConnectorError("contract", "duplicate_member");
      // Even an empty workspace must validate the organization directory access.
      const users = await organizationPages(
        context,
        `${root}/directories/-/users/search`,
        authorization,
        userPageSchema,
        { limit: 100, ...(ids.length ? { accountIds: ids } : {}) },
      );
      const emails = new Map<string, string | null>();
      for (const user of users) {
        const email = z.email().safeParse(user.email?.trim().toLowerCase());
        const value = email.success ? email.data : null;
        if (emails.has(user.accountId) && emails.get(user.accountId) !== value)
          throw new ConnectorError("contract", "conflicting_account");
        emails.set(user.accountId, value);
      }
      const observedOn =
        state?.observedOn ?? context.now().toISOString().slice(0, 10);
      const count = (state?.count ?? 0) + members.values.length;
      let next: string | null = null;
      if (members.next) {
        let url: URL;
        try {
          url = new URL(members.next);
        } catch {
          throw new ConnectorError("contract", "unexpected_payload");
        }
        if (
          url.origin !== "https://api.bitbucket.org" ||
          url.pathname !== new URL(endpoint).pathname ||
          url.username ||
          url.password ||
          url.hash ||
          url.searchParams.get("page") !== String(page + 1) ||
          !members.values.length ||
          count >= members.size ||
          page >= 10000
        )
          throw new ConnectorError("contract", "pagination_did_not_advance");
        next = JSON.stringify({
          version: 1,
          page: page + 1,
          count,
          total: members.size,
          workspaceId: site.id,
          observedOn,
        });
      } else if (count !== members.size)
        throw new ConnectorError("contract", "incomplete_membership");
      return {
        cursor: next,
        plans: [
          {
            externalId: site.id,
            name: `Bitbucket · ${workspace}`,
            purchasedQuantity: {
              value: members.size,
              unit: "person",
              source: "GET /2.0/workspaces/{workspace}/members.size",
              observedOn,
            },
            consumedQuantity: null,
            billingCycle: null,
            pricePerSeat: null,
            currency: null,
          },
        ],
        seats: members.values.map(({ user }) => ({
          planExternalId: site.id,
          accountExternalId: user.account_id,
          accountName: user.display_name || null,
          accountEmail: emails.get(user.account_id) ?? null,
          lastActivityAt: null,
        })),
      };
    },
  },
});
