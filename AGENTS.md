# alma-plugins conventions

The official repository of provider connectors for ALMA. Read [CONTRIBUTING.md](CONTRIBUTING.md) and [docs/CONTRACT.md](docs/CONTRACT.md) before changing anything; they own the connector rules and this file owns the working protocol.

## Language: English, everywhere, no exceptions

**Everything in this repository is written in English.** Code, identifiers, file and directory names, comments, documentation, sample data, commit messages, branch names, issue titles and bodies, pull request descriptions, review replies, and handoff notes.

The reason is that this repository is public and its contributors and reviewers are not all Spanish speakers. A connector that only a Spanish reader can review is a connector with one possible reviewer, and the security review is the step that cannot be skipped.

The only text that keeps another language is an identifier that comes from a provider: those keep the provider's own spelling.

`arkanaio/alma`, the product repository, is private and keeps its own Spanish conventions. Those do not apply here, and this rule does not apply there. Do not "fix" one repository to match the other.

## Runtime and tooling

- Node 24 and pnpm 11. The exact pnpm version is pinned in `package.json`.
- Biome is the only formatter and linter. Do not add ESLint or Prettier.
- TypeScript stays strict. Do not bypass errors with `any`, `@ts-ignore`, or unchecked external data.
- Tests use the Node test runner. Do not add a test framework.

## Repository layout

- `contract/` — the connector contract. Provisional until [arkanaio/alma#364](https://github.com/arkanaio/alma/issues/364) closes. A breaking change here is announced in `CONTRIBUTING.md` before it is applied, and it is never mixed into a PR that also changes a connector.
- `connectors/<provider>/` — one directory per provider, with its manifest, schemas, implementation, sample data, tests, and README.
- `docs/` — the contract, the activity capability, sample-data testing, the security review, and publishing.

## The connector boundary

A connector receives a validated configuration, a credential, and a restricted request function, and returns data. Nothing else. No database, no organisation, no global `fetch`, no disk, no environment variables. This boundary is the whole reason external contributions are acceptable; do not widen it to make a connector easier to write. If a connector needs something the contract does not give, that is a conversation about the contract, in an issue.

## Tests never reach a real provider

Every test runs against the connector's own sample data, through the test host in `connectors/example/tests/host.ts`, which enforces the declared domains. CI holds no provider credential and must not hold one. Never commit a credential, a token, or real people's data, sample data included.

## Before handing off

Run `pnpm verify` (Biome, types, and tests). Check that a contributor following `CONTRIBUTING.md` after your change would not be wrong, stuck, or unaware of something they can now do; if they would, update the guide in the same PR.
