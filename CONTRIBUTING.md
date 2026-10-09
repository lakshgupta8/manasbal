# Contributing

Manasbal is a solo portfolio project, open source under the [Apache License 2.0](LICENSE). Outside pull requests aren't being taken for now. This file documents how the project itself is worked on.

## Setup

1. Node.js 24 LTS (`.nvmrc`) and pnpm 10
2. `pnpm install`
3. `pnpm dev`

## Workflow

| Step        | Rule                                                                                                         |
| ----------- | ------------------------------------------------------------------------------------------------------------ |
| Branches    | Short-lived, named after the ticket: `MAN-123-short-name`                                                    |
| Commits     | [Conventional Commits](https://www.conventionalcommits.org), enforced by commitlint: `feat: add cart drawer` |
| Before a PR | `pnpm lint && pnpm typecheck && pnpm test && pnpm build`                                                     |
| Merging     | Squash merge into `main`; `main` is always deployable                                                        |
| Decisions   | Anything significant gets an ADR in [`docs/adr`](docs/adr)                                                   |

## Rules that never bend

- **Clean room:** never copy code or assets from the old course project or from any employer.
- **Legal guardrails:** no real card data, ID numbers or brands anywhere; `pnpm check:brands` and gitleaks enforce this.
- **Icons:** drawn in-house only; no icon libraries.
- **Secrets:** never committed. Use `.env` files locally (ignored by git) and CI secrets in GitHub.
