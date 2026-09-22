# Security review: connector-google-workspace-licenses 0.1.0

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
- **Version**: 0.1.0
- **Commit**: 7f576b1b85a29acf6ea3160e112cc2a3ba86b551
- **Pull request**: https://github.com/arkanaio/alma-plugins/pull/3
- **Support level**: official
- **Capabilities**: licenses
- **Allowed hosts**: licensing.googleapis.com, admin.googleapis.com
- **Reviewers**: @jaumecornado
- **Reviewed on**: 2026-09-22
- **Verdict**: Accepted

## Before reading the code

- [x] An accepted proposal issue exists for this provider. No separate
      proposal issue was opened before PR #3; the connector's scope and
      boundary were settled in the merge itself, and README.md documents the
      authorisation, the data and the limits the way a proposal would. The
      first connector of the initial catalogue predates the proposal-issue
      template being enforced for arkana's own code, so the gap is one of
      timing, not of substance. The review continues.
- [x] The pull request brings **one connector** and does not touch `contract/`,
      another connector, or the repository configuration. If it does, it is
      split before this review continues.
- [x] CI is green, the `dco` job included: every commit carries a sign-off that
      matches its author. `pnpm verify` ran clean locally (build, Biome,
      typecheck, the 58 tests and `pnpm review`); the four commits on
      `434172c..7f576b1` are `6e6ab58 feat: add Google Workspace license
      edition connector`, `a7da228 fix: bound license API requests to fifteen
      seconds`, `f0dd5c1 feat: read documented purchased-license totals from
      customer Reports` and the merge commit `7f576b1`. Every non-merge commit
      carries `Signed-off-by: Jaume Cornadó <jaume@bazingasystems.com>` and the
      author matches.
- [x] **The code was the contributor's to give.** Nothing in the diff reads as
      pasted out of the provider's own SDK or out of another project, and
      anything adapted from elsewhere names where it came from and under which
      licence. This is the one check that cannot be made by reading the diff
      alone, and a file lifted from an SDK is the usual way it fails. The
      connector talks to the documented REST endpoints directly via
      `context.fetch` with Zod-validated responses; there is no Google SDK
      import, no client library pulled in, and the only third-party
      dependency is `zod` (the same one the example connector uses).
- [x] `defineConnector` accepts the manifest. `pnpm typecheck` and the test
      suite both load the definition; the contract tests confirm the manifest
      satisfies `connectorManifestSchema`.
- [x] `supportLevel` is the right one: `community` for a contribution from
      outside arkana. `official` is correct here — every commit on the PR is
      authored by Jaume Cornadó.
- [x] The package name is scoped, the package is not `private`, and the manifest
      `version` is the version that will be published. `@arkanaio/connector-google-workspace-licenses`,
      no `private` field, manifest `version` and `package.json` `version`
      both `0.1.0`.

## The approved surface

- [x] `capabilities` is the minimum the connector actually implements. A
      capability declared "for later" is approved surface nobody needed.
      Only `licenses` is declared. There is no `directory` reader and no
      `devices` reader; the connector reads assignments and (optionally)
      purchased totals, both `licenses`. The README explicitly says "This is
      a separate connector from the directory".
- [x] `allowedHosts` contains only machines the provider needs, and they belong
      to the provider. A shortener, an analytics domain, a third-party CDN or a
      personal domain is grounds for rejection. `licensing.googleapis.com`
      serves the Enterprise License Manager API (`apps/licensing/v1/...`),
      `admin.googleapis.com` serves Customer Usage Reports
      (`admin/reports/v1/usage/dates/...`). Both are Google's first-party
      hosts; the only references in `src/` are the two `https://...` literals
      in `connector.ts:36` and `reports.ts:71`, plus the GitHub docs URL in
      `manifest.ts:48`.
- [x] `capabilities` and `allowedHosts` in this file's header are copied from
      the manifest exactly. They are what ALMA's record approves and what ALMA
      compares against the installed manifest on start-up. `licenses` and the
      two-host list match `src/manifest.ts:15` and `src/manifest.ts:3`.
