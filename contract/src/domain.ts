/**
 * The shared definition of what a provider connector is.
 *
 * A connector knows how to talk to one specific provider and knows nothing
 * else: it does not know about organisations, it has no database access, and it
 * never decides who a piece of data belongs to. It receives a validated
 * configuration and a credential, queries the provider, and returns data in the
 * shape agreed here. That boundary is what makes an external contribution
 * reviewable.
 *
 * This file is the vocabulary; `schemas.ts` validates it and `runtime.ts` is
 * what a connector author implements against. What executes a connector —the
 * restricted fetch, the page readers, the registry and the incorporation
 * record— lives in ALMA and is deliberately not published here.
 */

/** What a connector can synchronise. It declares one or more. */
export const connectorCapabilities = [
  "directory",
  "devices",
  "licenses",
] as const;

export type ConnectorCapability = (typeof connectorCapabilities)[number];

/**
 * Where the connector comes from, as shown to the customer.
 *
 * This is not an internal detail: an organisation has a right to know whether
 * the piece reading its licenses is maintained by ALMA, a reviewed community
 * contribution, or a robot filling in a form in a browser because the provider
 * offers no other way to read its data.
 */
export const connectorSupportLevels = [
  "official",
  "community",
  "browser_automation",
] as const;

export type ConnectorSupportLevel = (typeof connectorSupportLevels)[number];

/** The billing cycle a license connector can expose. */
export const connectorBillingCycles = ["monthly", "yearly"] as const;
export type ConnectorBillingCycle = (typeof connectorBillingCycles)[number];

/** How each configuration value is asked for on the integration screen. */
export const connectorFieldKinds = [
  "text",
  "email",
  "domain",
  "url",
  "select",
] as const;

export type ConnectorFieldKind = (typeof connectorFieldKinds)[number];

/**
 * A configuration value the organisation enters and can read back: the
 * directory domain, the account region, the company identifier at the provider.
 */
export type ConnectorField = {
  help: string | null;
  key: string;
  kind: ConnectorFieldKind;
  label: string;
  maximumLength: number;
  options: readonly { label: string; value: string }[] | null;
  required: boolean;
};

/**
 * A secret belonging to the organisation. It is declared like a configuration
 * field, but its value never returns to the browser: not whole, not masked, and
 * not inside an error.
 */
export type ConnectorSecretField = {
  help: string | null;
  key: string;
  label: string;
  maximumLength: number;
};

/**
 * How the connector gets permission to read.
 *
 * `oauth2` describes what the exchange performed by the server needs; the
 * connector receives the result already exchanged and never drives the consent.
 */
export type ConnectorAuthentication =
  | { kind: "none" }
  | { kind: "secret"; fields: readonly ConnectorSecretField[] }
  | { kind: "oauth2"; scopes: readonly string[] };

/**
 * What a license connector declares about last usage activity.
 *
 * It is optional: a connector that synchronises plans and seats is still valid
 * without it. Declaring it requires saying exactly what the provider's value
 * measures and what its limitations are, because a last sign-in or an
 * assignment date is not usage of a license, and presenting one as such would
 * be asserting something nobody measured.
 */
export type ConnectorActivityDeclaration = {
  documentationUrl: string;
  limitations: string;
  measures: string;
};

/** What the connector exposes about the cost of a seat, if it exposes any. */
export type ConnectorPricingDeclaration = {
  exposesBillingCycle: boolean;
  exposesPricePerSeat: boolean;
};

/**
 * A connector's complete card: everything ALMA needs in order to present it,
 * configure it and run it without any screen naming it.
 */
export type ConnectorManifest = {
  activity: ConnectorActivityDeclaration | null;
  allowedHosts: readonly string[];
  authentication: ConnectorAuthentication;
  capabilities: readonly ConnectorCapability[];
  configuration: readonly ConnectorField[];
  description: string;
  documentationUrl: string;
  id: string;
  name: string;
  pricing: ConnectorPricingDeclaration;
  supportLevel: ConnectorSupportLevel;
  version: string;
};

/** The secret fields the manifest declares, whatever its method. */
export function connectorSecretFields(
  manifest: ConnectorManifest,
): readonly ConnectorSecretField[] {
  return manifest.authentication.kind === "secret"
    ? manifest.authentication.fields
    : [];
}

export function connectorDeclaresCapability(
  manifest: ConnectorManifest,
  capability: ConnectorCapability,
): boolean {
  return manifest.capabilities.includes(capability);
}
