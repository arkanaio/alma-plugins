import assert from "node:assert/strict";
import test from "node:test";
import {
  ConnectorError,
  type ConnectorLicensePage,
  connectorLicensePageSchema,
  connectorManifestSchema,
  createConnectorFetch,
} from "@arkanaio/connector-contract";
import users from "../sample-data/users.json" with { type: "json" };
import workspaces from "../sample-data/workspaces.json" with { type: "json" };
import { atlassianLicensesConnector } from "../src/index.ts";

const definition = atlassianLicensesConnector;
const jira =
  "ari:cloud:jira-software::site/00000000-0000-4000-8000-000000000001";
const confluence =
  "ari:cloud:confluence::site/00000000-0000-4000-8000-000000000001";
const sandbox =
  "ari:cloud:jira-software::site/00000000-0000-4000-8000-000000000009";

type Recorded = {
  url: string;
  init: RequestInit;
  body: Record<string, unknown>;
};
type Responder = (url: string, body: Record<string, unknown>) => Response;

/** Serves the sample data the way Atlassian would, keyed by cursor. */
const sampleProvider: Responder = (url, body) => {
  if (url.endsWith("/workspaces")) {
    const page = (workspaces as Record<string, unknown>)[
      typeof body.cursor === "string" ? body.cursor : ""
    ];
    return page ? Response.json(page) : Response.json({}, { status: 400 });
  }
  const resource = (body.resourceIds as string[])[0];
  const key = `${resource} ${typeof body.cursor === "string" ? body.cursor : ""}`;
  const page = (users as Record<string, unknown>)[key];
  return page ? Response.json(page) : Response.json({}, { status: 400 });
};

async function read(
  cursor: string | null = null,
  respond: Responder = sampleProvider,
  configuration: Record<string, string | null> = {
    organization_id: "sample-org",
  },
  secrets: Record<string, string> = { api_key: "sample-key-never-real" },
) {
  const requests: Recorded[] = [];
  const reader = definition.readers.licenses;
  assert.ok(reader);
  const page = await reader({
    context: {
      configuration,
      secrets,
      now: () => new Date("2026-09-20T12:00:00Z"),
      fetch: createConnectorFetch({
        allowedHosts: definition.manifest.allowedHosts,
        fetch: async (url, init) => {
          const body = JSON.parse(String(init.body ?? "{}"));
          requests.push({ url, init, body });
          return respond(url, body);
        },
      }),
    },
    cursor,
  });
  return { page: connectorLicensePageSchema.parse(page), requests };
}

async function readAll() {
  const pages: ConnectorLicensePage[] = [];
  let cursor: string | null = null;
  do {
    const { page } = await read(cursor);
    pages.push(page);
    cursor = page.cursor;
    assert.ok(pages.length < 10, "pagination must end");
  } while (cursor !== null);
  return pages;
}

test("the manifest satisfies the contract and declares what activity measures", () => {
  const manifest = connectorManifestSchema.parse(definition.manifest);
  assert.deepEqual(manifest.capabilities, ["licenses"]);
  assert.deepEqual(manifest.allowedHosts, ["api.atlassian.com"]);
  assert.ok(manifest.activity?.measures.includes("lastActiveTimestamp"));
  assert.ok(manifest.activity?.limitations.includes("24 hours"));
  assert.deepEqual(manifest.pricing, {
    exposesBillingCycle: false,
    exposesPricePerSeat: false,
  });
});

test("walks every site and every page of billable accounts", async () => {
  const pages = await readAll();
  assert.equal(pages.length, 3);
  const first = pages[0];
  assert.ok(first);
  assert.deepEqual(
    first.plans.map((plan) => plan.externalId),
    [confluence, jira],
  );
  const seats = pages.flatMap((page) => page.seats);
  assert.deepEqual(
    seats.map((seat) => [seat.planExternalId, seat.accountExternalId]),
    [
      [confluence, "sample-account-3"],
      [jira, "sample-account-1"],
      [jira, "sample-account-2"],
      [jira, "sample-account-3"],
    ],
  );
  // Later pages repeat only the plan their accounts belong to, unchanged.
  for (const page of pages.slice(1)) {
    for (const plan of page.plans)
      assert.deepEqual(
        plan,
        first.plans.find((value) => value.externalId === plan.externalId),
      );
  }
});

test("names each product site and keeps the seat limit only when Atlassian gives one", async () => {
  const { page } = await read();
  const byId = new Map(page.plans.map((plan) => [plan.externalId, plan]));
  assert.deepEqual(byId.get(jira), {
    externalId: jira,
    name: "Jira Standard · example.atlassian.net",
    billingCycle: null,
    pricePerSeat: null,
    currency: null,
    seatCount: 50,
  });
  assert.equal(
    byId.get(confluence)?.name,
    "Confluence · example.atlassian.net",
  );
  // No capacity is unknown, never the number of accounts detected.
  assert.equal(byId.get(confluence)?.seatCount, null);
  assert.equal(byId.has(sandbox), false);
});

test("returns activity for that site only, and null when there is none", async () => {
  const pages = await readAll();
  const seats = pages.flatMap((page) => page.seats);
  const find = (plan: string, account: string) =>
    seats.find(
      (seat) =>
        seat.planExternalId === plan && seat.accountExternalId === account,
    );
  assert.equal(
    find(jira, "sample-account-1")?.lastActivityAt,
    "2026-09-19T16:20:00.000Z",
  );
  assert.equal(
    find(confluence, "sample-account-3")?.lastActivityAt,
    "2026-09-18T07:45:10.123Z",
  );
  assert.equal(find(jira, "sample-account-2")?.lastActivityAt, null);
  assert.equal(find(jira, "sample-account-3")?.lastActivityAt, null);
});

