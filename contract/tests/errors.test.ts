import assert from "node:assert/strict";
import { test } from "node:test";

import { asConnectorError, ConnectorError } from "../src/index.ts";

test("the message is the code, so no response body fits in it", () => {
  const error = new ConnectorError("credentials", "rejected");
  assert.equal(error.message, "credentials:rejected");
});

test("a code that is not a closed identifier becomes unspecified", () => {
  const error = new ConnectorError("service", '429 {"email":"a@b.test"}');
  assert.equal(error.code, "unspecified");
  assert.equal(error.message, "service:unspecified");
});

test("a service failure is retryable and a credential failure is not", () => {
  assert.equal(new ConnectorError("service", "unavailable").retryable, true);
  assert.equal(new ConnectorError("credentials", "rejected").retryable, false);
  assert.equal(new ConnectorError("permissions", "missing").retryable, false);
  assert.equal(new ConnectorError("contract", "invalid_page").retryable, false);
});

test("anything else a connector throws becomes a service failure", () => {
  const wrapped = asConnectorError(new TypeError("cannot read x of undefined"));
  assert.equal(wrapped.kind, "service");
  assert.equal(wrapped.code, "unexpected_error");
  assert.ok(wrapped.cause instanceof TypeError);
});

test("a ConnectorError travels through unchanged", () => {
  const original = new ConnectorError("permissions", "scope_missing");
  assert.equal(asConnectorError(original), original);
});
