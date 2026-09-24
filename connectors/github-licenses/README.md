# GitHub licenses

`@arkanaio/connector-github-licenses` reads one GitHub organization's paid plan
(GitHub Team or GitHub Enterprise) with the accounts holding its seats, and its
GitHub Copilot Business or Enterprise seats. It declares only `licenses`.

## Set up the connection

1. Sign in as an **owner** of the organization. Only owners can see the plan
   and Copilot billing.
2. Create a **fine-grained personal access token** with the organization as
   resource owner. If the organization requires approval for fine-grained
   tokens, approve it under the organization's settings.
3. Grant only these **organization permissions**, all read-only:
   - **Members**: list members and outside collaborators, and read their
     verified-domain emails.
   - **Plan**: read the plan name, purchased seats and filled seats.
   - **Administration**: read Copilot billing and seat assignments. Only needed
     when Copilot seats are read.
4. Grant **no repository permissions** and no write access. The connector never
   reads code, repositories, the audit log or billing amounts.
5. Set an expiry and record it. When the token expires or its owner stops being
   an organization owner, the next read fails; it never becomes zero licenses.
6. In ALMA, enter the organization login, choose whether to read Copilot seats,
   and paste the token. The package must first have been published and
   incorporated in that ALMA deployment.
7. If the organization enforces SAML single sign-on, authorize the token for
   the organization after creating it. An unauthorized token fails with
   `sso_authorization_required`.

A classic token also works, but it needs the `admin:org` scope to see the plan,
which grants write access to the organization. Prefer the fine-grained token.

## What is returned

### The GitHub plan

- One plan per organization, with external ID `plan_<name>`, for example
  `plan_team` or `plan_enterprise`. A **free** organization pays for no seat and
  returns no plan.
- `purchasedQuantity.value` is `plan.seats` and `consumedQuantity.value` is
  `plan.filled_seats`, both as reported by `GET /orgs/{org}`. A missing value is
  `null`; zero is kept as zero. Neither is rebuilt from the list of accounts.
- If GitHub returns no `plan` object at all, the token cannot see it and the
  read fails with `plan_not_visible`. A hidden plan is never treated as free.
- Seats are the organization's **members** (every role) and its **outside
  collaborators**. GitHub counts an outside collaborator only when they have
  access to a private repository, and it also counts pending invitations sent by
  email. So the accounts returned and `filled_seats` can differ; ALMA keeps the
  two apart.
- Enterprise accounts with several organizations are billed per unique user
  across the enterprise. This connector reads one organization, so the same
  person in two organizations appears in both.

### GitHub Copilot

- Read only when the connection chooses **Read**. An organization without a
  Copilot subscription (GitHub answers 404 or 422) returns no Copilot plan. A
  token without permission to read Copilot billing fails; it is not reported as
  no subscription.
- One plan named after `plan_type`: `copilot_business` or `copilot_enterprise`.
- `purchasedQuantity` is always `null`: Copilot bills each assigned seat and
  nothing is bought in advance. `consumedQuantity.value` is
  `seat_breakdown.total`.
- Seats come from the Copilot seat assignments. A seat whose assignee was
  deleted is skipped.

### Accounts

- `accountExternalId` is the GitHub user ID, which does not change when the user
  renames their login. The same person has the same ID in both plans.
- `accountName` is `Name (login)`, or just the login when the profile has no
  name.
- `accountEmail` is an address on a **domain the organization verified**, read
  from GraphQL `organizationVerifiedDomainEmails`. With several, the first in
  alphabetical order. Without a verified domain it is `null`: a public profile
  email is chosen by the user and says nothing about who they are in the
  organization. Verify the company's domain in GitHub so ALMA can match
  accounts to employees; otherwise every seat reaches ALMA without an email.
- Bots, teams and organizations never become seats.
- Price, currency and billing cycle are always `null`.

### Last activity

Declared, for Copilot seats only: `lastActivityAt` is the seat's
`last_activity_at`. IDE usage is only counted when the user has IDE telemetry
enabled. GitHub publishes no per-user usage for plan seats, so they always
return `null`; a last sign-in is not usage.

## Requests and limits

All calls go to `api.github.com` with REST API version `2022-11-28`. Every page
reads `GET /orgs/{org}` and, when enabled, `GET /orgs/{org}/copilot/billing`,
then walks members, outside collaborators and Copilot seats in that order: at
most five lists of 100 accounts, each followed by one GraphQL `nodes` query
for the names and verified emails of those accounts. The GraphQL query only
reads; there is no mutation. The cursor contains only the phase and the page
number.

Pages are numbered, so an account added or removed during a scan can shift a
page: a scan is not an atomic snapshot. A repeated account within a page is
returned once. A plan or Copilot subscription that disappears between pages
fails with `catalog_changed` instead of completing a partial scan.

Rate limits (403 or 429 with no remaining quota, or `Retry-After`) and server
errors are retryable. An invalid token is `credentials`; a missing permission,
unauthorized SSO or an organization the token cannot see is `permissions`.
Each call has a 15-second timeout. The token is only ever sent in the
`Authorization` header.

## Validation and evidence

Tests use the real `createConnectorFetch` boundary and anonymised responses in
`sample-data/`. They cover pagination across phases, unknown and zero
quantities, free organizations, organizations without Copilot, deleted
accounts, bots, rate limits, SSO, permission failures, schema drift and
malformed tokens and cursors. No test reaches GitHub.

## Provider references

- [Get an organization](https://docs.github.com/en/rest/orgs/orgs#get-an-organization)
- [Organization members](https://docs.github.com/en/rest/orgs/members#list-organization-members)
- [Outside collaborators](https://docs.github.com/en/rest/orgs/outside-collaborators#list-outside-collaborators-for-an-organization)
- [Copilot user management](https://docs.github.com/en/rest/copilot/copilot-user-management)
- [People who consume a license](https://docs.github.com/en/billing/managing-the-plan-for-your-github-account/about-per-user-pricing)
- [Verifying your organization's domains](https://docs.github.com/en/organizations/managing-organization-settings/verifying-or-approving-a-domain-for-your-organization)
- [Fine-grained token permissions](https://docs.github.com/en/rest/authentication/permissions-required-for-fine-grained-personal-access-tokens)
