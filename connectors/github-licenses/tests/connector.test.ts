import assert from "node:assert/strict";
import test from "node:test";
import {
  type ConnectorContext,
  ConnectorError,
  connectorLicensePageSchema,
  createConnectorFetch,
} from "@arkanaio/connector-contract";
import billing from "../sample-data/copilot-billing.json" with { type: "json" };
import copilotSeats from "../sample-data/copilot-seats.json" with {
  type: "json",
};
import members from "../sample-data/members.json" with { type: "json" };
import organization from "../sample-data/organization.json" with {
  type: "json",
};
import outside from "../sample-data/outside-collaborators.json" with {
  type: "json",
};
import nodes from "../sample-data/user-nodes.json" with { type: "json" };
import { githubLicensesConnector as connector } from "../src/index.ts";

const token = "github_pat_synthetic_Value_0123456789";
type Override = (url: URL, init: RequestInit) => Response | undefined;

function graphql(init: RequestInit): Response {
  const body = JSON.parse(String(init.body)) as {
    variables: { ids: string[]; org: string };
  };
  assert.equal(body.variables.org, "example-org");
  return Response.json({
    data: {
      nodes: body.variables.ids.map(
        (id) => (nodes as Record<string, unknown>)[id] ?? null,
      ),
    },
  });
}

function host(
  override?: Override,
  configuration: Record<string, string | null> = {
    organization: "example-org",
    copilot: "read",
  },
) {
  const calls: { url: string; init: RequestInit }[] = [];
  const context: ConnectorContext = {
    configuration,
    secrets: { access_token: token },
    now: () => new Date("2026-09-24T23:30:00Z"),
    fetch: createConnectorFetch({
      allowedHosts: connector.manifest.allowedHosts,
      fetch: async (url, init) => {
        calls.push({ url, init });
        const parsed = new URL(url);
        const response = override?.(parsed, init);
        if (response) return response;
        const page = parsed.searchParams.get("page");
        switch (parsed.pathname) {
          case "/orgs/example-org":
            return Response.json(organization);
          case "/orgs/example-org/members":
            return Response.json(page === "1" ? members : []);
          case "/orgs/example-org/outside_collaborators":
            return Response.json(page === "1" ? outside : []);
          case "/orgs/example-org/copilot/billing":
            return Response.json(billing);
          case "/orgs/example-org/copilot/billing/seats":
            return Response.json(copilotSeats);
          case "/graphql":
            return graphql(init);
        }
        assert.fail(`Unexpected endpoint ${url}`);
      },
    }),
  };
  return { calls, context };
}

async function read(context: ConnectorContext, cursor: string | null = null) {
  assert.ok(connector.readers.licenses);
  return connectorLicensePageSchema.parse(
    await connector.readers.licenses({ context, cursor }),
  );
}

function errorIs(kind: string, code: string) {
  return (error: unknown) => {
    assert.ok(error instanceof ConnectorError);
    assert.equal(error.kind, kind);
    assert.equal(error.code, code);
    assert.equal(error.retryable, kind === "service");
    assert.ok(!error.message.includes(token));
    return true;
  };
}

function account(id: number) {
  return {
    login: `example-${id}`,
    id,
    node_id: `U_kgDO${id}`,
    type: "User",
  };
}

test("reads the paid plan and Copilot with separate, sourced quantities", async () => {
  const { context } = host();
  const page = await read(context);
  assert.equal(page.cursor, null);
  assert.deepEqual(page.plans, [
    {
      externalId: "plan_enterprise",
      name: "GitHub Enterprise",
      purchasedQuantity: {
        value: 50,
        unit: "person",
        source: "plan.seats",
        observedOn: "2026-09-24",
      },
      consumedQuantity: {
        value: 4,
        unit: "person",
        source: "plan.filled_seats",
        observedOn: "2026-09-24",
      },
      pricePerSeat: null,
      currency: null,
      billingCycle: null,
    },
    {
      externalId: "copilot_business",
      name: "GitHub Copilot Business",
      purchasedQuantity: null,
      consumedQuantity: {
        value: 3,
        unit: "person",
        source: "seat_breakdown.total",
        observedOn: "2026-09-24",
      },
      pricePerSeat: null,
      currency: null,
      billingCycle: null,
    },
  ]);
  assert.deepEqual(
    page.seats.map((seat) => [seat.planExternalId, seat.accountExternalId]),
    [
      ["plan_enterprise", "100001"],
      ["plan_enterprise", "100002"],
      ["plan_enterprise", "100003"],
      ["plan_enterprise", "100004"],
      ["copilot_business", "100002"],
      ["copilot_business", "100003"],
    ],
  );
});

