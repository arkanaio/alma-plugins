<!-- Write this PR in English, like everything else here. See CONTRIBUTING.md#language. -->

## What this PR adds

<!-- Which connector, which provider, which capabilities. Link the proposal issue. -->

## Approved surface

<!-- This is what goes into ALMA's incorporation record, so state it exactly. -->

- `capabilities`:
- `allowedHosts`, and why each one is needed:
- `authentication`, and the minimum permissions it asks the customer for:

## Security

<!-- Read first in review. Answer all of it. -->

- New dependencies, if any, and why they cannot be avoided:
- I confirm every outbound call goes through `context.fetch`, and the connector
  reads no environment variables, no files and no clock other than
  `context.now`: <!-- yes / no -->
- I confirm the credential only ever travels in a request header, and appears in
  no error, returned value or cursor: <!-- yes / no -->
- I confirm no `ConnectorError` carries the provider's response in its code or
  message: <!-- yes / no -->
- I confirm the sample data is anonymised and contains no secrets: <!-- yes / no -->
- I confirm every commit is signed off (`git commit -s`) and that this code is
  mine to contribute under the Apache 2.0 license of this repository, including
  any code I took from elsewhere: <!-- yes / no -->

## Last activity

<!-- If the connector does not declare it, write "Not declared" and move on. -->

- The provider field it comes from, with a link to the provider's documentation:
- What it measures exactly, and what it does not measure:
- I confirm I do not substitute usage with a sync date, an assignment date or a
  generic sign-in: <!-- yes / no -->
- I confirm that with no value `lastActivityAt` is `null`, that the connector
  stamps no date of its own, and that the value is neither stored nor
  logged: <!-- yes / no -->

## Validation performed

<!-- The result of `pnpm verify`. If you tested against the real provider in your own environment, say what you checked and what came back. Never commit credentials. -->

## Documentation

<!-- What you added to the connector's README: credential and permissions, permissions that are NOT needed, known limits. -->
