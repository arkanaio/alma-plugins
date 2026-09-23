# Atlassian licenses

Reads the product sites of an Atlassian Cloud organization (Jira, Confluence,
Jira Service Management and the rest of the workspaces Atlassian Administration
lists), the seat limit Atlassian reports for each one, and the accounts that
hold a billable role on it. It uses the
[Organizations REST API](https://developer.atlassian.com/cloud/admin/organization/rest/intro/)
at `api.atlassian.com` and nothing else.

## Authorization

An organization admin creates an API key in Atlassian Administration, Settings,
API keys, and gives it to the host together with the organization ID shown on
the same screen and in the Administration URL.

- `configuration.organization_id`: the organization ID.
- `secrets.api_key`: the API key. It travels only in the `Authorization`
  header.

Prefer a key **with scopes**, limited to `read:workspaces:admin` and
`read:directories:admin`. Atlassian does not document a scope for every
endpoint; if it rejects the user search with a scoped key, the read fails with
`permissions` and an unscoped key is needed. The connector only reads either
way. Both endpoints it calls are searches that take their filters in a `POST`
body; it never calls an endpoint that changes anything.

Atlassian API keys expire on the date chosen when they are created. After that
the read fails with `credentials`, and the organization has to create a new key.

## What it reads

1. `POST /admin/v2/orgs/{orgId}/workspaces` lists the product sites. Each site
   is one plan. Its `externalId` is the site's ARI, which is stable, and its name
   combines the product, the plan Atlassian reports and the site host, such as
   `Jira Standard · example.atlassian.net`. Sandboxes (`sandbox.type` `CHILD`)
   are skipped: they copy a production site and hold no seats of their own.
2. `POST /admin/v2/orgs/{orgId}/directories/-/users/search`, once per site,
   lists the active accounts with the `atlassian/user` or `atlassian/admin`
   role on it, 100 per page. `-` searches every directory the key can manage.
   Each account is a seat with its Atlassian account ID, email and name.

The cursor names the site being read and Atlassian's cursor inside it. If a site
disappears in the middle of a read, the read continues with the next site in the
same order.

## Data and limits

- **Purchased seats.** `seatCount` is the site's `capacity`, the seat limit
  Atlassian reports when it has license data for that site. When it does not,
  `seatCount` is `null`: unknown, never replaced by the number of accounts
  detected. Atlassian bills Jira and Confluence by user tier, so the limit can
  be higher than what the organization uses.
- **Billable roles only.** Guests, Jira Service Management customers,
  contributors, basic users, stakeholders and user-access admins hold no paid
  seat and are not read. Suspended and deactivated accounts are not read either.
- **Unit.** Each plan counts users of one product site. Products that Atlassian
  bills per workspace or per agent with other rules, such as Bitbucket, Trello
  or Jira Service Management agents, are read with the same user roles; their
  totals follow what Atlassian reports and nothing is inferred.
- **Emails.** An account whose email Atlassian does not return, or returns in a
  shape that is not an email, keeps its account ID and name and has a `null`
  email. The host treats it as an account it cannot match to a person.
- **Prices, currency and billing cycle** are always `null`. The Organizations
  API does not expose them.
- **Activity** is declared: `lastActivityAt` is the site's entry in
  `productAccess[].lastActiveTimestamp`. Atlassian counts a visit to a product
  page lasting at least two seconds, with up to 24 hours of delay. An account
  that never used the product has `null`. Use through apps, automation or the
  REST API may not be counted.
- **Failures.** 401 is `credentials`; 403 and 404 (a wrong organization ID) are
  `permissions`; 429 and 5xx are retryable `service` failures. A response in
  another shape, a cursor that does not advance and a listing that loops are
  `contract` failures, and none of them empties the read. No failure carries
  the response body.

## Verification and release

The sample responses in `sample-data/` are synthetic and contain no customer
data. The tests serve them through the real `createConnectorFetch` built from
this manifest's `allowedHosts`, and never contact Atlassian. Build with
`pnpm --filter @arkanaio/connector-atlassian-licenses build` and run
`pnpm verify` before review.
