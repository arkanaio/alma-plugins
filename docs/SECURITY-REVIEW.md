# Security review of a connector

No version of a connector is published without passing this review. **Not
arkana's own either.** The process is settled in
[arkanaio/alma#366](https://github.com/arkanaio/alma/issues/366).

It carries weight for one reason. A connector reaches a deployment **installed
as a package**, and ALMA's lint rule that keeps a connector away from the
database only covers ALMA's own tree — it does not reach `node_modules`. What
still stops a connector from reaching data is what always did: the execution
context gives it nothing to reach with, and ALMA's internal alias does not even
resolve from a published package. But the automatic check is no longer on that
side, so this review is.

This document owns the **process**: who reviews, what a review produces, when it
is passed, and what forces a new one. The checks themselves are the checklist in
[`reviews/TEMPLATE.md`](../reviews/TEMPLATE.md), which is also the file a review
fills in. They are written once, there, so the list a reviewer signs cannot
drift away from the list this repository documents.

## What the automated checks settle, and what they do not

CI is a pre-filter, and it is worth knowing exactly what it buys:

| Check | What it proves |
|---|---|
| `pnpm build`, `pnpm tsc --noEmit` | The contract's types are respected. |
| `pnpm biome ci .` | The code is formatted and free of the patterns Biome catches. |
| `pnpm test` | The connector returns what it says it returns, against its own sample data, through the real host-restricted `fetch`. |
| `dco` | Every commit carries a sign-off matching its author. |
| `pnpm review` | Every accepted review on record is complete and signed. |

None of them proves the connector does **nothing else**. A connector that reads
an environment variable, sends the credential in a query string, keeps an
activity date between runs or pulls in a dependency published last week passes
all of the above. That is the gap this review closes, and it closes it by
someone reading the code.

## Who reviews

A reviewer is someone with write access to this repository, and **never the
author of the contribution**. Two people, not one, when the code comes from
outside arkana:

| Support level | Signatures |
|---|---|
| `community` — contributed from outside arkana | **Two** reviewers, neither of them the author. |
| `official` — written by arkana | **One** reviewer, not the author. |
| `browser_automation` | **Two** reviewers, neither of them the author. |

A contribution from outside gets two because the first review of an unfamiliar
codebase is where the boundary is easiest to miss, and because a connector
arrives with a customer's provider credential in front of it. Browser automation
gets two for the same reason from the other direction: it is the support level
where the connector does not go through a documented API at all.

arkana's own connectors are reviewed like any other, by someone who did not
write them. A review nobody else reads is a review that checks nothing, and the
deployment that runs the result is a customer's.

Both reviewers read the code. The second is not a rubber stamp on the first: the
signatures mean two people looked, not that one looked and another agreed.

ALMA's record holds one account, `review.reviewedBy`. That is the reviewer who
writes the verdict file; the second signs by approving the pull request that
brings it, and both accounts are named in the file itself.

## What a review produces

A file in [`reviews/`](../reviews/), copied from
[`reviews/TEMPLATE.md`](../reviews/TEMPLATE.md) and named after the package and
the version:

```
reviews/connector-slack-1.0.0.md
```

**The result is a file and not a conversation**, because of what ALMA does with
it. Every incorporated connector carries in `connectors.lock.json` an HTTPS link
to its review, the date it was done and the GitHub account that did it, and that
link has to still answer the question years later: what exactly was approved,
and who approved it. A pull request approval is a state, not a document. A
comment can be edited afterwards with nothing visible left behind. A file merged
into `main` and cited by a permalink pinned to a commit keeps saying today what
it said the day it was signed, and it arrived the only way anything arrives
here — through a pull request someone else read.

The record cites it pinned to a commit, never to a branch:

```
https://github.com/arkanaio/alma-plugins/blob/<commit>/reviews/connector-slack-1.0.0.md
```

The file also fixes **the approved surface**: the `capabilities` and the
`allowedHosts` copied from the manifest. Those are what goes into ALMA's record,
and ALMA compares them against the installed manifest every time it starts. A
connector that gains a host after being reviewed does not run, even with the
same version number. Writing them into the verdict is therefore not bookkeeping:
it is the list of what somebody actually agreed to.

Only accepted reviews become files. A review that asks for changes or rejects a
contribution stays on the pull request, because nothing was approved.

## When it is passed

A version has passed its review when all of this is true:

1. The verdict file is in `main`, with `Verdict: Accepted`.
2. Every box in it is checked, and its header names the exact commit that was
   read.
3. It carries the signatures its support level requires, and none of them is
   the author's.

The file is usually the last commit on the connector's own pull request, written
by the reviewer, so one merge brings the connector and the evidence that it was
reviewed. When the contribution comes from a fork that maintainers cannot push
to, the verdict goes in a pull request of its own straight after the merge, and
nothing is published until it lands.

Publishing enforces it. The publish workflow refuses to publish a package with
no accepted review on record for the exact version in its `package.json`, and
`pnpm review` runs the same check locally. Beyond that, ALMA will not start
running a connector whose entry in `connectors.lock.json` nobody wrote, and
writing that entry means filling in the link to this file.

## What forces a new review

**Every published version has its own verdict file.** The record binds a review
to a version, so there is no such thing as a version that inherits the review of
another.

What changes is the depth, and it is honest to say so. A version that only fixes
code inside an already approved surface is reviewed against what changed, and
its file says which earlier review it builds on, in the notes. A version is
reviewed from scratch, with the whole checklist read against the whole
connector, when any of these moves:

- `capabilities` or `allowedHosts` — the approved surface itself.
- `supportLevel`, or the maintainer of the connector.
- `authentication`: a new scope, a different credential, or a permission the
  customer has to grant on top of what they already granted.
- The dependencies: one added, one removed, or one whose own tree changed
  shape.
- The `activity` declaration, in either direction.

A permission the customer has to grant deserves its own line because of how it
usually arrives: the provider is **already connected** for something else, and
the new capability looks like it comes for free. It does not. The checklist
asks what each new permission buys, what happens when the customer says no, and
that nothing switches itself on because the directory was already there.

## Outcomes other than accepted

- **Changes requested**, with the list of points that do not pass. The review
  may ask for things that are not functional defects: fewer dependencies,
  narrower hosts, a field removed from an error. That is not distrust of the
  contributor. The cost of getting it wrong is paid by a customer who never saw
  the pull request.
- **Rejected**, with the reason. A rejection over the connector boundary is not
  negotiated case by case: if a connector needs something the contract does not
  give, the conversation is about the contract, in an issue, and not about one
  exception.

Neither leaves a file in `reviews/`.

## When something is found afterwards

A verdict that has been cited is not edited. What was signed on the day stays
readable as it was signed, which is the only reason a permalink is worth
anything.

A problem found after publication follows [SECURITY.md](../SECURITY.md) — not a
public issue — and comes out the normal way: a fix, a review, a new version, and
a new entry in ALMA's record. The affected versions are stated when the fix is
published.
