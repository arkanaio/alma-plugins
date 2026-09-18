# From this repository to production

> The mechanism for taking a connector into the product is built in [arkanaio/alma#367](https://github.com/arkanaio/alma/issues/367). This document describes the agreed path; the implementation details live there.

## The path

1. **Contribution.** A PR with a connector, following [CONTRIBUTING.md](../CONTRIBUTING.md).
2. **Automated tests** in CI, against the sample data. No network, no credentials.
3. **A human security review**, using the checklist in [SECURITY-REVIEW.md](SECURITY-REVIEW.md). Mandatory, arkana's own connectors included.
4. **A published version** of the connector.
5. **Adoption.** ALMA takes **that version** into its deployment. It does not follow a branch and it does not update itself.
6. **Activation.** The customer organisation configures its credentials and enables the connector from the product.

## What never happens

A customer organisation **does not install code**. It does not upload a connector, does not pick a version, and does not run anything of its own inside ALMA. It configures credentials and enables what is already adopted and reviewed.

This is the decision that avoids the most risk. Letting an organisation upload its own code for ALMA to run would require, at a minimum, real isolation from the rest of the system, provenance verification, resource limits, a quarantine process, and a clear model of liability for when one customer's connector leaks that same customer's data. All of that is, in itself, a different product.

What is done from the start is to **leave the door open**: a connector's contract is already "data in, data out". If real demand for self-hosted connectors appears, what will be left to build is packaging and verification, not a redesign.

## Versioning

Each connector is versioned separately, using semantic versioning:

- **Major**: what ALMA receives changes, or the connector needs a different configuration or credential. Adoption requires intervention.
- **Minor**: new fields, a provider case that was not covered before.
- **Patch**: fixes that do not change what is received.

A breaking change to the **contract** is a different thing: it is announced in [CONTRIBUTING.md](../CONTRIBUTING.md) before it is applied, with what has to change in an existing connector.

## What the customer sees

The connector's support level, as-is: **official**, **community-contributed**, or **browser-automation based**. It is not dressed up. A customer has a right to know who maintains the piece that talks to their provider.

## When a connector breaks

A provider can change its API without notice. When that happens:

- The sync fails with a clear error and **does not save wrong data silently**.
- If the failure is a credential failure, the connection is marked "reauthentication required" instead of retrying forever.
- The fix comes through the normal path: PR, tests, review, and a new version.

A connector with no maintainer that has been broken for a while is marked unmaintained and removed from the list offered to new customers, without breaking anyone who already has it enabled.
