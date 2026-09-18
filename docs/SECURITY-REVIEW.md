# Security review of a contribution

> **Provisional.** The final process is settled in [arkanaio/alma#366](https://github.com/arkanaio/alma/issues/366). This checklist is what applies in the meantime.

No contribution is published without passing this review. **Not arkana's own either.** The automated tests are a pre-filter, not a substitute: they check that the connector does what it says, not that it does nothing else.

The review is done by someone with write access to the repository, other than the contributor. The result is written on the PR, with this checklist filled in.

## Before reading the code

- [ ] An accepted proposal issue exists for this provider.
- [ ] The PR brings **one connector** and does not touch `contract/`, the repository configuration, or another connector. If it does, split it.
- [ ] The manifest is valid and its `support` level is the right one (`community` for an external contribution).
- [ ] `domains` contains only the machines the provider needs, and they belong to the provider. A URL shortener, an analytics domain, a third-party CDN, or a personal domain is grounds for rejection.
- [ ] The `configuration` fields ask for nothing the connector does not use.
- [ ] CI is green.

## The boundary

- [ ] There is no import of a database, an ORM, a custom HTTP client, `node:http`, `node:https`, `node:net`, `node:child_process`, `node:fs`, or `node:worker_threads`.
- [ ] Every outbound call goes through `context.request`. There is no global `fetch`, and no provider SDK opening its own connections.
- [ ] No environment variables and no files on disk are read.
- [ ] There is no `eval`, no `new Function`, no dynamic import with a computed path, and no deserialisation of code.
- [ ] The connector does not write to the provider: no POST, PUT, PATCH, or DELETE, unless the provider requires POST for a **query**, in which case it is justified in the PR.
- [ ] The connector neither receives nor derives any organisation. There is no ALMA organisation identifier anywhere in its code.

## Credentials

- [ ] The credential is used only to authenticate against the declared domains.
- [ ] The credential appears in no trace, no error message, no URL, and no returned object.
- [ ] Error messages do not include the provider's raw response body, which can carry data or headers.
- [ ] There is no credential, token, or key in the repository, including in the sample data and in the branch history.

## Data

- [ ] Every provider response is validated with Zod before being used.
- [ ] No missing value is filled in with an assumption. An amount with no currency is dropped whole.
- [ ] The connector does not classify seats or decide whether an account is orphaned.
- [ ] Reads are paged and do not accumulate the whole catalogue in memory.
- [ ] Errors tell retryable from not retryable, and a rejected credential is not retried.
- [ ] Traces contain no emails, names, personal identifiers, or activity values.

## Last activity, if declared

Apply the full checklist in [ACTIVITY.md](ACTIVITY.md). In short:

- [ ] `measures` and `limitations` describe the provider's real field.
- [ ] No sync date, assignment date, or generic sign-in stands in for usage.
- [ ] With no value, `null` is returned.
- [ ] `readAt` is stamped at the read and not copied from the provider's date.
- [ ] The value is not persisted, not cached, and not logged.

## Dependencies

- [ ] Every new dependency is justified in the PR and there is no reasonable way to avoid it.
- [ ] No new dependency runs install scripts.
- [ ] No new dependency has a name close to that of a well-known package.
- [ ] The PR's `pnpm-lock.yaml` follows from the PR's `package.json` and brings no unrelated changes.

## Sample data

- [ ] It is anonymised: no email, name, or identifier of a real person or customer.
- [ ] It contains no secrets.
- [ ] It includes the awkward cases: a missing value, a suspended or invited account, more than one page.

## Documentation

- [ ] The connector's `README.md` says what credential to create, with which permissions, and which ones are **not** needed.
- [ ] Known limits are documented: quotas, delays, fields the provider does not offer.

## Outcome

The review ends in one of three ways:

- **Accepted.** A version is published and ALMA adopts it. See [PUBLISHING.md](PUBLISHING.md).
- **Changes requested.** With the list of points that do not pass.
- **Rejected.** With the reason. A rejection over the connector boundary is not negotiated case by case: if a connector needs something the contract does not give, the conversation is about the contract, in an issue.
