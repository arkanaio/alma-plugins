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
  type Sku,
  skuPageSchema,
  tokenSchema,
  userPageSchema,
} from "./schemas.ts";

const graph = "https://graph.microsoft.com/v1.0";
const userSelect = "id,displayName,mail,userPrincipalName";
const maximumSearches = 5;

async function json(
  response: Response,
  tokenRequest = false,
): Promise<unknown> {
  if (response.status === 401 || (tokenRequest && response.status === 400))
    throw new ConnectorError("credentials", "rejected");
  if (response.status === 403)
    throw new ConnectorError("permissions", "admin_consent_missing");
  if (response.status === 429 || response.status >= 500)
    throw new ConnectorError("service", "provider_unavailable");
  if (!response.ok) throw new ConnectorError("contract", "unexpected_status");
  return response.json().catch(() => null);
}

async function accessToken(context: ConnectorContext): Promise<string> {
  const config = configurationSchema.safeParse(context.configuration);
  if (!config.success)
    throw new ConnectorError("contract", "invalid_configuration");
  const secret = context.secrets.client_secret;
  if (!secret || secret.length > 2048 || /[\r\n]/.test(secret))
    throw new ConnectorError("credentials", "invalid_secret");
  // Microsoft supports RFC 6749 HTTP Basic client authentication. The secret
  // stays in the header, never in the URL, body, cursor or returned page.
  const formEncode = (value: string) =>
    new URLSearchParams({ v: value }).toString().slice(2);
  const basic = btoa(
    `${formEncode(config.data.client_id)}:${formEncode(secret)}`,
  );
  const result = tokenSchema.safeParse(
    await json(
      await context.fetch(
        `https://login.microsoftonline.com/${config.data.tenant_id}/oauth2/v2.0/token`,
        {
          method: "POST",
          headers: {
            authorization: `Basic ${basic}`,
            "content-type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            scope: "https://graph.microsoft.com/.default",
            grant_type: "client_credentials",
          }).toString(),
          signal: AbortSignal.timeout(15000),
        },
      ),
      true,
    ),
  );
  if (!result.success)
    throw new ConnectorError("contract", "unexpected_token_payload");
  return result.data.access_token;
}

function plan(sku: Sku, observedOn: string) {
  return {
    externalId: sku.skuId,
    name: sku.skuPartNumber,
    purchasedQuantity:
      sku.prepaidUnits?.enabled == null
        ? null
        : {
            value: sku.prepaidUnits.enabled,
            unit: "person" as const,
            source: "prepaidUnits.enabled",
            observedOn,
          },
    consumedQuantity:
      sku.consumedUnits == null
        ? null
        : {
            value: sku.consumedUnits,
            unit: "person" as const,
            source: "consumedUnits",
            observedOn,
          },
    pricePerSeat: null,
    currency: null,
    billingCycle: null,
  };
}

function decode(cursor: string): Cursor {
  try {
    return cursorSchema.parse(JSON.parse(cursor));
  } catch {
    throw new ConnectorError("contract", "invalid_cursor");
  }
}

function filter(sku: string) {
  return `assignedLicenses/any(x:x/skuId eq ${sku})`;
}

function usersUrl(sku: string, token: string | null): string {
  const url = new URL(`${graph}/users`);
  url.searchParams.set("$select", userSelect);
  url.searchParams.set("$filter", filter(sku));
  url.searchParams.set("$top", "100");
  if (token !== null) url.searchParams.set("$skiptoken", token);
  return url.toString();
}

