import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  type ConnectorContext,
  connectorLicensePageSchema,
  createConnectorFetch,
} from "@arkanaio/connector-contract";
import { bitbucketLicensesConnector } from "../src/index.ts";

type Reply = Record<string, unknown>;
type Samples = {
  workspaces: Record<string, Reply>;
  members: Record<string, Reply>;
  users: Record<string, Reply>;
};
const samples = (): Samples =>
  JSON.parse(
    readFileSync(
      new URL("../sample-data/responses.json", import.meta.url),
      "utf8",
    ),
  );
function host(
  options: { fixture?: Samples; fail?: string; status?: number } = {},
) {
  const fixture = options.fixture ?? samples();
  const calls: string[] = [];
  const context: ConnectorContext = {
    configuration: {
      workspace: "example",
      organization_id: "sample-org",
      account_email: "token@example.invalid",
    },
    secrets: { api_token: "synthetic-token", api_key: "synthetic-key" },
    now: () => new Date("2026-09-28T00:00:00Z"),
    fetch: createConnectorFetch({
      allowedHosts: bitbucketLicensesConnector.manifest.allowedHosts,
      fetch: async (input, init) => {
        const url = new URL(String(input));
        calls.push(url.pathname);
        const headers = new Headers(init?.headers);
        const bitbucket = url.hostname === "api.bitbucket.org";
        assert.equal(
          headers.get("authorization"),
          bitbucket
            ? `Basic ${Buffer.from("token@example.invalid:synthetic-token").toString("base64")}`
            : "Bearer synthetic-key",
        );
        assert.equal(init?.method, bitbucket ? "GET" : "POST");
        assert.ok(!url.href.includes("synthetic"));
        if (options.fail && url.pathname.endsWith(options.fail))
          return new Response("private provider data", {
            status: options.status ?? 403,
          });
        const body = JSON.parse(String(init?.body ?? "{}"));
        let result: Reply | undefined;
        if (url.pathname === "/2.0/workspaces/example/members")
          result = fixture.members[url.searchParams.get("page") ?? "1"];
        else if (url.pathname === "/admin/v2/orgs/sample-org/workspaces")
          result = fixture.workspaces[body.cursor ?? ""];
        else if (
          url.pathname ===
          "/admin/v2/orgs/sample-org/directories/-/users/search"
        ) {
          assert.ok(!body.resourceIds);
          assert.ok(!body.roleIds);
          result = fixture.users[body.cursor ?? ""];
        } else assert.fail(`Unexpected endpoint: ${url.pathname}`);
        assert.ok(result);
        return Response.json(result);
      },
    }),
  };
  return { context, calls };
}
async function read(context: ConnectorContext, cursor: string | null = null) {
  const reader = bitbucketLicensesConnector.readers.licenses;
  assert.ok(reader);
  const page = await reader({ context, cursor });
  return connectorLicensePageSchema.parse(page);
}
test("paginates all three resources, joins IDs and preserves missing emails", async () => {
  const { context } = host();
  const first = await read(context);
  assert.ok(first.cursor);
  const last = await read(context, first.cursor);
  assert.equal(last.cursor, null);
  assert.equal(first.plans[0]?.purchasedQuantity?.value, 3);
  assert.equal(first.plans[0]?.purchasedQuantity?.observedOn, "2026-09-28");
  assert.equal(first.plans[0]?.consumedQuantity, null);
  assert.equal(first.seats[0]?.accountEmail, "alex@example.invalid");
  assert.equal(first.seats[1]?.accountEmail, null);
  assert.equal(first.seats[1]?.accountExternalId, "account-2");
  assert.equal(last.seats[0]?.accountEmail, "sam@example.invalid");
  assert.equal(last.seats[0]?.lastActivityAt, null);
  assert.ok(!first.cursor.includes("account-"));
});
for (const endpoint of ["members", "workspaces", "users/search"]) {
  for (const [status, kind] of [
    [401, "credentials"],
    [403, "permissions"],
    [404, "permissions"],
    [429, "service"],
    [500, "service"],
    [400, "contract"],
  ] as const) {
    test(`${endpoint} ${status} rejects the entire page without leaking the response`, async () => {
      await assert.rejects(
        read(host({ fail: endpoint, status }).context),
        (error: unknown) => {
          assert.ok(error instanceof Error);
          assert.match(error.message, new RegExp(`^${kind}:`));
          assert.ok(!error.message.includes("private"));
          return true;
        },
      );
    });
  }
}
test("requires both credentials before any provider call", async () => {
  for (const secrets of [
    { api_key: "key" },
    { api_token: "token" },
    { api_key: "key", api_token: "bad\nvalue" },
  ]) {
    const { context, calls } = host();
    await assert.rejects(
      read({ ...context, secrets }),
      /credentials:invalid_secret/,
    );
    assert.equal(calls.length, 0);
  }
});
test("an unrelated organization fails before membership is read", async () => {
  const fixture = samples();
  fixture.workspaces = { "": { data: [] } };
  const { context, calls } = host({ fixture });
  await assert.rejects(read(context), /permissions:/);
  assert.equal(calls.length, 1);
});
test("malformed successful responses never become empty inventories", async () => {
  for (const field of ["workspaces", "members", "users"] as const) {
    const fixture = samples();
    fixture[field][field === "members" ? "1" : ""] = {};
    await assert.rejects(
      read(host({ fixture }).context),
      /contract:unexpected_payload/,
    );
  }
});
test("rejects malicious and looping pagination URLs", async () => {
  for (const next of [
    "https://api.atlassian.com/steal?page=2",
    "https://api.bitbucket.org/2.0/workspaces/example/members?page=1",
    "https://api.bitbucket.org/other?page=2",
  ]) {
    const fixture = samples();
    assert.ok(fixture.members["1"]);
    fixture.members["1"].next = next;
    await assert.rejects(
      read(host({ fixture }).context),
      /contract:pagination_did_not_advance/,
    );
  }
});
test("rejects incomplete pages and changing membership totals", async () => {
  const fixture = samples();
  assert.ok(fixture.members["1"]);
  delete fixture.members["1"].next;
  await assert.rejects(
    read(host({ fixture }).context),
    /contract:incomplete_membership/,
  );
  const { context } = host();
  const first = await read(context);
  const changed = samples();
  assert.ok(changed.members["2"]);
  changed.members["2"].size = 4;
  await assert.rejects(
    read(host({ fixture: changed }).context, first.cursor),
    /service:membership_changed/,
  );
});
test("zero members remains a known zero and still requires directory access", async () => {
  const fixture = samples();
  fixture.members = { "1": { size: 0, values: [] } };
  const page = await read(host({ fixture }).context);
  assert.equal(page.plans[0]?.purchasedQuantity?.value, 0);
  await assert.rejects(
    read(host({ fixture, fail: "users/search" }).context),
    /permissions:/,
  );
});

