import assert from "node:assert/strict";
import { test } from "node:test";

import { ConnectorError, createConnectorFetch } from "../src/index.ts";

function harness(options: { allowedHosts?: readonly string[] } = {}) {
  const calls: { init: RequestInit; url: string }[] = [];
  const fetch = createConnectorFetch({
    allowedHosts: options.allowedHosts ?? ["api.example.invalid"],
    fetch: async (url, init) => {
      calls.push({ init, url });
      return new Response("{}", { status: 200 });
    },
  });
  return { calls, fetch };
}

async function rejectsWith(promise: Promise<unknown>, code: string) {
  await assert.rejects(
    promise,
    (error: unknown) =>
      error instanceof ConnectorError &&
      error.kind === "contract" &&
      error.code === code,
  );
}

test("reaches a declared host", async () => {
  const { calls, fetch } = harness();
  await fetch("https://api.example.invalid/v1/seats");
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.init.method, "GET");
});

test("refuses a host that is not declared", async () => {
  const { fetch } = harness();
  await rejectsWith(fetch("https://other.invalid/v1/seats"), "forbidden_host");
});

test("refuses plain HTTP", async () => {
  const { fetch } = harness();
  await rejectsWith(
    fetch("http://api.example.invalid/v1/seats"),
    "insecure_request",
  );
});

test("refuses a credential carried in the address", async () => {
  const { fetch } = harness();
  await rejectsWith(
    fetch("https://user:token@api.example.invalid/v1/seats"),
    "credential_in_url",
  );
});

test("refuses something that is not a URL", async () => {
  const { fetch } = harness();
  await rejectsWith(fetch("not a url"), "invalid_url");
});

test("treats a redirect as a failure and not a shortcut", async () => {
  const { calls, fetch } = harness();
  await fetch("https://api.example.invalid/v1/seats");
  assert.equal(calls[0]?.init.redirect, "error");
});

test("matches a declared host regardless of case", async () => {
  const { calls, fetch } = harness({ allowedHosts: ["API.Example.Invalid"] });
  await fetch("https://api.example.invalid/v1/seats");
  assert.equal(calls.length, 1);
});
