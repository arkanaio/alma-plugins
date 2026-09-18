# Security review of a contribution

> **Provisional.** The final process is settled in
> [arkanaio/alma#366](https://github.com/arkanaio/alma/issues/366). This
> checklist is what applies in the meantime.

No contribution is published without passing this review. **Not arkana's own
either.** The automated tests are a pre-filter, not a substitute: they check that
the connector does what it says, not that it does nothing else.

The review is done by someone with write access, other than the contributor, and
its result is written on the PR with this checklist filled in. That PR is what
ALMA's incorporation record cites as `review.reference`, so it has to stay
readable and stable: it is the evidence that a version was approved.

Once the package is installed in ALMA, the lint rule that keeps a connector away
from the database no longer reaches it — it only covers ALMA's own tree. What
still prevents it is that the context gives it nothing to reach with. But the
automatic check has moved to this side, which is why this list exists.

## Before reading the code

- [ ] An accepted proposal issue exists for this provider.
- [ ] The PR brings **one connector** and does not touch `contract/`, another
      connector, or the repository configuration. If it does, split it.
- [ ] `defineConnector` accepts the manifest, and CI is green, the `dco` job
      included: every commit is signed off by its author.
- [ ] `supportLevel` is the right one: `community` for an external contribution.
- [ ] `capabilities` is the minimum the connector actually implements. A
      capability declared "for later" is approved surface nobody needed.
- [ ] `allowedHosts` contains only machines the provider needs, and they belong
      to the provider. A shortener, an analytics domain, a third-party CDN or a
      personal domain is grounds for rejection.
- [ ] `authentication` asks for the least the provider allows. For `oauth2`, each
      scope is justified: read-only wherever the provider offers it.
- [ ] The `configuration` fields ask for nothing the connector does not use.
- [ ] The package name is scoped and the manifest `version` matches the version
      to be published.

## The boundary

- [ ] Every outbound call goes through `context.fetch`. There is no global
      `fetch`, no `node:http`, `node:https` or `node:net`, and no provider SDK
      opening its own connections.
- [ ] No import of `node:fs`, `node:child_process` or `node:worker_threads`.
- [ ] No environment variables are read, and no files are written.
- [ ] There is no `eval`, no `new Function`, no dynamic import with a computed
      path, and no deserialisation of code.
- [ ] The connector does not write to the provider: no POST, PUT, PATCH or
      DELETE, unless the provider requires POST for a **query**, justified in the
      PR.
- [ ] Nothing in the code knows about an organisation, a tenant or a customer.
- [ ] `context.now` is used instead of `Date.now()` or `new Date()` wherever a
      date matters, so a test can pin it.

## Credentials

- [ ] The credential is only ever sent to the declared hosts, and only in a
      header — never in a URL, a query parameter or a body that gets logged.
- [ ] The credential appears in no error, no returned value and no cursor.
- [ ] No `ConnectorError` carries the provider's response in its code or
      message. The body may only be in `cause`.
- [ ] There is no credential, token or key anywhere in the repository, including
      the sample data and the branch history.

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

## Last activity, if declared

Apply the full checklist in [ACTIVITY.md](ACTIVITY.md). In short:

- [ ] `measures` and `limitations` describe the provider's real field, and
      `documentationUrl` points at the provider's page for it.
- [ ] No sync date, assignment date or generic sign-in stands in for usage.
- [ ] With no value, `lastActivityAt` is `null`.
- [ ] The connector stamps no date of its own.
- [ ] The value is not persisted, not cached and not logged.

## Dependencies

Dependencies are allowed. They are also the part of a contribution that carries
the most code nobody in this repository wrote, so they are read.

- [ ] Each new dependency is justified in the PR and there is no reasonable way
      to avoid it.
- [ ] No dependency runs install scripts.
- [ ] No dependency has a name close to that of a well-known package.
- [ ] Each one is a package with a real history, not a version published days
      ago by an account with nothing else.
- [ ] The dependency tree it drags in is proportionate to what it does.
- [ ] `pnpm-lock.yaml` follows from the PR's `package.json` and brings no
      unrelated changes.

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

## Outcome

- **Accepted.** A version is published and it can be incorporated. The approved
  surface — `capabilities` and `allowedHosts` — is stated in the review, because
  that is what goes into ALMA's record.
- **Changes requested.** With the list of points that do not pass.
- **Rejected.** With the reason. A rejection over the connector boundary is not
  negotiated case by case: if a connector needs something the contract does not
  give, the conversation is about the contract, in an issue.
