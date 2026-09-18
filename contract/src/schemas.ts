import { z } from "zod";

import {
  type ConnectorManifest,
  connectorBillingCycles,
  connectorCapabilities,
  connectorFieldKinds,
  connectorSupportLevels,
} from "./domain.ts";

/**
 * Validation of the manifest and of everything a connector returns.
 *
 * The manifest is validated when the connector is defined, not when it runs: an
 * incoherent card —a capability with no reader, activity declared without
 * licenses, a repeated host— is a fault in the contribution and has to stop it
 * from being incorporated, not surface one night during a sync.
 *
 * Pages are validated on arrival. That is the second half of the boundary: a
 * connector can be wrong or carry fields nobody agreed on, and none of it
 * reaches the domain without passing through here.
 *
 * What is missing from this file is deliberate. The schemas that validate what
 * an organisation configured live in ALMA, because their messages are read by
 * the person filling in the form and belong to the product's own language.
 */

const identifierPattern = /^[a-z][a-z0-9_]{0,63}$/;
const semanticVersionPattern = /^\d+\.\d+\.\d+$/;
const hostnamePattern =
  /^(?=.{1,253}$)[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/;

export const connectorIdSchema = z
  .string()
  .regex(
    identifierPattern,
    "A connector id uses lowercase letters, digits and underscores.",
  );

const fieldKeySchema = z
  .string()
  .regex(identifierPattern, "A field key uses lowercase letters and digits.");

const shortTextSchema = z.string().trim().min(1).max(200);
const proseSchema = z.string().trim().min(1).max(1_000);

/** HTTPS only: documentation over HTTP is an invitation to impersonate it. */
export const secureUrlSchema = z
  .url()
  .refine((value) => value.startsWith("https://"), "The URL must use HTTPS.");

/**
 * A connector's version is written the same way in the manifest and in ALMA's
 * incorporation record: they are the same claim made from both sides, and if
 * each validated it its own way they could drift apart unnoticed.
 */
export const connectorVersionSchema = z
  .string()
  .regex(semanticVersionPattern, "A connector version is semantic.");

export const connectorHostSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(hostnamePattern, "A declared host is not a domain name.");

const connectorFieldOptionSchema = z
  .object({ label: shortTextSchema, value: shortTextSchema })
  .strict();

export const connectorFieldSchema = z
  .object({
    help: proseSchema.nullable(),
    key: fieldKeySchema,
    kind: z.enum(connectorFieldKinds),
    label: shortTextSchema,
    maximumLength: z.int().min(1).max(16_384),
    options: z
      .array(connectorFieldOptionSchema)
      .min(1)
      .max(50)
      .readonly()
      .nullable(),
    required: z.boolean(),
  })
  .strict()
  .check((context) => {
    const field = context.value;
    if (field.kind === "select" && field.options === null) {
      context.issues.push({
        code: "custom",
        input: field,
        message: "A select field declares its options.",
        path: ["options"],
      });
    }
    if (field.kind !== "select" && field.options !== null) {
      context.issues.push({
        code: "custom",
        input: field,
        message: "Only a select field declares options.",
        path: ["options"],
      });
    }
  });

export const connectorSecretFieldSchema = z
  .object({
    help: proseSchema.nullable(),
    key: fieldKeySchema,
    label: shortTextSchema,
    maximumLength: z.int().min(1).max(16_384),
  })
  .strict();

const connectorAuthenticationSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("none") }).strict(),
  z
    .object({
      fields: z.array(connectorSecretFieldSchema).min(1).max(10).readonly(),
      kind: z.literal("secret"),
    })
    .strict(),
  z
    .object({
      kind: z.literal("oauth2"),
      scopes: z
        .array(z.string().trim().min(1).max(200))
        .min(1)
        .max(20)
        .readonly(),
    })
    .strict(),
]);

const connectorActivityDeclarationSchema = z
  .object({
    documentationUrl: secureUrlSchema,
    limitations: proseSchema,
    measures: proseSchema,
  })
  .strict();

const connectorPricingSchema = z
  .object({
    exposesBillingCycle: z.boolean(),
    exposesPricePerSeat: z.boolean(),
  })
  .strict();

function duplicates(values: readonly string[]): readonly string[] {
  const seen = new Set<string>();
  const repeated = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) repeated.add(value);
    seen.add(value);
  }
  return [...repeated];
}

export const connectorManifestSchema = z
  .object({
    activity: connectorActivityDeclarationSchema.nullable(),
    allowedHosts: z.array(connectorHostSchema).min(1).max(20).readonly(),
    authentication: connectorAuthenticationSchema,
    capabilities: z
      .array(z.enum(connectorCapabilities))
      .min(1)
      .max(3)
      .readonly(),
    configuration: z.array(connectorFieldSchema).max(20).readonly(),
    description: proseSchema,
    documentationUrl: secureUrlSchema,
    id: connectorIdSchema,
    name: shortTextSchema,
    pricing: connectorPricingSchema,
    supportLevel: z.enum(connectorSupportLevels),
    version: connectorVersionSchema,
  })
  .strict()
  .check((context) => {
    const manifest = context.value;
    const reportIssue = (message: string, path: readonly PropertyKey[]) => {
      context.issues.push({
        code: "custom",
        input: manifest,
        message,
        path: [...path],
      });
    };

    if (duplicates(manifest.capabilities).length > 0) {
      reportIssue("A capability is declared once.", ["capabilities"]);
    }

    if (duplicates(manifest.allowedHosts).length > 0) {
      reportIssue("A host is declared once.", ["allowedHosts"]);
    }

    const secretKeys =
      manifest.authentication.kind === "secret"
        ? manifest.authentication.fields.map((field) => field.key)
        : [];
    const repeatedKeys = duplicates([
      ...manifest.configuration.map((field) => field.key),
      ...secretKeys,
    ]);
    if (repeatedKeys.length > 0) {
      reportIssue("Configuration and secrets do not share keys.", [
        "configuration",
      ]);
    }

    const declaresLicenses = manifest.capabilities.includes("licenses");
    if (manifest.activity !== null && !declaresLicenses) {
      reportIssue("Only a license connector declares usage activity.", [
        "activity",
      ]);
    }
    if (
      !declaresLicenses &&
      (manifest.pricing.exposesPricePerSeat ||
        manifest.pricing.exposesBillingCycle)
    ) {
      reportIssue("Only a license connector exposes a seat price.", [
        "pricing",
      ]);
    }
  });

