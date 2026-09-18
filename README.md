# alma-plugins

The official repository of provider connectors for [ALMA](https://github.com/arkanaio/alma).

A **connector** is a piece that knows how to talk to one specific provider and knows nothing else. It receives a validated configuration and a credential, queries the provider, and returns the data in an agreed shape. It does not know about organisations, it has no access to ALMA's database, and it never decides who a piece of data belongs to.

In this repository, "connector" and "plugin" mean the same thing. The repository name keeps "plugin" for continuity with the product documentation; everything else says "connector".

## Status

Phase C of the [ALMA roadmap](https://github.com/arkanaio/alma/blob/main/docs/ROADMAP.md), in progress. The contract in `contract/` is **provisional**: the shared definition is settled in [arkanaio/alma#364](https://github.com/arkanaio/alma/issues/364) and the security review process in [arkanaio/alma#366](https://github.com/arkanaio/alma/issues/366). A breaking change to the contract is announced in [CONTRIBUTING.md](CONTRIBUTING.md) before it is applied.

Until those two close, this repository **does not yet accept external contributions of new connectors**. It does accept fixes, questions, and provider proposals through an issue.

## What is here

| Path | What it is |
|---|---|
| `contract/` | The types and schemas that define what a connector is and what it returns. |
| `connectors/example/` | The reference connector, runnable against sample data. It is the template to copy. |
| `docs/CONTRACT.md` | The contract explained: capabilities, data, and boundaries. |
| `docs/ACTIVITY.md` | The optional last-activity capability and its rules. |
| `docs/SAMPLE-DATA.md` | How a connector is tested without reaching a real provider. |
| `docs/SECURITY-REVIEW.md` | The checklist every contribution goes through. |
| `docs/PUBLISHING.md` | How a connector gets from this repository into production. |

## Getting started

You need Node 24 and pnpm 11.

```sh
pnpm install
pnpm verify   # Biome check, types, and tests
```

`pnpm verify` makes no network requests: every test runs against each connector's sample data.

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md). Every contribution goes through automated tests and a human security review before it is published.

## Language

**Everything in this repository is written in English**: code, identifiers, comments, documentation, commit messages, issues, and pull requests. This is a public repository and its contributors are not all Spanish speakers. See [CONTRIBUTING.md](CONTRIBUTING.md#language).

## How a connector gets installed

It does not. An ALMA customer organisation configures its credentials and enables the connector from the product; it never uploads or runs code of its own. ALMA takes one specific, reviewed version of each connector into its deployment. See [docs/PUBLISHING.md](docs/PUBLISHING.md).

## Security

To report a security problem, read [SECURITY.md](SECURITY.md). Do not open a public issue.
