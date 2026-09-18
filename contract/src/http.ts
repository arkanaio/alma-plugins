import { ConnectorError } from "./errors.ts";
import type { ConnectorFetch, ConnectorRequestInit } from "./runtime.ts";

/**
 * The only door through which a connector talks to the outside.
 *
 * A connector declares in its manifest which hosts it needs to talk to, and
 * this builds the `fetch` that reaches only those. It is how "it may not talk
 * to any address other than the provider it declares to serve" is made
 * checkable: a review looks at the declared host list, not at every call in the
 * connector's code.
 *
 * It is published with the contract because both sides need exactly this one.
 * ALMA builds the context with it, and a connector's tests use it so what they
 * exercise is the real boundary and not a copy of it that can drift.
 */
export function createConnectorFetch(input: {
  allowedHosts: readonly string[];
  fetch?: (url: string, init: RequestInit) => Promise<Response>;
}): ConnectorFetch {
  const allowed = new Set(input.allowedHosts.map((host) => host.toLowerCase()));
  const perform = input.fetch ?? globalThis.fetch;

  return async (url: string, init: ConnectorRequestInit = {}) => {
    const target = parseTarget(url);

    if (target.protocol !== "https:") {
      throw new ConnectorError("contract", "insecure_request");
    }
    if (target.username !== "" || target.password !== "") {
      // A credential in the address itself ends up in every log of the
      // request. If the provider asks for one, it goes in a header.
      throw new ConnectorError("contract", "credential_in_url");
    }
    if (!allowed.has(target.hostname)) {
      throw new ConnectorError("contract", "forbidden_host");
    }

    const request: RequestInit = {
      method: init.method ?? "GET",
      // A redirect to another host would step around the declared list without
      // anyone seeing it: here a redirect is a failure, not a shortcut.
      redirect: "error",
    };
    // Set only what the caller passed: an explicit undefined and an absent key
    // mean the same thing to fetch, and keeping them apart lets the published
    // types stay strict about optional properties.
    if (init.body !== undefined) request.body = init.body;
    if (init.headers !== undefined) request.headers = init.headers;
    if (init.signal !== undefined) request.signal = init.signal;

    return perform(target.toString(), request);
  };
}

function parseTarget(url: string): URL {
  try {
    return new URL(url);
  } catch (error) {
    throw new ConnectorError("contract", "invalid_url", { cause: error });
  }
}
