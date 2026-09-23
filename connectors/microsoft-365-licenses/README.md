# Microsoft 365 licenses

`@arkanaio/connector-microsoft-365-licenses` reads the Microsoft Graph v1.0
license catalogue and the accounts holding each user license. It declares only
`licenses`. No employee directory connector, Microsoft login, or Google
Workspace connection is required.

## Set up the connection

1. In Microsoft Entra admin center, create a dedicated, single-tenant app
   registration in the organization whose licenses you want to read.
2. Under **API permissions**, add Microsoft Graph **Application permissions**:
   - `LicenseAssignment.Read.All`: read the subscribed SKU catalogue.
   - `User.Read.All`: find users holding each SKU and read their account ID,
     display name, mail and user principal name.
3. Grant administrator consent for those permissions. No delegated user,
   redirect URI, `Directory.Read.All`, write permission, Reports permission or
   audit-log permission is needed. Reading user identities for license matching
   does not enable employee synchronization in ALMA.
4. Create a client secret. Record its **Value**, not its secret ID, and expiry.
5. In ALMA's license integration form enter the Directory (tenant) ID and
   Application (client) ID GUIDs, then the client secret value. The package must
   first have been published and incorporated in that ALMA deployment.
6. Renew the secret and reconnect before it expires. Revoking admin consent or
   letting it expire makes the next read fail; it never becomes zero licenses.

Use a dedicated app with only these permissions: Microsoft's `.default` scope
includes all Graph application permissions granted to that app.

## What is returned

- One plan per `skuId`, named with Microsoft's `skuPartNumber`. These are
  provider identifiers, not a hard-coded marketing-name catalogue.
- Only SKUs whose `appliesTo` is `User`. Company-wide entitlements cannot be
  represented as user seats and are excluded. Products with no assignments
  remain in the catalogue.
- `seatCount` is `prepaidUnits.enabled`, the units enabled for active
  subscriptions. Missing capacity is `null`; reported zero remains zero.
  Warning/grace-period, suspended and locked-out units are not added. This is
  active licensed capacity, **not a price, proof of a paid purchase, invoice
  quantity, or the number of accounts**. Trials and free entitlements may be
  present because Graph does not provide their billing terms here.
- Each account returned by the SKU assignment filter becomes one seat, keyed
  by SKU GUID and user GUID. The filter includes direct and inherited license
  assignments. We do not filter out disabled accounts or guests: an account
  retaining a license still holds it.
- Email uses `mail`, falling back to a valid `userPrincipalName`; synthetic
  guest `#EXT#` identifiers are not email addresses. With neither, email is
  `null`. ALMA determines employee matches and orphaned assignments.
- Price, currency and billing cycle are always `null`. Last activity is not
  declared and is always `null`. Generic sign-ins are not license usage.

Graph also exposes `consumedUnits`. Contract 0.1.1 has no separate field for a
provider-reported consumed total, its provenance, or its measurement date, so
this connector does **not** substitute it for capacity or create fake account
assignments from it. ALMA's product model for additional license quantities
(arkanaio/alma#557) must support that value before it can be persisted separately.
The host timestamps successful readings, as for the other connectors.

## Requests and limits

Only the global Microsoft cloud is supported. Sovereign cloud endpoints are
not silently substituted.

Every page obtains a fresh app-only token at
`login.microsoftonline.com/{tenant}/oauth2/v2.0/token`, reads
`graph.microsoft.com/v1.0/subscribedSkus`, and makes at most five `/users`
queries, with 100 accounts per query, filtered by SKU. Large tenants continue
using an opaque cursor containing only a SKU GUID and a Graph position token.
No token or secret is cached across contexts. Each call has a 15-second timeout.

Client authentication uses the documented RFC 6749 HTTP Basic form: the secret
is only in the authorization header. The token request creates no provider
business data; all Graph calls are GETs. Bearer tokens only go to Graph.
Continuation links must use the exact Graph users endpoint and matching query;
only their position token is retained. Redirects are rejected by the shared
fetch boundary.

The catalogue is capped at the contract's 1,000 plans. Unexpected catalogue
pagination, malformed data and repeated page positions fail explicitly.
Microsoft may delay propagation of license changes; a scan is not an atomic
snapshot. Throttling and server errors are retryable; invalid credentials and
missing administrator consent require fixing the connection.

## Validation and evidence

Tests use the real `createConnectorFetch` boundary and synthetic responses
based on Microsoft's documented schema. They cover pagination, unknown and
zero capacity, products without accounts, guest identifiers, credential
placement, permission failures, service failures, schema drift, and malicious
continuation links. No live Microsoft tenant was used; these fixtures are
**not** a claim of production acceptance. Validate administrator consent, token
issuance and license totals against a real test tenant before release acceptance.

## Provider references

- [List subscribed SKUs](https://learn.microsoft.com/en-us/graph/api/subscribedsku-list?view=graph-rest-1.0)
- [License unit states](https://learn.microsoft.com/en-us/graph/api/resources/licenseunitsdetail?view=graph-rest-1.0)
- [List users and permissions](https://learn.microsoft.com/en-us/graph/api/user-list?view=graph-rest-1.0)
- [User properties and assignedLicenses filter](https://learn.microsoft.com/en-us/graph/api/resources/user?view=graph-rest-1.0)
- [Client credentials and HTTP Basic authentication](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-client-creds-grant-flow)
