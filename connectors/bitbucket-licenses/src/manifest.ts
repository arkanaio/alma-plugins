export const manifest = {
  activity: null,
  allowedHosts: ["api.bitbucket.org", "api.atlassian.com"],
  authentication: {
    kind: "secret",
    fields: [
      {
        key: "api_token",
        label: "Bitbucket API token",
        help: "A personal API token with read:workspace:bitbucket and access to this workspace.",
        maximumLength: 2048,
      },
      {
        key: "api_key",
        label: "Atlassian organization API key",
        help: "Required: read:directories:admin and read:workspaces:admin for the organization that owns the workspace.",
        maximumLength: 2048,
      },
    ],
  },
  capabilities: ["licenses"],
  configuration: [
    {
      key: "workspace",
      kind: "text",
      label: "Workspace slug",
      help: "The workspace slug in bitbucket.org/<workspace>.",
      maximumLength: 100,
      options: null,
      required: true,
    },
    {
      key: "organization_id",
      kind: "text",
      label: "Organization ID",
      help: "The Atlassian organization linked to this workspace.",
      maximumLength: 100,
      options: null,
      required: true,
    },
    {
      key: "account_email",
      kind: "text",
      label: "Token account email",
      help: "The email of the account that created the personal Bitbucket token.",
      maximumLength: 320,
      options: null,
      required: true,
    },
  ],
  description:
    "Reads one plan per Bitbucket workspace and its members, with emails from the owning Atlassian organization. Both credentials are required.",
  documentationUrl:
    "https://github.com/arkanaio/alma-plugins/tree/main/connectors/bitbucket-licenses",
  id: "bitbucket_licenses",
  name: "Bitbucket",
  pricing: { exposesBillingCycle: false, exposesPricePerSeat: false },
  supportLevel: "official",
  version: "0.1.0",
} as const;