// Never follow an arbitrary provider URL with a bearer token. Retain only the
// opaque position and rebuild the fixed endpoint and query ourselves.
function nextToken(
  link: string | null | undefined,
  sku: string,
): string | null {
  if (link == null) return null;
  let url: URL;
  try {
    url = new URL(link);
  } catch {
    throw new ConnectorError("contract", "invalid_next_link");
  }
  if (
    url.origin !== "https://graph.microsoft.com" ||
    url.pathname !== "/v1.0/users" ||
    url.username ||
    url.password ||
    url.hash
  )
    throw new ConnectorError("contract", "invalid_next_link");
  const expected: Record<string, string> = {
    $select: userSelect,
    $filter: filter(sku),
    $top: "100",
  };
  for (const [key, value] of url.searchParams) {
    if (
      url.searchParams.getAll(key).length !== 1 ||
      (key !== "$skiptoken" && expected[key] !== value)
    )
      throw new ConnectorError("contract", "invalid_next_link");
  }
  const token = url.searchParams.get("$skiptoken");
  if (!token || token.length > 1700)
    throw new ConnectorError("contract", "invalid_next_link");
  return token;
}

function email(
  mail: string | null | undefined,
  upn: string | null | undefined,
): string | null {
  for (const value of [mail, upn]) {
    // Guest UPNs are synthetic identifiers, not delivery addresses.
    if (!value || value.includes("#EXT#")) continue;
    const result = z.email().safeParse(value.trim().toLowerCase());
    if (result.success) return result.data;
  }
  return null;
}

export const microsoft365LicensesConnector: ConnectorDefinition =
  defineConnector({
    manifest,
    readers: {
      licenses: async ({ context, cursor }) => {
        const state = cursor === null ? null : decode(cursor);
        const token = await accessToken(context);
        const get = async (url: string) =>
          json(
            await context.fetch(url, {
              headers: {
                authorization: `Bearer ${token}`,
                accept: "application/json",
              },
              signal: AbortSignal.timeout(15000),
            }),
          );
        const catalog = skuPageSchema.safeParse(
          await get(
            `${graph}/subscribedSkus?$select=skuId,skuPartNumber,appliesTo,prepaidUnits,consumedUnits`,
          ),
        );
        if (!catalog.success)
          throw new ConnectorError("contract", "unexpected_payload");
        const skus = catalog.data.value
          .filter((sku) => sku.appliesTo === "User")
          .sort((a, b) => a.skuId.localeCompare(b.skuId));
        if (new Set(skus.map((sku) => sku.skuId)).size !== skus.length)
          throw new ConnectorError("contract", "duplicate_sku");
        // A changed catalogue invalidates the position; never silently publish a
        // partial snapshot after a product disappears during synchronization.
        if (state && !skus.some((sku) => sku.skuId === state.sku))
          throw new ConnectorError("contract", "catalog_changed");
        let index = state
          ? skus.findIndex((sku) => sku.skuId === state.sku)
          : 0;
        let position = state?.token ?? null;
        const seats: ConnectorLicensePage["seats"][number][] = [];
        const seen = new Set<string>();
        if (position !== null) seen.add(position);
        for (
          let searches = 0;
          index < skus.length && searches < maximumSearches;
          searches++
        ) {
          const sku = skus[index];
          if (!sku) break;
          const page = userPageSchema.safeParse(
            await get(usersUrl(sku.skuId, position)),
          );
          if (!page.success)
            throw new ConnectorError("contract", "unexpected_payload");
          for (const user of page.data.value)
            seats.push({
              planExternalId: sku.skuId,
              accountExternalId: user.id,
              accountEmail: email(user.mail, user.userPrincipalName),
              accountName: user.displayName?.trim() || null,
              lastActivityAt: null,
            });
          position = nextToken(page.data["@odata.nextLink"], sku.skuId);
          if (position !== null) {
            if (seen.has(position))
              throw new ConnectorError(
                "contract",
                "pagination_did_not_advance",
              );
            seen.add(position);
          } else {
            index++;
            seen.clear();
          }
        }
        const current = skus[index];
        const next = current
          ? JSON.stringify({ version: 1, sku: current.skuId, token: position })
          : null;
        if (next !== null && next.length > 2048)
          throw new ConnectorError("contract", "cursor_too_long");
        return {
          cursor: next,
          plans: skus.map((sku) =>
            plan(sku, context.now().toISOString().slice(0, 10)),
          ),
          seats,
        };
      },
    },
  });
