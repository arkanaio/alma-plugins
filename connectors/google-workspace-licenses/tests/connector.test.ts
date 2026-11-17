import assert from "node:assert/strict";
import test from "node:test";
import {
  ConnectorError,
  connectorLicensePageSchema,
  createConnectorFetch,
} from "@arkanaio/connector-contract";
import assignments from "../sample-data/assignments.json" with { type: "json" };
import geminiAssignments from "../sample-data/gemini-assignments.json" with {
  type: "json",
};
import purchased from "../sample-data/purchased.json" with { type: "json" };
import { googleWorkspaceLicensesConnector } from "../src/index.ts";

const definition = googleWorkspaceLicensesConnector;
async function read(
  body: unknown,
  status = 200,
  cursor: string | null = null,
  configuration: Record<string, string | null> = {},
) {
  const requests: { url: string; init: RequestInit }[] = [];
  const reader = definition.readers.licenses;
  assert.ok(reader);
  const page = await reader({
    context: {
      configuration: { customer_id: "C01234567", ...configuration },
      secrets: { access_token: "sample-token-never-real" },
      now: () => new Date("2026-09-20T12:00:00Z"),
      fetch: createConnectorFetch({
        allowedHosts: definition.manifest.allowedHosts,
        fetch: async (url, init) => {
          requests.push({ url, init });
          return Response.json(body, { status });
        },
      }),
    },
    cursor,
  });
  return { page: connectorLicensePageSchema.parse(page), requests };
}

test("reads each account's edition without inventing billing or activity", async () => {
  const { page, requests } = await read(assignments);
  assert.equal(page.cursor, "v1:Google-Apps:sample-page-2");
  assert.equal(page.plans.length, 2);
  assert.equal(page.seats[0]?.planExternalId, "Google-Apps/1010020028");
  assert.equal(page.seats[1]?.planExternalId, "Google-Apps/1010020025");
  assert.equal(page.seats[0]?.accountEmail, "alex@example.invalid");
  for (const plan of page.plans) {
    assert.equal(plan.pricePerSeat, null);
    assert.equal(plan.currency, null);
    assert.equal(plan.billingCycle, null);
    assert.equal(plan.purchasedQuantity?.value ?? null, null);
  }
  assert.ok(page.seats.every((seat) => seat.lastActivityAt === null));
  assert.equal(definition.manifest.activity, null);
  assert.equal(requests.length, 1);
  const request = requests[0];
  assert.ok(request);
  assert.equal(request.init.method, "GET");
  assert.equal(
    new Headers(request.init.headers).get("authorization"),
    "Bearer sample-token-never-real",
  );
  assert.equal(
    new URL(request.url).searchParams.get("customerId"),
    "C01234567",
  );
  assert.ok(!request.url.includes("sample-token"));
});

test("walks every supported product and keeps Google's page token opaque", async () => {
  const workspace = await read({ kind: assignments.kind }, 200, "next/page?=");
  assert.deepEqual(workspace.page, {
    cursor: "v1:101068:",
    plans: [],
    seats: [],
  });
  const request = workspace.requests[0];
  assert.ok(request);
  assert.equal(
    new URL(request.url).searchParams.get("pageToken"),
    "next/page?=",
  );
  assert.equal(
    new URL(request.url).pathname,
    "/apps/licensing/v1/product/Google-Apps/users",
  );

  const business = await read(
    { kind: assignments.kind },
    200,
    workspace.page.cursor,
  );
  assert.equal(business.page.cursor, "v1:101047:");
  assert.equal(
    new URL(business.requests[0]?.url ?? "").pathname,
    "/apps/licensing/v1/product/101068/users",
  );
  assert.equal(
    new URL(business.requests[0]?.url ?? "").searchParams.get("pageToken"),
    null,
  );

  const gemini = await read(geminiAssignments, 200, business.page.cursor);
  assert.equal(gemini.page.cursor, null);
  assert.equal(
    new URL(gemini.requests[0]?.url ?? "").pathname,
    "/apps/licensing/v1/product/101047/users",
  );
  assert.equal(gemini.page.plans[0]?.externalId, "101047/1010470006");
  assert.equal(gemini.page.seats[0]?.accountEmail, "orphan@example.invalid");
});

test("absent optional fields arrive as null, as the contract delivers them", async () => {
  // The host hands over every declared key with null for the ones the
  // organisation left empty; a connector that only accepts undefined fails
  // its first real read.
  const { page } = await read(assignments, 200, null, {
    read_mode: null,
    report_date: null,
  });
  assert.equal(page.seats.length, 2);
  await assert.rejects(
    read(purchased, 200, null, { read_mode: "purchased", report_date: null }),
    { code: "missing_report_date" },
  );
});

test("keeps unknown Gemini SKUs readable", async () => {
  const { page } = await read(geminiAssignments, 200, "v1:101047:");
  assert.equal(page.plans.length, 2);
  assert.equal(page.plans[1]?.externalId, "101047/future-gemini-sku");
  assert.equal(page.seats[1]?.accountExternalId, "alex@example.invalid");
});

test("rejects an invalid product cursor and a cross-product response", async () => {
  await assert.rejects(read(assignments, 200, "v1:unknown:"), {
    code: "invalid_cursor",
  });
  await assert.rejects(read(assignments, 200, "v1:101047:"), {
    code: "unexpected_payload",
  });
});

for (const [status, kind, retryable] of [
  [401, "credentials", false],
  [403, "permissions", false],
  [429, "service", true],
  [503, "service", true],
  [404, "contract", false],
] as const) {
  test(`classifies HTTP ${status} without leaking the provider body`, async () => {
    await assert.rejects(
      read({ secret: "sensitive-provider-body" }, status),
      (error: unknown) => {
        assert.ok(error instanceof ConnectorError);
        assert.equal(error.kind, kind);
        assert.equal(error.retryable, retryable);
        assert.ok(!String(error).includes("sensitive-provider-body"));
        return true;
      },
    );
  });
}

