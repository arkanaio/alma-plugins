import assert from "node:assert/strict";
import { test } from "node:test";

import {
  ConnectorError,
  type ConnectorManifest,
  connectorManifestSchema,
  defineConnector,
} from "../src/index.ts";

const base: ConnectorManifest = {
  activity: null,
  allowedHosts: ["api.example.invalid"],
  authentication: {
    fields: [
      { help: null, key: "api_token", label: "API token", maximumLength: 200 },
    ],
    kind: "secret",
  },
  capabilities: ["licenses"],
  configuration: [],
  description: "A connector used to exercise the shared definition.",
  documentationUrl: "https://example.invalid/docs",
  id: "example",
  name: "Example",
  pricing: { exposesBillingCycle: true, exposesPricePerSeat: true },
  supportLevel: "official",
  version: "1.0.0",
};

const emptyPage = async () => ({ cursor: null, plans: [], seats: [] });

test("accepts a license manifest with no activity", () => {
  assert.equal(connectorManifestSchema.parse(base).id, "example");
});

test("rejects an id that is not a lowercase identifier", () => {
  assert.equal(
    connectorManifestSchema.safeParse({ ...base, id: "Example Provider" })
      .success,
    false,
  );
});

test("requires at least one declared host", () => {
  assert.equal(
    connectorManifestSchema.safeParse({ ...base, allowedHosts: [] }).success,
    false,
  );
});

test("rejects a repeated host", () => {
  assert.equal(
    connectorManifestSchema.safeParse({
      ...base,
      allowedHosts: ["api.example.invalid", "api.example.invalid"],
    }).success,
    false,
  );
});

test("rejects documentation served over HTTP", () => {
  assert.equal(
    connectorManifestSchema.safeParse({
      ...base,
      documentationUrl: "http://example.invalid/docs",
    }).success,
    false,
  );
});

test("rejects a configuration key that collides with a secret", () => {
  assert.equal(
    connectorManifestSchema.safeParse({
      ...base,
      configuration: [
        {
          help: null,
          key: "api_token",
          kind: "text",
          label: "Token",
          maximumLength: 10,
          options: null,
          required: true,
        },
      ],
    }).success,
    false,
  );
});

test("rejects activity on a connector that does not sync licenses", () => {
  assert.equal(
    connectorManifestSchema.safeParse({
      ...base,
      activity: {
        documentationUrl: "https://example.invalid/docs/activity",
        limitations: "Daily granularity.",
        measures: "The last sign-in recorded by the provider.",
      },
      capabilities: ["devices"],
      pricing: { exposesBillingCycle: false, exposesPricePerSeat: false },
    }).success,
    false,
  );
});

test("rejects a seat price on a connector that does not sync licenses", () => {
  assert.equal(
    connectorManifestSchema.safeParse({
      ...base,
      capabilities: ["devices"],
    }).success,
    false,
  );
});

test("defineConnector returns a frozen definition", () => {
  const definition = defineConnector({
    manifest: base,
    readers: { licenses: emptyPage },
  });
  assert.equal(definition.manifest.id, "example");
  assert.ok(Object.isFrozen(definition));
});

test("defineConnector rejects a capability with no reader", () => {
  assert.throws(
    () => defineConnector({ manifest: base, readers: {} }),
    (error: unknown) =>
      error instanceof ConnectorError &&
      error.code === "capability_without_reader",
  );
});

test("defineConnector rejects a reader with no capability", () => {
  assert.throws(
    () =>
      defineConnector({
        manifest: base,
        readers: {
          devices: async () => ({ cursor: null, devices: [] }),
          licenses: emptyPage,
        },
      }),
    (error: unknown) =>
      error instanceof ConnectorError &&
      error.code === "reader_without_capability",
  );
});

test("defineConnector reports an invalid manifest as a contract failure", () => {
  assert.throws(
    () =>
      defineConnector({
        manifest: { ...base, version: "1.0" },
        readers: { licenses: emptyPage },
      }),
    (error: unknown) =>
      error instanceof ConnectorError &&
      error.kind === "contract" &&
      error.code === "invalid_manifest",
  );
});