test("keeps the account without inventing an email it does not expose", async () => {
  const pages = await readAll();
  const seats = pages.flatMap((page) => page.seats);
  const alex = seats.find(
    (seat) => seat.accountExternalId === "sample-account-1",
  );
  assert.equal(alex?.accountEmail, "alex@example.invalid");
  assert.equal(alex?.accountName, "Alex Moreno");
  const former = seats.find(
    (seat) => seat.accountExternalId === "sample-account-2",
  );
  assert.equal(former?.accountEmail, null);
});

test("asks only for active accounts with a billable role on the site", async () => {
  const { requests } = await read();
  const search = requests.find((request) =>
    request.url.includes("/users/search"),
  );
  assert.ok(search);
  assert.equal(
    search.url,
    "https://api.atlassian.com/admin/v2/orgs/sample-org/directories/-/users/search",
  );
  assert.deepEqual(search.body, {
    limit: 100,
    resourceIds: [confluence],
    roleIds: ["atlassian/user", "atlassian/admin"],
    status: ["active"],
    expand: ["productAccess"],
  });
  const listing = requests.filter((request) =>
    request.url.endsWith("/workspaces"),
  );
  assert.deepEqual(
    listing.map((request) => request.body),
    [{ limit: 1000 }, { cursor: "d29ya3NwYWNlcy0y" }],
  );
});

test("the key travels in a header and only reads are sent", async () => {
  const { requests } = await read();
  for (const request of requests) {
    assert.equal(new URL(request.url).host, "api.atlassian.com");
    assert.ok(!request.url.includes("sample-key"));
    assert.equal(
      new Headers(request.init.headers).get("authorization"),
      "Bearer sample-key-never-real",
    );
    // Both endpoints are searches: POST carries the filters, never a change.
    assert.ok(
      request.url.endsWith("/workspaces") ||
        request.url.endsWith("/users/search"),
    );
  }
});

test("continues with the next site when the one being read disappears", async () => {
  const cursor = JSON.stringify({
    version: 1,
    workspace: "ari:cloud:confluence::site/removed",
    users: "stale-cursor",
  });
  const { page, requests } = await read(cursor);
  const search = requests.find((request) =>
    request.url.includes("/users/search"),
  );
  assert.deepEqual(search?.body.resourceIds, [jira]);
  assert.equal(search?.body.cursor, undefined);
  assert.deepEqual(
    page.plans.map((plan) => plan.externalId),
    [jira],
  );
});

test("ends cleanly for an organization without product sites", async () => {
  const { page, requests } = await read(null, () =>
    Response.json({ data: [], links: {} }),
  );
  assert.deepEqual(page, { cursor: null, plans: [], seats: [] });
  assert.equal(requests.length, 1);
});

async function failure(respond: Responder, cursor: string | null = null) {
  try {
    await read(cursor, respond);
  } catch (error) {
    assert.ok(error instanceof ConnectorError);
    return error;
  }
  assert.fail("expected the read to fail");
}

test("maps provider failures without carrying the response body", async () => {
  const cases: [number, string, string, boolean][] = [
    [401, "credentials", "rejected", false],
    [403, "permissions", "admin_access_missing", false],
    [404, "permissions", "organization_not_found", false],
    [429, "service", "provider_unavailable", true],
    [503, "service", "provider_unavailable", true],
    [418, "contract", "unexpected_status", false],
  ];
  for (const [status, kind, code, retryable] of cases) {
    const error = await failure(() =>
      Response.json({ errors: [{ detail: "secret-body-detail" }] }, { status }),
    );
    assert.equal(error.kind, kind);
    assert.equal(error.code, code);
    assert.equal(error.retryable, retryable);
    assert.ok(!error.message.includes("secret-body-detail"));
  }
});

test("rejects a differently shaped response instead of returning wrong data", async () => {
  const error = await failure((url, body) =>
    url.endsWith("/workspaces")
      ? sampleProvider(url, body)
      : Response.json({ data: [{ name: "No account id" }] }),
  );
  assert.equal(error.kind, "contract");
  assert.equal(error.code, "unexpected_payload");
});

test("refuses a user cursor that does not advance", async () => {
  const cursor = JSON.stringify({ version: 1, workspace: jira, users: "same" });
  const error = await failure(
    (url, body) =>
      url.endsWith("/workspaces")
        ? sampleProvider(url, body)
        : Response.json({ data: [], links: { next: "same" } }),
    cursor,
  );
  assert.equal(error.code, "pagination_did_not_advance");
});

test("refuses a workspace listing that loops", async () => {
  const error = await failure(() =>
    Response.json({ data: [], links: { next: "again" } }),
  );
  assert.equal(error.code, "workspace_pagination_loop");
});

test("refuses a cursor it did not write", async () => {
  const error = await failure(sampleProvider, "not-json");
  assert.equal(error.kind, "contract");
  assert.equal(error.code, "invalid_cursor");
});

test("validates its configuration and secret before any request", async () => {
  const requests: string[] = [];
  const respond: Responder = (url) => {
    requests.push(url);
    return Response.json({});
  };
  for (const [configuration, secrets, kind] of [
    [{ organization_id: null }, { api_key: "key" }, "contract"],
    [{ organization_id: "../other" }, { api_key: "key" }, "contract"],
    [{ organization_id: "sample-org" }, { api_key: "" }, "credentials"],
    [{ organization_id: "sample-org" }, { api_key: "a\r\nb" }, "credentials"],
  ] as const) {
    await assert.rejects(
      read(null, respond, configuration, secrets),
      (error) => error instanceof ConnectorError && error.kind === kind,
    );
  }
  assert.deepEqual(requests, []);
});
