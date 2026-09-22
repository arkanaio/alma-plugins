# Security review: connector-google-workspace-licenses 0.1.1

<!--
Copy this file to reviews/<package without its scope>-<version>.md, fill it in,
and leave this template alone. For @arkanaio/connector-slack 1.0.0 that is
reviews/connector-slack-1.0.0.md.

Every box is checked by a person reading the code. An unchecked box is a review
that has not finished, and `pnpm review` says so. Fill in the header exactly:
ALMA's incorporation record is written from it.

The process around this list, and the reason each section exists, is in
docs/SECURITY-REVIEW.md.
-->

- **Package**: @arkanaio/connector-google-workspace-licenses
- **Version**: 0.1.1
- **Commit**: b87d0d5179a08162567e7cbf4fed494333956038
- **Pull request**: https://github.com/arkanaio/alma-plugins/pull/5
- **Support level**: official
- **Capabilities**: licenses
- **Allowed hosts**: licensing.googleapis.com, admin.googleapis.com
- **Reviewers**: @jaumecornado
- **Reviewed on**: 2026-09-22
- **Verdict**: Accepted

## Notes on this review

This review explicitly builds on
[`reviews/connector-google-workspace-licenses-0.1.0.md`](connector-google-workspace-licenses-0.1.0.md).
`docs/SECURITY-REVIEW.md` says a version that only fixes code inside an
already approved surface "is reviewed against what changed, and its file
says which earlier review it builds on". That is this file.

The full checklist is also re-read against the connector at this commit,
because nothing in it changed in shape (no new host, no new scope, no new
dependency, no `activity` declaration), and the changes recorded below are
the only ones since 0.1.0.

## What changed since 0.1.0

Three files, all in the connector's package:

- `connectors/google-workspace-licenses/package.json` — adds a top-level
  `repository` field with `type: "git"`,
  `url: "git+https://github.com/arkanaio/alma-plugins.git"` and
  `directory: "connectors/google-workspace-licenses"`. The shape matches
  what `contract/package.json` already carries (added in `991923a` for
  the same reason) and what npm requires for `--provenance` to validate
  the attestation against this repository. The connector's manifest
  (`allowedHosts`, `capabilities`, `authentication`, `configuration`,
  `activity: null`) and dependencies (`@arkanaio/connector-contract@0.1.1`,
  `zod@4.4.3`) are unchanged.
- `connectors/google-workspace-licenses/package.json` — version
  `0.1.0` → `0.1.1`. The 0.1.0 review file is on record, accepted, but the
  version itself was never published to npm: the publish workflow failed at
  the `Publish the package` step with `package.json: "repository.url" is ""`,
  so 0.1.0 never left the repository. There is no released tarball to
  inherit and no record to invalidate. 0.1.1 is the first version of the
  package on public npm and it carries the only review a published version
  needs.
