import assert from "node:assert/strict";
import { test } from "node:test";

import {
  type ConnectorContext,
  ConnectorError,
  type ConnectorLicensePage,
  connectorLicensePageSchema,
  connectorManifestSchema,
} from "@arkanaio/connector-contract";

import { exampleConnector } from "../src/connector.ts";
import { manifest } from "../src/manifest.ts";
import { createHost } from "./host.ts";

function read(
  context: ConnectorContext,
  cursor: string | null = null,
): Promise<ConnectorLicensePage> {
  const reader = exampleConnector.readers.licenses;
  assert.ok(reader, "The connector declares the licenses capability.");
  return reader({ context, cursor });
}

async function failsWith(
  options: { status?: number; body?: string },
  expected: { code: string; kind: string; retryable: boolean },
) {
  const { context } = await createHost(options);
  await assert.rejects(read(context), (error: unknown) => {
    assert.ok(error instanceof ConnectorError);
    assert.equal(error.kind, expected.kind);
    assert.equal(error.code, expected.code);
    assert.equal(error.retryable, expected.retryable);
    return true;
  });
}

test("the manifest satisfies the contract", () => {
  assert.equal(connectorManifestSchema.parse(manifest).id, "example_licenses");
});

test("it declares licenses only, not directory", () => {
  assert.deepEqual([...manifest.capabilities], ["licenses"]);
});

test("every page it returns satisfies the agreed shape", async () => {
  const { context } = await createHost();
  const page = await read(context);
  assert.doesNotThrow(() => connectorLicensePageSchema.parse(page));
});

test("walks every page", async () => {
  const { context } = await createHost();
  const first = await read(context);
  assert.equal(first.seats.length, 3);
  assert.equal(first.cursor, "page_2");

  const second = await read(context, first.cursor);
  assert.equal(second.seats.length, 1);
  assert.equal(second.cursor, null);
});

test("drops a price with no currency instead of assuming one", async () => {
  const { context } = await createHost();
  const page = await read(context);
  const storage = page.plans.find((plan) => plan.externalId === "plan_storage");
  assert.equal(storage?.pricePerSeat, null);
  assert.equal(storage?.currency, null);
});

test("hands over seats without deciding whether they are orphaned", async () => {
  const { context } = await createHost();
  const page = await read(context);
  // The connector reports the account, not the employee: there is no field in
  // which it could say one is orphaned even if it wanted to.
  assert.deepEqual(Object.keys(page.seats[0] ?? {}).sort(), [
    "accountEmail",
    "accountExternalId",
    "accountName",
    "lastActivityAt",
    "planExternalId",
  ]);
});

test("a seat with no activity value reports no value", async () => {
  const { context } = await createHost();
  const page = await read(context);
  const invited = page.seats.find((seat) => seat.accountExternalId === "acc_3");
  assert.equal(invited?.lastActivityAt, null);
});

test("it reports the provider's date and never a date of its own", async () => {
  const { context } = await createHost();
  const page = await read(context);
  const owner = page.seats.find((seat) => seat.accountExternalId === "acc_1");
  // The moment of the read is ALMA's to stamp, from `now`. The connector only
  // repeats what the provider said.
  assert.equal(owner?.lastActivityAt, "2026-09-16T08:12:00.000Z");
});

test("only talks to the hosts it declares", async () => {
  const { context, requests } = await createHost();
  await read(context);
  assert.ok(requests.length > 0);
  for (const request of requests) {
    assert.equal(new URL(request.url).hostname, "api.example.invalid");
  }
  await assert.rejects(
    context.fetch("https://collector.invalid/steal"),
    (error: unknown) =>
      error instanceof ConnectorError && error.code === "forbidden_host",
  );
});

test("sends the credential in a header and never in the address", async () => {
  const { context, requests } = await createHost();
  await read(context);
  const request = requests[0];
  assert.equal(request?.headers.get("authorization"), "Bearer test-token");
  assert.ok(!request?.url.includes("test-token"));
});

test("a rejected credential is not retried", async () => {
  await failsWith(
    { status: 401 },
    { code: "rejected", kind: "credentials", retryable: false },
  );
});

test("a missing permission is reported as such", async () => {
  await failsWith(
    { status: 403 },
    { code: "seats_scope_missing", kind: "permissions", retryable: false },
  );
});

test("a temporary provider failure is retryable", async () => {
  await failsWith(
    { status: 503 },
    { code: "provider_unavailable", kind: "service", retryable: true },
  );
});

test("a differently shaped response fails instead of producing wrong data", async () => {
  await failsWith(
    { body: JSON.stringify({ members: [{ id: 1 }] }) },
    { code: "unexpected_payload", kind: "contract", retryable: false },
  );
});

test("the failure never carries the provider's response", async () => {
  const leak = JSON.stringify({ members: [{ secret: "s3cr3t-value" }] });
  const { context } = await createHost({ body: leak });
  await assert.rejects(read(context), (error: unknown) => {
    assert.ok(error instanceof ConnectorError);
    assert.equal(error.message, "contract:unexpected_payload");
    assert.ok(!error.message.includes("s3cr3t-value"));
    return true;
  });
});
