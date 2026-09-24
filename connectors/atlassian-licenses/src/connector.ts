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
  type Cursor,
  configurationSchema,
  cursorSchema,
  userPageSchema,
  type Workspace,
  workspacePageSchema,
} from "./schemas.ts";

const apiRoot = "https://api.atlassian.com/admin";
const maximumWorkspacePages = 10;
const maximumCursorLength = 2048;
// Each search returns up to 100 accounts, so a page stays within the
// contract's 1,000 seats and within a few seconds of provider calls.
const maximumSearchesPerPage = 5;

/**
 * The roles Atlassian bills for. Guests, customers, contributors, basic users,
 * stakeholders and user-access admins hold no paid seat, so they are not read.
 */
const billableRoles = ["atlassian/user", "atlassian/admin"] as const;

type Request = {
  organizationId: string;
  apiKey: string;
  context: ConnectorContext;
};

async function post(request: Request, path: string, body: unknown) {
  const response = await request.context.fetch(
    `${apiRoot}/v2/orgs/${encodeURIComponent(request.organizationId)}${path}`,
    {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${request.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    },
  );
  if (response.status === 401)
    throw new ConnectorError("credentials", "rejected");
  if (response.status === 403)
    throw new ConnectorError("permissions", "admin_access_missing");
  if (response.status === 404)
    throw new ConnectorError("permissions", "organization_not_found");
  if (response.status === 429 || response.status >= 500)
    throw new ConnectorError("service", "provider_unavailable");
  if (!response.ok) throw new ConnectorError("contract", "unexpected_status");
  return response.json().catch(() => null);
}

/** Atlassian returns the next page either as a bare token or inside a URL. */
function workspaceCursor(next: string): string {
  if (!/^https?:\/\//.test(next)) return next;
  const cursor = new URL(next).searchParams.get("cursor");
  if (!cursor) throw new ConnectorError("contract", "unexpected_payload");
  return cursor;
}

/** Every product site the key can see, in a stable order, sandboxes aside. */
async function listWorkspaces(request: Request): Promise<Workspace[]> {
  const workspaces = new Map<string, Workspace>();
  const seen = new Set<string>();
  let cursor: string | null = null;
  for (let page = 0; ; page++) {
    if (page >= maximumWorkspacePages)
      throw new ConnectorError("contract", "workspace_pagination_limit");
    const body = workspacePageSchema.safeParse(
      await post(
        request,
        "/workspaces",
        cursor === null ? { limit: 1000 } : { cursor },
      ),
    );
    if (!body.success)
      throw new ConnectorError("contract", "unexpected_payload");
    for (const workspace of body.data.data) {
      // A sandbox copies a production site and holds no seats of its own.
      if (workspace.attributes.sandbox?.type === "CHILD") continue;
      workspaces.set(workspace.id, workspace);
    }
    const next = body.data.links?.next;
    if (!next) break;
    cursor = workspaceCursor(next);
    if (seen.has(cursor))
      throw new ConnectorError("contract", "workspace_pagination_loop");
    seen.add(cursor);
  }
  return [...workspaces.values()].sort((left, right) =>
    left.id < right.id ? -1 : left.id > right.id ? 1 : 0,
  );
}

/**
 * Only sites on a paid plan hold licenses. Free plans and sites Atlassian
 * reports without a plan are not read: they have no cost to manage.
 */
function isPaid(workspace: Workspace): boolean {
  const plan = planOf(workspace);
  return plan !== null && !/^(free|none)$/i.test(plan.trim());
}

function siteOf(workspace: Workspace): string | null {
  const { hostUrl, name } = workspace.attributes;
  if (hostUrl) {
    try {
      return new URL(hostUrl).host;
    } catch {
      // A malformed URL is not worth failing the read: the site name remains.
    }
  }
  return name || null;
}

function planOf(workspace: Workspace): string | null {
  for (const items of Object.values(workspace.relationships ?? {})) {
    for (const item of items) {
      const plan = item.attributes?.plan;
      if (plan) return plan;
    }
  }
  return null;
}

function planFor(workspace: Workspace, observedOn: string) {
  const product = workspace.attributes.type || workspace.attributes.typeKey;
  const edition = [product, planOf(workspace)].filter(Boolean).join(" ");
  const site = siteOf(workspace);
  return {
    externalId: workspace.id,
    name: (site ? `${edition} · ${site}` : edition).slice(0, 200),
    billingCycle: null,
    pricePerSeat: null,
    currency: null,
    // Atlassian reports the seat limit of a site only when it has license data
    // for it. Without it, the purchased total is unknown, never the accounts.
    purchasedQuantity:
      workspace.attributes.capacity == null
        ? null
        : {
            value: workspace.attributes.capacity,
            unit: "person" as const,
            source: "attributes.capacity",
            observedOn,
          },
    consumedQuantity: null,
  };
}

function encodeCursor(cursor: Cursor): string {
  const value = JSON.stringify(cursor);
  if (value.length > maximumCursorLength)
    throw new ConnectorError("contract", "cursor_too_long");
  return value;
}

function decodeCursor(cursor: string): Cursor {
  try {
    return cursorSchema.parse(JSON.parse(cursor));
  } catch {
    throw new ConnectorError("contract", "invalid_cursor");
  }
}

const emailSchema = z.email().max(320);

function activityAt(timestamp: string | null | undefined): string | null {
  if (!timestamp) return null;
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export const atlassianLicensesConnector: ConnectorDefinition = defineConnector({
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
      const request = {
        organizationId: configuration.data.organization_id,
        apiKey,
        context,
      };
      const state = cursor === null ? null : decodeCursor(cursor);

      const workspaces = (await listWorkspaces(request)).filter(isPaid);
      // A site removed mid-read is skipped, not retried: the next one in the
      // same order continues the read.
      let current = state
        ? workspaces.find((workspace) => workspace.id >= state.workspace)
        : workspaces[0];
      let usersCursor =
        current && state?.workspace === current.id ? state.users : null;
      const read: Workspace[] = [];
      const seats: ConnectorLicensePage["seats"][number][] = [];
      let next: Cursor | null = null;

      // Several sites per page, so an organization with a handful of products
      // finishes in one or two pages instead of one page per product.
      for (let searches = 0; current; searches++) {
        if (searches >= maximumSearchesPerPage) {
          next = { version: 1, workspace: current.id, users: usersCursor };
          break;
        }
        const site: Workspace = current;
        const body = userPageSchema.safeParse(
          await post(request, "/directories/-/users/search", {
            limit: 100,
            resourceIds: [site.id],
            roleIds: billableRoles,
            status: ["active"],
            expand: ["productAccess"],
            ...(usersCursor === null ? {} : { cursor: usersCursor }),
          }),
        );
        if (!body.success)
          throw new ConnectorError("contract", "unexpected_payload");
        const nextUsers = body.data.links?.next ?? null;
        if (nextUsers !== null && nextUsers === usersCursor)
          throw new ConnectorError("contract", "pagination_did_not_advance");
        if (!read.includes(site)) read.push(site);
        for (const user of body.data.data) {
          const email = emailSchema.safeParse(user.email?.toLowerCase());
          seats.push({
            accountExternalId: user.accountId,
            accountEmail: email.success ? email.data : null,
            accountName: user.name || null,
            lastActivityAt: activityAt(
              user.productAccess?.find((access) => access.id === site.id)
                ?.lastActiveTimestamp,
            ),
            planExternalId: site.id,
          });
        }
        if (nextUsers !== null) {
          usersCursor = nextUsers;
          continue;
        }
        current = workspaces[workspaces.indexOf(site) + 1];
        usersCursor = null;
      }

      return {
        cursor: next === null ? null : encodeCursor(next),
        plans: (state ? read : workspaces).map((workspace) =>
          planFor(workspace, context.now().toISOString().slice(0, 10)),
        ),
        seats,
      };
    },
  },
});
