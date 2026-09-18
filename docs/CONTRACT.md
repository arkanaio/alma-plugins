# The connector contract

> **Provisional.** The shared connector definition is settled in [arkanaio/alma#364](https://github.com/arkanaio/alma/issues/364). Until then, this document and the `contract/` package are this repository's working reference. Breaking changes are announced in [CONTRIBUTING.md](../CONTRIBUTING.md).

## What a connector is

A piece that **knows how to talk to one specific provider and knows nothing else**. It does not know about organisations, it has no database access, it does not know how a change is audited. It receives a validated configuration and a credential, queries the provider, and returns the data in an agreed shape.

That boundary is not a matter of style. It is what makes accepting external contributions possible: reviewing a piece that can only talk to the declared provider and return a known shape is a bounded task.

## Capabilities

A connector declares one or more:

| Capability | What it synchronises | What it feeds in ALMA |
|---|---|---|
| `directory` | The organisation's list of employees | Automatic employee joins and leaves |
| `devices` | The inventory of machines the provider manages | Equipment inventory |
| `licenses` | Contracts and occupied seats | License inventory and cost control |

A provider like Slack or Figma would declare only `licenses`. Google Workspace declares `directory` and `licenses`. Mosyle declares only `devices`.

This repository starts with the `licenses` capability, which is where the most real providers are waiting. `directory` and `devices` will reuse exactly this contract.

## The manifest

The card ALMA uses to present the connector to the customer.

```ts
{
  id: "example",                      // slug, stable forever
  name: "Example provider",
  description: "...",
  documentation: "https://...",
  capabilities: ["licenses"],
  support: "official",                // "official" | "community" | "browser"
  domains: ["api.example.test"],      // a commitment, not a hint
  configuration: [ /* fields the organisation fills in */ ],
  exposesSeatPrice: true,
  activity: { supported: false },
}
```

`support` is shown to the customer as-is so they know what they have installed. An external contribution is `community`.

`domains` is the closed list of machines the connector may talk to. The host enforces it: a request to any other machine is an execution failure, not a decision the connector makes.

## What it receives when it runs

```ts
type ExecutionContext<Configuration> = {
  configuration: Configuration;
  credential: Readonly<Record<string, string>>;
  request: (input: OutboundRequest) => Promise<Response>;
  log: (message: string, data?: Record<string, string | number>) => void;
  cancellation: AbortSignal;
};
```

That is all. There is no database client, no organisation identifier, and no global `fetch` available. **If something is not in the context, the connector does not have it.**

- `request` is the only way out to the network. It enforces the declared domains, timeouts, and size limits.
- `credential` arrives decrypted. It is never logged, never returned, and never forwarded anywhere.
- `log` is for technical traces: numbers and states. Never personal data, never credentials.
- `cancellation` fires when the host aborts the sync. Respect it in long loops.

## What the licenses capability returns

Two paged reads and no writes.

```ts
verifyAccess(context): Promise<void>
listContracts(context, cursor): Promise<Page<LicenseContract, C>>
listSeats(context, cursor): Promise<Page<LicenseSeat, C>>
```

A **contract** is what the organisation pays for: product, plan, total seats, seat price, billing cycle, and renewal date. Whatever the provider does not give goes to `null`.

A **seat** is an account occupying a place on that contract: external identifier, the contract it belongs to, email, display name, status, and optionally last activity.

The connector **does not classify** seats. It does not decide whether an account is orphaned: it hands the account over as-is and ALMA reconciles, because ALMA is the one that knows the organisation's employees. That reconciliation — held by a known employee, orphaned, or an employee with no detected account — is exactly where the product's value is, and it depends on data the connector does not have and should not have.

## Errors

Tell two classes apart, because the host does different things with them:

- **Not retryable.** The credential was rejected, the configuration is invalid, the provider returned something that does not match its own contract. ALMA leaves the connection marked "reauthentication required" instead of failing silently forever.
- **Retryable.** Quota exhausted (429) or a temporary provider failure (5xx). ALMA retries later.

Faced with a response that does not match the schema, fail. Never produce wrong data saved silently: that is worse than not syncing.

## What a connector may never do

- Reach the product's database directly.
- Decide which organisation a piece of data belongs to: it always receives that context already resolved.
- Talk to any address other than the provider it declares to serve.
- See another integration's credential, or hand its own back to the customer.
- Write to the provider.

## See also

- [ACTIVITY.md](ACTIVITY.md) — the optional last-activity capability.
- [SAMPLE-DATA.md](SAMPLE-DATA.md) — how all of this is tested without a real provider.
- `connectors/example/` — the whole contract, runnable.
