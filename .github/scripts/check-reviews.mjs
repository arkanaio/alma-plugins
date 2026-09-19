#!/usr/bin/env node
//
// Checks the security reviews on record.
//
// A connector reaches a deployment installed as a package, so the review of its
// code is the last place anyone reads it. What that review produced is a file
// in reviews/, and ALMA's incorporation record cites it by permalink as the
// evidence that a version was approved. This script is what keeps that evidence
// from being incomplete: a header that does not agree with the file name, a box
// nobody checked, a community connector with a single signature.
//
// Run with no arguments, it checks every review on record (`pnpm review`, and
// CI). Run with `--package @arkanaio/connector-slack`, it also demands an
// accepted review for the exact version in that package's package.json, which
// is what the publish workflow asks before publishing anything.
//
// See docs/SECURITY-REVIEW.md.

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const REVIEWS = "reviews";
const NOT_A_REVIEW = new Set(["README.md", "TEMPLATE.md"]);

/** The package this repository publishes as the contract, not a connector. */
const CONTRACT = "@arkanaio/connector-contract";

const CAPABILITIES = new Set(["directory", "devices", "licenses"]);

/**
 * How many people have to have read the code, by support level.
 *
 * Two for anything arkana did not write: the first review of an unfamiliar
 * codebase is where the connector boundary is easiest to miss. Two as well for
 * browser automation, which does not go through a documented API at all.
 */
const SIGNATURES = { browser_automation: 2, community: 2, official: 1 };

const HEADER_KEYS = [
  "Package",
  "Version",
  "Commit",
  "Pull request",
  "Support level",
  "Capabilities",
  "Allowed hosts",
  "Reviewers",
  "Reviewed on",
  "Verdict",
];

const VERSION = /^\d+\.\d+\.\d+$/;
const FILE_NAME = /^([a-z0-9][a-z0-9-]*)-(\d+\.\d+\.\d+)\.md$/;

const problems = [];

function fail(file, message) {
  problems.push(`${file}: ${message}`);
}

/** The header is a list of `- **Key**: value` lines at the top of the file. */
function readHeader(contents) {
  const header = new Map();
  for (const line of contents.split("\n")) {
    const match = /^- \*\*([^*]+)\*\*:\s*(.*)$/.exec(line);
    if (match?.[1] !== undefined) header.set(match[1], (match[2] ?? "").trim());
  }
  return header;
}

/** Comma-separated values in a header field, with the empties dropped. */
function items(value) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function withoutComments(contents) {
  return contents.replace(/<!--[\s\S]*?-->/g, "");
}

function checkReview(file, contents) {
  const name = FILE_NAME.exec(file);
  if (name?.[1] === undefined || name[2] === undefined) {
    fail(
      file,
      "the name of a review is the package without its scope and its version, as connector-slack-1.0.0.md.",
    );
    return;
  }
  const [, packageName, version] = name;

  const header = readHeader(contents);
  for (const key of HEADER_KEYS) {
    if ((header.get(key) ?? "") === "") {
      fail(file, `the header has no ${key}. Copy it from reviews/TEMPLATE.md.`);
    }
  }
  if (problems.some((problem) => problem.startsWith(`${file}:`))) return;

  const value = (key) => header.get(key) ?? "";

  if (value("Package") !== `@arkanaio/${packageName}`) {
    fail(
      file,
      `the header says ${value("Package")} and the file name says @arkanaio/${packageName}.`,
    );
  }
  if (value("Version") !== version) {
    fail(
      file,
      `the header says version ${value("Version")} and the file name says ${version}.`,
    );
  }
  if (!/^[0-9a-f]{40}$/.test(value("Commit"))) {
    fail(
      file,
      "Commit is the full 40-character SHA of the code that was read, so anyone can read the same code.",
    );
  }
  if (!value("Pull request").startsWith("https://")) {
    fail(file, "Pull request is an HTTPS link.");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value("Reviewed on"))) {
    fail(file, "Reviewed on is a date written as YYYY-MM-DD.");
  }
  if (value("Verdict") !== "Accepted") {
    fail(
      file,
      "only an accepted review is on record. One that asks for changes or rejects a contribution stays on its pull request.",
    );
  }

  const capabilities = items(value("Capabilities"));
  const unknown = capabilities.filter((item) => !CAPABILITIES.has(item));
  if (capabilities.length === 0 || unknown.length > 0) {
    fail(
      file,
      `Capabilities is one or more of directory, devices, licenses${unknown.length > 0 ? `, not ${unknown.join(", ")}` : ""}.`,
    );
  }
  if (items(value("Allowed hosts")).length === 0) {
    fail(
      file,
      "Allowed hosts is the surface being approved; it is never empty.",
    );
  }

  const required = SIGNATURES[value("Support level")];
  if (required === undefined) {
    fail(
      file,
      `Support level is official, community or browser_automation, not ${value("Support level")}.`,
    );
  } else {
    const reviewers = items(value("Reviewers"));
    const wrong = reviewers.filter((item) => !/^@[A-Za-z\d-]+$/.test(item));
    if (wrong.length > 0) {
      fail(file, `a reviewer is a GitHub account, not ${wrong.join(", ")}.`);
    }
    if (new Set(reviewers).size !== reviewers.length) {
      fail(
        file,
        "the same account is named twice. Two signatures are two people.",
      );
    }
    if (reviewers.length < required) {
      fail(
        file,
        `a ${value("Support level")} connector needs ${required} reviewer${required === 1 ? "" : "s"}, and this names ${reviewers.length}.`,
      );
    }
  }

  const unchecked = withoutComments(contents).match(/^\s*- \[ \]/gm);
  if (unchecked !== null) {
    fail(
      file,
      `${unchecked.length} box${unchecked.length === 1 ? " is" : "es are"} unchecked. An unchecked box is a review that has not finished.`,
    );
  }
}

