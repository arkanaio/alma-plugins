# Reviews

One file per reviewed version, and it is the evidence that the version was
approved. ALMA's incorporation record cites it by permalink, so these files are
written to be read years later by someone who was not there.

```
reviews/connector-slack-1.0.0.md
```

The name is the package without its scope, then the version. Only accepted
reviews live here: a review that asks for changes or rejects a contribution
stays on its pull request, because nothing was approved.

**A file here is never edited after ALMA's record cites it.** A permalink pinned
to a commit keeps showing what was signed, but a correction that matters — the
approved surface was written down wrong, something was found afterwards — is a
new review of a new version, with its own file. Fixing a typo in the prose is
fine; changing what was approved is not a typo.

`pnpm review` checks every file here: that the header is complete and agrees
with the file name, that the sections still match
[TEMPLATE.md](TEMPLATE.md), that no box was left unchecked, and that a
`community` connector carries the two signatures it needs. The publish workflow
runs the same check for the exact version it is about to publish, so a package
with no accepted review here does not leave the repository.

The process is [docs/SECURITY-REVIEW.md](../docs/SECURITY-REVIEW.md). The
checklist is [TEMPLATE.md](TEMPLATE.md).
