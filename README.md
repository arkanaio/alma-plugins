# alma-plugins

The official repository of provider connectors for
[ALMA](https://github.com/arkanaio/alma), and the home of the contract they are
written against.

A **connector** knows how to talk to one specific provider and knows nothing
else. It receives a validated configuration and a credential, queries the
provider, and returns data in an agreed shape. It does not know about
organisations, it has no access to ALMA's database, and it never decides who a
piece of data belongs to.

In this repository, "connector" and "plugin" mean the same thing. The repository
name keeps "plugin" for continuity with the product documentation.

## Status

Phase C of the
[ALMA roadmap](https://github.com/arkanaio/alma/blob/main/docs/ROADMAP.md), in
progress. The contract is published at `0.1.1` and stays below `1.0.0` while the
first connectors of the initial catalogue are built. Until then, every merge to
`main` publishes the versions it bumps, and the per-version security review is
waived ([docs/SECURITY-REVIEW.md](docs/SECURITY-REVIEW.md#before-100)).

This repository **does not yet accept external contributions of new
connectors**. The security review they go through is settled and written down;
what is not finished is the repository around it
([arkanaio/alma#365](https://github.com/arkanaio/alma/issues/365)). It does
accept fixes, questions and provider proposals through an issue.

## Deferred connectors

The ChatGPT license connector was withdrawn on September 23, 2026. API access
could not be validated with the target Team/Business workspace. It will be
reconsidered when an API suitable for the required license data is available
and can be validated against a real workspace. Existing published npm versions
are not removed by this repository change.

## What is here

| Path | What it is |
|---|---|
| `contract/` | `@arkanaio/connector-contract`, the published definition both sides compile against. |
| `connectors/example/` | The reference connector, runnable against sample data. The template to copy. |
| `docs/CONTRACT.md` | Orientation to the contract, and which half lives where. |
| `docs/ACTIVITY.md` | The optional last-activity capability and its rules. |
| `docs/SAMPLE-DATA.md` | How a connector is tested without reaching a real provider. |
| `docs/SECURITY-REVIEW.md` | The security review every version goes through: who does it, and when it is passed. |
| `docs/PUBLISHING.md` | How a version reaches a deployment. |
| `reviews/` | One file per reviewed version, and the checklist it was signed against. |

The contract is **defined** in ALMA's
[`docs/CONNECTORS.md`](https://github.com/arkanaio/alma/blob/main/docs/CONNECTORS.md)
and published from here. It is not explained twice: two documents describing one
contract drift apart, and this one has already proved it.

## Getting started

You need Node 24 and pnpm 11.

```sh
pnpm install
pnpm verify   # build, Biome check, types, tests and the reviews on record
```

`pnpm verify` makes no network requests: every test runs against each
connector's sample data, through the same host-restricted fetch the deployment
uses.

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md). Every contribution goes through
automated tests, and from `1.0.0` on a human security review, before it is
published.

## Language

**Everything in this repository is written in English**: code, identifiers,
comments, documentation, commit messages, issues and pull requests. This is a
public repository and its contributors are not all Spanish speakers. See
[CONTRIBUTING.md](CONTRIBUTING.md#language).

## How a connector gets installed

It does not. An ALMA customer organisation configures its credentials and
enables a connector from the product; it never uploads or runs code of its own.
A deployment installs one exact, reviewed version as a package and records which
review approved it. See [docs/PUBLISHING.md](docs/PUBLISHING.md).

## Security

To report a security problem, read [SECURITY.md](SECURITY.md). Do not open a
public issue.

## License

[Apache License 2.0](LICENSE), for the whole repository: the contract, arkana's
own connectors, and the ones contributed from outside. A contribution is made
under that same license and certified with a sign-off per commit, checked in CI.
There is no CLA. See
[CONTRIBUTING.md](CONTRIBUTING.md#license-and-sign-off).
