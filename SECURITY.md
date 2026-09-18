# Security policy

## Reporting a problem

**Do not open a public issue.**

Use GitHub's private vulnerability reporting, under this repository's **Security** tab ("Report a vulnerability"). If you cannot, write to **jaume@arkana.io**.

Include:

- Which connector or which part of the repository is affected.
- What the problem allows someone to do.
- How to reproduce it.
- Your assessment of the impact, if you have one.

We acknowledge receipt within 3 working days and report status at least every 7 days until it is closed. When there is a fix, the affected and fixed versions are published, and the reporter is credited unless they prefer not to be.

## What this policy covers

- A connector talking to a domain it does not declare in its manifest.
- A connector leaking a credential, personal data, or an activity value into a trace, an error, or a returned value.
- A connector reaching something the execution context does not give it.
- A secret or real personal data committed to this repository, sample data included.
- A compromised or impersonated dependency.

A problem in the ALMA product rather than in a connector goes to [arkanaio/alma](https://github.com/arkanaio/alma).

## What it does not cover

- Functional bugs with no security consequence. Those go to a normal issue.
- Vulnerabilities in a provider's own system. Report those to the provider.
- Automatically generated reports with no verification and no demonstrated impact.

## Before you commit anything

Do not commit credentials, tokens, or real people's data, sample data included. A secret that reaches a public branch is considered compromised even if it is deleted afterwards: it has to be rotated.
