export const manifest = {
  activity: null,
  allowedHosts: ["licensing.googleapis.com"],
  authentication: {
    kind: "secret",
    fields: [
      {
        key: "access_token",
        label: "OAuth access token",
        help: "Short-lived token supplied by the host with the apps.licensing scope; never a customer-entered long-lived credential.",
        maximumLength: 16384,
      },
    ],
  },
  capabilities: ["licenses"],
  configuration: [
    {
      key: "customer_id",
      kind: "text",
      label: "Google customer ID",
      help: "The customer ID from Google Admin console, for example C01234567. Do not use my_customer.",
      maximumLength: 100,
      options: null,
      required: true,
    },
  ],
  description:
    "Reads the Google Workspace edition assigned to each account. No prices, purchased seat totals or usage activity.",
  documentationUrl:
    "https://github.com/arkanaio/alma-plugins/tree/main/connectors/google-workspace-licenses",
  id: "google_workspace_licenses",
  name: "Google Workspace",
  pricing: { exposesBillingCycle: false, exposesPricePerSeat: false },
  supportLevel: "official",
  version: "0.1.0",
} as const;
