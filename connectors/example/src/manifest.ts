import type { Manifest } from "@alma/connector-contract";

export const manifest: Manifest = {
  id: "example",
  name: "Example provider",
  description:
    "Reference connector. It talks to no real provider: it exists so the contribution guide has a runnable example.",
  documentation:
    "https://github.com/arkanaio/alma-plugins/tree/main/connectors/example",
  capabilities: ["licenses"],
  support: "official",
  domains: ["api.example.test"],
  configuration: [
    {
      key: "workspace",
      label: "Workspace identifier",
      help: "It appears in the URL of the provider's admin panel.",
      type: "text",
      required: true,
    },
  ],
  exposesSeatPrice: true,
  // The example provider does publish activity, so the connector declares it
  // and documents exactly what it measures. A license connector without
  // activity is just as valid: { supported: false } would be enough.
  activity: {
    supported: true,
    measures:
      "The last time the account produced an action inside the product, from the provider's last_active_at field.",
    limitations:
      "Daily granularity and up to 24 hours of delay. It does not tell real usage apart from sessions opened by integrations. Invited accounts that never signed in are not reported.",
  },
};
