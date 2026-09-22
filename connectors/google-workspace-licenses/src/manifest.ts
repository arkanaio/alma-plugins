export const manifest = {
  activity: null,
  allowedHosts: ["licensing.googleapis.com", "admin.googleapis.com"],
  authentication: {
    kind: "secret",
    fields: [
      {
        key: "access_token",
        label: "OAuth access token",
        help: "Short-lived token supplied by the host with apps.licensing for assignments or admin.reports.usage.readonly for purchased totals; never a customer-entered long-lived credential.",
        maximumLength: 16384,
      },
    ],
  },
  capabilities: ["licenses"],
  configuration: [
    {
      key: "read_mode",
      kind: "text",
      label: "Read mode",
      help: "Host-selected assignments (default) or purchased totals. Each mode uses a separately scoped token.",
      maximumLength: 20,
      options: null,
      required: false,
    },
    {
      key: "report_date",
      kind: "text",
      label: "Report date",
      help: "Required for purchased mode, YYYY-MM-DD in Google's reporting timezone (UTC-8).",
      maximumLength: 10,
      options: null,
      required: false,
    },
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
    "Reads assigned Workspace editions and documented purchased-license totals from customer Reports. No prices or user activity.",
  documentationUrl:
    "https://github.com/arkanaio/alma-plugins/tree/main/connectors/google-workspace-licenses",
  id: "google_workspace_licenses",
  name: "Google Workspace",
  pricing: { exposesBillingCycle: false, exposesPricePerSeat: false },
  supportLevel: "official",
  version: "0.1.2",
} as const;
