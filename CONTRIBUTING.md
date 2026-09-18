# Contributing

Thank you for wanting to add a connector to ALMA. This guide says what is expected of a contribution and how it is reviewed.

Before writing any code, read [docs/CONTRACT.md](docs/CONTRACT.md). Almost everything rejected in review is code that does not respect the connector boundary, and that boundary is the only reason external contributions are viable at all: reviewing a piece that can only talk to the provider it declares and return a known shape is a bounded task; reviewing a piece that could touch the database would not be, at any price.

## Before you start

1. **Open a proposal issue** using the "Propose a new connector" template. The provider, its capabilities, and whether a real customer is waiting for it are agreed there. A connector that arrives with no prior proposal may sit unreviewed for a long time.
2. Check that the provider offers a **programmatic way** (an API) to read what you want to synchronise. If it does not, this repository is not the path yet: that is the browser-automation connector phase, which has different rules and a different support level.
3. While [arkanaio/alma#364](https://github.com/arkanaio/alma/issues/364) and [arkanaio/alma#366](https://github.com/arkanaio/alma/issues/366) are open, the contract can change. Breaking changes are announced here, under "Contract changes", before they are applied.

## Language

**Everything in this repository is written in English.** Code, identifiers, comments, documentation, sample data, commit messages, issue titles and bodies, pull request descriptions, and review replies.

This is not a style preference. This is a public repository whose contributors and reviewers are not all Spanish speakers, and a connector that can only be reviewed by someone who reads Spanish is a connector with one possible reviewer. Identifiers that come from the provider keep the provider's own spelling, in whatever language the provider uses.

The ALMA product repository is a separate, private codebase and keeps its own language conventions. They do not apply here, and this one does not apply there.

## What a contribution must satisfy

A connector is accepted when it meets **all** of the following.

### Structure

Copy `connectors/example/` and rename it after your provider's identifier:

```
connectors/<provider>/
├── README.md              # what it syncs, what credential it needs, its limits
├── package.json
├── src/
│   ├── manifest.ts        # the card ALMA shows the customer
│   ├── schemas.ts         # configuration and provider responses, in Zod
│   └── connector.ts       # the implementation
├── sample-data/           # anonymised real responses from the provider
└── tests/
```

### The manifest

Declare the name, description, documentation link, capabilities (`directory`, `devices`, `licenses`), support level, the domains it talks to, what the organisation needs in order to configure it, and whether it exposes a seat price. The support level of an external contribution is `community`, and it is shown to the customer as-is so they know what they have.

`domains` is a commitment: the host rejects any request to a machine that is not on that list. Declare the ones you actually need and no others.

### What a connector may never do

- Reach ALMA's database, directly or through anything else.
- Decide which organisation a piece of data belongs to. It always receives that context already resolved.
- Talk to any address other than the provider it declares to serve. Use `context.request`; do not use global `fetch`, `node:http`, or an SDK that opens its own connections.
- Read environment variables, files on disk, or the system clock to make a business decision.
- See another integration's credential, return its own to the customer, or write it into a trace.
- Write to the provider. A connector reads. It creates nothing, changes nothing, and deletes nothing in the provider's system.
- Add dependencies without justifying them. Every new dependency is surface that has to be reviewed, and it will be asked about in review.

### Data

- **Validate every provider response with Zod** before its contents reach any other part of the connector. A response that changes shape has to fail there, not produce wrong data further down.
- **Do not invent data.** If the provider gives no value, return `null`. An amount with no currency is dropped whole rather than assuming the organisation's currency.
- **Do not classify.** The connector hands over accounts as-is; deciding whether a seat is orphaned is ALMA's job, because ALMA is the one that knows the employees.
- **Page.** Never load the whole catalogue into memory.
- **Tell errors apart.** A credential the provider rejected is not retried and leaves the connection in "reauthentication required"; a 429 or a 5xx is retryable.
- **Traces count, they do not describe.** `context.log` is for numbers and states. Never emails, names, personal identifiers, credentials, or activity values.

### Last activity

This is an **optional** capability. A license connector that synchronises contracts and seats without offering activity is perfectly valid and is accepted just the same.

If you declare it, you have to document what the provider measures and where it stops measuring, and respect specific rules about the value. They are in [docs/ACTIVITY.md](docs/ACTIVITY.md) and they are reviewed one by one. In short: a sync date, an assignment date, or a generic sign-in to the account are **not** usage of a license and cannot stand in for it; with no value you return absence of information, never inferred inactivity.

### Tests

A connector's tests run **without reaching any real provider**, against the connector's own sample data. See [docs/SAMPLE-DATA.md](docs/SAMPLE-DATA.md).

At a minimum, cover: that the manifest is valid and consistent with the configuration schema, the full walk through pagination, a value the provider does not give, a rejected credential, a temporary provider failure, a differently shaped response, that only the declared domains are contacted, and that the trace leaks no personal data. `connectors/example/tests/connector.test.ts` has one of each.

### Documentation

The connector's `README.md` explains, plainly: what it synchronises, what credential has to be created at the provider and with which permissions, which permissions are **not** needed, and its known limits (quotas, delays, fields the provider does not offer).

## How to submit

1. Fork the repository and work on a branch.
2. Run `pnpm verify` before opening the PR. CI runs exactly the same thing.
3. Open the PR and fill in the template. The security section is not a formality: it is the first thing that gets read.
4. A PR that changes `contract/` or the repository configuration is reviewed separately from the connector that motivated it. Split them.

## How it is reviewed

Every contribution goes through, in this order:

1. **Automated tests** in CI against the sample data.
2. **A human security review**, using the checklist in [docs/SECURITY-REVIEW.md](docs/SECURITY-REVIEW.md). It is mandatory and no connector is published without it, arkana's own included.
3. **A published version**, which is the one ALMA takes into its deployment. See [docs/PUBLISHING.md](docs/PUBLISHING.md).

The security review may ask for changes that are not functional defects: fewer dependencies, narrower domains, a field removed from a trace. That is not distrust of the contributor; it is that the cost of getting this wrong is paid by a customer.

## Contract changes

Breaking changes to `contract/` are announced here before they are applied, with the date and what has to change in an existing connector.

- No changes yet. The initial contract is provisional until [arkanaio/alma#364](https://github.com/arkanaio/alma/issues/364) closes.

## Security

If you find a security problem, **do not open an issue**. Follow [SECURITY.md](SECURITY.md).