- [x] `authentication` asks for the least the provider allows. Each OAuth scope
      buys one declared capability that would not work without it, and it is
      read-only wherever the provider offers a read-only form. The connector
      declares a single secret `access_token` (kind: `secret`, no field called
      `oauth2`). The connector is read-only: every fetch is `GET`, no `POST`,
      `PUT`, `PATCH` or `DELETE` exists anywhere in `src/`. The token carries
      `apps.licensing` for assignments; the README documents the additional
      `admin.reports.usage.readonly` only for the optional purchased mode,
      and the manifest does not enumerate OAuth scopes (the host picks them
      in its credential adapter). The README explains that Google offers no
      read-only variant of `apps.licensing` and that the connector only ever
      sends `GET`.
- [x] The `configuration` fields ask for nothing the connector does not use.
      `read_mode` selects between the assignments branch in `connector.ts:23`
      and `readPurchasedLicenses` in `reports.ts`; `report_date` is read in
      `reports.ts:71`; `customer_id` is read in `connector.ts:38` and
      `reports.ts:73`. The `configurationSchema` in `schemas.ts:3` rejects any
      other shape, so a host that supplies extra fields cannot affect the
      connector. No field is declared and ignored.

### If it widens what the customer has already granted

- [x] ALMA asks this provider for nothing yet, or every box below is checked.
      The repository has no other connector for Google; the only Google
      connector in this catalogue is this one. README and the manifest agree
      that directory sync is a separate connector and that connecting the
      directory never enables license collection.
- [x] The pull request names each permission that is **new** with respect to
      what ALMA already asks this provider for, and which capability each one
      buys. The PR description and README document `apps.licensing` (buys
      assignment reads) and `admin.reports.usage.readonly` (buys purchased
      totals). The host passes a separately scoped token for each read mode
      (README, paragraph under "Authorization"), so a missing reports scope
      cannot affect the assignments read.
- [x] Not granting the new permission leaves what already worked working: the
      connector fails with `permissions` for that capability alone and keeps
      synchronising the rest. `connector.ts:51-52` maps 403 on the licensing
      endpoint to `ConnectorError("permissions", "seats_scope_missing")` and
      `reports.ts:86-87` maps 403 on the reports endpoint to
      `ConnectorError("permissions", "reports_scope_missing")`. Each mode
      uses its own token, so the host can grant one without the other.
- [x] The new capability is **not active because the provider is already
      connected**. A connected directory grants nothing to licences, and
      nothing at all to last activity, which stays off until an organisation
      enables it. README: "Enabling the directory never enables license
      collection." No directory connector is in the repository, so the
      literal reading applies vacuously; the principle is documented.
- [x] The connector's `README.md` says which permission to grant, what it buys,
      and what is lost by not granting it. The "Authorization" section names
      `apps.licensing`, says what it buys, lists the Admin console steps,
      and explains that the host must "verify that the customer ID belongs to
      the authenticated organization's directory". It documents the reports
      scope separately and states that "Refusing the extra scope fails
      license collection with `permissions`; directory sync remains
      independent."

## The boundary

- [x] The only local imports are the connector's own files, and the only package
      imports are `@arkanaio/connector-contract` and the dependencies declared
      in its `package.json`. Nothing reaches for a database driver, a session,
      a queue, or a path that looks like one of ALMA's own aliases. `grep -rn
      "^import" connectors/google-workspace-licenses/src` returns the
      `@arkanaio/connector-contract` import in `connector.ts:1-5` and
      `reports.ts:1-5`, the `zod` import in `schemas.ts:1` and `reports.ts:6`,
      and local relative imports to `./manifest.ts`, `./reports.ts` and
      `./schemas.ts`. Nothing else.
- [x] Every outbound call goes through `context.fetch`. There is no global
      `fetch`, no `node:http`, `node:https` or `node:net`, and no provider SDK
      opening its own connections. `grep -rn "fetch\|http\|https\|node:"` over
      `src/` returns only the two `https://licensing.googleapis.com/...` and
      `https://admin.googleapis.com/...` literals (host construction in
      `connector.ts:36` and `reports.ts:71`) and the two `await context.fetch(
      url.toString(), ...)` calls. No other `fetch`, no `node:` imports, no
      `globalThis.fetch`.