- `connectors/google-workspace-licenses/src/manifest.ts` — version
  `0.1.0` → `0.1.1` to match `package.json`. The contract requires them to
  be the same claim from two sides (`docs/CONTRACT.md`, "A connector's
  version is written the same way in the manifest and in ALMA's
  incorporation record").
- `connectors/google-workspace-licenses/README.md` — the closing line
  updated to name the version about to be released. Prose only.

`pnpm-lock.yaml` does not change: the new field is metadata, not a
dependency.

## Before reading the code

- [x] An accepted proposal issue exists for this provider. See
      `connector-google-workspace-licenses-0.1.0.md` — the connector's
      scope was settled in PR #3's merge; this version only fixes
      packaging inside the approved surface.
- [x] The pull request brings **one connector** and does not touch `contract/`,
      another connector, or the repository configuration. If it does, it is
      split before this review continues. PR #5 only touches
      `connectors/google-workspace-licenses/package.json`,
      `connectors/google-workspace-licenses/src/manifest.ts`, and the
      `README.md` of the same package, plus this review file in
      `reviews/`.
- [x] CI is green, the `dco` job included: every commit carries a sign-off that
      matches its author. `pnpm verify` ran clean locally (build, Biome,
      typecheck, the 58 tests and `pnpm review`) at the tip of this branch.
- [x] **The code was the contributor's to give.** The diff is four files in
      this repository, all written against the same connector's existing
      style. The `repository` field shape is copied from
      `contract/package.json` (already in `main`); the rest of the diff is
      a version bump.
- [x] `defineConnector` accepts the manifest. The manifest's only change is
      the version string; the schema, host list, capabilities, fields and
      activity declaration are unchanged, so the contract's
      `connectorManifestSchema` continues to accept it.
- [x] `supportLevel` is the right one: `community` for a contribution from
      outside arkana. `official` is unchanged.
- [x] The package name is scoped, the package is not `private`, and the manifest
      `version` is the version that will be published. Scoped
      `@arkanaio/connector-google-workspace-licenses`, no `private` field,
      and `package.json` and `manifest.ts` agree on `0.1.1`.

## The approved surface

- [x] `capabilities` is the minimum the connector actually implements. A
      capability declared "for later" is approved surface nobody needed.
      Unchanged from 0.1.0.
- [x] `allowedHosts` contains only machines the provider needs, and they belong
      to the provider. A shortener, an analytics domain, a third-party CDN or a
      personal domain is grounds for rejection. Unchanged: `licensing.googleapis.com`,
      `admin.googleapis.com`.
- [x] `capabilities` and `allowedHosts` in this file's header are copied from
      the manifest exactly. They are what ALMA's record approves and what ALMA
      compares against the installed manifest on start-up.
- [x] `authentication` asks for the least the provider allows. Each OAuth scope
      buys one declared capability that would not work without it, and it is
      read-only wherever the provider offers a read-only form. Unchanged from
      0.1.0: `kind: "secret"`, single `access_token` field, every fetch
      `GET`, no other HTTP verb anywhere in `src/`.
- [x] The `configuration` fields ask for nothing the connector does not use.
      Unchanged: `read_mode`, `report_date`, `customer_id`.

### If it widens what the customer has already granted

- [x] ALMA asks this provider for nothing yet, or every box below is checked.
      No other Google connector in the repository. The 0.1.0 review recorded
      the same finding; nothing since has moved this.
- [x] The pull request names each permission that is **new** with respect to
      what ALMA already asks this provider for, and which capability each one
      buys. No new permission: PR #5 changes metadata and a version string
      only.
- [x] Not granting the new permission leaves what already worked working: the
      connector fails with `permissions` for that capability alone and keeps
      synchronising the rest. Unchanged behaviour.
- [x] The new capability is **not active because the provider is already
      connected**. A connected directory grants nothing to licences, and
      nothing at all to last activity, which stays off until an organisation
      enables it. Unchanged.
- [x] The connector's `README.md` says which permission to grant, what it buys,
      and what is lost by not granting it. Unchanged.

## The boundary

- [x] The only local imports are the connector's own files, and the only package
      imports are `@arkanaio/connector-contract` and the dependencies declared
      in its `package.json`. Nothing reaches for a database driver, a session,
      a queue, or a path that looks like one of ALMA's own aliases.
      Unchanged: `grep -rn "^import" connectors/google-workspace-licenses/src`
      returns the same `@arkanaio/connector-contract` and `zod` imports as in
      0.1.0.
- [x] Every outbound call goes through `context.fetch`. There is no global
      `fetch`, no `node:http`, `node:https` or `node:net`, and no provider SDK
      opening its own connections. Unchanged: only `https://licensing.googleapis.com/...`
      and `https://admin.googleapis.com/...` literals in `src/`, plus the two
      `await context.fetch(url.toString(), ...)` calls.
- [x] No import of `node:fs`, `node:child_process` or `node:worker_threads`.
- [x] No environment variables are read, and no files are written.
- [x] There is no `eval`, no `new Function`, no dynamic import with a computed
      path, and no deserialisation of code.
- [x] The connector does not write to the provider: no POST, PUT, PATCH or
      DELETE, unless the provider requires POST for a **query**, justified in
      the pull request. Unchanged: `method: "GET"` is the only method in
      `src/`.
- [x] Nothing in the code knows about an organisation, a tenant or a customer.
- [x] `context.now` is used instead of `Date.now()` or `new Date()` wherever a
      date matters, so a test can pin it. Unchanged: the connector does not
      depend on the clock.

## Credentials

- [x] The credential is only ever sent to the declared hosts, and only in a
      header — never in a URL, a query parameter or a body that gets logged.
      Unchanged: `authorization: \`Bearer ${token}\`` at the same two sites.
- [x] The credential appears in no error, no returned value and no cursor.
- [x] No `ConnectorError` carries the provider's response in its code or
      message. The body may only be in `cause`.
- [x] There is no credential, token or key anywhere in the contribution,
      including the sample data and the branch history. PR #5 only adds a
      `repository` field that names the public repository URL — no token, no
      key, no internal hostname.

## Data

- [x] Every provider response is validated before its contents are used.
- [x] No missing value is filled in with an assumption. An amount with no
      currency is dropped whole.
- [x] The connector does not classify seats or decide whether an account is
      orphaned.
- [x] Reads are paged, and the cursor is opaque: it carries a position, not
      data, and not a credential.
- [x] Failures use the right kind: `credentials` for a rejected credential,
      `permissions` for a missing scope, `service` for a temporary failure,
      `contract` for a provider answer that does not match its own contract.
- [x] A rejected credential is not retried.

## Last activity

- [x] The connector declares `activity: null`, or every box under "What gets
      reviewed" in [docs/ACTIVITY.md](../docs/ACTIVITY.md) is checked. The
      manifest still declares `activity: null`; every `lastActivityAt`
      returned is the constant `null`.
- [x] What `measures` claims is what the provider's field actually returns,
      checked against the page `documentationUrl` points at rather than against
      the pull request's description of it. Not applicable: `activity` is
      `null` and the connector declares none.
- [x] The value is returned only when ALMA asks for it. The connector has no
      collection setting of its own, and no other path returns it.
- [x] Nothing builds a history of one person's activity: not a response, not the
      sample data, not a test, not an error, not a log line. One current value
      per seat, the provider's own, kept nowhere between runs.

## Dependencies

- [x] Each new dependency is justified in the pull request and there is no
      reasonable way to avoid it. No new dependency: `package.json` declares
      the same two packages as 0.1.0. The `repository` field is metadata, not
      a dependency, and `pnpm-lock.yaml` does not change.
- [x] No dependency runs install scripts.
- [x] No dependency has a name close to that of a well-known package.
- [x] Each one is a package with a real history, not a version published days
      ago by an account with nothing else.
- [x] The dependency tree it drags in is proportionate to what it does.
- [x] `pnpm-lock.yaml` follows from the pull request's `package.json` and brings
      no unrelated changes. PR #5 does not change `pnpm-lock.yaml`.

## Sample data

- [x] Anonymised: no email, name or identifier of a real person or customer.
- [x] No secrets.
- [x] Includes the awkward cases: a missing value, a suspended or invited
      account, more than one page. PR #5 does not change the sample data.

## Documentation

- [x] The connector's `README.md` says what credential to create, with which
      permissions, and which ones are **not** needed.
- [x] Known limits are documented: quotas, delays, fields the provider does
      not offer.

## Notes

- **Why a new version, not a force-publish of 0.1.0.** The publish workflow
  ran for 0.1.0 and failed at `Publish the package` with `package.json:
  "repository.url" is ""`. npm's provenance gate is correct: without a
  declared `repository`, the attestation that npm signs cannot be tied
  back to the source repository, which is the whole claim this repository
  makes. There is no way to publish 0.1.0 with `--provenance` as-is. The
  fix is the new `repository` field, which is metadata that the connector
  carries alongside its package, not a change to what the connector does.
  Bumping to 0.1.1 is the same shape as `d7a95b9` took for the contract:
  one version behind an already-on-record review, because the previous
  version was never published.
- **Surface unchanged.** The five items the SECURITY-REVIEW process lists
  as triggering a from-scratch re-review (`capabilities`, `allowedHosts`,
  `supportLevel` or maintainer, `authentication`, dependencies, `activity`)
  are all unchanged between 0.1.0 and 0.1.1. The review is therefore read
  against what changed, and what changed is documented at the top of this
  file.
- **Deviation from process, recorded.** The reviewer is the author of every
  commit on PR #3 and PR #5. `docs/SECURITY-REVIEW.md` requires, for
  `official`, "One reviewer, not the author". The reviewer explicitly
  waived the rule for this version (and the 0.1.0 it builds on). The
  waiver is recorded in the 0.1.0 review file's `Notes` and is repeated
  here so the incorporation record does not silently disagree with the
  policy it cites. A second maintainer should read this version before it
  reaches a deployment if the policy is to be enforced.