test("rejects a forged owner URL and a different product", async () => {
  for (const attributes of [
    {
      typeKey: "bitbucket",
      hostUrl: "https://bitbucket.org.evil.invalid/example",
    },
    { typeKey: "bitbucket", hostUrl: "https://bitbucket.org/example-other" },
    { typeKey: "jira", hostUrl: "https://bitbucket.org/example" },
  ]) {
    const fixture = samples();
    fixture.workspaces = { "": { data: [{ id: "unrelated", attributes }] } };
    await assert.rejects(read(host({ fixture }).context), /permissions:/);
  }
});
test("rejects invalid cursors before sending any credentials", async () => {
  const { context, calls } = host();
  await assert.rejects(read(context, "not-json"), /contract:invalid_cursor/);
  assert.equal(calls.length, 0);
});
test("directory failure on a later members page never returns degraded seats", async () => {
  const first = await read(host().context);
  assert.ok(first.cursor);
  await assert.rejects(
    read(host({ fail: "users/search", status: 401 }).context, first.cursor),
    /credentials:rejected/,
  );
});
test("organization loops fail and cannot redirect credentials between hosts", async () => {
  for (const next of [
    "workspaces-2",
    "https://api.bitbucket.org/steal?cursor=x",
  ]) {
    const fixture = samples();
    assert.ok(fixture.workspaces["workspaces-2"]);
    fixture.workspaces["workspaces-2"].links = { next };
    await assert.rejects(read(host({ fixture }).context), /contract:/);
  }
});

test("a read crossing UTC midnight keeps consistent quantity provenance", async () => {
  const { context } = host();
  const first = await read(context);
  const last = await read(
    { ...context, now: () => new Date("2026-09-29T00:00:00Z") },
    first.cursor,
  );
  assert.deepEqual(
    last.plans[0]?.purchasedQuantity,
    first.plans[0]?.purchasedQuantity,
  );
});
