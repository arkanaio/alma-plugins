# Security review: PACKAGE VERSION

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

- **Package**: @arkanaio/connector-provider
- **Version**: 1.0.0
- **Commit**: 0000000000000000000000000000000000000000
- **Pull request**: https://github.com/arkanaio/alma-plugins/pull/0
- **Support level**: community
- **Capabilities**: licenses
- **Allowed hosts**: api.provider.example
- **Reviewers**: @first-reviewer, @second-reviewer
- **Reviewed on**: 2026-01-01
- **Verdict**: Accepted

## Before reading the code

- [ ] An accepted proposal issue exists for this provider.
- [ ] The pull request brings **one connector** and does not touch `contract/`,
      another connector, or the repository configuration. If it does, it is
      split before this review continues.
- [ ] CI is green, the `dco` job included: every commit carries a sign-off that
      matches its author.
- [ ] **The code was the contributor's to give.** Nothing in the diff reads as
      pasted out of the provider's own SDK or out of another project, and
      anything adapted from elsewhere names where it came from and under which
      licence. This is the one check that cannot be made by reading the diff
      alone, and a file lifted from an SDK is the usual way it fails.
- [ ] `defineConnector` accepts the manifest.
- [ ] `supportLevel` is the right one: `community` for a contribution from
      outside arkana.
- [ ] The package name is scoped, the package is not `private`, and the manifest
      `version` is the version that will be published.

## The approved surface

- [ ] `capabilities` is the minimum the connector actually implements. A
      capability declared "for later" is approved surface nobody needed.
- [ ] `allowedHosts` contains only machines the provider needs, and they belong
      to the provider. A shortener, an analytics domain, a third-party CDN or a
      personal domain is grounds for rejection.
- [ ] `capabilities` and `allowedHosts` in this file's header are copied from
      the manifest exactly. They are what ALMA's record approves and what ALMA
      compares against the installed manifest on start-up.
- [ ] `authentication` asks for the least the provider allows. Each OAuth scope
      buys one declared capability that would not work without it, and it is
      read-only wherever the provider offers a read-only form.
- [ ] The `configuration` fields ask for nothing the connector does not use.

### If it widens what the customer has already granted

<!-- Applies when ALMA already talks to this provider for another capability.
     If it does not, check the first box and skip the rest. -->

- [ ] ALMA asks this provider for nothing yet, or every box below is checked.
- [ ] The pull request names each permission that is **new** with respect to
      what ALMA already asks this provider for, and which capability each one
      buys.
- [ ] Not granting the new permission leaves what already worked working: the
      connector fails with `permissions` for that capability alone and keeps
      synchronising the rest.
- [ ] The new capability is **not active because the provider is already
      connected**. A connected directory grants nothing to licences, and
      nothing at all to last activity, which stays off until an organisation
      enables it.
- [ ] The connector's `README.md` says which permission to grant, what it buys,
      and what is lost by not granting it.

## The boundary

- [ ] The only local imports are the connector's own files, and the only package
      imports are `@arkanaio/connector-contract` and the dependencies declared
      in its `package.json`. Nothing reaches for a database driver, a session,
      a queue, or a path that looks like one of ALMA's own aliases.
- [ ] Every outbound call goes through `context.fetch`. There is no global
      `fetch`, no `node:http`, `node:https` or `node:net`, and no provider SDK
      opening its own connections.
- [ ] No import of `node:fs`, `node:child_process` or `node:worker_threads`.
- [ ] No environment variables are read, and no files are written.
- [ ] There is no `eval`, no `new Function`, no dynamic import with a computed
      path, and no deserialisation of code.
- [ ] The connector does not write to the provider: no POST, PUT, PATCH or
      DELETE, unless the provider requires POST for a **query**, justified in
      the pull request.
- [ ] Nothing in the code knows about an organisation, a tenant or a customer.
- [ ] `context.now` is used instead of `Date.now()` or `new Date()` wherever a
      date matters, so a test can pin it.

## Credentials

- [ ] The credential is only ever sent to the declared hosts, and only in a
      header — never in a URL, a query parameter or a body that gets logged.
- [ ] The credential appears in no error, no returned value and no cursor.
- [ ] No `ConnectorError` carries the provider's response in its code or
      message. The body may only be in `cause`.
- [ ] There is no credential, token or key anywhere in the contribution,
      including the sample data and the branch history.

## Data

- [ ] Every provider response is validated before its contents are used.
- [ ] No missing value is filled in with an assumption. An amount with no
      currency is dropped whole.
- [ ] The connector does not classify seats or decide whether an account is
      orphaned.
- [ ] Reads are paged, and the cursor is opaque: it carries a position, not
      data, and not a credential.
- [ ] Failures use the right kind: `credentials` for a rejected credential,
      `permissions` for a missing scope, `service` for a temporary failure,
      `contract` for a provider answer that does not match its own contract.
- [ ] A rejected credential is not retried.

## Last activity

- [ ] The connector declares `activity: null`, or every box under "What gets
      reviewed" in [docs/ACTIVITY.md](../docs/ACTIVITY.md) is checked.
- [ ] What `measures` claims is what the provider's field actually returns,
      checked against the page `documentationUrl` points at rather than against
      the pull request's description of it.
- [ ] The value is returned only when ALMA asks for it. The connector has no
      collection setting of its own, and no other path returns it.
- [ ] Nothing builds a history of one person's activity: not a response, not the
      sample data, not a test, not an error, not a log line. One current value
      per seat, the provider's own, kept nowhere between runs.

## Dependencies

- [ ] Each new dependency is justified in the pull request and there is no
      reasonable way to avoid it.
- [ ] No dependency runs install scripts.
- [ ] No dependency has a name close to that of a well-known package.
- [ ] Each one is a package with a real history, not a version published days
      ago by an account with nothing else.
- [ ] The dependency tree it drags in is proportionate to what it does.
- [ ] `pnpm-lock.yaml` follows from the pull request's `package.json` and brings
      no unrelated changes.

## Sample data

- [ ] Anonymised: no email, name or identifier of a real person or customer.
- [ ] No secrets.
- [ ] Includes the awkward cases: a missing value, a suspended or invited
      account, more than one page.

## Documentation

- [ ] The connector's `README.md` says what credential to create, with which
      permissions, and which ones are **not** needed.
- [ ] Known limits are documented: quotas, delays, fields the provider does not
      offer.

## Notes

<!-- What was looked at and did not fit a box, what was changed during the
     review, and anything the next reviewer of this connector should start
     from. A review with nothing to say here is rare. -->