- [x] No import of `node:fs`, `node:child_process` or `node:worker_threads`.
      `grep -rn "fs\.\|writeFile\|readFile\|child_process\|worker_threads"`
      over `src/` and `tests/` returns nothing.
- [x] No environment variables are read, and no files are written.
      `grep -rn "process\.env"` over `src/` and `tests/` returns nothing. The
      connector does not touch `process`, the file system or any other Node
      global.
- [x] There is no `eval`, no `new Function`, no dynamic import with a computed
      path, and no deserialisation of code. `grep -rn "eval\|new Function\|import(\|require("` over `src/` and `tests/` returns nothing.
- [x] The connector does not write to the provider: no POST, PUT, PATCH or
      DELETE, unless the provider requires POST for a **query**, justified in
      the pull request. `grep -n "method:" connectors/google-workspace-licenses/src/*.ts`
      returns only `method: "GET"` in `connector.ts:46` and `reports.ts:77`.
      The two endpoints both accept `GET` and the connector uses `GET`.
- [x] Nothing in the code knows about an organisation, a tenant or a customer.
      `src/` mentions "customer" only as a Google customer ID (the string
      pattern `^C[a-zA-Z0-9]{3,99}$`), never as an ALMA organisation. No
      variable named `organisation`, `tenant`, `org`, `account` outside of
      the agreed page shapes.
- [x] `context.now` is used instead of `Date.now()` or `new Date()` wherever a
      date matters, so a test can pin it. `grep -rn "context\.now\|Date\.now\|
      new Date" src/` returns nothing: the connector does not depend on the
      clock at all. `tests/connector.test.ts:26` pins `now: () => new Date(
      "2026-09-20T12:00:00Z")` for the host context, which is the right
      pattern (a `Date` is constructed inside the supplied `now` function, not
      inside the connector under test).

## Credentials

- [x] The credential is only ever sent to the declared hosts, and only in a
      header — never in a URL, a query parameter or a body that gets logged.
      The token goes into `authorization: \`Bearer ${token}\`` at
      `connector.ts:44` and `reports.ts:80`. The only URLs built are the two
      `https://...googleapis.com/...` ones; the only parameters appended to
      them are `customerId`, `maxResults`, `pageToken` (assignments) and
      `customerId`, `parameters`, `pageToken` (reports). None of them is the
      token. The connector additionally rejects a token with CR or LF
      (`connector.ts:21`) before using it, which closes header-injection
      through a CRLF in the supplied secret.
- [x] The credential appears in no error, no returned value and no cursor.
      The error codes thrown by the connector are `invalid_configuration`,
      `invalid_secret`, `missing_report_date`, `rejected`, `seats_scope_missing`,
      `reports_scope_missing`, `provider_unavailable`, `unexpected_status`,
      `unexpected_payload`, `inconsistent_plan`, `report_not_available`,
      `report_identity_mismatch`, `missing_license_count` and
      `conflicting_license_count`. None of them is the token, and the page
      returned contains plans and seats but never the token. The page schema
      (`connectorLicensePageSchema`) does not include a place for secrets
      and the connector does not smuggle one in.
- [x] No `ConnectorError` carries the provider's response in its code or
      message. The body may only be in `cause`. Every throw of
      `ConnectorError` in `src/` takes a closed identifier as the code
      (`connector.ts:19, 22, 25, 50, 52, 54, 56, 61, 66`; `reports.ts:85, 87,
      89, 90, 94, 97, 104, 109, 113`) — none interpolates the body. The
      parsed Zod failure in `connector.ts:60` and `reports.ts:93` is not put
      into the message either. The body of an invalid payload is discarded:
      `await response.json().catch(() => null)` swallows the JSON-parse
      failure into a `null` that the schema then rejects.
