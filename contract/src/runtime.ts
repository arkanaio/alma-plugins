import type { ConnectorCapability, ConnectorManifest } from "./domain.ts";
import { ConnectorError } from "./errors.ts";
import {
  type ConnectorConfiguration,
  type ConnectorPageByCapability,
  type ConnectorSecrets,
  connectorManifestSchema,
} from "./schemas.ts";

/**
 * What a connector implements, and the shape of what it is handed.
 *
 * The boundary everything else rests on is written here: there is no
 * organisation, no transaction, no queue and no audit trail. A connector cannot
 * decide who a piece of data belongs to because it is never told, and it cannot
 * reach the database because it is never given anything to reach it with. The
 * clock is passed in rather than read so a test can pin it.
 *
 * ALMA builds this context. A connector only declares what it needs through its
 * manifest and reads what it is given.
 */

export type ConnectorRequestInit = {
  body?: BodyInit | null;
  headers?: HeadersInit;
  method?: string;
  signal?: AbortSignal | null;
};

/**
 * The only way out to the network.
 *
 * ALMA builds it from the manifest's `allowedHosts`: it reaches those hosts and
 * no others, requires HTTPS, rejects credentials in the URL, and treats a
 * redirect as a failure rather than a shortcut. A connector never calls global
 * `fetch`, and a review looks at the declared host list instead of every call.
 */
export type ConnectorFetch = (
  url: string,
  init?: ConnectorRequestInit,
) => Promise<Response>;

export type ConnectorContext = {
  configuration: ConnectorConfiguration;
  fetch: ConnectorFetch;
  now: () => Date;
  secrets: ConnectorSecrets;
};

export type ConnectorReader<TCapability extends ConnectorCapability> = (input: {
  context: ConnectorContext;
  cursor: string | null;
}) => Promise<ConnectorPageByCapability[TCapability]>;

export type ConnectorReaders = {
  [TCapability in ConnectorCapability]?: ConnectorReader<TCapability>;
};

export type ConnectorDefinition = {
  manifest: ConnectorManifest;
  readers: ConnectorReaders;
};

/**
 * Passes a connector as sound before anyone runs it.
 *
 * A declared capability with no reader, or a reader for a capability the
 * manifest does not announce, are inconsistencies a review can miss and that
 * would otherwise show up in the middle of a sync at night. Failing here turns
 * them into a definition error, which is also what ALMA checks when it
 * incorporates the published package.
 *
 * This is the entry point of a connector package: export what this returns.
 */
export function defineConnector(input: {
  manifest: unknown;
  readers: ConnectorReaders;
}): ConnectorDefinition {
  const parsed = connectorManifestSchema.safeParse(input.manifest);
  if (!parsed.success) {
    throw new ConnectorError("contract", "invalid_manifest", {
      cause: parsed.error,
    });
  }

  const manifest = parsed.data;
  const declared = new Set<string>(manifest.capabilities);
  const implemented = Object.entries(input.readers)
    .filter(([, reader]) => reader !== undefined)
    .map(([capability]) => capability);

  for (const capability of declared) {
    if (!implemented.includes(capability)) {
      throw new ConnectorError("contract", "capability_without_reader");
    }
  }
  for (const capability of implemented) {
    if (!declared.has(capability)) {
      throw new ConnectorError("contract", "reader_without_capability");
    }
  }

  return Object.freeze({
    manifest,
    readers: Object.freeze({ ...input.readers }),
  });
}
