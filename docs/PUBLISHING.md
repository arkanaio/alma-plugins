# From this repository to a deployment

Writing a connector and incorporating it are not the same act, and that
difference is what holds the rest up. A connector is written and reviewed here;
it reaches ALMA **installed as a package**. Incorporating it is the act by which
a deployment starts running one specific, already reviewed version.

ALMA's side of this is
[`docs/CONNECTORS.md` §6](https://github.com/arkanaio/alma/blob/main/docs/CONNECTORS.md).

## The path

1. **Proposal issue** here, agreed before any code.
2. **Pull request** with the connector. CI runs with no network and no
   credentials.
3. **Human security review**, with [SECURITY-REVIEW.md](SECURITY-REVIEW.md).
   Mandatory from `1.0.0` on, arkana's own connectors included; below `1.0.0`
   it is waived for now (see
   [Before 1.0.0](SECURITY-REVIEW.md#before-100)). It ends in a file merged into
   `main`, `reviews/<package>-<version>.md`, signed by two maintainers for a
   connector contributed from outside and by one for arkana's own. That file is
   what the record below cites.
4. **A published version**: `@arkanaio/connector-<provider>@1.2.0`. Merging to
   `main` publishes every package whose version is not on npm yet, so releasing
   means bumping the version in the pull request; a merge that bumps nothing
   publishes nothing. From `1.0.0` on, the publish workflow refuses a package
   whose exact version has no accepted review on record, so step 4 cannot
   happen before step 3.
5. **Incorporation into ALMA**, which is two steps and no third one:
   - `pnpm add @arkanaio/connector-<provider>@1.2.0`, exact, no range.
   - Write its entry in `connectors.lock.json` and add its definition to
     `src/connectors/index.ts`.
6. **Activation.** The customer organisation configures its credentials and
   enables it.

## Trusted publishing

The publish workflow authenticates to public npm using GitHub Actions OIDC,
without `NPM_TOKEN` or `NODE_AUTH_TOKEN`. It runs on `ubuntu-latest`, because
npm does not support trusted publishing from self-hosted runners, and always
requests provenance. The exact-version security-review gate still runs before
publishing; an attestation does not replace a review.

A maintainer must configure a trusted publisher **for each non-private package**
before its next automated release. In the package's npm settings, select GitHub
Actions and use:

| Field | Value |
|---|---|
| Organization or user | `arkanaio` |
| Repository | `alma-plugins` |
| Workflow filename | `publish.yml` |
| Environment | `publish` |
| Allowed action | Direct publishing (`npm publish`) |

The active packages are `@arkanaio/connector-contract`,
`@arkanaio/connector-atlassian-licenses`,
`@arkanaio/connector-bitbucket-licenses`,
`@arkanaio/connector-github-licenses`,
`@arkanaio/connector-google-workspace-licenses`, and
`@arkanaio/connector-microsoft-365-licenses`. Add every new public workspace
package to this configuration; private examples never publish. Retired packages
are not released by this repository and do not need a new trust relationship.

npm also supports `npm trust` from npm 11.15.0 onward, using an authenticated
maintainer session with 2FA. A bypass-2FA automation token cannot configure it.
See [npm's trusted publishing guide](https://docs.npmjs.com/trusted-publishers/)
and [the CLI requirements](https://docs.npmjs.com/cli/v11/commands/npm-trust/).

### First publication of a new package

A trusted publisher can only be configured after the package exists on npm.
A maintainer first publishes the real, verified initial version from an
interactive npm session with 2FA, after checking its security review when
required. Use `pnpm --filter <package-name> publish --access public` from the
accepted release commit. Do not publish an empty placeholder or store an
automation token in CI. Configure the publisher immediately afterward; the
next version can then be published by the workflow. A local first publication
does not have GitHub Actions provenance; verify provenance on the subsequent
OIDC release.

### Migration verification and token removal

1. Configure all active packages before merging the token-free workflow.
2. Release a new version through `publish.yml` with no static npm token supplied.
   Keep the run URL, commit and package version as the evidence; a run that
   finds no pending versions does not prove publishing works.
3. Check the authentication output for OIDC and the published version's registry
   metadata for its trusted publisher and provenance attestation. Verify the
   attestation points to this repository, workflow and release commit.
4. Only after that succeeds, remove the repository's `NPM_TOKEN` secret and its
   entry from the local production secret file. Revoke the old automation token
   on npm as well: deleting stored copies does not revoke the credential.
5. Confirm the GitHub secret and local variable are absent without printing
   their values, and retain the release evidence with the migration handoff.

## Why a package, and what checks what

The split is the one that already makes sense in a project with a package
manager. That the installed code is exactly what was published is
`pnpm-lock.yaml`'s job: it stores the version and the integrity hash and checks
them on every install. Repeating that by hand would be maintaining, worse, what
the package manager already does.

The record, `connectors.lock.json`, stores what no lockfile knows: **which
review approved that version, who did it and when, and what surface was approved
with it** — the capabilities and the hosts.

`review.reference` is the permalink of the verdict file, pinned to a commit and
never to a branch:

```
https://github.com/arkanaio/alma-plugins/blob/<commit>/reviews/connector-slack-1.0.0.md
```

Pinned, because the record has to keep showing what was signed on the day, not
what the file says today. `review.reviewedBy` is the maintainer who wrote that
file; a second signature, where one is required, is named inside it.

From that comes the property that matters most: **raising the dependency without
going through the record leaves the deployment unable to start.** The installed
manifest would say 1.1.0 and the record would still say 1.0.0. There is no way
for a version to run without someone having written down that they reviewed it.

Both directions are checked, because they mean different things: a connector
with no record is unreviewed code, and a record with no connector is a piece of
paper that no longer describes what runs.

## What your package must satisfy

- **A scoped name.** `@arkanaio/connector-<provider>`. An unscoped name is the
  one that lets a typo install somebody else's package, and here the typo would
  be installed with a customer organisation's credentials in front of it. ALMA's
  record schema rejects it outright.
- **A semantic version** in the manifest, matching the published version. They
  are the same claim made from two sides.
- **`"license": "Apache-2.0"`** in its `package.json`. It is the license of the
  whole repository, and a published package with no license field is one nobody
  downstream can account for.
- **No install scripts.** pnpm blocks them unless explicitly allowed, and a
  connector is never added to that list.
- **Runtime dependencies are allowed**, and reviewed one by one. Each one is
  surface someone has to read, so bring what you need and justify it in the PR.

## Versioning

Semantic, per connector:

- **Major**: what ALMA receives changes, or the connector needs different
  configuration or a different credential. Incorporating it requires work.
- **Minor**: new fields, a provider case that was not covered before.
- **Patch**: fixes that do not change what is received.

Every published version has its own review, because the record binds a review
to a version: no version inherits another's. What changes is the depth. A
version that only fixes code inside an already approved surface is reviewed
against what changed; moving `allowedHosts`, `capabilities`, `supportLevel`, a
permission asked of the customer, a dependency or the `activity` declaration
means the whole checklist again, whatever the version number says.

The **contract** package versions separately. A breaking change to it is
announced in [CONTRIBUTING.md](../CONTRIBUTING.md) before it is applied.

## What never happens

A customer organisation **does not install code**. It does not upload a
connector, does not choose a version, and does not run anything of its own
inside ALMA. Incorporating is an act of the deployment; the organisation
configures credentials and enables what is already incorporated.

## When a connector breaks

A provider can change its API without notice. The sync then fails with a clear
error and **saves no wrong data silently**. If the failure is a credential
failure, the connection is marked as needing reauthentication instead of
retrying forever. The fix goes through the normal path: PR, tests, review, new
version, new record entry.

A connector with no maintainer that has been broken for a while is marked
unmaintained and removed from the list offered to new customers, without
breaking anyone who already has it enabled.
