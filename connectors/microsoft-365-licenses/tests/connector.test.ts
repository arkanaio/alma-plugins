import assert from "node:assert/strict";
import test from "node:test";
import {
  type ConnectorContext,
  ConnectorError,
  connectorLicensePageSchema,
  createConnectorFetch,
} from "@arkanaio/connector-contract";
import skus from "../sample-data/skus.json" with { type: "json" };
import users from "../sample-data/users.json" with { type: "json" };
import { microsoft365LicensesConnector as connector } from "../src/index.ts";

const firstSku = "00000000-0000-0000-0000-000000000001";
const tenant = "20000000-0000-0000-0000-000000000001";
const client = "30000000-0000-0000-0000-000000000001";
const secret = "synthetic-client-value:+ %";
const access = "synthetic-access-value";
type Override = (url: URL, init: RequestInit) => Response | undefined;
function host(override?: Override) {
  const calls: { url: string; init: RequestInit }[] = [];
  const context: ConnectorContext = {
    configuration: { tenant_id: tenant, client_id: client },
    secrets: { client_secret: secret },
    now: () => new Date("2026-09-23T12:00:00Z"),
    fetch: createConnectorFetch({
      allowedHosts: connector.manifest.allowedHosts,
      fetch: async (url, init) => {
        calls.push({ url, init });
        const parsed = new URL(url);
        const response = override?.(parsed, init);
        if (response) return response;
        if (parsed.hostname === "login.microsoftonline.com")
          return Response.json({ token_type: "Bearer", access_token: access });
        if (parsed.pathname === "/v1.0/subscribedSkus")
          return Response.json(skus);
        if (parsed.pathname === "/v1.0/users")
          return Response.json(
            parsed.searchParams.get("$filter")?.includes(firstSku)
              ? users
              : { value: [] },
          );
        assert.fail(`Unexpected endpoint ${url}`);
      },
    }),
  };
  return { calls, context };
}
async function read(context: ConnectorContext, cursor: string | null = null) {
  assert.ok(connector.readers.licenses);
  return connectorLicensePageSchema.parse(
    await connector.readers.licenses({ context, cursor }),
  );
}
function errorIs(kind: string, code: string) {
  return (error: unknown) => {
    assert.ok(error instanceof ConnectorError);
    assert.equal(error.kind, kind);
    assert.equal(error.code, code);
    assert.equal(error.retryable, kind === "service");
    assert.ok(!error.message.includes(secret));
    assert.ok(!error.message.includes(access));
    return true;
  };
}

test("license-only catalogue preserves active units, unknowns and zero without inventing prices", async () => {
  const { context, calls } = host();
  const page = await read(context);
  assert.deepEqual(connector.manifest.capabilities, ["licenses"]);
  assert.equal(connector.manifest.activity, null);
  assert.equal(page.cursor, null);
  assert.deepEqual(
    page.plans.map((p) => p.seatCount),
    [25, null, 0],
  );
  assert.equal(page.plans[0]?.externalId, firstSku);
  assert.ok(
    page.plans.every(
      (p) =>
        p.currency === null &&
        p.pricePerSeat === null &&
        p.billingCycle === null,
    ),
  );
  assert.equal(page.seats.length, 2);
  assert.equal(page.seats[0]?.accountEmail, "member@example.invalid");
  assert.equal(page.seats[1]?.accountEmail, null);
  assert.ok(page.seats.every((s) => s.lastActivityAt === null));
  assert.equal(calls.length, 5);
  assert.ok(!JSON.stringify(page).includes(secret));
  assert.ok(!JSON.stringify(page).includes(access));
});

test("credentials only travel in headers to their respective fixed hosts", async () => {
  const { context, calls } = host();
  await read(context);
  for (const { url, init } of calls) {
    assert.ok(!url.includes(secret) && !url.includes(access));
    assert.equal(init.redirect, "error");
    const headers = new Headers(init.headers);
    if (new URL(url).hostname === "login.microsoftonline.com") {
      assert.equal(init.method, "POST");
      assert.equal(new URL(url).pathname, `/${tenant}/oauth2/v2.0/token`);
      const encoded = headers.get("authorization")?.replace("Basic ", "");
      assert.ok(encoded);
      const decoded = atob(encoded).split(":");
      assert.equal(decoded[0], client);
      assert.equal(new URLSearchParams(`v=${decoded[1]}`).get("v"), secret);
      const form = new URLSearchParams(String(init.body));
      assert.equal(form.get("grant_type"), "client_credentials");
      assert.equal(form.get("scope"), "https://graph.microsoft.com/.default");
      assert.equal(form.has("client_secret"), false);
    } else {
      assert.equal(init.method, "GET");
      assert.equal(headers.get("authorization"), `Bearer ${access}`);
      assert.equal(init.body, undefined);
    }
  }
});

test("bounded pagination resumes without placing accounts or credentials in cursors", async () => {
  const { context } = host((url) => {
    if (
      url.pathname !== "/v1.0/users" ||
      !url.searchParams.get("$filter")?.includes(firstSku)
    )
      return undefined;
    const index = Number(url.searchParams.get("$skiptoken") ?? "0");
    const next = new URL(url);
    next.searchParams.set("$skiptoken", String(index + 1));
    return Response.json({
      value: [
        {
          ...users.value[0],
          id: `10000000-0000-0000-0000-${String(index + 1).padStart(12, "0")}`,
        },
      ],
      ...(index < 6 ? { "@odata.nextLink": next.toString() } : {}),
    });
  });
  const first = await read(context);
  assert.equal(first.seats.length, 5);
  assert.ok(first.cursor);
  assert.ok(!first.cursor.includes("example.invalid"));
  const second = await read(context, first.cursor);
  assert.equal(second.seats.length, 2);
  assert.equal(second.cursor, null);
  assert.equal(
    new Set([...first.seats, ...second.seats].map((s) => s.accountExternalId))
      .size,
    7,
  );
});

