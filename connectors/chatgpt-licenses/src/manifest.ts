export const manifest = {
  // The Admin API's per-user Daily Usage rows could say when a member last
  // used ChatGPT, but they need a second scope and a scan of daily rows. Until
  // that is built and reviewed, the connector declares no activity.
  activity: null,
  allowedHosts: ["api.chatgpt.com"],
  authentication: {
    kind: "secret",
    fields: [
      {
        key: "api_key",
        label: "Workspace Admin API key",
        help: "A workspace-scoped Admin key from the OpenAI Admin Console, Credentials, Admin keys. Choose Custom permissions and set only Users to Read; the connector only reads.",
        maximumLength: 2048,
      },
    ],
  },
  capabilities: ["licenses"],
  configuration: [
    {
      key: "workspace_id",
      kind: "text",
      label: "Workspace ID",
      help: "The ID of the ChatGPT Enterprise or Edu workspace, shown in the workspace settings and when the Admin key is created.",
      maximumLength: 36,
      options: null,
      required: true,
    },
  ],
  description:
    "Reads the active members of a ChatGPT Enterprise or Edu workspace and the seat each one holds, ChatGPT or Codex. No purchased totals, prices or activity.",
  documentationUrl:
    "https://github.com/arkanaio/alma-plugins/tree/main/connectors/chatgpt-licenses",
  id: "chatgpt_licenses",
  name: "ChatGPT",
  pricing: { exposesBillingCycle: false, exposesPricePerSeat: false },
  supportLevel: "official",
  version: "0.1.0",
} as const;
