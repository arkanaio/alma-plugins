# Contributing

Thank you for wanting to add a connector to ALMA. This guide says what is
expected of a contribution and how it is reviewed.

Before writing any code, read the contract:
[ALMA's `docs/CONNECTORS.md`](https://github.com/arkanaio/alma/blob/main/docs/CONNECTORS.md)
is the definition, and [docs/CONTRACT.md](docs/CONTRACT.md) is the orientation
to it. Almost everything rejected in review is code that does not respect the
connector boundary, and that boundary is the only reason external contributions
are viable: reviewing a piece that can only talk to the provider it declares and
return a known shape is a bounded task. Reviewing one that could touch the
database would not be, at any price.

## Before you start

1. **Open a proposal issue** using the "Propose a new connector" template. The
   provider, its capabilities and whether a real customer is waiting are agreed
   there. A connector that arrives with no prior proposal may sit unreviewed.
2. Check that the provider offers a **programmatic way** (an API) to read what
   you want to synchronise. If it does not, this repository is not the path yet:
   that is the browser-automation phase, with different rules and a different
   support level.
3. This repository **does not yet accept connectors contributed from outside**.
   The security review they go through is settled and written down
   ([docs/SECURITY-REVIEW.md](docs/SECURITY-REVIEW.md)); what is not finished is
   the repository around it, in
   [arkanaio/alma#365](https://github.com/arkanaio/alma/issues/365), and the
   contract stays below `1.0.0` while the first connectors of the initial
   catalogue are built. Proposals, questions and fixes are welcome now.

## Language

**Everything in this repository is written in English.** Code, identifiers,
comments, documentation, sample data, commit messages, issue titles and bodies,
pull request descriptions and review replies.

This is not a style preference. This is a public repository whose contributors
and reviewers are not all Spanish speakers, and a connector that can only be
reviewed by someone who reads Spanish is a connector with one possible reviewer.
Identifiers that come from a provider keep the provider's own spelling.

The ALMA product repository is a separate, private codebase with its own
language conventions. They do not apply here, and this one does not apply there.

## License and sign-off

Everything here is under the [Apache License 2.0](LICENSE): the contract, the
connectors written by arkana, and the ones contributed from outside. One license
for the whole repository, with no per-connector exception, because a repository
whose directories carry different terms is one nobody can fork, package or
review without asking a lawyer first.

Apache 2.0 rather than MIT for the reason that matters once a customer's
deployment runs this code: it grants a patent license from every contributor
(section 3), and its section 5 says that what you contribute is licensed under
these same terms unless you state otherwise. That second point is why **there is
no CLA to sign**. The license already says it.

What is asked instead is one line per commit:

```sh
git commit -s
```

That appends `Signed-off-by: Your Name <you@example.com>`, and it means what the
[Developer Certificate of Origin 1.1](https://developercertificate.org/) says:
the code is yours to contribute, or you took it from somewhere whose license
allows it, and you know the commit is public and permanent. It answers the one
question a security review cannot answer by reading the diff — whether the code
was the contributor's to give — and the usual reason it turns out badly is a file
pasted out of a provider's own SDK.

CI checks it on every pull request, in the `dco` job. If you forgot:

```sh
git rebase --signoff <the commit your branch started from>
git push --force-with-lease
```

The name and email in the sign-off have to be the ones you commit with.

The published contract, `@arkanaio/connector-contract`, is under this same
license, and carries its own copy of it in the package. Nothing about ALMA
itself is licensed here: the product is a separate, private codebase, and
consuming an Apache 2.0 package does not change that.

## One connector, one capability set, one package

A connector declares the capabilities it actually implements and nothing more.
If the same provider offers directory **and** licenses, that is normally **two
connectors in two packages**, not one declaring both.

The reason is the incorporation record: it approves `capabilities` and
`allowedHosts` as a single surface, and ALMA refuses to start if the installed
manifest does not match it. A combined connector forces both surfaces to be
approved together and both sets of permissions to be granted at once by the
customer, when only one of them may be wanted. Split, each approval stays the
minimum it needs.

## What a contribution must satisfy

### Structure

Copy `connectors/example/` and rename it after your provider:

```
connectors/<provider>/
├── README.md            # what it syncs, what credential it needs, its limits
├── package.json         # @arkanaio/connector-<provider>, scoped
├── src/
│   ├── manifest.ts      # the card ALMA shows the customer
│   ├── schemas.ts       # the provider's responses
│   ├── connector.ts     # defineConnector({ manifest, readers })
│   └── index.ts         # exports the definition, and nothing else
├── sample-data/         # anonymised real responses from the provider
└── tests/
```

### The manifest

It is validated by `defineConnector`, so an incoherent card fails immediately
rather than during a sync. Two fields deserve special care:

- **`allowedHosts`** is a commitment, not a hint. ALMA builds your `fetch` from
  it and a request anywhere else fails. Declare what you need and nothing more.
- **`authentication`** asks for the least the provider allows. For `oauth2`,
  every scope is justified in the PR; read-only wherever it exists.

`supportLevel` for an external contribution is `community`, and it is shown to
the customer as-is so they know what they have.

### What a connector may never do

- Reach ALMA's database, directly or through anything else.
- Decide which organisation a piece of data belongs to. It is never told.
- Talk to any address outside `allowedHosts`. Use `context.fetch`; never global
  `fetch`, `node:http`, or an SDK that opens its own connections.
- Read environment variables or files, or read the clock directly. `context.now`
  exists so a test can pin it.
- Put a credential anywhere but a request header.
- Write to the provider. A connector reads.

### Data

- **Validate the provider's responses** before their contents reach the rest of
  your connector. ALMA validates the page you return, but that check cannot tell
  a missing field from one the provider renamed. Yours can.
- **Do not invent data.** No value means `null`. An amount with no currency is
  dropped whole rather than assuming the organisation's currency.
- **Do not classify.** You return the account holding a seat. Deciding whether
  it is orphaned is the product's job, because the product knows the people.
- **Page**, and keep the cursor opaque: a position, never data, never a
  credential.
- **Use the right failure kind**: `credentials`, `permissions`, `service` or
  `contract`. A rejected credential is not retried.
- **Never put the provider's response in an error.** `ConnectorError` takes a
  kind and a closed code, and its message is the code. The body may only be in
  `cause`.

### Dependencies

Dependencies are allowed, and each one is reviewed. They are the part of a
contribution carrying the most code nobody here wrote, so bring what you need,
justify it in the PR, and expect questions about anything unusual. No dependency
may run install scripts: pnpm blocks them, and a connector is never allowlisted.

### Last activity

Optional. A license connector without it is valid and accepted the same. If you
declare it, [docs/ACTIVITY.md](docs/ACTIVITY.md) has the rules and they are
reviewed one by one.

### Tests

They run **without reaching any real provider**, against your sample data,
through the real `createConnectorFetch`. See
[docs/SAMPLE-DATA.md](docs/SAMPLE-DATA.md) for the minimum to cover.

### Documentation

Your `README.md` explains what it synchronises, what credential to create at the
provider and with which permissions, which permissions are **not** needed, and
the known limits: quotas, delays, fields the provider does not offer.

## How to submit

1. Fork the repository and work on a branch.
2. Sign off every commit with `git commit -s`. CI checks it, and a pull request
   without it is not reviewed. See [License and sign-off](#license-and-sign-off).
3. Run `pnpm verify` before opening the PR. CI runs the same thing: build,
   Biome, types, tests, and the check over the reviews on record.
4. Fill in the template. The security section is read first.
5. A PR that changes `contract/` or the repository configuration is reviewed
   separately from the connector that motivated it. Split them.

## How it is reviewed and published

Automated tests, then a human security review, then a published version. The
process is [docs/SECURITY-REVIEW.md](docs/SECURITY-REVIEW.md) and the checklist
someone fills in about your code is [reviews/TEMPLATE.md](reviews/TEMPLATE.md).
Read it before you open the pull request: it is not a secret, and nothing in it
is easier to fix after the fact.

Three things about it are worth knowing in advance:

- **A reviewer is never the author.** A connector contributed from outside is
  read by **two** maintainers; one of arkana's own by one maintainer who did not
  write it. Nobody's connector skips this, arkana's included.
- **The review ends in a file**, `reviews/<package>-<version>.md`, merged into
  `main`. That file is what ALMA's incorporation record cites, by a permalink
  pinned to a commit, as the evidence that your version was approved. An
  approval on a pull request is a state; this is a document that still answers
  the question in three years.
- **Every published version has its own review.** A version that only changes
  code inside an already approved surface is reviewed against what changed.
  Moving `capabilities`, `allowedHosts`, a permission asked of the customer, a
  dependency or the `activity` declaration means the whole checklist again.

The review may ask for changes that are not functional defects: fewer
dependencies, narrower hosts, a field removed from an error. That is not
distrust of the contributor; it is that the cost of getting this wrong is paid
by a customer who never saw the pull request.

See [docs/PUBLISHING.md](docs/PUBLISHING.md) for what happens after.

## Contract changes

Breaking changes to `@arkanaio/connector-contract` are announced here before they
are applied, with the date and what has to change in an existing connector.

- **0.1.1** — first version on public npm, and the first carrying its licence.
  No change to the contract itself: install it with
  `pnpm add @arkanaio/connector-contract`, with no token and no registry
  configuration.
- **0.1.0** — first published version, extracted from ALMA's `src/lib/connectors`
  so that both sides compile against the same definition. The contract stays
  below 1.0.0 while the first connectors of the initial catalogue are built.

## Security

If you find a security problem, **do not open an issue**. Follow
[SECURITY.md](SECURITY.md).
