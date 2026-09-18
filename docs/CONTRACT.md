# The connector contract

The contract is not described twice. It is defined once, in ALMA's
[`docs/CONNECTORS.md`](https://github.com/arkanaio/alma/blob/main/docs/CONNECTORS.md),
and shipped as the `@arkanaio/connector-contract` package you compile against.
This page is only the orientation you need before reading it, and the map of
which half lives where.

Read the definition first. Everything below assumes it.

## Install it

```sh
pnpm add @arkanaio/connector-contract
```

A connector package exports one `ConnectorDefinition`, built with
`defineConnector({ manifest, readers })`. That call validates the manifest and
checks that every declared capability has a reader and every reader has a
declared capability, so an incoherent card fails at definition rather than one
night in the middle of a sync.

## Which half is which

| In the package | In ALMA |
|---|---|
| The manifest and its schema | The labels a customer reads |
| The page shape of each capability | The page readers that call yours |
| `ConnectorError` and its four kinds | The registry and the incorporation record |
| `createConnectorFetch`, the restricted fetch | The schemas that validate what an organisation configured |
| `defineConnector` | Everything that touches a tenant, the database or the queue |

The split follows one rule: what a connector author needs in order to declare
and return is published; what decides, persists or displays stays in the
product. `createConnectorFetch` is published even though ALMA is the one that
builds your context, because your tests need the real boundary and not a copy
of it that can drift away from it.

## What you write

```ts
import { defineConnector } from "@arkanaio/connector-contract";

export const connector = defineConnector({
  manifest,
  readers: {
    licenses: async ({ context, cursor }) => {
      const response = await context.fetch(url, { headers });
      return { cursor: next, plans, seats };
    },
  },
});
```

`context` carries four things and nothing else: `configuration`, `secrets`,
`fetch` and `now`. There is no organisation, no transaction, no queue and no
logger. You cannot decide who a piece of data belongs to because you are never
told, and you cannot reach the database because you are never given anything to
reach it with.

`connectors/example/` is all of this, runnable, with its sample data.

## The three things people get wrong

**Declaring hosts you do not need.** `allowedHosts` is not a hint. ALMA builds
your `fetch` from it, a request anywhere else fails, and the incorporation
record approves that exact list. A shortener, an analytics domain or a personal
domain in that list is grounds for rejection.

**Classifying.** You return the account that holds a seat. You do not say which
employee it is —you cannot know— and you do not decide whether the seat is
orphaned. That reconciliation is the product's, because the product is the one
that knows the people.

**Putting the provider's answer in the error.** A license provider's response
body carries emails, names and sometimes the credential. `ConnectorError` takes
a kind and a closed code, and its message *is* the code. The original response
can stay in `cause` for local debugging; nothing writes it out.

## See also

- [ACTIVITY.md](ACTIVITY.md) — the optional last-activity capability.
- [SAMPLE-DATA.md](SAMPLE-DATA.md) — testing without a real provider.
- [PUBLISHING.md](PUBLISHING.md) — how a version reaches a deployment.
