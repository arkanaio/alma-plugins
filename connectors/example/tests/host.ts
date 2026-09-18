import { readFile } from "node:fs/promises";

import type { ExecutionContext } from "@alma/connector-contract";

import { manifest } from "../src/manifest.ts";
import type { Configuration } from "../src/schemas.ts";

type Trace = { message: string; data?: Record<string, string | number> };

type Host = {
  context: ExecutionContext<Configuration>;
  requestedUrls: string[];
  traces: Trace[];
};

async function load(file: string): Promise<Record<string, unknown>> {
  const path = new URL(`../sample-data/${file}`, import.meta.url);
  return JSON.parse(await readFile(path, "utf8"));
}

/**
 * Test host: it does what ALMA will do when it runs the connector. It serves
 * the sample data, rejects any domain not declared in the manifest, and keeps
 * the requests and traces visible so they can be asserted on. No test in this
 * repository talks to a real provider.
 */
export async function createHost(
  options: { status?: number } = {},
): Promise<Host> {
  const subscriptions = await load("subscriptions.json");
  const members = await load("members.json");
  const requestedUrls: string[] = [];
  const traces: Trace[] = [];
  const domains = new Set(manifest.domains);

  const context: ExecutionContext<Configuration> = {
    configuration: { workspace: "arkana" },
    credential: { token: "test-token" },
    cancellation: new AbortController().signal,
    log: (message, data) => {
      traces.push(data === undefined ? { message } : { message, data });
    },
    request: async ({ url }) => {
      requestedUrls.push(url);
      const target = new URL(url);
      if (!domains.has(target.hostname)) {
        throw new Error(
          `The connector tried to reach ${target.hostname}, which is not in its manifest.`,
        );
      }
      if (options.status && options.status !== 200) {
        return new Response("", { status: options.status });
      }
      const cursor = target.searchParams.get("cursor") ?? "";
      const catalogue = target.pathname.endsWith("/subscriptions")
        ? subscriptions
        : members;
      const page = catalogue[cursor];
      if (page === undefined) {
        return new Response("", { status: 404 });
      }
      return Response.json(page);
    },
  };

  return { context, requestedUrls, traces };
}
