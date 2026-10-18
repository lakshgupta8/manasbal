# Contributing

Manasbal is a two-person portfolio project, open source under the [Apache License 2.0](LICENSE). Work comes from the project's collaborators; outside pull requests aren't being taken for now. This file documents how the project is worked on.

## Setup

1. Node.js 24 LTS (`.nvmrc`) and pnpm 10
2. `pnpm install`
3. `pnpm dev`

## Workflow

| Step          | Rule                                                                                                                                                                                                                 |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Branches      | Short-lived, cut from `dev`, named after the ticket: `MAN-123-short-name`                                                                                                                                            |
| Commits       | [Conventional Commits](https://www.conventionalcommits.org), signed off with `git commit -s`; no `Co-Authored-By` or tool-credit lines; commitlint enforces all three: `feat: add cart drawer`                       |
| Before a PR   | `pnpm lint && pnpm typecheck && pnpm test && pnpm build`                                                                                                                                                             |
| Pull requests | Into `dev`, one small task each, with a short description (what changed, why, how it was checked) and no tool-credit footer. Checks must be green; a collaborator's PR also needs the owner's approval               |
| Changesets    | `pnpm changeset` for any change users would notice; it becomes the changelog entry                                                                                                                                   |
| Merging       | Squash merge into `dev`; `dev` must always work                                                                                                                                                                      |
| Releasing     | Every Sunday: `pnpm changeset version` on `dev`, then `dev` → `main` with a merge commit. `main` holds released versions only; only the apps that changed are deployed ([ADR 0006](docs/adr/0006-ci-cd-pipeline.md)) |
| Decisions     | Anything significant gets an ADR in [`docs/adr`](docs/adr)                                                                                                                                                           |

## Licence and sign-off

Contributions are accepted under the project's licence, Apache-2.0: you keep the copyright on what you write and share it under the same terms. Every commit carries a `Signed-off-by:` line (`git commit -s`), certifying the [Developer Certificate of Origin](https://developercertificate.org): you wrote the change, or otherwise have the right to submit it under this licence.

## Rules that never bend

- **Clean room:** never copy code or assets from the old course project or from any employer.
- **Legal guardrails:** no real card data, ID numbers or brands anywhere; `pnpm check:brands` and gitleaks enforce this.
- **Icons:** drawn in-house only; no icon libraries.
- **Secrets:** never committed. Use `.env` files locally (ignored by git) and CI secrets in GitHub.