/** The version a package would publish, and whether it publishes at all. */
function findPackage(name) {
  const directories = [
    "contract",
    ...readdirSync("connectors").map((entry) => join("connectors", entry)),
  ];
  for (const directory of directories) {
    let manifest;
    try {
      manifest = JSON.parse(
        readFileSync(join(directory, "package.json"), "utf8"),
      );
    } catch {
      continue;
    }
    if (manifest.name === name) return manifest;
  }
  return undefined;
}

function checkPackage(name) {
  const manifest = findPackage(name);
  if (manifest === undefined) {
    problems.push(`${name}: no package in this repository is called that.`);
    return;
  }
  // The contract is not a connector: it is the definition both sides compile
  // against, and it is reviewed as a change to this repository. A private
  // package is never published, so nothing of it reaches a deployment.
  if (name === CONTRACT || manifest.private === true) return;

  const version = String(manifest.version ?? "");
  if (!VERSION.test(version)) {
    problems.push(
      `${name}: its version, ${version}, is not a semantic version.`,
    );
    return;
  }
  const file = `${name.replace(/^@[^/]+\//, "")}-${version}.md`;
  let contents;
  try {
    contents = readFileSync(join(REVIEWS, file), "utf8");
  } catch {
    problems.push(
      `${name}: nothing publishes without a review. Version ${version} has none: reviews/${file} does not exist.`,
    );
    return;
  }
  if (readHeader(contents).get("Verdict") !== "Accepted") {
    problems.push(`${name}: the review of version ${version} is not accepted.`);
  }
}

const template = readFileSync(join(REVIEWS, "TEMPLATE.md"), "utf8");
const templateHeader = readHeader(template);
for (const key of HEADER_KEYS) {
  if (!templateHeader.has(key)) {
    fail(
      "reviews/TEMPLATE.md",
      `the template no longer offers ${key}, and every review is copied from it.`,
    );
  }
}

for (const entry of readdirSync(REVIEWS)) {
  if (!entry.endsWith(".md") || NOT_A_REVIEW.has(entry)) continue;
  checkReview(entry, readFileSync(join(REVIEWS, entry), "utf8"));
}

const asked = process.argv.indexOf("--package");
if (asked !== -1) {
  const name = process.argv[asked + 1];
  if (name === undefined) {
    problems.push("--package takes the name of a package.");
  } else {
    checkPackage(name);
  }
}

if (problems.length > 0) {
  for (const problem of problems) console.error(`Review problem — ${problem}`);
  console.error("\nThe process is docs/SECURITY-REVIEW.md.");
  process.exit(1);
}

console.error("Every review on record is complete and signed.");
