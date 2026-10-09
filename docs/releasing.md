# Maintainer release process

This is a future release plan, not an enabled publishing workflow. This change
adds no publishing trigger, npm credential secret, or OIDC publishing job.
Do not republish `@fiberlatch/access@0.1.1` or
`@fiberlatch/postgres-store@0.1.0`, move their source tags, or rewrite their history.
The PostgreSQL 0.1.0 tag remains at `2dd6c51d84e8642c5b6500ce3e583e6417a9ff0f`.

## Repository changes and CI

Use a branch and PR into `master`. Require successful GitHub Actions checks
`validate (22)` and `validate (24)` with the branch up to date before merging.
They run on every PR to master, including docs-only PRs, and validate the backend,
access package/example and PostgreSQL distribution. GitGuardian is advisory:
its observed PR scan passed, but there is insufficient history to guarantee it
appears on every PR. Inspect its results when present.

The active `Protect master` ruleset requires PRs, those two checks, and blocks
force pushes and deletion. No reviewer approval, signed commits, or linear
history is required. Use **Create a merge commit** for release changes so the
approved source commit survives in master. Repository admins have PR-only bypass
for recovery; ordinary contributors do not. Do not use bypass for routine merges.
Admins can edit the ruleset under Settings → Rules → Rulesets if recovery is
necessary; record the reason and restore protection afterward.

## Independent package identity

| Package | Workspace | Source tag | Proposed future workflow |
| --- | --- | --- | --- |
| `@fiberlatch/access` | `packages/access` | `access-vX.Y.Z` | `release-access.yml` |
| `@fiberlatch/postgres-store` | `packages/postgres-store` | `postgres-store-vX.Y.Z` | `release-postgres-store.yml` |

Prefer two small fixed-package workflows over a selectable workspace publisher.
Each releases only its own approved version; neither bumps or releases the other.
The filenames above are reserved design choices, not files that currently exist.
Historical tags remain unchanged.

## Future Trusted Publishing setup

Use GitHub-hosted runners with Node 24 and a pinned, reviewed npm version that
meets npm's OIDC minimum (currently npm 11.5.1 and Node 22.14.0). The eventual
publish job needs only `contents: read` and `id-token: write`; verification jobs
need no OIDC permission. No long-lived npm credential is needed.

Configure each npm package separately in npmjs.com → package → Settings →
Trusted publishing → GitHub Actions. Use owner `Ticoworld`, repository
`fiber-latch`, and that package's exact workflow filename above. If an environment
is used, its name must match on both sides. Future workflows should be manual
`workflow_dispatch` only, use a fixed package/workspace, and require explicit
version, source-tag/SHA and release-confirmation inputs. Merge the workflow into
protected master first. Dispatch manually at the approved package-specific source
tag, and verify that the tag's peeled commit, checkout HEAD and `github.sha` all
match the approved SHA reachable from master. Do not dispatch at current master
and then build a different commit: provenance uses the triggering SHA. The
reviewed workflow must also exist at the source tag. Do not publish on push,
tag creation, PR merge or GitHub release events.

Before enabling publishing, a maintainer must review the workflow PR, configure
the matching npm publisher, and explicitly confirm the npm-side configuration.
Keep the publish job disabled until then. The current npm setup expires a new
publisher if its first successful publish does not occur within two days, so
configure it just before an approved future release, not during this planning
task. Configuration alone is not proof of working OIDC or provenance.

Choose only the npm action needed by the reviewed workflow: direct publishing
must explicitly be allowed for `npm publish`; stage-only publishing is an
alternative requiring a separate reviewed adoption of its approval flow. Do not
grant dist-tag administration unless needed. Preserve account 2FA. Do not change
package publishing-access settings as an incidental release step.

For public packages from this public repository, successful GitHub Actions
Trusted Publishing automatically supplies provenance. It connects the artifact
to the source repository/commit and workflow/build identity. Keep each package's
`repository.url` matching this repository and its `repository.directory` correct.
Do not disable provenance or claim it exists before a verified OIDC publication.
The local PostgreSQL 0.1.0 release does not acquire provenance retroactively.

