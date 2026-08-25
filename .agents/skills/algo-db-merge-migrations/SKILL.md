---
name: algo-db-merge-migrations
description: Fix Drizzle migration number collisions after rebase/merge with main, and reset a broken PR preview DB when journal hashes diverge
---

Preview volumes persist (`infra/preview/compose.yml`). Renumbering a tag already applied on that volume → migrate crashloops. CI `_test` stays green. Never rewrite a migration already on `main`/prod.

## A — Branch

1. Two files sharing `XXXX__` or a stolen journal tag.
2. Keep `main`'s file. Delete **your unapplied** `.sql` + `meta/XXXX_snapshot.json` + journal row; keep `schema.ts`; `bun run db:generate <module>__<action>__<subject>_`.
3. Rebase onto `main`. Force-push `--force-with-lease`.
4. Safety pass: `algo-db-generate-migration/references/migration-safety-checklist.md`. Hooks block hand-editing migration SQL — regenerate.

## B — Preview volume

Wipe compose **with volumes**, then redeploy. Close+reopen the PR (cleanup on `closed`, deploy on `reopened`) always works. Dokploy fallback: delete `preview-pr-<N>` with volumes, then Preview Deploy.

Done: PR comment `## Preview Deployment` deployed, `https://pr-<N>.algoacademy.pl` loads, migrate+seed in logs.

## C — Local (optional)

`bun run db:reset` (or `db:reset:all`) then `bun run test:integration`.
