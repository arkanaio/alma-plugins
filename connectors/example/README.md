# Example connector

The repository's reference connector. **It talks to no real provider**: `api.example.test` does not exist and the `.test` domain is unresolvable by design. It exists so the contribution guide has a runnable example, and so copying it is the first step of a new connector.

It implements the `licenses` capability and declares the optional last-activity capability, so both shapes are visible.

## What it synchronises

| Read | What it returns |
|---|---|
| `listContracts` | Product, plan, total seats, seat price, billing cycle, and renewal |
| `listSeats` | Accounts occupying a seat, with their status and, if the provider gives it, their last activity |

It writes nothing to the provider.

## What credential it would ask for

An API token with **read-only** access to the workspace's subscriptions and members. No write permission is needed, no user administration, and no billing access.

## Known limits

- Activity has daily granularity and up to 24 hours of delay.
- Activity does not tell real usage apart from sessions opened by integrations.
- An invited account that never signed in has no activity: absence of information is returned, not inactivity.
- The seat price can arrive with no currency; in that case it is dropped whole rather than assuming one.

## Copying it

```sh
cp -R connectors/example connectors/<provider>
```

Then: rename the package in `package.json`, change `id`, `name`, `description`, `documentation`, and `domains` in `src/manifest.ts`, replace the schemas in `src/schemas.ts` with the real provider's, and replace the sample data with anonymised real responses.

Read [CONTRIBUTING.md](../../CONTRIBUTING.md) before opening the PR.

## Testing

```sh
pnpm verify
```