/**
 * A compile-time check that the validated manifest and the domain type are the
 * same thing. Without it, adding a field to one would leave the other
 * describing a connector that no longer exists.
 */
const manifestParity: [
  z.infer<typeof connectorManifestSchema> extends ConnectorManifest
    ? true
    : never,
  ConnectorManifest extends z.infer<typeof connectorManifestSchema>
    ? true
    : never,
] = [true, true];
void manifestParity;

/**
 * The marker for the next page, as the connector understands it.
 *
 * It is an opaque string to the product: it is stored and handed back without
 * being interpreted, like a pagination token. Its cap exists so a cursor does
 * not become somewhere to accumulate data.
 */
export const connectorCursorSchema = z.string().min(1).max(2_048);

const externalIdSchema = z.string().trim().min(1).max(200);
const optionalTextSchema = z.string().trim().max(200).nullable();
const optionalEmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email())
  .nullable();

export const connectorDirectoryMemberSchema = z
  .object({
    externalId: externalIdSchema,
    fullName: z.string().trim().min(1).max(200),
    primaryEmail: z.string().trim().toLowerCase().pipe(z.email()),
    status: z.enum(["active", "suspended", "deleted"]),
  })
  .strict();

export const connectorDeviceSchema = z
  .object({
    assignedEmail: optionalEmailSchema,
    brand: optionalTextSchema,
    externalId: externalIdSchema,
    model: optionalTextSchema,
    operatingSystem: optionalTextSchema,
    serialNumber: z.string().trim().min(1).max(200),
  })
  .strict();

const decimalAmountSchema = z
  .string()
  .trim()
  .regex(/^\d{1,10}(?:\.\d{1,2})?$/, "An amount uses up to two decimals.")
  .nullable();

export const connectorLicensePlanSchema = z
  .object({
    billingCycle: z.enum(connectorBillingCycles).nullable(),
    currency: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{3}$/, "A currency uses a three-letter ISO code.")
      .nullable(),
    externalId: externalIdSchema,
    name: z.string().trim().min(1).max(200),
    pricePerSeat: decimalAmountSchema,
    seatCount: z.int().min(0).max(1_000_000).nullable(),
  })
  .strict();

/**
 * A seat as the provider sees it: which plan it belongs to and which account
 * holds it. The connector does not say which employee that is —it cannot know—
 * and it does not decide whether the seat is orphaned: it hands over the
 * account and the product reconciles, because the product knows the people.
 */
export const connectorLicenseSeatSchema = z
  .object({
    accountEmail: optionalEmailSchema,
    accountExternalId: externalIdSchema,
    accountName: optionalTextSchema,
    lastActivityAt: z.iso.datetime({ offset: true }).nullable(),
    planExternalId: externalIdSchema,
  })
  .strict();

const maximumRecordsPerPage = 1_000;

export const connectorDirectoryPageSchema = z
  .object({
    cursor: connectorCursorSchema.nullable(),
    members: z
      .array(connectorDirectoryMemberSchema)
      .max(maximumRecordsPerPage)
      .readonly(),
  })
  .strict();

export const connectorDevicePageSchema = z
  .object({
    cursor: connectorCursorSchema.nullable(),
    devices: z
      .array(connectorDeviceSchema)
      .max(maximumRecordsPerPage)
      .readonly(),
  })
  .strict();

export const connectorLicensePageSchema = z
  .object({
    cursor: connectorCursorSchema.nullable(),
    plans: z
      .array(connectorLicensePlanSchema)
      .max(maximumRecordsPerPage)
      .readonly(),
    seats: z
      .array(connectorLicenseSeatSchema)
      .max(maximumRecordsPerPage)
      .readonly(),
  })
  .strict();

export const connectorPageSchemas = {
  devices: connectorDevicePageSchema,
  directory: connectorDirectoryPageSchema,
  licenses: connectorLicensePageSchema,
} as const;

export type ConnectorDirectoryPage = z.infer<
  typeof connectorDirectoryPageSchema
>;
export type ConnectorDevicePage = z.infer<typeof connectorDevicePageSchema>;
export type ConnectorLicensePage = z.infer<typeof connectorLicensePageSchema>;

export type ConnectorPageByCapability = {
  devices: ConnectorDevicePage;
  directory: ConnectorDirectoryPage;
  licenses: ConnectorLicensePage;
};

export type ConnectorConfiguration = Readonly<Record<string, string | null>>;
export type ConnectorSecrets = Readonly<Record<string, string>>;
