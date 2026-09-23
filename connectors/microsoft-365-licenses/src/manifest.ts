export const manifest = {
  activity: null,
  allowedHosts: ["login.microsoftonline.com", "graph.microsoft.com"],
  authentication: {
    kind: "secret",
    fields: [
      {
        key: "client_secret",
        label: "Client secret",
        help: "The secret VALUE of a dedicated Microsoft Entra application with admin-consented application permissions LicenseAssignment.Read.All and User.Read.All. Renew it before expiry.",
        maximumLength: 2048,
      },
    ],
  },
  capabilities: ["licenses"],
  configuration: [
    {
      key: "tenant_id",
      kind: "text",
      label: "Directory (tenant) ID",
      help: "The Microsoft Entra tenant GUID. This does not connect ALMA's employee directory.",
      maximumLength: 36,
      options: null,
      required: true,
    },
    {
      key: "client_id",
      kind: "text",
      label: "Application (client) ID",
      help: "The GUID of the dedicated app registration in that tenant.",
      maximumLength: 36,
      options: null,
      required: true,
    },
  ],
  description:
    "Reads Microsoft 365 user-license products, active subscription units and the accounts holding each license. Independent of employee directory synchronization; no prices or activity.",
  documentationUrl:
    "https://github.com/arkanaio/alma-plugins/tree/main/connectors/microsoft-365-licenses",
  id: "microsoft_365_licenses",
  name: "Microsoft 365",
  pricing: { exposesBillingCycle: false, exposesPricePerSeat: false },
  supportLevel: "official",
  version: "0.1.0",
} as const;