## Before a future publish

1. Review and merge the approved release source through a normal PR. Create the
   package-specific annotated tag at the exact approved source commit, never a
   later documentation/merge commit. Verify the tag target and master ancestry.
2. The manual workflow must verify its fixed package name, exact requested
   version, dispatch ref, tag pattern and peeled SHA, clean checkout, and successful required
   CI for that source. If master moved, update through a merge and revalidate.
3. Query the public registry immediately before publication. An existing version
   blocks publishing. Only a clear not-found response is availability evidence;
   auth/network failures must stop the job. npm versions cannot be reused even
   after unpublishing.
4. Install with `npm ci`, check the actual Node/npm versions and public registry,
   and run the normal checks below. Pack freshly and inspect actual archive files,
   metadata, size and hashes. Install the archive in an isolated consumer to
   validate imports, types, exports and declared dependencies. No workspace links.
5. Require an explicit maintainer release approval/confirmation before the
   OIDC-capable publish job. For a protected GitHub environment, ensure its
   approval policy works for a solo maintainer; do not require another person's
   approval unintentionally. Never run privileged publishing from a PR context.
6. Only a future reviewed/approved workflow may run `npm publish --access public`
   from its fixed package directory. Its `prepack` behavior must be checked:
   access requires an explicit build; PostgreSQL prepack rebuilds. Record the
   actual uploaded archive identity, source commit and job URL.

Access checks from the repository root:

```sh
npm run verify:access:package
npm run verify:access:example
```

PostgreSQL checks from the repository root:

```sh
npm run check --workspace @fiberlatch/postgres-store
npm run build --workspace @fiberlatch/postgres-store
npm test --workspace @fiberlatch/postgres-store
node packages/access/node_modules/publint/src/cli.js run --strict packages/postgres-store
npx --no-install attw --pack packages/postgres-store --profile esm-only --entrypoints .
```

Keep the PostgreSQL archive at six files unless the release deliberately changes
the reviewed allowlist: `package.json`, `README.md`, `LICENSE`, `dist/index.js`,
`dist/index.d.ts`, `sql/001_access_receipts.sql`. Exclude environment files,
credentials, fixtures, reports, source maps, local archives and workspace junk.
The SQL resource is read as a file; ATTW checks only the JS entry. Actual Node22/24
consumer checks cover synchronous CommonJS require, which ATTW's older Node16
model does not. Ordinary releases need no Neon credentials or full database
suite in CI. Runtime/SQL changes require a separately authorized real database
proof before approval; do not silently widen the release.

## After publication and ambiguous outcomes

Publish once. If the result is ambiguous, query the exact public version before
any retry. Wait briefly for processing and inspect registry metadata/checksums;
if still uncertain, stop for investigation. Never blindly retry or automatically
unpublish. On success, verify name/version/latest, peer/engine metadata, file
shape, integrity and a clean public-registry consumer install.

Create a GitHub release from the verified package-specific source tag only after
npm verification, with accurate notes and no prerelease flag for stable versions.
Repository release immutability is enabled for future releases. Prepare/review
all intended assets in a draft before publishing; publishing locks those assets
and the release tag. Existing non-immutable releases are not retroactively changed.
Do not attach local npm archives without an established reason. Check the tag,
release and provenance publicly, and leave the repository's tracked tree clean.

## Sources and configuration status

Requirements checked October 9, 2026; recheck before implementing the publisher:

- [npm Trusted Publishing](https://docs.npmjs.com/trusted-publishers/)
- [npm provenance](https://docs.npmjs.com/generating-provenance-statements/)
- [GitHub OIDC](https://docs.github.com/en/actions/concepts/security/openid-connect)
- [GitHub manual dispatch identity](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#workflow_dispatch)
- [GitHub release immutability](https://docs.github.com/en/code-security/how-tos/secure-your-supply-chain/establish-provenance-and-integrity/prevent-release-changes)

Manual work remains: implement/review the two non-automatic release workflows,
then configure each npm Trusted Publisher immediately before its next approved
release. No publishing workflow or npm Trusted Publisher was created by this
hardening change. No provenance claim is made for a future release yet.