test("identifies accounts only through verified-domain emails", async () => {
  const { context } = host();
  const page = await read(context);
  const byId = (plan: string, id: string) =>
    page.seats.find(
      (seat) => seat.planExternalId === plan && seat.accountExternalId === id,
    );
  assert.equal(
    byId("plan_enterprise", "100001")?.accountEmail,
    "owner@example.invalid",
  );
  // Several verified addresses: the choice is stable, not the provider's order.
  assert.equal(
    byId("plan_enterprise", "100002")?.accountEmail,
    "alias@example.invalid",
  );
  assert.equal(byId("plan_enterprise", "100003")?.accountEmail, null);
  assert.equal(
    byId("plan_enterprise", "100003")?.accountName,
    "example-no-domain",
  );
  assert.equal(
    byId("plan_enterprise", "100004")?.accountName,
    "Example Contractor (example-contractor)",
  );
  assert.equal(
    byId("copilot_business", "100002")?.accountEmail,
    "alias@example.invalid",
  );
});

test("only Copilot seats carry the provider's activity date", async () => {
  const { context } = host();
  const page = await read(context);
  assert.ok(connector.manifest.activity);
  const copilot = page.seats.filter(
    (seat) => seat.planExternalId === "copilot_business",
  );
  assert.deepEqual(
    copilot.map((seat) => seat.lastActivityAt),
    ["2026-09-22T16:40:00Z", null],
  );
  assert.ok(
    page.seats
      .filter((seat) => seat.planExternalId === "plan_enterprise")
      .every((seat) => seat.lastActivityAt === null),
  );
});