for (const [status, kind, code] of [
  [401, "credentials", "rejected"],
  [403, "permissions", "admin_consent_missing"],
  [429, "service", "provider_unavailable"],
  [503, "service", "provider_unavailable"],
  [400, "contract", "unexpected_status"],
] as const) {
  test(`Graph ${status} is classified without exposing the body`, async () => {
    const { context } = host((url) =>
      url.hostname === "graph.microsoft.com"
        ? new Response(secret, { status })
        : undefined,
    );
    await assert.rejects(read(context), errorIs(kind, code));
  });
}

test("rejected app secret is not retried", async () => {
  const { context } = host(() => new Response(secret, { status: 400 }));
  await assert.rejects(read(context), errorIs("credentials", "rejected"));
});

for (const next of [
  "https://example.invalid/v1.0/users?$skiptoken=next",
  "https://login.microsoftonline.com/v1.0/users?$skiptoken=next",
  "https://graph.microsoft.com:444/v1.0/users?$skiptoken=next",
  "http://graph.microsoft.com/v1.0/users?$skiptoken=next",
  "https://graph.microsoft.com/v1.0/groups?$skiptoken=next",
  "https://graph.microsoft.com/v1.0/users?$skiptoken=next&$filter=wrong",
  "https://graph.microsoft.com/v1.0/users?$skiptoken=a&$skiptoken=b",
  "https://name:password@graph.microsoft.com/v1.0/users?$skiptoken=next",
]) {
  test(`rejects unsafe continuation ${next}`, async () => {
    const { context, calls } = host((url) =>
      url.pathname === "/v1.0/users"
        ? Response.json({ value: [], "@odata.nextLink": next })
        : undefined,
    );
    await assert.rejects(
      read(context),
      errorIs("contract", "invalid_next_link"),
    );
    assert.equal(calls.length, 3);
  });
}

test("repeated continuation fails without looping", async () => {
  const { context } = host((url) =>
    url.pathname === "/v1.0/users"
      ? Response.json({
          value: [],
          "@odata.nextLink":
            "https://graph.microsoft.com/v1.0/users?$skiptoken=repeat",
        })
      : undefined,
  );
  await assert.rejects(
    read(context),
    errorIs("contract", "pagination_did_not_advance"),
  );
});

test("schema drift and incomplete SKU pagination fail closed", async () => {
  for (const body of [
    {},
    { value: [{ ...skus.value[0], prepaidUnits: { enabled: -1 } }] },
    {
      ...skus,
      "@odata.nextLink":
        "https://graph.microsoft.com/v1.0/subscribedSkus?next=2",
    },
  ]) {
    const { context } = host((url) =>
      url.pathname === "/v1.0/subscribedSkus" ? Response.json(body) : undefined,
    );
    await assert.rejects(
      read(context),
      errorIs("contract", "unexpected_payload"),
    );
  }
  const { context } = host((url) =>
    url.pathname === "/v1.0/users"
      ? Response.json({ value: [{ displayName: "Missing ID" }] })
      : undefined,
  );
  await assert.rejects(
    read(context),
    errorIs("contract", "unexpected_payload"),
  );
});

test("invalid config and cursor fail before contacting Microsoft", async () => {
  const { context, calls } = host();
  await assert.rejects(
    read({
      ...context,
      configuration: { tenant_id: "../common", client_id: client },
    }),
    errorIs("contract", "invalid_configuration"),
  );
  await assert.rejects(
    read(context, "{}"),
    errorIs("contract", "invalid_cursor"),
  );
  assert.equal(calls.length, 0);
});

test("unlicensed tenants return an empty successful page", async () => {
  const { context, calls } = host((url) =>
    url.pathname === "/v1.0/subscribedSkus"
      ? Response.json({ value: [] })
      : undefined,
  );
  assert.deepEqual(await read(context), { cursor: null, plans: [], seats: [] });
  assert.equal(calls.length, 2);
});

test("uses a valid UPN when mail is absent and retains a licensed disabled account", async () => {
  const { context } = host((url) =>
    url.pathname === "/v1.0/users"
      ? Response.json({
          value: [
            {
              ...users.value[0],
              mail: null,
              userPrincipalName: "FALLBACK@example.invalid",
              accountEnabled: false,
            },
          ],
        })
      : undefined,
  );
  const page = await read(context);
  assert.equal(page.seats.length, 3);
  assert.ok(
    page.seats.every(
      (seat) => seat.accountEmail === "fallback@example.invalid",
    ),
  );
});

test("rejects malformed tokens without sending them to Graph", async () => {
  const { context, calls } = host((url) =>
    url.hostname === "login.microsoftonline.com"
      ? Response.json({ token_type: "Bearer", access_token: "bad\r\ntoken" })
      : undefined,
  );
  await assert.rejects(
    read(context),
    errorIs("contract", "unexpected_token_payload"),
  );
  assert.equal(calls.length, 1);
});

test("does not silently complete after the current SKU disappears", async () => {
  const { context } = host();
  await assert.rejects(
    read(
      context,
      JSON.stringify({
        version: 1,
        sku: "90000000-0000-0000-0000-000000000001",
        token: null,
      }),
    ),
    errorIs("contract", "catalog_changed"),
  );
});
