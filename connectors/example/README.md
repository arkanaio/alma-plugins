# Example connector

The repository's reference connector. **It talks to no real provider**:
`api.example.invalid` does not exist and the `.invalid` domain is unresolvable
by design. It exists so the contribution guide has a runnable example, and so
copying it is the first step of a new connector.

It implements the `licenses` capability and declares the optional last-activity
capability, so both shapes are visible.

Note its id: `example_licenses`. A directory connector for the same provider
would be a **separate** connector in a separate package, because the
incorporation record approves capabilities and hosts as one surface and there is
no reason to have both approved when only one is wanted.

## What it synchronises

| Returned | What it carries |
|---|---|
| `plans` | Product, total seats, seat price, currency and billing cycle |
| `seats` | The account holding each seat and, if the provider gives it, its last activity |

It writes nothing to the provider.

## What credential it would ask for

An API token with **read-only** access to the workspace's subscriptions and
members. No write permission, no user administration, no billing access.

## Known limits

- Activity has daily granularity and up to 24 hours of delay.
- Activity does not tell real usage apart from sessions opened by integrations.
- An invited account that never signed in has no activity: `null` is returned,
  which ALMA reports as unavailable and never as inactivity.
- A seat price can arrive with no currency; it is then dropped whole rather than
  assuming one.

## Copying it

```sh
cp -R connectors/example connectors/<provider>
```

Then: rename the package to `@arkanaio/connector-<provider>`, change `id`,
`name`, `description`, `documentationUrl`, `allowedHosts` and `authentication`
in `src/manifest.ts`, replace `src/schemas.ts` with the real provider's
responses, and replace the sample data with anonymised real ones.

Read [CONTRIBUTING.md](../../CONTRIBUTING.md) before opening the PR.

## Testing

```sh
pnpm verify
```
