# alma-plugins conventions

The official repository of provider connectors for ALMA, and the home of the
contract they are written against. Read [CONTRIBUTING.md](CONTRIBUTING.md) and
[docs/CONTRACT.md](docs/CONTRACT.md) before changing anything; they own the
connector rules and this file owns the working protocol.

## Language: English, everywhere, no exceptions

**Everything in this repository is written in English.** Code, identifiers, file
and directory names, comments, documentation, sample data, commit messages,
branch names, issue titles and bodies, pull request descriptions, review replies
and handoff notes.

The reason is that this repository is public and its contributors and reviewers
are not all Spanish speakers. A connector only a Spanish reader can review is a
connector with one possible reviewer, and the security review is the step that
cannot be skipped.

The only text that keeps another language is an identifier that comes from a
provider: those keep the provider's own spelling.

`arkanaio/alma`, the product repository, is private and keeps its own Spanish
conventions. Those do not apply here, and this rule does not apply there. Do not
"fix" one repository to match the other.

## The contract is defined once

The connector definition lives in ALMA's `docs/CONNECTORS.md` and in its
`src/lib/connectors/`. This repository **publishes** the half a connector author
needs, as `@arkanaio/connector-contract`, and ALMA consumes that package.

Never re-explain the contract in this repository's documentation. `docs/CONTRACT.md`
orients and links; it does not define. Two documents describing one contract
drift apart, and this repository has already been through that once.

What belongs in the package: the manifest and its schema, the page shape of each
capability, `ConnectorError`, `createConnectorFetch` and `defineConnector`. What
stays in ALMA: the labels a customer reads, the schemas whose messages the
customer reads, the page readers, the registry and the incorporation record.
When in doubt: what an author needs to declare and return is published; what
decides, persists or displays is not.

A breaking change to the package is announced in `CONTRIBUTING.md` under
"Contract changes" before it is applied, and it never travels in a PR that also
changes a connector.

## Runtime and tooling

- Node 24 and pnpm 11. The exact pnpm version is pinned in `package.json`.
- Biome is the only formatter and linter. Do not add ESLint or Prettier.
- TypeScript stays strict. Do not bypass errors with `any`, `@ts-ignore`, or
  unchecked external data.
- Tests use the Node test runner. Do not add a test framework.
- Packages may have runtime dependencies, and each one is reviewed. No package
  may run install scripts.

## The connector boundary

A connector receives `configuration`, `secrets`, a host-restricted `fetch` and
`now`. Nothing else. No database, no organisation, no global `fetch`, no disk, no
environment variables. This boundary is the whole reason external contributions
are acceptable; do not widen it to make a connector easier to write. If a
connector needs something the contract does not give, that is a conversation
about the contract, in an issue.

Once a connector is installed in ALMA as a package, ALMA's lint rule no longer
reaches it. What still holds is that the context gives it nothing — and the
security review. That is why `docs/SECURITY-REVIEW.md` is load-bearing and not
paperwork.

The checks a review makes live once, in `reviews/TEMPLATE.md`, which is also the
file a review fills in. `docs/SECURITY-REVIEW.md` owns the process around it and
does not restate the list. Never copy the checklist into a second document: two
copies of one list is the same failure as two documents describing one contract.

## Tests never reach a real provider

Every test runs against the connector's own sample data, through the real
`createConnectorFetch` built from that connector's `allowedHosts`. Never replace
it with a hand-written stub: the point is that the tests exercise the same
boundary the deployment does. CI holds no provider credential and must not hold
one. Never commit a credential, a token, or real people's data.

## Publishing

Publishing is manual, by workflow dispatch, and only after a review. A review
ends in a file in `reviews/`, and the workflow refuses to publish a version that
has none. A package name is always scoped `@arkanaio/...`: an unscoped name is
what lets a typo install somebody else's package, and ALMA's incorporation
record rejects it.

## Before handing off

Run `pnpm verify` (build, Biome, types, tests and the reviews on record). Check that a contributor
following `CONTRIBUTING.md` after your change would not be wrong, stuck, or
unaware of something they can now do; if they would, update the guide in the
same PR.