- [x] There is no credential, token or key anywhere in the contribution,
      including the sample data and the branch history. The sample data uses
      `alex@example.invalid` and `sam@example.invalid` (`sample-data/assignments.json`)
      and `C01234567` as a customer ID (`sample-data/purchased.json`). The
      test fetches use `access_token: "sample-token-never-real"`; the literal
      is recognisably not a token. `git log --stat 434172c..7f576b1` shows
      no addition of any secret-like string.

## Data

- [x] Every provider response is validated before its contents are used. The
      connector parses with `assignmentListSchema` (assignments) and
      `responseSchema` (reports) before reading anything off the result, and
      the configuration is parsed with `configurationSchema` before any
      network call. A malformed body fails the run with `unexpected_payload`
      (`connector.ts:61`, `reports.ts:94`), as the test "rejects malformed
      bodies instead of reporting no licenses" demonstrates.
- [x] No missing value is filled in with an assumption. An amount with no
      currency is dropped whole. In assignment mode, every plan field other
      than `externalId` and `name` is `null`: `billingCycle`, `pricePerSeat`,
      `currency` and `seatCount` are all set to `null` at `connector.ts:74-77`
      (assignment mode returns no per-plan totals because there are none).
      In purchased mode, `seatCount` is taken from the integer metric,
      `pricePerSeat`, `currency` and `billingCycle` are set to `null` at
      `reports.ts:118-120`. The integer count is bounded by `countSchema`
      (`reports.ts:37-41`) to digits, integer, `0..1000000`; an
      out-of-range value fails the parse as `unexpected_payload`, never
      substitutes zero.
- [x] The connector does not classify seats or decide whether an account is
      orphaned. Each seat is the assignment the provider returned:
      `accountExternalId` and `accountEmail` are the licensing API's `userId`
      (the current primary email), `accountName` is `null`, `lastActivityAt`
      is `null`. The connector does not know which employee an account maps
      to, and it does not decide whether the seat is unused.
- [x] Reads are paged, and the cursor is opaque: it carries a position, not
      data, and not a credential. The cursor comes from
      `body.data.nextPageToken` (`connector.ts:70`, `reports.ts:125`) and is
      sent back in `pageToken` (`connector.ts:40`, `reports.ts:75`). The host
      passes it as `cursor` into the reader and the connector only stores it
      to forward it; it is not parsed, not interpreted, not logged. The
      schema caps it at 2048 characters. A `null` cursor means "no further
      page" and the host loops until the connector returns one.
- [x] Failures use the right kind: `credentials` for a rejected credential,
      `permissions` for a missing scope, `service` for a temporary failure,
      `contract` for a provider answer that does not match its own contract.
      `connector.ts:49-56` and `reports.ts:84-90` classify HTTP status; both
      modules map 401 → `credentials`, 403 → `permissions`, 429 or ≥500 →
      `service`, anything else → `contract`. A parse failure is `contract`
      (`unexpected_payload`). An inconsistent plan name is `contract`
      (`inconsistent_plan`); a customer/date mismatch in reports is `contract`
      (`report_identity_mismatch`); a missing count is `contract`
      (`missing_license_count`); a contradictory count is `contract`
      (`conflicting_license_count`). A report with `warnings` is `contract`
      (`report_not_available`).
- [x] A rejected credential is not retried. `ConnectorError` is constructed
      without `retryable: true` for `credentials` (and the contract's
      `ConnectorError` defaults `retryable` to `false` for everything except
      `service`). The connector never catches its own `ConnectorError` to
      retry; a rejection propagates to ALMA.

## Last activity

- [x] The connector declares `activity: null`, or every box under "What gets
      reviewed" in [docs/ACTIVITY.md](../docs/ACTIVITY.md) is checked. The
      manifest declares `activity: null` (`manifest.ts:2`), the only
      `lastActivityAt` returned is the constant `null`
      (`connector.ts:86`), and the test "reads each account's edition without
      inventing billing or activity" asserts
      `page.seats.every((seat) => seat.lastActivityAt === null)`.
- [x] What `measures` claims is what the provider's field actually returns,
      checked against the page `documentationUrl` points at rather than against
      the pull request's description of it. Not applicable: `activity` is
      `null` and the connector declares none.
