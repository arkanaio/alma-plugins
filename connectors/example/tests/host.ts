import { readFile } from "node:fs/promises";

import {
  type ConnectorContext,
  createConnectorFetch,
} from "@arkanaio/connector-contract";

import { manifest } from "../src/manifest.ts";

type Request = { headers: Headers; url: string };

type Host = {
  context: ConnectorContext;
  requests: Request[];
};

/**
 * A test host: it does what ALMA does when it runs the connector.
 *
 * The fetch is the real `createConnectorFetch` from the contract, built from
 * this connector's own `allowedHosts`, so what the tests exercise is the actual
 * boundary and not a copy of it. No test in this repository reaches a real
 * provider: the responses come from `sample-data/`.
 */
export async function createHost(
  options: { status?: number; body?: string } = {},
): Promise<Host> {
  const path = new URL("../sample-data/seats.json", import.meta.url);
  const pages: Record<string, unknown> = JSON.parse(
    await readFile(path, "utf8"),
  );
  const requests: Request[] = [];

  const context: ConnectorContext = {
    configuration: { region: "eu", workspace: "arkana" },
    secrets: { api_token: "test-token" },
    now: () => new Date("2026-09-19T06:30:00.000Z"),
    fetch: createConnectorFetch({
      allowedHosts: manifest.allowedHosts,
      fetch: async (url, init) => {
        requests.push({ headers: new Headers(init.headers), url });

        if (options.status !== undefined && options.status !== 200) {
          return new Response("", { status: options.status });
        }
        if (options.body !== undefined) {
          return new Response(options.body, { status: 200 });
        }

        const cursor = new URL(url).searchParams.get("cursor") ?? "";
        const page = pages[cursor];
        if (page === undefined) return new Response("", { status: 404 });
        return Response.json(page);
      },
    }),
  };

  return { context, requests };
}
