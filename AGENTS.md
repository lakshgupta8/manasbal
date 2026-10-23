# AGENTS.md

Instructions for AI coding agents working in this repository. Written for: an agent running in opencode (or any other tool).

## 1. Read first

1. [team/agent-context.md](team/agent-context.md): the project context and the rules, with the file each rule lives in. It is a local file (gitignored); if it is missing, ask the owner for it instead of guessing.
2. [CONTRIBUTING.md](CONTRIBUTING.md): branches, commits, sign-off, pull requests, changesets, releases.
3. [docs/adr/README.md](docs/adr/README.md): accepted architecture decisions. Never edit an accepted record; write a new one that supersedes it.

Do not commit or stage `team/`, `ROADMAP.md`, `docs/legal/`, `.env` files or `AGENTS.md`. Check with `git status` before every commit.

## 2. Non-negotiable rules

- Cut every branch from a fresh base: `git fetch origin`, `git switch dev`, `git pull --ff-only`, then `git switch -c MAN-<number>-<short-slug>`. Never branch from a stale `dev`.
- Never reset, discard or overwrite someone else's uncommitted or unpushed work. If a fast-forward fails, stop and report why.
- Commits: Conventional Commits, signed off with `git commit -s`. Never add a `Co-Authored-By` trailer or any tool-credit line.
- Pull requests: into `dev`, short description (what changed, why, how it was checked), no tool-credit footer.
- Never commit secrets, `.env` values, real personal data, real card, ID or bank numbers, real brands, or code copied from anywhere else (clean room).
- Money is whole paise (integers).
- Do not prune local branches. Remote branches are deleted on merge; that is intended.

## 3. Commands (run from the repo root with pnpm 10 and Node 24, see `.nvmrc`)

| Task                                                         | Command                                                  |
| ------------------------------------------------------------ | -------------------------------------------------------- |
| Install                                                      | `pnpm install`                                           |
| Run every app plus Storybook                                 | `pnpm dev`                                               |
| Before opening a PR                                          | `pnpm lint && pnpm typecheck && pnpm test && pnpm build` |
| API end-to-end tests                                         | `pnpm test:e2e`                                          |
| Storybook screenshot and accessibility checks (needs Docker) | `pnpm test:visual`                                       |
| Format                                                       | `pnpm format`                                            |
| Changeset (user-visible change)                              | `pnpm changeset`                                         |

## 4. Local services

- Start: `cp .env.example apps/api/.env` (once), then `docker compose up -d`. Stop: `docker compose stop`.
- Postgres `localhost:5432`, Valkey `6379`, Mailpit web `http://localhost:8025`, Meilisearch `http://localhost:7700`.
- Storybook: `http://localhost:6006` after `pnpm dev`.

## 5. Database (Prisma 8 release candidate)

- Schema: `apps/api/src/prisma/contract.prisma`. Do not use `prisma migrate dev`.
- Migration commands, run as `pnpm --filter @manasbal/api exec <command>`:
  1. `prisma contract emit`
  2. `prisma migration plan --name <name>`
  3. `prisma migration show <dir>`
  4. `prisma db migrate --advance-ref db`
- Commit the contract, `contract.json`, `contract.d.ts`, `refs/db.json` and `migrations/` together.
- Look inside the database with Prisma Studio, using the stable CLI (Prisma 8 RC has no `studio` command): `pnpm dlx prisma@7.10.1 studio --url "postgresql://manasbal:manasbal@localhost:5432/manasbal"`, then `http://localhost:5555`.
- Decision record: `docs/adr/0007-prisma-8-release-candidate.md`.

## 6. GitHub and quality gates

- Use the `gh` CLI for pull requests and checks: `gh pr create --base dev --fill`, `gh pr checks`.
- Automatic checks on every PR: SonarQube Cloud (code quality), Codecov (coverage), gitleaks (secrets), CodeQL. A red check blocks the merge; read the failing log before changing code.
- Pull request template: `.github/pull_request_template.md`. Keep its checklist ticked honestly.

## 7. Tools and MCP servers

- This file does not configure MCP servers. The owner sets them up in opencode's own config. Use only the servers the owner has enabled.
- Jira is not reachable from this repo. Work cards live in `team/jira/` (CSV, local). Mark a card's progress by telling the owner; do not invent card numbers. A card number is `MAN-<n>`.
- Schema and data work: use the `prisma` CLI commands in section 5, not guessed SQL.
- If an MCP tool or server is unavailable, say so and use the command-line equivalent in this file. Do not claim a tool worked when it did not.

## 8. Before you report a task as done

- `git status` shows only the files you meant to change.
- `pnpm lint && pnpm typecheck && pnpm test && pnpm build` pass, and you say so in the report. If something fails, say which step and paste the error.
- Branch is `MAN-…` from a fresh `dev`; commit is signed off; PR targets `dev`.
- Say which parts you verified by running them and which you checked only by reading.
