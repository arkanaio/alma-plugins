import assert from "node:assert/strict";
import test from "node:test";
import {
  ConnectorError,
  connectorLicensePageSchema,
  createConnectorFetch,
} from "@arkanaio/connector-contract";
import assignments from "../sample-data/assignments.json" with { type: "json" };
import { googleWorkspaceLicensesConnector } from "../src/index.ts";

const definition = googleWorkspaceLicensesConnector;
async function read(body: unknown, status = 200, cursor: string | null = null) {
  const requests: { url: string; init: RequestInit }[] = [];
  const reader = definition.readers.licenses;
  assert.ok(reader);
  const page = await reader({
    context: {
      configuration: { customer_id: "C01234567" },
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
  assert.equal(page.cursor, "sample-page-2");
  assert.equal(page.plans.length, 2);
  assert.equal(page.seats[0]?.planExternalId, "Google-Apps/1010020028");
  assert.equal(page.seats[1]?.planExternalId, "Google-Apps/1010020025");
  assert.equal(page.seats[0]?.accountEmail, "alex@example.invalid");
  for (const plan of page.plans) {
    assert.equal(plan.pricePerSeat, null);
    assert.equal(plan.currency, null);
    assert.equal(plan.billingCycle, null);
    assert.equal(plan.seatCount, null);
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

test("passes the opaque cursor and accepts a genuinely empty final page", async () => {
  const { page, requests } = await read(
    { kind: assignments.kind },
    200,
    "next/page?=",
  );
  assert.deepEqual(page, { cursor: null, plans: [], seats: [] });
  const request = requests[0];
  assert.ok(request);
  assert.equal(
    new URL(request.url).searchParams.get("pageToken"),
    "next/page?=",
  );
});

test("keeps new SKUs readable and collapses repeated plans", async () => {
  const { page } = await read({
    kind: assignments.kind,
    items: [
      {
        productId: "Google-Apps",
        skuId: "future-sku",
        skuName: "Future edition",
        userId: "ALEX@example.invalid",
      },
      {
        productId: "Google-Apps",
        skuId: "future-sku",
        skuName: "Future edition",
        userId: "sam@example.invalid",
      },
    ],
  });
  assert.equal(page.plans.length, 1);
  assert.equal(page.seats[0]?.accountExternalId, "alex@example.invalid");
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
