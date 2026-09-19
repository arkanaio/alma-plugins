# The optional last-activity capability

This is the connector side of the decision taken in
[arkanaio/alma#409](https://github.com/arkanaio/alma/issues/409). Read it in
full before declaring the capability. ALMA's own side of it is in
[`docs/CONNECTORS.md` §5](https://github.com/arkanaio/alma/blob/main/docs/CONNECTORS.md).

## It is optional, and genuinely so

A license connector that synchronises plans and seats **without offering
activity is completely valid**. It is accepted the same, published the same and
used the same. Plenty of providers do not publish this value, and forcing it
would produce an invented number, which is worse than having none.

No manual substitute is allowed: not asking for the date by hand, not periodic
file uploads.

## How you declare it

`activity: null` when the provider does not offer it. Otherwise:

```ts
activity: {
  documentationUrl: "https://provider.example/docs/activity",
  measures:
    "The last time the account opened a document in the workspace, from the provider's last_active_at field.",
  limitations:
    "Daily granularity and up to 24 hours of delay. It does not tell real usage apart from sessions opened by integrations.",
}
```

`measures` and `limitations` are not filler: they are reviewed and they are
shown to the customer. They say **what exactly the provider measures** and
**where it stops measuring**, and `documentationUrl` points at the provider's
own page for that field so a reviewer can check the claim.

The manifest schema rejects `activity` on a connector that does not declare the
`licenses` capability. You cannot attach it to a directory or device connector.

## What does not count as activity

None of these is usage of a license, and none may stand in for the value:

- The **sync date**. That is when we looked, not when anyone used anything.
- The seat's **assignment date**. That is when someone was given the license.
- A **generic sign-in**, such as a login through the provider's SSO or the
  creation of the account. Signing in is not using the product being paid for.
- A **date derived** from any of the above.

If the provider only publishes one of these, `activity` is `null`. Substituting
a stand-in makes the report of paid unused seats point at people based on a
value that does not mean what it claims to mean.

## What you return, and what ALMA makes of it

You return one field per seat:

```ts
lastActivityAt: "2026-09-16T08:12:00.000Z" | null
```

That is the date **the provider reports**. You never stamp a date of your own,
and you never substitute one when the provider has none: `null` is the answer.

ALMA turns that into one of four states, and this is why `null` is safe:

| State | What it means |
|---|---|
| `not_declared` | Your connector does not offer the capability |
| `not_collected` | The organisation has not enabled collection |
| `unavailable` | The provider has no date for that account |
| `observed` | There is a reading, with the provider's date and the moment ALMA read it |

**Only `observed` is evidence.** The other three are different kinds of not
knowing, and none of them proves a license is unused: the report of paid unused
seats tells free seats from assigned seats with observed inactivity, and seats
with no information are not counted as inactive.

So never return an old date, the epoch, or the account creation date to
"represent" the absence of a value. `null` already says it, and says it
correctly.

## What you do not have to do

These rules are ALMA's. They are listed so it is clear you **neither have to
implement them nor can**:

- Collection is **explicitly enabled per organisation** and off by default.
  Connecting the provider enables nothing. It is a required argument of ALMA's
  license reader, so activity you return without it being enabled is discarded
  before anyone can store it — even if your connector returned it.
- The moment of the read is stamped by ALMA, from its own clock, and only when
  the read succeeded. A transient failure never turns a stale value into a
  recent check.
- Only the **latest** value is kept, while the assignment and the collection are
  both active. It is erased when the seat is released, when collection is
  disabled, when the integration is disconnected, and when the occupant changes.
- **No history is accumulated**, not through the audit trail either.

For you this comes down to one rule: **return the value and store it nowhere.**
Not on disk, not cached between runs, not in an error.

## Errors never carry it

`ConnectorError` takes a kind and a closed code, and its message is the code.
That is not only about credentials: an activity date inside an error message
would be exactly the personal history the decision forbids, arriving through
observability instead of the database.

## What gets reviewed

- [ ] `measures` describes the provider's real field, and `documentationUrl`
      points at the provider's page for it.
- [ ] `limitations` states granularity, delay and which cases are not covered.
- [ ] No sync date, assignment date or generic sign-in stands in for usage.
- [ ] With no value, `lastActivityAt` is `null`, never a filler date.
- [ ] The connector stamps no date of its own.
- [ ] The value is not persisted, not cached and not logged.
- [ ] There is a test with a seat that has no activity.
- [ ] Nothing in the contribution builds a history of one person's activity:
      not a response, not the sample data, not a test, not an error. One
      current value per seat, and nothing kept between runs.
