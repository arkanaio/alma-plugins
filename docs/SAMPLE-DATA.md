# Testing a connector without reaching a provider

No test in this repository talks to a real provider. Not on your machine and not in CI. A connector is tested against **sample data** that ships with it.

This is not a convenience: it is what lets anyone review, reproduce, and maintain a connector without holding an account at the provider, and what lets CI pass without custodying third-party credentials.

## Where it lives

In `connectors/<provider>/sample-data/`, one JSON file per provider resource. Each file maps a cursor to a response, so pagination can be walked end to end:

```json
{
  "": { "subscriptions": [ ... ], "next_cursor": "page-2" },
  "page-2": { "subscriptions": [ ... ], "next_cursor": null }
}
```

The `""` key is the first page.

## What it has to look like

- **Real responses, anonymised.** Copy them from the provider and replace emails, names, account identifiers, and workspace identifiers. Use the `example.test` domain, which is not resolvable.
- **No secrets at all.** No tokens, no keys, no authorization headers, no internal customer identifiers. When in doubt, take it out.
- **With the awkward cases in it.** Sample data where every field is filled in proves nothing. Include at least: a missing optional field, an amount with no currency, a suspended or invited account, a seat with no activity, and more than one page.
- **No real people's data.** Not yours either.

## The test host

`connectors/example/tests/host.ts` does what ALMA will do when it runs the connector: it serves the sample data, **rejects any domain not in the manifest**, and keeps the requests and traces visible so they can be asserted on.

Copy it into your connector and adapt it to your provider's resources. Do not simplify it by removing the domain check: that check is half a security review, done by a machine.

## What to cover at a minimum

One test for each of these, and `connectors/example/tests/connector.test.ts` has an example of all of them:

| Case | Why |
|---|---|
| The manifest is valid | It is reviewed before the code is |
| Manifest fields match the configuration schema | A field declared and not validated is a hole |
| Pagination is walked end to end | A connector that stops at page one loses data silently |
| A value the provider does not give | Proves it returns `null` and not an invention |
| A rejected credential | Has to be not retryable |
| A temporary provider failure | Has to be retryable |
| A differently shaped response | Has to fail, not produce wrong data |
| Only the declared domains are contacted | The manifest's commitment, verified |
| The trace leaks no personal data | The easiest thing to slip past a review |

## Running it

```sh
pnpm verify   # everything: Biome, types, and tests
pnpm test     # just the tests
```

CI runs exactly that, with no network and no credentials.

## What about testing against the real provider

That does not belong in this repository. If you need to check your connector against the real provider, do it in your own environment with your own credentials, and describe the result in the PR. Never commit a credential, not even a test one, not even an expired one.
