# Google Workspace licenses

Reads the Google Workspace edition assigned to each account using Enterprise
License Manager API, product `Google-Apps`. This is a separate connector from
the directory. Enabling the directory never enables license collection.

## Authorization

The host supplies an ephemeral OAuth access token in `secrets.access_token`.
It needs `https://www.googleapis.com/auth/apps.licensing`. Google offers no
read-only variant of this scope; this connector only sends GET requests.
The host obtains the token using its own credential adapter, never this package.
No refresh tokens or service-account private keys belong in this connector.

For domain-wide delegation, an administrator explicitly adds that scope to the
host's client ID in Google Admin console, Security, Access and data control,
API controls, Domain-wide delegation, and authorizes a delegated administrator
with permission to manage licenses. Keep the existing directory scope when
editing the delegation. Enable Enterprise License Manager API in the host's
Google Cloud project. Set `customer_id` to the organization's Google customer ID
from Account settings, Profile; `my_customer` is not accepted.

No Directory, Reports, billing or Reseller API permission is requested here.
Refusing the extra scope fails license collection with `permissions`; directory
sync remains independent. The host must require explicit activation and verify
that the customer ID belongs to the authenticated organization's directory.

## Data and limits

- The provider's SKU ID and SKU name identify the edition. Unknown future SKUs
  remain readable; no hard-coded SKU catalogue can silently omit them.
- All pages must finish before the host reconciles absences. Page size is 100;
  the opaque Google page token is returned as the continuation cursor.
- Prices, currencies, billing cycles and purchased seat counts are unknown
  and returned as null. Assigned accounts are not purchased seat totals.
- Activity is not declared or collected. No last-sign-in is substituted for use.
- Only `Google-Apps` is read: separate-product add-ons, archived-user licenses,
  device licenses and domain-wide SKUs are outside this version's coverage.
- `userId` is the account's current primary email, not a stable Directory ID.
  A rename appears as an absent old account and a newly detected one. The host
  must not silently release manually assigned seats based on this change.
- A 401 is a credential failure; 403 a permission failure; 429 and 5xx are
  retryable service failures. Invalid responses fail the run, never empty it.

References: [assignments](https://developers.google.com/workspace/admin/licensing/reference/rest/v1/licenseAssignments),
[listing and scope](https://developers.google.com/workspace/admin/licensing/reference/rest/v1/licenseAssignments/listForProduct),
[supported products](https://developers.google.com/workspace/admin/licensing/v1/how-tos/products).

## Verification and release

Sample responses are synthetic and contain no customer data. Tests exercise the
real host boundary with an in-memory transport and never contact Google.
Build with `pnpm --filter @arkanaio/connector-google-workspace-licenses build`.
Run `pnpm verify` before review. Version 0.1.0 requires its own human security
review and publication before it can be incorporated into ALMA.