test("rejects malformed bodies instead of reporting no licenses", async () => {
  for (const body of [
    {},
    { kind: assignments.kind, items: null },
    { kind: assignments.kind, items: [{ userId: "bad" }] },
  ]) {
    await assert.rejects(read(body), {
      kind: "contract",
      code: "unexpected_payload",
    });
  }
});

test("the declared boundary refuses another host before sending credentials", async () => {
  let sent = false;
  const restricted = createConnectorFetch({
    allowedHosts: definition.manifest.allowedHosts,
    fetch: async () => {
      sent = true;
      return Response.json({});
    },
  });
  await assert.rejects(
    restricted("https://outside.example.invalid/", {}),
    ConnectorError,
  );
  assert.equal(sent, false);
});

const reportConfiguration = {
  read_mode: "purchased",
  report_date: "2026-09-18",
};
const report = (body: unknown, status = 200, cursor: string | null = null) =>
  read(body, status, cursor, reportConfiguration);

test("reads purchased totals, deduplicates aliases and preserves explicit zero", async () => {
  const { page, requests } = await report(purchased);
  assert.deepEqual(
    page.plans.map((plan) => [
      plan.externalId,
      plan.purchasedQuantity?.value ?? null,
    ]),
    [
      ["Google-Apps/Google-Apps-For-Business", 10],
      ["Google-Apps/1010020020", 30],
      ["Google-Vault/Google-Vault", 0],
    ],
  );
  assert.ok(page.plans.every((plan) => plan.consumedQuantity === null));
  assert.ok(
    page.plans.every(
      (plan) => plan.purchasedQuantity?.observedOn === "2026-09-18",
    ),
  );
  assert.ok(
    page.plans.every((plan) => plan.purchasedQuantity?.unit === "person"),
  );
  assert.ok(
    page.plans.every((plan) =>
      plan.purchasedQuantity?.source.startsWith("accounts:"),
    ),
  );
  assert.deepEqual(page.seats, []);
  assert.ok(
    !page.plans.some((plan) => plan.externalId === "Google-Apps/1010020028"),
  );
  const url = new URL(requests[0]?.url ?? "");
  assert.equal(url.hostname, "admin.googleapis.com");
  assert.equal(url.pathname, "/admin/reports/v1/usage/dates/2026-09-18");
  assert.equal(url.searchParams.get("customerId"), "C01234567");
  assert.equal(
    url.searchParams.get("parameters"),
    "accounts:gsuite_basic_total_licenses,accounts:apps_total_licenses,accounts:gsuite_unlimited_total_licenses,accounts:gsuite_enterprise_total_licenses,accounts:vault_total_licenses",
  );
  assert.equal(requests[0]?.init.method, "GET");
});

test("reports are paginated and missing totals remain unknown", async () => {
  const { page, requests } = await report(
    { ...purchased, nextPageToken: "next" },
    200,
    "previous",
  );
  assert.equal(page.cursor, "next");
  assert.equal(
    new URL(requests[0]?.url ?? "").searchParams.get("pageToken"),
    "previous",
  );
  assert.deepEqual((await report({ kind: purchased.kind })).page, {
    plans: [],
    seats: [],
    cursor: null,
  });
});

test("rejects another customer, another date and invalid or contradictory counts", async () => {
  const original = purchased.usageReports[0];
  assert.ok(original);
  for (const entry of [
    { ...original, entity: { customerId: "COTHER", type: "CUSTOMER" } },
    { ...original, date: "2026-09-17" },
    ...["-1", "1.5", "1000001", "9007199254740993", undefined].map(
      (intValue) => ({
        ...original,
        parameters: [{ name: "accounts:vault_total_licenses", intValue }],
      }),
    ),
    {
      ...original,
      parameters: [
        { name: "accounts:apps_total_licenses", intValue: "20" },
        { name: "accounts:gsuite_basic_total_licenses", intValue: "10" },
      ],
    },
  ])
    await assert.rejects(
      report({ kind: purchased.kind, usageReports: [entry] }),
      { kind: "contract" },
    );
});

test("incomplete reports never become authoritative totals", async () => {
  await assert.rejects(
    report({ ...purchased, warnings: [{ code: "PARTIAL_DATA_AVAILABLE" }] }),
    { code: "report_not_available" },
  );
  await assert.rejects(read(purchased, 200, null, { read_mode: "purchased" }), {
    code: "missing_report_date",
  });
  await assert.rejects(
    read(purchased, 200, null, {
      read_mode: "purchased",
      report_date: "2026-02-31",
    }),
    { code: "invalid_configuration" },
  );
});

test("a pending report date lets the host try an older date", async () => {
  const message = "Data for dates later than 2026-09-18 is not yet available";
  for (const error of [{ message }, { errors: [{ message }] }]) {
    await assert.rejects(report({ error }, 400), {
      kind: "contract",
      code: "report_not_available",
    });
  }
  await assert.rejects(
    report({ error: { message: "Invalid customer ID" } }, 400),
    { kind: "contract", code: "unexpected_status" },
  );
});

for (const [status, kind] of [
  [401, "credentials"],
  [403, "permissions"],
  [429, "service"],
  [500, "service"],
  [404, "contract"],
] as const) {
  test(`Reports HTTP ${status} remains isolated and sanitized`, async () => {
    await assert.rejects(
      report({ secret: "private-provider-body" }, status),
      (error: unknown) => {
        assert.ok(error instanceof ConnectorError);
        assert.equal(error.kind, kind);
        assert.ok(!String(error).includes("private-provider-body"));
        return true;
      },
    );
  });
}
