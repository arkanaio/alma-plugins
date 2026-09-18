/**
 * What a connector package exports: one definition, and nothing else.
 *
 * ALMA installs this package at an exact version, checks its manifest against
 * the incorporation record, and adds this definition to its registry.
 */
export { exampleConnector } from "./connector.ts";
export { manifest } from "./manifest.ts";
