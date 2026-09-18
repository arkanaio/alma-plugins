# Testing a connector without reaching a provider

No test in this repository talks to a real provider. Not on your machine and not
in CI. A connector is tested against **sample data** that ships with it.

This is not a convenience: it is what lets anyone review, reproduce and maintain
a connector without holding an account at the provider, and what lets CI pass
without custodying third-party credentials.

## Where it lives

In `connectors/<provider>/sample-data/`, JSON files holding the provider's
responses, keyed by cursor so pagination can be walked end to end:

```json
{
  "": { "members": [ ... ], "next_cursor": "page_2" },
  "page_2": { "members": [ ... ], "next_cursor": null }
}
```

The `""` key is the first page.

## What it has to look like

- **Real responses, anonymised.** Copy them from the provider and replace
  emails, names, account identifiers and workspace identifiers. Use the
  `example.invalid` domain, which cannot resolve.
- **No secrets at all.** No tokens, no keys, no authorization headers, no
  internal customer identifiers. When in doubt, take it out.
- **With the awkward cases in it.** Sample data where every field is filled in
  proves nothing. Include at least: a missing optional field, an amount with no
  currency, a suspended or invited account, a seat with no activity, and more
  than one page.
- **No real people's data.** Not yours either.

## The test host

`connectors/example/tests/host.ts` builds the context ALMA would build. The
important part is that its `fetch` is the **real** `createConnectorFetch` from
the contract package, constructed from your own `allowedHosts`:

```ts
fetch: createConnectorFetch({
  allowedHosts: manifest.allowedHosts,
  fetch: async (url, init) => { /* serve sample-data */ },
}),
```

Copy it and adapt the part that serves your provider's resources. **Do not
replace the fetch with a stub of your own.** The point is that your tests
exercise the same boundary the deployment will, so a request to an undeclared
host fails in your tests exactly as it would in production. A hand-written
substitute drifts from it, and the drift is invisible until it matters.

Pin `now` too, so any test that involves a date is deterministic.

## What to cover at a minimum

`connectors/example/tests/connector.test.ts` has one of each:

| Case | Why |
|---|---|
| The manifest satisfies the contract | It is reviewed before the code is |
| Every returned page satisfies the agreed shape | ALMA rejects one that does not, at run time |
| Pagination is walked end to end | A connector that stops at page one loses data silently |
| A value the provider does not give | Proves it returns `null` and not an invention |
| A rejected credential | `credentials`, not retryable |
| A missing permission | `permissions`, so the customer knows what to grant |
| A temporary provider failure | `service`, retryable |
| A differently shaped response | `contract`, and no wrong data |
| Only the declared hosts are contacted | The manifest's commitment, verified |
| The credential travels in a header | Never in the address |
| The failure carries no response body | The easiest leak to miss in a review |

## Running it

```sh
pnpm verify   # build, Biome, types and tests
pnpm test     # just the tests
```

CI runs exactly that, with no network and no credentials.

## What about testing against the real provider

That does not belong in this repository. If you need to check your connector
against the real provider, do it in your own environment with your own
credentials, and describe the result in the PR. Never commit a credential, not
even a test one, not even an expired one.
