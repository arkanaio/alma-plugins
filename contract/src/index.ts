import { z } from "zod";

// Provisional connector contract. Until arkanaio/alma#364 settles the shared
// definition inside the product, this is the reference the contribution guide
// and every connector in this repository build on. A breaking change here is
// announced in the guide before it is applied.

/** What a connector can synchronise. It declares one or more. */
export const capabilitySchema = z.enum(["directory", "devices", "licenses"]);
export type Capability = z.infer<typeof capabilitySchema>;

/** Shown to the customer as-is, so they know what they have installed. */
export const supportLevelSchema = z.enum(["official", "community", "browser"]);
export type SupportLevel = z.infer<typeof supportLevelSchema>;

/** What the organisation has to fill in to configure the connector. */
export const configurationFieldSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  help: z.string().min(1),
  type: z.enum(["text", "secret", "domain", "boolean"]),
  required: z.boolean(),
});
export type ConfigurationField = z.infer<typeof configurationFieldSchema>;

/**
 * Declaration of the optional last-activity capability (decision in
 * arkanaio/alma#409). A license connector is valid without it. When it does
 * declare it, it has to say what the provider measures and where it stops
 * measuring: a sync date, an assignment date or a generic sign-in to the
 * account is not usage of a license and cannot stand in for it.
 */
export const activityDeclarationSchema = z.discriminatedUnion("supported", [
  z.object({ supported: z.literal(false) }),
  z.object({
    supported: z.literal(true),
    measures: z.string().min(1),
    limitations: z.string().min(1),
  }),
]);
export type ActivityDeclaration = z.infer<typeof activityDeclarationSchema>;

/** The card ALMA uses to present the connector to the customer. */
export const manifestSchema = z.object({
  id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  name: z.string().min(1),
  description: z.string().min(1),
  documentation: z.url(),
  capabilities: z.array(capabilitySchema).min(1),
  support: supportLevelSchema,
  // The only machines the connector is allowed to talk to. A request to any
  // other host is an execution failure, not a decision the connector makes.
  domains: z.array(z.string().min(1)).min(1),
  configuration: z.array(configurationFieldSchema),
  exposesSeatPrice: z.boolean(),
  activity: activityDeclarationSchema,
});
export type Manifest = z.infer<typeof manifestSchema>;

/**
 * An activity reading. The date the provider reports and the moment we read it
 * are two different facts: a failed sync never turns a stale value into a
 * current reading. With no value we return null, never an invented date and
 * never inferred inactivity.
 */
export const activityReadingSchema = z.object({
  providerDate: z.iso.datetime({ offset: true }),
  readAt: z.iso.datetime({ offset: true }),
});
export type ActivityReading = z.infer<typeof activityReadingSchema>;

export const moneySchema = z.object({
  // Decimal string: the amount travels without going through a float.
  amount: z.string().regex(/^-?\d+(\.\d+)?$/),
  currency: z.string().length(3),
});
export type Money = z.infer<typeof moneySchema>;

/** A software contract as the provider sees it. */
export const licenseContractSchema = z.object({
  externalId: z.string().min(1),
  product: z.string().min(1),
  plan: z.string().min(1).nullable(),
  totalSeats: z.number().int().nonnegative().nullable(),
  seatPrice: moneySchema.nullable(),
  billingCycle: z.enum(["monthly", "yearly"]).nullable(),
  renewsOn: z.iso.date().nullable(),
});
export type LicenseContract = z.infer<typeof licenseContractSchema>;

/**
 * A seat taken at the provider. The connector does not decide whether a seat
 * is orphaned: it hands over the account as-is and ALMA reconciles, because
 * ALMA is the one that knows the organisation's employees.
 */
export const licenseSeatSchema = z.object({
  externalId: z.string().min(1),
  contractExternalId: z.string().min(1),
  email: z.email().nullable(),
  displayName: z.string().min(1).nullable(),
  status: z.enum(["active", "suspended", "invited"]),
  lastActivity: activityReadingSchema.nullable(),
});
export type LicenseSeat = z.infer<typeof licenseSeatSchema>;

/** An outbound request. The host runs it and applies limits and domains. */
export type OutboundRequest = {
  url: string;
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  body?: string;
};

/**
 * Everything a connector gets. No database client, no organisation, no global
 * fetch: if something is not here, the connector does not have it.
 */
export type ExecutionContext<Configuration> = {
  configuration: Configuration;
  /** Already decrypted. Never logged, never returned, never forwarded. */
  credential: Readonly<Record<string, string>>;
  request: (input: OutboundRequest) => Promise<Response>;
  /** Technical trace. Never emails, names or activity values. */
  log: (message: string, data?: Record<string, string | number>) => void;
  cancellation: AbortSignal;
};

/** A paged read. A connector never loads the whole catalogue into memory. */
export type Page<Item, Cursor> = {
  items: readonly Item[];
  cursor: Cursor | null;
};

/** The "licenses" capability. Two reads, no writes. */
export type LicenseConnector<Configuration, Cursor = unknown> = {
  manifest: Manifest;
  configurationSchema: z.ZodType<Configuration>;
  /** A cheap credential and configuration check before syncing anything. */
  verifyAccess: (context: ExecutionContext<Configuration>) => Promise<void>;
  listContracts: (
    context: ExecutionContext<Configuration>,
    cursor: Cursor | null,
  ) => Promise<Page<LicenseContract, Cursor>>;
  listSeats: (
    context: ExecutionContext<Configuration>,
    cursor: Cursor | null,
  ) => Promise<Page<LicenseSeat, Cursor>>;
};

/**
 * Checks that a manifest is consistent with itself. It runs in every
 * connector's tests and during review, before anyone reads a single line of
 * the implementation.
 */
export function validateManifest(value: unknown): Manifest {
  const manifest = manifestSchema.parse(value);
  if (
    manifest.activity.supported &&
    !manifest.capabilities.includes("licenses")
  ) {
    throw new Error("Only a license connector declares last activity.");
  }
  if (
    manifest.exposesSeatPrice &&
    !manifest.capabilities.includes("licenses")
  ) {
    throw new Error("Only a license connector declares a seat price.");
  }
  return manifest;
}
