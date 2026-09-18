import assert from "node:assert/strict";
import { test } from "node:test";

import { validateManifest } from "@alma/connector-contract";

import { exampleConnector, ProviderError } from "../src/connector.ts";
import { manifest } from "../src/manifest.ts";
import { configurationSchema } from "../src/schemas.ts";
import { createHost } from "./host.ts";

test("the manifest satisfies the contract", () => {
  assert.equal(validateManifest(manifest).id, "example");
});

test("every field declared in the manifest exists in the schema", () => {
  const declared = manifest.configuration.map((field) => field.key);
  const validated = Object.keys(configurationSchema.shape);
  assert.deepEqual([...declared].sort(), [...validated].sort());
});

test("walks every page of contracts", async () => {
  const { context } = await createHost();
  const first = await exampleConnector.listContracts(context, null);
  assert.equal(first.items.length, 2);
  assert.equal(first.cursor, "page-2");

  const second = await exampleConnector.listContracts(context, first.cursor);
  assert.equal(second.items.length, 1);
  assert.equal(second.cursor, null);
});

test("drops a price with no currency instead of assuming one", async () => {
  const { context } = await createHost();
  const page = await exampleConnector.listContracts(context, "page-2");
  assert.equal(page.items[0]?.seatPrice, null);
});

test("reports the billing cycle the contract expects", async () => {
  const { context } = await createHost();
  const page = await exampleConnector.listContracts(context, null);
  assert.equal(page.items[0]?.billingCycle, "monthly");
  assert.equal(page.items[1]?.billingCycle, "yearly");
});

test("hands over seats as-is, without deciding if they are orphaned", async () => {
  const { context } = await createHost();
  const page = await exampleConnector.listSeats(context, null);
  assert.deepEqual(
    page.items.map((seat) => seat.status),
    ["active", "active", "invited"],
  );
});

test("a seat with no activity value returns absence of information", async () => {
  const { context } = await createHost();
  const page = await exampleConnector.listSeats(context, null);
  const invited = page.items.find((seat) => seat.status === "invited");
  assert.equal(invited?.lastActivity, null);
});

test("keeps the provider date apart from the moment of the read", async () => {
  const { context } = await createHost();
  const page = await exampleConnector.listSeats(context, null);
  const activity = page.items[0]?.lastActivity;
  assert.equal(activity?.providerDate, "2026-09-16T08:12:00Z");
  assert.ok(activity?.readAt);
  assert.notEqual(activity?.readAt, activity?.providerDate);
});

test("only talks to the declared domains", async () => {
  const { context, requestedUrls } = await createHost();
  await exampleConnector.listSeats(context, null);
  assert.ok(requestedUrls.length > 0);
  for (const url of requestedUrls) {
    assert.equal(new URL(url).hostname, "api.example.test");
  }
});

test("the trace carries no personal data and no activity", async () => {
  const { context, traces } = await createHost();
  await exampleConnector.listSeats(context, null);
  const text = JSON.stringify(traces);
  for (const forbidden of [
    "first.owner@example.test",
    "First Owner",
    "2026-09-16",
    "test-token",
  ]) {
    assert.ok(!text.includes(forbidden), `The trace leaked ${forbidden}.`);
  }
});

test("a rejected credential is not retried", async () => {
  const { context } = await createHost({ status: 401 });
  await assert.rejects(
    exampleConnector.verifyAccess(context),
    (error: unknown) =>
      error instanceof ProviderError && error.retryable === false,
  );
});

test("a temporary provider failure is retryable", async () => {
  const { context } = await createHost({ status: 503 });
  await assert.rejects(
    exampleConnector.verifyAccess(context),
    (error: unknown) =>
      error instanceof ProviderError && error.retryable === true,
  );
});

test("a differently shaped response fails instead of producing wrong data", async () => {
  const { context } = await createHost();
  const broken = {
    ...context,
    request: async () => Response.json({ subscriptions: [{ id: 1 }] }),
  };
  await assert.rejects(exampleConnector.listContracts(broken, null));
});
