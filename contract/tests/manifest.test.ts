import assert from "node:assert/strict";
import { test } from "node:test";

import {
  activityReadingSchema,
  type Manifest,
  validateManifest,
} from "../src/index.ts";

const base: Manifest = {
  id: "example-provider",
  name: "Example provider",
  description: "The repository's reference connector.",
  documentation:
    "https://github.com/arkanaio/alma-plugins/tree/main/connectors/example",
  capabilities: ["licenses"],
  support: "official",
  domains: ["api.example.test"],
  configuration: [],
  exposesSeatPrice: true,
  activity: { supported: false },
};

test("accepts a license manifest with no activity", () => {
  assert.equal(validateManifest(base).id, "example-provider");
});

test("rejects an id that is not a slug", () => {
  assert.throws(() => validateManifest({ ...base, id: "Example Provider" }));
});

test("requires at least one declared domain", () => {
  assert.throws(() => validateManifest({ ...base, domains: [] }));
});

test("requires an explanation when activity is declared supported", () => {
  assert.throws(() =>
    validateManifest({ ...base, activity: { supported: true } }),
  );
});

test("rejects activity on a connector that does not sync licenses", () => {
  assert.throws(() =>
    validateManifest({
      ...base,
      capabilities: ["devices"],
      exposesSeatPrice: false,
      activity: {
        supported: true,
        measures: "Last sign-in recorded by the provider.",
        limitations: "Daily granularity.",
      },
    }),
  );
});

test("keeps the provider date apart from the moment it was read", () => {
  const reading = activityReadingSchema.parse({
    providerDate: "2026-09-01T00:00:00Z",
    readAt: "2026-09-18T06:30:00Z",
  });
  assert.notEqual(reading.providerDate, reading.readAt);
});
