# Bitbucket license connector

One plan per workspace, with the workspace members as purchased seats and one
assignment per member. The count comes from the Bitbucket members endpoint's
`size`, with its source and UTC observation date. This follows the billing
interpretation validated for ALMA's Bitbucket integration; it is not an invoice,
price or the Atlassian plan ceiling. Consumed quantity, prices, billing cycle
and last activity are unknown. No repository or Pipelines access is requested.

## Setup

1. Create a personal Bitbucket API token with `read:workspace:bitbucket` on an
   account that can access the workspace. Supply the token and that account's
   email. Authentication uses Basic with email and token.
2. Create an Atlassian organization API key with `read:directories:admin` and
   `read:workspaces:admin`. Supply the key and the organization ID from Atlassian
   Administration. This organization must own the workspace.
3. Set the workspace slug from `https://bitbucket.org/<workspace>`.

Both credentials are mandatory. The connector first lists the organization's
workspaces and matches the Bitbucket product and exact workspace URL. A missing
match fails with `permissions`, before reading members. Atlassian directory
searches use the members' account IDs, without product or billable-role filters.
Emails are joined by Atlassian account ID; a member absent from the directory
keeps their account ID and display name with a null email. ALMA reconciles
employees and shows unmatched accounts. No email is guessed.

A failure of either API fails the page. The host must publish only after the
whole run completes, preserving the previous snapshot on failure. Even an empty
workspace checks directory access. Different credentials are sent only to their
respective host, in headers. Continuation URLs are never followed directly.

## Pagination and limitations

The reader returns at most 100 members per page and repeats organization
ownership verification on every page. Organization lookups are bounded at 100
pages; loops and malformed payloads fail closed. Cursors contain only position,
count, total and workspace identity, never names, emails or secrets. Missing
member totals, totals changing during a read and incomplete pagination fail
instead of publishing a partial inventory. This API does not offer snapshot
isolation: an unchanged total does not guarantee the membership stayed unchanged
between pages. Run another synchronization if membership changed during a run.

The directory may contain only some workspace members, so unmatched accounts
are expected. No last-login or synchronization timestamp is reported as usage.
The Atlassian license connector excludes Bitbucket; use this connector for it.

## Validation

Run `pnpm verify`. Synthetic response fixtures follow the provider response
shapes, contain no real people or credentials, and cover pagination, a missing
name, an invited directory user and an account absent from the directory.
Tests use the real host-restricted fetch, and no provider network or secrets.
Real-provider acceptance is separate and has not been run for this package.

## Provider references

- [Workspace members and API token scope](https://developer.atlassian.com/cloud/bitbucket/rest/api-group-workspaces/#api-workspaces-workspace-members-get)
- [Organization workspaces](https://developer.atlassian.com/cloud/admin/organization/rest/api-group-workspaces/)
- [Organization directory search by account ID](https://developer.atlassian.com/cloud/admin/organization/rest/api-group-users/#api-v2-orgs-orgid-directories-directoryid-users-search-post)
