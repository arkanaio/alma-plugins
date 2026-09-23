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
import { chatgptLicensesConnector } from "../src/index.ts";

const definition = chatgptLicensesConnector;
const workspace = "00000000-0000-4000-8000-000000000001";
const chatgpt = `${workspace}/chatgpt`;
const codex = `${workspace}/codex`;

type Recorded = { url: URL; init: RequestInit };
type Responder = (url: URL) => Response;

/** Serves the sample data the way OpenAI would, keyed by the after cursor. */
const sampleProvider: Responder = (url) => {
  const page = (users as Record<string, unknown>)[
    url.searchParams.get("after") ?? ""
  ];
  return page ? Response.json(page) : Response.json({}, { status: 400 });
};

async function read(
  cursor: string | null = null,
  respond: Responder = sampleProvider,
  configuration: Record<string, string | null> = { workspace_id: workspace },
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
          const parsed = new URL(url);
          requests.push({ url: parsed, init });
          return respond(parsed);
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

async function rejects(
  promise: Promise<unknown>,
  kind: ConnectorError["kind"],
  code: string,
) {
  await assert.rejects(promise, (error) => {
    assert.ok(error instanceof ConnectorError);
    assert.equal(error.kind, kind);
    assert.equal(error.code, code);
    return true;
  });
}

test("the manifest satisfies the contract and declares no activity", () => {
  const manifest = connectorManifestSchema.parse(definition.manifest);
  assert.deepEqual(manifest.capabilities, ["licenses"]);
  assert.deepEqual(manifest.allowedHosts, ["api.chatgpt.com"]);
  assert.equal(manifest.activity, null);
  assert.deepEqual(manifest.pricing, {
    exposesBillingCycle: false,
    exposesPricePerSeat: false,
  });
});

test("reads every active member, one plan per seat type", async () => {
  const pages = await readAll();
  assert.equal(pages.length, 2);
  assert.deepEqual(
    pages.flatMap((page) =>
      page.seats.map((seat) => [seat.planExternalId, seat.accountExternalId]),
    ),
    [
      [chatgpt, "user-sample0000000000000001"],
      [codex, "user-sample0000000000000002"],
      [chatgpt, "user-sample0000000000000003"],
      [chatgpt, "user-sample0000000000000004"],
    ],
  );
  const [first, second] = pages;
  assert.ok(first && second);
  assert.deepEqual(
    first.plans.map((plan) => [plan.externalId, plan.name]),
    [
      [chatgpt, "ChatGPT"],
      [codex, "Codex"],
    ],
  );
  // A later page repeats only the plans its seats need, with the same values.
  assert.deepEqual(second.plans, [first.plans[0]]);
});

test("purchased totals, prices and activity are never invented", async () => {
  for (const page of await readAll()) {
    for (const plan of page.plans) {
      assert.equal(plan.seatCount, null);
      assert.equal(plan.pricePerSeat, null);
      assert.equal(plan.currency, null);
      assert.equal(plan.billingCycle, null);
    }
    for (const seat of page.seats) assert.equal(seat.lastActivityAt, null);
  }
});

test("emails are lowercased, and a missing or malformed one is null", async () => {
  const seats = (await readAll()).flatMap((page) => page.seats);
  assert.deepEqual(
    seats.map((seat) => [seat.accountEmail, seat.accountName]),
    [
      ["alex@example.invalid", "Alex Moreno"],
      ["jordan@example.invalid", "Jordan Lee"],
      [null, "Sam Rivera"],
      [null, null],
    ],
  );
});

test("asks for the largest page, continues after the last ID and sends the key only in the header", async () => {
  const first = await read();
  const request = first.requests[0];
  assert.ok(request);
  assert.equal(
    `${request.url.origin}${request.url.pathname}`,
    `https://api.chatgpt.com/v1/manage/workspaces/${workspace}/users`,
  );
  assert.equal(request.url.searchParams.get("limit"), "1000");
  assert.equal(request.url.searchParams.get("after"), null);
  assert.equal(request.init.method, "GET");
  assert.equal(
    new Headers(request.init.headers).get("authorization"),
    "Bearer sample-key-never-real",
  );
  assert.ok(!request.url.toString().includes("sample-key-never-real"));

  const second = await read(first.page.cursor);
  assert.equal(
    second.requests[0]?.url.searchParams.get("after"),
    "user-sample0000000000000002",
  );
});

test("an unknown seat type fails the read instead of being guessed", async () => {
  await rejects(
    read(null, () =>
      Response.json({
        data: [{ id: "user-x", email: null, name: null, seat_type: "future" }],
        has_more: false,
      }),
    ),
    "contract",
    "unknown_seat_type",
  );
});

test("a cursor that does not advance is a contract failure", async () => {
  const stuck: Responder = () =>
    Response.json({
      data: [],
      last_id: "user-sample0000000000000002",
      has_more: true,
    });
  await rejects(
    read(
      JSON.stringify({ version: 1, after: "user-sample0000000000000002" }),
      stuck,
    ),
    "contract",
    "pagination_did_not_advance",
  );
  await rejects(
    read(null, () => Response.json({ data: [], has_more: true })),
    "contract",
    "pagination_did_not_advance",
  );
});

test("provider answers map to failure kinds without carrying the body", async () => {
  const cases: [number, ConnectorError["kind"], string][] = [
    [401, "credentials", "rejected"],
    [403, "permissions", "users_read_missing"],
    [404, "permissions", "workspace_not_found"],
    [429, "service", "provider_unavailable"],
    [503, "service", "provider_unavailable"],
    [400, "contract", "unexpected_status"],
  ];
  for (const [status, kind, code] of cases) {
    const promise = read(null, () =>
      Response.json({ error: { message: "alex@example.invalid" } }, { status }),
    );
    await assert.rejects(promise, (error) => {
      assert.ok(error instanceof ConnectorError);
      assert.equal(error.kind, kind);
      assert.equal(error.code, code);
      assert.ok(!error.message.includes("example.invalid"));
      return true;
    });
  }
});

test("a response in another shape is a contract failure", async () => {
  await rejects(
    read(null, () => Response.json({ users: [] })),
    "contract",
    "unexpected_payload",
  );
  await rejects(
    read(null, () => new Response("not json", { status: 200 })),
    "contract",
    "unexpected_payload",
  );
});

test("invalid configuration, secret and cursor are rejected before any request", async () => {
  for (const [configuration, secrets, cursor, kind, code] of [
    [
      { workspace_id: "not-a-uuid" },
      undefined,
      null,
      "contract",
      "invalid_configuration",
    ],
    [
      { workspace_id: null },
      undefined,
      null,
      "contract",
      "invalid_configuration",
    ],
    [undefined, { api_key: "" }, null, "credentials", "invalid_secret"],
    [undefined, { api_key: "a\r\nb" }, null, "credentials", "invalid_secret"],
    [undefined, undefined, "{not json", "contract", "invalid_cursor"],
    [
      undefined,
      undefined,
      JSON.stringify({ version: 2, after: "x" }),
      "contract",
      "invalid_cursor",
    ],
  ] as const) {
    let called = false;
    await rejects(
      read(
        cursor,
        () => {
          called = true;
          return Response.json({});
        },
        configuration,
        secrets,
      ),
      kind,
      code,
    );
    assert.equal(called, false);
  }
});

test("the workspace ID is normalized to lowercase", async () => {
  const { page, requests } = await read(null, sampleProvider, {
    workspace_id: ` ${workspace.toUpperCase()} `,
  });
  assert.ok(requests[0]?.url.pathname.includes(workspace));
  assert.equal(page.plans[0]?.externalId, chatgpt);
});
