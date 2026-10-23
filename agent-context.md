# Manasbal: context for AI agents

Read this first. It points to the rules; the rules themselves live in the files listed here. Where a rule is written in a file, follow the file. Where it is written here, it applies because the file doesn't say otherwise.

Written for: an AI coding agent working in this repository.

## 1. What the project is

- Manasbal is a demo multi-vendor marketplace (monorepo). It is a portfolio project: nothing is for sale, and payments and delivery are simulated.
- Read: [README.md](../README.md), [ROADMAP.md](../ROADMAP.md) (local only, gitignored), [docs/adr/README.md](../docs/adr/README.md)
- Apps: `apps/web` (Next.js storefront), `apps/console` (Vite + React), `apps/api` (NestJS on Fastify, Prisma 8 RC). Shared packages: `packages/*`.

## 2. Rules: where they are written

| Topic                                                                             | File                                                                                            |
| --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Branches, commits, sign-off, PRs, changesets, release flow, rules that never bend | [CONTRIBUTING.md](../CONTRIBUTING.md)                                                           |
| PR checklist and description                                                      | [.github/pull_request_template.md](../.github/pull_request_template.md)                         |
| Commit message format                                                             | [commitlint.config.mjs](../commitlint.config.mjs)                                               |
| Changesets (base branch is `dev`)                                                 | [.changeset/config.json](../.changeset/config.json)                                             |
| Architecture decisions (accepted; never edit, supersede instead)                  | [docs/adr/](../docs/adr/)                                                                       |
| Prisma 8 RC decision                                                              | [docs/adr/0007-prisma-8-release-candidate.md](../docs/adr/0007-prisma-8-release-candidate.md)   |
| CI/CD and deploy rules                                                            | [docs/adr/0006-ci-cd-pipeline.md](../docs/adr/0006-ci-cd-pipeline.md)                           |
| Legal guardrails (no real card, ID or bank data; no brands)                       | [docs/legal/LEGAL_RISK_REGISTER.md](../docs/legal/LEGAL_RISK_REGISTER.md) (local only)          |
| Repo contents policy (app and tooling only; no team notes in the repo)            | [ROADMAP.md](../ROADMAP.md) and [team/](.) are local only; keep them out of commits             |
| Secrets scanning                                                                  | [.gitleaks.toml](../.gitleaks.toml), [.gitguardian.yaml](../.gitguardian.yaml)                  |
| Formatting                                                                        | [.prettierrc.json](../.prettierrc.json), [.editorconfig](../.editorconfig)                      |
| Node and pnpm versions                                                            | [.nvmrc](../.nvmrc), [package.json](../package.json)                                            |
| Database schema (the Prisma contract)                                             | [apps/api/src/prisma/contract.prisma](../apps/api/src/prisma/contract.prisma)                   |
| Schema design sketch                                                              | [team/diagrams/schema-v1.dbml](diagrams/schema-v1.dbml) (local only)                            |
| Contributor notes and weekly plans                                                | [team/](.) (local only): [team/03-daily-routine.md](03-daily-routine.md), [team/weeks/](weeks/) |

Rules listed in those files are not repeated here. Read the file before you act on a topic.

## 3. Rules that apply to every change

These come from the owner's private instructions and memory, so they are restated here.

1. **Branch from a fresh base.** Run `git fetch origin`, then fast-forward the local base (`dev`) with `git pull --ff-only`, then create the branch. Never branch from a stale base. Never reset or discard someone else's uncommitted or unpushed work to do this; if the fast-forward fails, stop and say why.
2. **Branch names:** `MAN-<number>-<short-slug>`, cut from `dev`.
3. **Commits:** Conventional Commits, signed off (`git commit -s`). Never add a `Co-Authored-By: Claude …` trailer or any tool-credit line.
4. **Pull requests:** into `dev`. Keep the description short: what changed, why, how it was checked. A few lines or bullets. Never end with a "Generated with Claude Code" line or any tool-credit footer. Add screenshots only for visible UI changes.
5. **Before a PR:** `pnpm lint && pnpm typecheck && pnpm test && pnpm build` must pass.
6. **Remote branches** are deleted on merge. Local branches are kept on purpose. Do not prune local branches.
7. **Never commit** `.env` files, secrets, real personal data, real brands, or copied code. Use `.env.example` for new variables.
8. **Money** is stored as whole paise (integers). ₹499.00 = `49900`.
9. **Clean room:** write every line of code yourself. Do not copy from other projects or employers.
10. **Icons** are drawn in-house. No icon libraries.
11. **Significant decisions** get an ADR in `docs/adr/`, numbered after the last one.

## 4. Database (Prisma 8 RC), run from the repo root

- The schema is `apps/api/src/prisma/contract.prisma`. It starts with `// use prisma-8`. Ids are `Uuid` with client-side `uuid()` defaults. Tables are plural snake_case via `@@map`.
- Commands, in order (run with `pnpm --filter @manasbal/api exec …`):
  1. `prisma contract emit`
  2. `prisma migration plan --name <name>`
  3. `prisma migration show <dir>`
  4. `prisma db migrate --advance-ref db`
- Commit the contract, `contract.json`, `contract.d.ts`, `refs/db.json`, and the `migrations/` folder together.
- Do not use `prisma migrate dev`. Prisma 8 has no Studio; the stable CLI is used for Studio: `pnpm dlx prisma@7.10.1 studio --url "<url>"`.
- Reference: [docs/adr/0007-prisma-8-release-candidate.md](../docs/adr/0007-prisma-8-release-candidate.md), and the earlier decision in memory (below).

## 5. Local setup

- Docker runs Postgres, Valkey, Mailpit and Meilisearch: [docker-compose.yml](../docker-compose.yml). Setup steps: [README.md](../README.md#local-databases).
- Copy `.env.example` to `apps/api/.env` before starting the API.

## 6. Owner's memory and instructions (outside the repo)

These files hold the owner's private rules. Read them if you can access the owner's profile; they are not in the repo.

- Global instructions: `C:\Users\Lakshya Gupta\.claude\CLAUDE.md`
- Memory index: `C:\Users\Lakshya Gupta\.claude\projects\d--CodeYogi-Ecommerce-Application\memory\MEMORY.md`
  - `commit-message-style.md`: short commit descriptions, no `Co-Authored-By`
  - `repo-contents-policy.md`: app and tooling only in the repo
  - `prisma-8-decision.md`: Prisma 8 commands and CI gate
  - `shared-docs-confirmation-only.md`: never write the owner's private documents into the repo, plans or notes
  - `peer-session-context.md`: ask before touching areas another session owns

## 7. Working with people

- Contributors (see [README.md](../README.md#contributors)) use the same rules. Contributors use their own AI account or Antigravity's built-in AI, never the owner's login. Each PR says whether AI was used and for what.
- Never use or expose anyone's login, `.env` values, or personal data, including another contributor's.
- Each change must be explainable line by line by the person who merges it.

## 8. Before you finish a task

- [ ] Work is on a `MAN-…` branch cut from a fresh `dev`
- [ ] `pnpm lint && pnpm typecheck && pnpm test && pnpm build` pass
- [ ] Commits are signed off and follow Conventional Commits
- [ ] A changeset exists if users would notice the change
- [ ] No secrets, `.env` files, team notes or personal data are staged (`git status`)
- [ ] PR targets `dev`, with a short description and no tool-credit footer
