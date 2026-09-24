export const manifest = {
  activity: {
    documentationUrl:
      "https://docs.github.com/en/rest/copilot/copilot-user-management#list-all-copilot-seat-assignments-for-an-organization",
    measures:
      "For GitHub Copilot seats only: the last time the account used Copilot, from the seat's last_activity_at field. GitHub counts IDE completions and chat, Copilot Chat on github.com, the Copilot CLI and other Copilot features.",
    limitations:
      "IDE usage is only counted when the user has telemetry enabled in the IDE, and GitHub may report it with a delay. An account that never used Copilot has no date. GitHub plan seats (Team or Enterprise) never carry activity: GitHub publishes no per-user usage for them, and a last sign-in is not usage.",
  },
  allowedHosts: ["api.github.com"],
  authentication: {
    kind: "secret",
    fields: [
      {
        key: "access_token",
        label: "Fine-grained personal access token",
        help: "A fine-grained token owned by an organization owner, with this organization as resource owner and only read access to the organization permissions Members, Plan and Administration (Administration is needed for Copilot). Set an expiry and renew it before it lapses.",
        maximumLength: 255,
      },
    ],
  },
  capabilities: ["licenses"],
  configuration: [
    {
      key: "organization",
      kind: "text",
      label: "Organization",
      help: "The organization's login as it appears in github.com/<organization>.",
      maximumLength: 39,
      options: null,
      required: true,
    },
    {
      key: "copilot",
      kind: "select",
      label: "GitHub Copilot seats",
      help: "Read Copilot Business or Enterprise seats too. Choose Skip when the organization has no Copilot subscription or the token must not read billing.",
      maximumLength: 10,
      options: [
        { label: "Read", value: "read" },
        { label: "Skip", value: "skip" },
      ],
      required: true,
    },
  ],
  description:
    "Reads the organization's paid GitHub plan (Team or Enterprise) with its purchased and filled seats, the members and outside collaborators holding them, and GitHub Copilot seats with their last activity. No prices.",
  documentationUrl:
    "https://github.com/arkanaio/alma-plugins/tree/main/connectors/github-licenses",
  id: "github_licenses",
  name: "GitHub",
  pricing: { exposesBillingCycle: false, exposesPricePerSeat: false },
  supportLevel: "official",
  version: "0.1.0",
} as const;
