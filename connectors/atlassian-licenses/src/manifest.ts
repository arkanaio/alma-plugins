export const manifest = {
  activity: {
    documentationUrl:
      "https://developer.atlassian.com/cloud/admin/organization/rest/api-group-users/",
    measures:
      "The last time the account used that product on that site, from productAccess[].lastActiveTimestamp. Atlassian counts a visit to a product page lasting at least two seconds.",
    limitations:
      "Up to 24 hours of delay. It is per product site, not per feature, and use only through apps, automation or the REST API may not be counted. An account that never used the product has no date.",
  },
  allowedHosts: ["api.atlassian.com"],
  authentication: {
    kind: "secret",
    fields: [
      {
        key: "api_key",
        label: "Organization API key",
        help: "An Atlassian Administration API key for this organization. Prefer a key with only read:workspaces:admin and read:directories:admin; the connector only reads.",
        maximumLength: 2048,
      },
    ],
  },
  capabilities: ["licenses"],
  configuration: [
    {
      key: "organization_id",
      kind: "text",
      label: "Organization ID",
      help: "The ID shown in the Atlassian Administration URL and when the API key is created.",
      maximumLength: 100,
      options: null,
      required: true,
    },
  ],
  description:
    "Reads each Atlassian Cloud product site on a paid plan, the seat limit Atlassian reports for it and the accounts holding a billable role. No prices.",
  documentationUrl:
    "https://github.com/arkanaio/alma-plugins/tree/main/connectors/atlassian-licenses",
  id: "atlassian_licenses",
  name: "Atlassian",
  pricing: { exposesBillingCycle: false, exposesPricePerSeat: false },
  supportLevel: "official",
  version: "0.1.1",
} as const;
