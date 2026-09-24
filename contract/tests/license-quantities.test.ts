import assert from "node:assert/strict";
import { test } from "node:test";
import {
  connectorLicensePlanSchema,
  connectorLicenseQuantitySchema,
} from "../src/index.ts";

const purchased = {
  value: 100,
  unit: "person",
  source: "prepaidUnits.enabled",
  observedOn: "2026-09-24",
};
const consumed = {
  value: 79,
  unit: "person",
  source: "consumedUnits",
  observedOn: "2026-09-23",
};
const plan = {
  externalId: "sku",
  name: "Product",
  billingCycle: null,
  currency: null,
  pricePerSeat: null,
  purchasedQuantity: purchased,
  consumedQuantity: consumed,
};

test("preserves independent quantities, provider fields and dates", () => {
  assert.deepEqual(connectorLicensePlanSchema.parse(plan), plan);
});

test("unknown and zero are distinct, independently for both quantities", () => {
  for (const field of ["purchasedQuantity", "consumedQuantity"] as const) {
    assert.equal(
      connectorLicensePlanSchema.parse({ ...plan, [field]: null })[field],
      null,
    );
    assert.equal(
      connectorLicensePlanSchema.parse({
        ...plan,
        [field]: { ...purchased, value: 0 },
      })[field]?.value,
      0,
    );
  }
});

test("rejects the retired count field, missing readings and incomplete provenance", () => {
  assert.equal(
    connectorLicensePlanSchema.safeParse({ ...plan, seatCount: 100 }).success,
    false,
  );
  const { purchasedQuantity: _, ...missing } = plan;
  assert.equal(connectorLicensePlanSchema.safeParse(missing).success, false);
  for (const invalid of [
    { ...purchased, value: -1 },
    { ...purchased, value: 1.5 },
    { ...purchased, value: 1_000_001 },
    { ...purchased, source: " " },
    { ...purchased, source: undefined },
    { ...purchased, unit: "unknown" },
    { ...purchased, observedOn: "2026-02-30" },
    { ...purchased, observedOn: undefined },
    { ...purchased, extra: true },
  ])
    assert.equal(
      connectorLicenseQuantitySchema.safeParse(invalid).success,
      false,
    );
});
