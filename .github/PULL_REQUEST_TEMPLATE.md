<!-- Write this PR in English, like everything else in this repository. See CONTRIBUTING.md#language. -->

## What this PR adds

<!-- Which connector, which provider, and which capabilities. Link the proposal issue. -->

## Security

<!-- This section is the first thing read in review. Answer all of it. -->

- Domains declared in the manifest, and why each one is needed:
- Credential it asks the customer for, and the minimum permissions:
- New dependencies, if any, and why they cannot be avoided:
- I confirm the connector reaches no database, disk, environment variable, or network outside `context.request`: <!-- yes / no -->
- I confirm no trace contains credentials, emails, names, or activity values: <!-- yes / no -->
- I confirm the sample data is anonymised and contains no secrets: <!-- yes / no -->

## Last activity

<!-- If the connector does not declare it, write "Not declared" and move on. -->

- The provider field it comes from, with a link to its documentation:
- What it measures exactly, and what it does not measure:
- I confirm I do not substitute usage with the sync date, the assignment date, or a generic sign-in: <!-- yes / no -->
- I confirm that with no value absence of information is returned, and that the value is neither persisted nor logged: <!-- yes / no -->

## Validation performed

<!-- The result of `pnpm verify`. If you tested against the real provider in your own environment, say so here: what you checked and what came back. Never commit credentials. -->

## Documentation

<!-- What you added to the connector's README: credential and permissions, permissions that are NOT needed, known limits. -->
