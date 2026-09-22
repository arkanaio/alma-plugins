#!/usr/bin/env node
//
// Prints, one per line, the workspace packages whose version is not on npm yet.
//
// This is what the publish workflow runs on every merge to main. A pull request
// that bumps a package's version publishes it when it lands; one that does not
// publishes nothing, because there is nothing new to publish. Private packages
// never leave the repository, so they are never listed.
//
// The contract comes first: a connector that raises the contract it depends on
// in the same merge cannot be installed until that contract is on npm.

import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const directories = [
  "contract",
  ...readdirSync("connectors")
    .sort()
    .map((entry) => join("connectors", entry)),
];

/** Whether npm already has this exact version of the package. */
function isPublished(name, version) {
  try {
    const output = execFileSync(
      "npm",
      ["view", `${name}@${version}`, "version", "--json"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );
    // A package that exists without this version answers with nothing.
    return output.trim() !== "";
  } catch (error) {
    // A package that was never published answers 404. Anything else — the
    // registry down, a network failure — must stop the workflow rather than
    // be read as "not published" and attempt a publish blind.
    const stderr = String(error?.stderr ?? "");
    if (stderr.includes("E404")) return false;
    throw error;
  }
}

for (const directory of directories) {
  let manifest;
  try {
    manifest = JSON.parse(
      readFileSync(join(directory, "package.json"), "utf8"),
    );
  } catch {
    continue;
  }
  if (manifest.private === true) continue;
  if (!isPublished(manifest.name, manifest.version)) {
    console.log(manifest.name);
  }
}
