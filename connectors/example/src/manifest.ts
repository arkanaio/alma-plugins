/**
 * The card ALMA shows the customer.
 *
 * It declares licenses only. A directory connector for the same provider would
 * be a separate connector with its own package: the incorporation record
 * approves capabilities and hosts as a single surface, so keeping them apart
 * keeps each approval to the minimum it actually needs.
 */
export const manifest = {
  activity: {
    documentationUrl: "https://example.invalid/docs/activity",
    limitations:
      "The provider aggregates activity by day, so a session today can take up to 24 hours to appear. It does not tell real usage apart from sessions opened by integrations.",
    measures:
      "The last time the account opened a document in the workspace, from the provider's last_active_at field.",
  },
  allowedHosts: ["api.example.invalid"],
  authentication: {
    fields: [
      {
        help: "Created under Settings, API, with read-only access.",
        key: "api_token",
        label: "API token",
        maximumLength: 200,
      },
    ],
    kind: "secret",
  },
  capabilities: ["licenses"],
  configuration: [
    {
      help: "The identifier the provider gives the workspace.",
      key: "workspace",
      kind: "text",
      label: "Workspace",
      maximumLength: 100,
      options: null,
      required: true,
    },
    {
      help: null,
      key: "region",
      kind: "select",
      label: "Region",
      maximumLength: 10,
      options: [
        { label: "Europe", value: "eu" },
        { label: "United States", value: "us" },
      ],
      required: false,
    },
  ],
  description:
    "Reference connector. It talks to no real provider and exists so the contribution guide has a runnable example.",
  documentationUrl:
    "https://github.com/arkanaio/alma-plugins/tree/main/connectors/example",
  id: "example_licenses",
  name: "Example",
  pricing: { exposesBillingCycle: true, exposesPricePerSeat: true },
  supportLevel: "official",
  version: "1.0.0",
} as const;
