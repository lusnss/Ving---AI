# VING cloud authoring

The GitHub repository holds editable source under `project/`. The production
website retains its existing Sites project and its D1 database and R2 storage.
This source import does not copy the latest live database or uploaded files.

## One-time source import on GitHub

1. Confirm `lusnss/Ving---AI` is Private. Upload
   `ving-cloud-source-2026-10-03.zip` to the root of its default branch.
2. Create `.github/workflows/cloud-bootstrap.yml` on the same branch and paste
   the supplied YAML exactly. The expected ZIP checksum is embedded in it.
3. Open Actions → Import VING cloud source → Run workflow on the default branch.
   This is a manual, one-time job. Use an existing included Actions allowance;
   if GitHub requires a paid plan, payment method, or billing change, stop and
   have the repository owner decide. This package does not configure billing.
4. The job checks the private repository, archive paths and checksums, builds the
   Worker with Node.js 24, and validates the schema in memory. Only after these
   checks pass does it commit the new `project/` tree back to the same repository.
5. Confirm the job succeeded and inspect `project/CLOUD-SETUP.md`,
   `project/build.mjs`, `project/out/` and `project/.openai/hosting.json` on GitHub.

The job aborts if `project/` exists, if a checksum differs, or if the default
branch advances during the run. It does not force-push, remove the old ZIP,
change access, connect to live databases, install a Mac job, or deploy the Site.
If repository policy rejects the commit, preserve the job logs and resolve that
policy through the owner; do not disable branch protections automatically.

## Prepare Codex Cloud

Use the GitHub connection that can read and write this private repository. A
browser login alone does not grant the Codex GitHub connection repository access.

1. In ChatGPT web or desktop, choose Work in → Cloud → Select environment →
   Create environment, or Settings → Codex Cloud → Environments.
2. Select this repository and choose Get started.
3. Ask setup to use Node.js 24 and run `bash project/cloud/setup-cloud.sh` from
   the repository root. The current build uses Node built-ins and needs no
   package install. Schema-authoring dependencies are pinned in `pnpm-lock.yaml`;
   install them only when schema development requires them.
4. Review the setup checks, keep environment access private, and Publish.
5. Start future coding tasks from this published cloud environment. Work in
   `project/`, run the affected checks, and commit or open a pull request so
   source changes persist in GitHub. Cloud task saved state is not source control.

Suggested task instruction:

> Work on the VING project in project/ using cloud files only. Read AGENTS.md and
> context/ first. Keep the existing Sites project identity. Implement the requested
> change, run the relevant tests and build, and save the source change to GitHub.
> Publish through the existing Sites workflow only when Sites is available and
> authorized in this cloud task. Report separately whether source was saved and
> whether production deployment succeeded. Do not request access to a local Mac.

## Continue website updates through Sites

The existing binding is `appgprj_6aa7b6cb802c81918328655749df1975`, with D1 `DB`
and R2 `BUCKET`. Preserve that project identity and current audience.

Open the existing VING Site in ChatGPT web → Sites → Edit for the native online
authoring flow. Before changes, read the current Site source; the source snapshot
in this package is derived from production commit
`78f1313949d4a03c5a6985fd7f4c34bfec862c1d`, and may become older than production.

GitHub commits do not automatically deploy this Site. Publishing requires the
native Sites workflow: reconcile the selected source, push the exact source
commit to the Site's configured repository, build matching deployment output,
save a version, deploy it, then verify deployment success. Keep GitHub source
aligned with the changes made through Sites. Never deploy this bootstrap snapshot
over a newer Site or overwrite newer live D1/R2 records with bundled fallback data.

Runtime credentials belong in Sites settings or the cloud environment's secret
settings. `.env.example` contains variable names only. Do not copy credentials
into GitHub, documentation, a workflow YAML, or chat. This package does not set up
cloud schedules; migrate any required updater separately after checking its
source access and existing schedule. The old Mac launchd file is historical
reference and must not be installed for a cloud-only workflow.

## Source review and limits

The ZIP contains Git-tracked source only, without history or local untracked
state. Required `out/` assets and fallback snapshots are retained. Generated
`dist/`, dependency directories, caches, actual `.env` files, keys, local runtime
state and raw database backups are excluded. Recognized personal-data fields,
identifier patterns and local account paths are redacted; synthetic test fixtures
remain available for testing. `SOURCE-MANIFEST.json` lists the exact source
revision, additions, transformations, and per-file hashes. Automated pattern
checks cannot establish that all arbitrary prose is free of personal names.

Official references:

- [Codex Cloud](https://learn.chatgpt.com/docs/cloud)
- [Cloud environments](https://learn.chatgpt.com/docs/environments/cloud-environments)
- [Sites](https://learn.chatgpt.com/docs/sites)
- [Manually running GitHub Actions](https://docs.github.com/en/actions/managing-workflow-runs/manually-running-a-workflow)
