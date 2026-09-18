# The optional last-activity capability

This captures the decision taken in [arkanaio/alma#409](https://github.com/arkanaio/alma/issues/409). Read it in full before declaring this capability.

## It is optional, and genuinely so

A license connector that synchronises contracts and seats **without offering activity is completely valid**. It is accepted the same, published the same, and used the same by the customer. Plenty of providers simply do not publish this value, and forcing it would produce an invented number, which is worse than having none.

No manual substitute is allowed: not asking for the date by hand, not periodic file uploads.

## How it is declared

In the manifest, in the `activity` field.

When the provider does not offer it:

```ts
activity: { supported: false }
```

When it does:

```ts
activity: {
  supported: true,
  measures:
    "The last time the account produced an action inside the product, from the provider's last_active_at field.",
  limitations:
    "Daily granularity and up to 24 hours of delay. It does not tell real usage apart from sessions opened by integrations.",
}
```

`measures` and `limitations` are not filler text: they are reviewed and they are shown to the customer. They have to say **what exactly the provider measures** and **where it stops measuring**.

## What does not count as activity

None of these is usage of a license, and none of them may stand in for the value:

- The **sync date**. That is when we looked, not when anyone used anything.
- The seat's **assignment date**. That is when someone was given the license.
- A **generic sign-in to the account**, such as a login through the provider's SSO or the creation of the account. Signing into an account is not using the product being paid for.
- A **date derived** from any of the above.

If the provider only publishes one of these, the capability is `{ supported: false }`. Substituting a stand-in makes the report of paid unused seats point at people based on a value that does not mean what it claims to mean.

## Absence of information

With no value from the provider, the seat returns `lastActivity: null`.

`null` means **we do not know**, not "they are not using it". Having no information does not prove a lack of use, and ALMA treats it that way: the report of paid unused seats tells free seats apart from assigned seats with evidence of inactivity, and seats with no information are not counted as inactive.

Never return a very old date, or the epoch, or the account creation date, to "represent" the absence of a value.

## The provider's date and the moment of the read are two facts

```ts
lastActivity: {
  providerDate: "2026-09-16T08:12:00Z",  // what the provider says
  readAt: "2026-09-18T06:30:00Z",        // when we read it
}
```

A failed sync does not turn a stale value into a current reading. That is why the connector stamps `readAt` at the moment of the read and never copies it from `providerDate`.

## What the connector does not do

These rules are ALMA's, not yours. They are listed so it is clear the connector **neither has to implement them nor can**:

- The organisation **explicitly enables** collection, and it is off by default. Connecting the provider enables nothing.
- The purpose is managing license usage and cost and reviewing potentially unnecessary seats; **not** measuring productivity, performance, or working time.
- Only the **latest** value is kept, and only while the assignment and the collection are both active. It is deleted when the seat is released, when collection is disabled, or when the integration is disconnected. A new assignment never inherits the previous person's activity.
- **No history is accumulated**, not through the audit trail either.

For the connector this comes down to one practical rule: **return the value and do not store it anywhere**. Do not write it to disk, do not cache it between runs, and do not put it in a trace.

## Traces

`context.log` may not receive activity values, emails, names, or personal identifiers. A trace for a page of seats counts how many came back; it does not say who they were or when they signed in.

```ts
context.log("Read a page of seats", { seats: body.members.length });  // good
context.log(`Last sign-in for ${email}: ${date}`);                     // rejected
```

`connectors/example/tests/connector.test.ts` has a test that checks exactly this. Copy it.

## What gets reviewed

The security review checks each of these:

- [ ] `measures` describes the provider's real field, with a link to its documentation.
- [ ] `limitations` states granularity, delay, and which cases are not covered.
- [ ] No sync date, assignment date, or generic sign-in stands in for usage.
- [ ] With no value, `null` is returned, never a filler date.
- [ ] `readAt` is stamped at the read.
- [ ] The value is not persisted, not cached, and appears in no trace.
- [ ] There is a test with a seat that has no activity, and one proving the trace does not leak the value.
