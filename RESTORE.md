# VING Warroom source recovery

This recovery snapshot was copied from the production source commit
`89304520d5afc641b62ba3316414e3ef308728f6` without Git history. It contains code,
schema migrations, tests, assets and the bundled fallback business data needed
by the build. It is **not a full backup of the live Sites D1 database or R2
bucket**. Live edits, uploads and the latest synchronized records require their
own verified data backup.

## Local verification

Use Node.js 24 or another tested runtime with `node:sqlite` support. The normal
build uses Node built-ins; schema-authoring dependencies are pinned in
`pnpm-lock.yaml` (`pnpm install --frozen-lockfile` when needed).

1. Extract into an empty directory; keep `out/`, snapshots and `drizzle/`.
2. Run `node build.mjs` to create `dist/server/index.js`.
3. Validate the schema locally with:
   `node --input-type=module -e "import {previewDatabase} from './preview-db.mjs'; const db=previewDatabase(); db.close(); console.log('Schema restored in memory');"`
4. Run the relevant existing tests against the local build. Tests use synthetic
   credentials; those strings are never production account passwords.

`previewDatabase()` uses an in-memory database and skips data-only seed
migrations by default. Historical seed migrations are retained for provenance;
review them before applying to any real database.

## Recovery on Sites

Have an authorized operator verify the target Site, configure D1/R2 bindings,
and set secrets securely through Sites. `.env.example` contains names only and
no credential values. Account access, sync tokens, session signing keys and push
keys must be supplied through a secure channel. The existing `.openai/hosting.json`
retains the original project binding for reference: do not deploy blindly.

No command here deploys, imports data, overwrites production, reinstalls a sync
schedule, or sends notifications. Verify a separate recovery environment first.
Restore live data only after matching schema versions and checking row/object
counts and checksums; disable background synchronization and notification sends
until the recovery has been reviewed.

The launchd file and automation runbook use `/Users/LOCAL_USER` placeholders.
Update machine paths before intentionally installing any local scheduled job.
This snapshot preserves business aggregates, product/branch names and schema.
It removes recognized personal-data fields/patterns and local account paths;
automated pattern scanning is not a guarantee that arbitrary prose contains no
personal name. See the audit manifest supplied alongside the recovery snapshot.
