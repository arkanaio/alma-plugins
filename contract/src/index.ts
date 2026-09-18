/**
 * The shared definition of a provider connector for ALMA.
 *
 * Everything a connector author needs in order to declare a manifest, type
 * their readers and return the agreed shapes enters through here.
 *
 * What is not here is deliberate: the restricted fetch, the page readers, the
 * registry and the incorporation record are ALMA's, and the labels shown to a
 * customer belong to the product's own language. A connector declares and
 * returns; ALMA executes and decides.
 */

export {
  type ConnectorActivityDeclaration,
  type ConnectorAuthentication,
  type ConnectorBillingCycle,
  type ConnectorCapability,
  type ConnectorField,
  type ConnectorFieldKind,
  type ConnectorManifest,
  type ConnectorPricingDeclaration,
  type ConnectorSecretField,
  type ConnectorSupportLevel,
  connectorBillingCycles,
  connectorCapabilities,
  connectorDeclaresCapability,
  connectorFieldKinds,
  connectorSecretFields,
  connectorSupportLevels,
} from "./domain.ts";
export {
  asConnectorError,
  ConnectorError,
  type ConnectorFailureKind,
  connectorFailureKinds,
} from "./errors.ts";
export { createConnectorFetch } from "./http.ts";
export {
  type ConnectorContext,
  type ConnectorDefinition,
  type ConnectorFetch,
  type ConnectorReader,
  type ConnectorReaders,
  type ConnectorRequestInit,
  defineConnector,
} from "./runtime.ts";
export {
  type ConnectorConfiguration,
  type ConnectorDevicePage,
  type ConnectorDirectoryPage,
  type ConnectorLicensePage,
  type ConnectorPageByCapability,
  type ConnectorSecrets,
  connectorCursorSchema,
  connectorDevicePageSchema,
  connectorDeviceSchema,
  connectorDirectoryMemberSchema,
  connectorDirectoryPageSchema,
  connectorFieldSchema,
  connectorHostSchema,
  connectorIdSchema,
  connectorLicensePageSchema,
  connectorLicensePlanSchema,
  connectorLicenseSeatSchema,
  connectorManifestSchema,
  connectorPageSchemas,
  connectorSecretFieldSchema,
  connectorVersionSchema,
  secureUrlSchema,
} from "./schemas.ts";