test("the token only travels in a header to api.github.com and every call reads", async () => {
  const { context, calls } = host();
  await read(context);
  assert.ok(calls.length > 0);
  for (const { url, init } of calls) {
    assert.equal(new URL(url).hostname, "api.github.com");
    assert.ok(!url.includes(token));
    assert.equal(init.redirect, "error");
    const headers = new Headers(init.headers);
    assert.equal(headers.get("authorization"), `Bearer ${token}`);
    assert.equal(headers.get("x-github-api-version"), "2022-11-28");
    assert.ok(headers.get("user-agent"));
    if (new URL(url).pathname === "/graphql") {
      assert.equal(init.method, "POST");
      assert.match(String(init.body), /^\{"query":"query\(/);
      assert.ok(!String(init.body).includes("mutation"));
      assert.ok(!String(init.body).includes(token));
    } else {
      assert.equal(init.method, "GET");
      assert.equal(init.body, undefined);
    }
  }
});

test("a free organization has no paid plan but keeps Copilot", async () => {
  const { context, calls } = host((url) =>
    url.pathname === "/orgs/example-org"
      ? Response.json({
          ...organization,
          plan: { ...organization.plan, name: "free" },
        })
      : undefined,
  );
  const page = await read(context);
  assert.deepEqual(
    page.plans.map((plan) => plan.externalId),
    ["copilot_business"],
  );
  assert.ok(page.seats.every((s) => s.planExternalId === "copilot_business"));
  assert.ok(!calls.some((call) => call.url.includes("/members")));
});

test("a hidden plan is a permission problem, not a free organization", async () => {
  const { context } = host((url) =>
    url.pathname === "/orgs/example-org"
      ? Response.json({ login: "example-org" })
      : undefined,
  );
  await assert.rejects(
    read(context),
    errorIs("permissions", "plan_not_visible"),
  );
});

test("unknown and zero plan quantities are kept as reported", async () => {
  const { context } = host((url) =>
    url.pathname === "/orgs/example-org"
      ? Response.json({
          ...organization,
          plan: { name: "team", space: 1, private_repos: 1, seats: 0 },
        })
      : undefined,
  );
  const page = await read(context);
  assert.equal(page.plans[0]?.name, "GitHub Team");
  assert.equal(page.plans[0]?.purchasedQuantity?.value, 0);
  assert.equal(page.plans[0]?.consumedQuantity, null);
  // Assignments are never used to fill a missing aggregate.
  assert.equal(
    page.seats.filter((seat) => seat.planExternalId === "plan_team").length,
    4,
  );
});

for (const status of [404, 422]) {
  test(`an organization without Copilot (${status}) reads only the plan`, async () => {
    const { context, calls } = host((url) =>
      url.pathname === "/orgs/example-org/copilot/billing"
        ? new Response("{}", { status })
        : undefined,
    );
    const page = await read(context);
    assert.deepEqual(
      page.plans.map((plan) => plan.externalId),
      ["plan_enterprise"],
    );
    assert.ok(!calls.some((call) => call.url.includes("/seats")));
  });
}

test("skipping Copilot never calls the billing endpoints", async () => {
  const { context, calls } = host(undefined, {
    organization: "example-org",
    copilot: "skip",
  });
  const page = await read(context);
  assert.equal(page.plans.length, 1);
  assert.ok(!calls.some((call) => call.url.includes("copilot")));
});

test("bounded pagination resumes across phases without data in the cursor", async () => {
  const { context, calls } = host((url) => {
    if (url.pathname !== "/orgs/example-org/members") return undefined;
    const page = Number(url.searchParams.get("page"));
    return Response.json(
      page <= 6
        ? Array.from({ length: 100 }, (_, i) => account(page * 1000 + i))
        : [account(page * 1000)],
    );
  });
  const first = await read(context);
  assert.equal(first.seats.length, 500);
  assert.deepEqual(JSON.parse(first.cursor ?? ""), {
    version: 1,
    phase: "members",
    page: 6,
  });
  // 1 organization + 1 Copilot billing + 5 × (list + GraphQL lookup).
  assert.equal(calls.length, 12);
  const second = await read(context, first.cursor);
  assert.equal(second.cursor, null);
  assert.equal(second.seats.length, 101 + 1 + 2);
  // Plans travel on every page, so any page can be published on its own.
  assert.equal(second.plans.length, 2);
  const planSeats = [...first.seats, ...second.seats].filter(
    (seat) => seat.planExternalId === "plan_enterprise",
  );
  assert.equal(
    new Set(planSeats.map((seat) => seat.accountExternalId)).size,
    602,
  );
  // An account GraphQL does not know keeps its login and no email.
  assert.equal(first.seats[0]?.accountName, "example-1000");
  assert.equal(first.seats[0]?.accountEmail, null);
});

test("Copilot seat pagination stops at the reported total", async () => {
  const { context, calls } = host((url) => {
    if (url.pathname !== "/orgs/example-org/copilot/billing/seats")
      return undefined;
    const page = Number(url.searchParams.get("page"));
    return Response.json({
      total_seats: 200,
      seats: Array.from({ length: 100 }, (_, i) => ({
        assignee: account(page * 1000 + i),
        last_activity_at: null,
      })),
    });
  });
  const page = await read(context);
  assert.equal(page.cursor, null);
  assert.equal(
    page.seats.filter((seat) => seat.planExternalId === "copilot_business")
      .length,
    200,
  );
  assert.equal(
    calls.filter((call) => call.url.includes("/billing/seats")).length,
    2,
  );
});

test("teams and bots never become seats", async () => {
  const { context } = host((url) =>
    url.pathname === "/orgs/example-org/members"
      ? Response.json([
          { ...account(1), type: "Bot" },
          { ...account(2), type: "Organization" },
        ])
      : undefined,
  );
  const page = await read(context);
  assert.ok(
    !page.seats.some((seat) => ["1", "2"].includes(seat.accountExternalId)),
  );
});

for (const [status, headers, kind, code] of [
  [401, {}, "credentials", "rejected"],
  [403, {}, "permissions", "permission_missing"],
  [
    403,
    { "x-github-sso": "required; url=https://github.com/orgs/x/sso" },
    "permissions",
    "sso_authorization_required",
  ],
  [403, { "x-ratelimit-remaining": "0" }, "service", "rate_limited"],
  [403, { "retry-after": "60" }, "service", "rate_limited"],
  [429, {}, "service", "rate_limited"],
  [404, {}, "permissions", "organization_not_found"],
  [502, {}, "service", "provider_unavailable"],
  [400, {}, "contract", "unexpected_status"],
] as const) {
  test(`organization ${status} ${JSON.stringify(headers)} is ${kind}:${code}`, async () => {
    const { context } = host((url) =>
      url.pathname === "/orgs/example-org"
        ? new Response(token, { status, headers })
        : undefined,
    );
    await assert.rejects(read(context), errorIs(kind, code));
  });
}

test("a token without Copilot permission fails instead of hiding Copilot", async () => {
  const { context } = host((url) =>
    url.pathname === "/orgs/example-org/copilot/billing"
      ? new Response("{}", { status: 403 })
      : undefined,
  );
  await assert.rejects(
    read(context),
    errorIs("permissions", "permission_missing"),
  );
});

for (const [type, kind, code] of [
  ["FORBIDDEN", "permissions", "permission_missing"],
  ["INSUFFICIENT_SCOPES", "permissions", "permission_missing"],
  ["RATE_LIMITED", "service", "rate_limited"],
  ["SOMETHING_NEW", "contract", "unexpected_payload"],
] as const) {
  test(`GraphQL ${type} is ${kind}:${code}`, async () => {
    const { context } = host((url) =>
      url.pathname === "/graphql"
        ? Response.json({ data: null, errors: [{ type, message: token }] })
        : undefined,
    );
    await assert.rejects(read(context), errorIs(kind, code));
  });
}

test("an account deleted during the scan keeps its seat without details", async () => {
  const { context } = host((url, init) => {
    if (url.pathname !== "/graphql") return undefined;
    const { variables } = JSON.parse(String(init.body)) as {
      variables: { ids: string[] };
    };
    return Response.json({
      data: { nodes: variables.ids.map(() => null) },
      errors: [{ type: "NOT_FOUND" }],
    });
  });
  const page = await read(context);
  assert.equal(page.seats.length, 6);
  assert.ok(page.seats.every((seat) => seat.accountEmail === null));
});

test("schema drift fails closed", async () => {
  for (const [path, body] of [
    [
      "/orgs/example-org",
      { ...organization, plan: { name: "team", seats: -1 } },
    ],
    [
      "/orgs/example-org",
      { ...organization, plan: { name: "team", filled_seats: 1.5 } },
    ],
    ["/orgs/example-org/members", [{ login: "x" }]],
    ["/orgs/example-org/members", { message: "not a list" }],
    ["/orgs/example-org/copilot/billing", { seat_breakdown: {} }],
    ["/orgs/example-org/copilot/billing/seats", { seats: [] }],
    ["/graphql", { data: { nodes: [] } }],
  ] as const) {
    const { context } = host((url) =>
      url.pathname === path ? Response.json(body) : undefined,
    );
    await assert.rejects(
      read(context),
      errorIs("contract", "unexpected_payload"),
    );
  }
});

test("invalid configuration, token and cursor fail before contacting GitHub", async () => {
  for (const organizationName of ["../users", "-bad", "a".repeat(40)]) {
    const { context, calls } = host(undefined, {
      organization: organizationName,
      copilot: "read",
    });
    await assert.rejects(
      read(context),
      errorIs("contract", "invalid_configuration"),
    );
    assert.equal(calls.length, 0);
  }
  for (const secret of ["", "bad token", "ghp_x\r\nx-evil: 1"]) {
    const { context, calls } = host();
    await assert.rejects(
      read({ ...context, secrets: { access_token: secret } }),
      errorIs("credentials", "invalid_secret"),
    );
    assert.equal(calls.length, 0);
  }
  const { context, calls } = host();
  await assert.rejects(
    read(context, "{}"),
    errorIs("contract", "invalid_cursor"),
  );
  await assert.rejects(
    read(context, JSON.stringify({ version: 1, phase: "members", page: 0 })),
    errorIs("contract", "invalid_cursor"),
  );
  assert.equal(calls.length, 0);
});

test("a phase that disappeared mid-scan is not completed silently", async () => {
  const { context } = host(undefined, {
    organization: "example-org",
    copilot: "skip",
  });
  await assert.rejects(
    read(context, JSON.stringify({ version: 1, phase: "copilot", page: 2 })),
    errorIs("contract", "catalog_changed"),
  );
});