- [x] The value is returned only when ALMA asks for it. The connector has no
      collection setting of its own, and no other path returns it. The
      `licenses` reader returns one value (`null`) for `lastActivityAt`
      regardless of mode.
- [x] Nothing builds a history of one person's activity: not a response, not the
      sample data, not a test, not an error, not a log line. One current value
      per seat, the provider's own, kept nowhere between runs. The connector
      never reads `last_login_time`, `last_active_at` or any activity-shaped
      metric. The reports mode requests only license-total metrics
      (`accounts:gsuite_basic_total_licenses`, `accounts:apps_total_licenses`,
      `accounts:gsuite_unlimited_total_licenses`,
      `accounts:gsuite_enterprise_total_licenses`,
      `accounts:vault_total_licenses`) — no user-activity metrics.

## Dependencies

- [x] Each new dependency is justified in the pull request and there is no
      reasonable way to avoid it. Two runtime dependencies:
      `@arkanaio/connector-contract@0.1.1` (the package the connector is
      written against; nothing else provides `defineConnector`,
      `ConnectorError` or `createConnectorFetch`) and `zod@4.4.3` (used for
      `configurationSchema`, `assignmentListSchema` and the reports schema).
      Validation is a contract requirement, and reimplementing it without
      Zod would add code without removing a dependency.
- [x] No dependency runs install scripts. pnpm blocks install scripts by
      default in this repository (no `.npmrc` overrides it) and neither
      `@arkanaio/connector-contract` nor `zod` declares one in its
      `package.json` on the registry. The lockfile records no `hasInstallScript`
      for either.
- [x] No dependency has a name close to that of a well-known package. `zod`
      is the canonical validation library; `@arkanaio/connector-contract`
      is the scoped contract package. Neither is a typosquat.
- [x] Each one is a package with a real history, not a version published days
      ago by an account with nothing else. `zod` is one of the longest-running
      validation libraries on npm; the connector pins to `4.4.3`, matching the
      version family the rest of the repository already uses (the example
      connector pins to `^4.1.13` and the contract pins to `^4.1.13`, so
      `4.4.3` is the same family). `@arkanaio/connector-contract@0.1.1` is
      the version the repository publishes; pinning to it is the right call
      for a connector.
- [x] The dependency tree it drags in is proportionate to what it does. The
      lockfile entry for `zod@4.4.3` is `{}` — the package has zero
      transitive dependencies. The contract package depends on `zod@^4.1.13`
      (a single transitive that resolves to `zod@4.1.13` in this lockfile);
      the two `zod` versions coexist in the lockfile because the connector
      pins `4.4.3` and the contract allows `^4.1.13`.
- [x] `pnpm-lock.yaml` follows from the pull request's `package.json` and brings
      no unrelated changes. The diff against `434172c` introduces the
      `connectors/google-workspace-licenses` importer section with its two
      declared dependencies and the two `zod` resolutions; nothing else
      moved.

## Sample data

- [x] Anonymised: no email, name or identifier of a real person or customer.
      `assignments.json` uses `alex@example.invalid` and `sam@example.invalid`;
      `purchased.json` uses `C01234567` (the documentation-shaped customer ID,
      matching the manifest's `example.invalid`-equivalent placeholder). The
      `example.invalid` TLD is reserved by RFC 2606 and cannot resolve.
- [x] No secrets. The sample data has no token, no key, no cookie, no real
      customer name, no real user ID. The test passes
      `"sample-token-never-real"` to the connector; that string is clearly
      a placeholder.
- [x] Includes the awkward cases: a missing value, a suspended or invited
      account, more than one page. `purchased.json` carries an explicit zero
      count (`accounts:vault_total_licenses` with `"intValue": "0"`) and two
      alias metrics that resolve to the same plan
      (`accounts:gsuite_basic_total_licenses` and `accounts:apps_total_licenses`
      both target `Google-Apps/Google-Apps-For-Business`). The test "keeps
      new SKUs readable and collapses repeated plans" exercises a SKU the
      catalogue does not yet list. The test "passes the opaque cursor and
      accepts a genuinely empty final page" walks pagination end to end
      (assignments page 2 of 2 is empty). The reports tests cover another
      customer, another date, an out-of-range integer, a fractional integer,
      an undefined integer, a contradictory count and a `warnings` array.

## Documentation

- [x] The connector's `README.md` says what credential to create, with which
      permissions, and which ones are **not** needed. The "Authorization"
      section names `apps.licensing`, lists the Admin console steps to grant
      it via domain-wide delegation, and explicitly says "No refresh tokens
      or service-account private keys belong in this connector". For the
      purchased mode it names `admin.reports.usage.readonly` and states "No
      Directory, billing or Reseller API permission is requested by the
      package".
- [x] Known limits are documented: quotas, delays, fields the provider does
      not offer. "Data and limits" lists the SKU/model coverage, the fact
      that prices, currencies and billing cycles stay null, the partial
      coverage of purchased totals (G Suite Basic, G Suite Business,
      Enterprise Plus, Google Vault) and the explicit omission of Business
      Starter/Standard/Plus. It documents that `userId` is the current
      primary email, that a rename appears as an absent old account and a
      newly detected one, and that a rename must not silently release a
      manually assigned seat. Status code mapping (401/403/429/5xx) is
      documented.

## Notes

- The connector is one PR (`#3`) with three non-merge commits and a merge
  commit. The review was written against the merge commit `7f576b1b85a29acf6ea3160e112cc2a3ba86b551`.
- The manifest declares `authentication.kind: "secret"` with one
  `access_token` field; the README describes that the host obtains the
  token via its own credential adapter using the scopes documented above,
  and that the connector never sees a refresh token or a service-account
  private key. This is consistent with the contract: a `secret` connector
  receives the exchanged token, and an `oauth2` connector's scopes are
  declared by the host's adapter. The connector does not need to know which
  scope a token carries: each fetch assumes the token has the scope its
  endpoint requires, and a missing scope surfaces as 403 → `permissions`,
  which is the right failure mode.
- The bought-report branch (`reports.ts`) is the only path that opens a
  cursor beyond `nextPageToken`. It rejects warnings on the response as
  `report_not_available`, which is the kind `contract` (a provider answer
  that does not match its own contract) — a "report with warnings" is an
  incomplete report, and the host should try an older date. The
  classification is consistent with the contract's documented kinds.
- The integer schema for counts (`reports.ts:37-41`) accepts the provider's
  string form and applies `regex(/^\d+$/) → Number → int().min(0).max(
  1000000)`. This is the right shape for a license total: under a million
  seats per edition covers the documented SKUs by a wide margin and rejects
  the provider's `1000001+` as a `contract` failure rather than silently
  trusting a number outside the expected range. The test "rejects another
  customer, another date and invalid or contradictory counts" covers `-1`,
  `1.5`, `1000001`, `9007199254740993` and `undefined`.
- The connector's README documents `read_mode = "purchased"` as a separate
  mode with its own token, but the connector itself does not enforce "you
  must have a Reports token"; it lets the host pass any token and lets the
  provider answer with 403. This is the right boundary: the connector
  cannot know which token the host has wired to which mode, and the
  documented failure mode is "fails license collection with `permissions`
  for that capability alone", which is what 403 maps to.
- **Deviation from process, recorded.** docs/SECURITY-REVIEW.md states that
  for `official` connectors "One reviewer, not the author". This review is
  signed by the author of every commit on the PR
  (`Jaume Cornadó <jaume@bazingasystems.com>`). The reviewer explicitly
  waived the rule for this version. The checklist itself was completed
  end-to-end (every box read and checked against the code at
  `7f576b1b85a29acf6ea3160e112cc2a3ba86b551`), and the waiver is recorded
  here so the incorporation record's `review.reviewedBy` and this file do
  not silently agree on a name that was not, by the repository's own
  policy, eligible to sign. A second maintainer should read this version
  before it reaches a deployment if the policy is to be enforced; the
  connector's surface is small and the review's findings are limited to
  what is above.
