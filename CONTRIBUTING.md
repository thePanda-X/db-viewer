# Contributing

Thank you for helping improve `db-vwr`. This project is a Bun, Vite, React, and Electron desktop app for browsing multiple database systems.

## Fork And Branch

1. Fork the repository on GitHub.
2. Clone your fork locally:

```bash
git clone https://github.com/<your-username>/db-vwr.git
cd db-vwr
```

3. Add the upstream repository:

```bash
git remote add upstream https://github.com/<owner>/db-vwr.git
```

4. Create a focused branch from the latest default branch:

```bash
git fetch upstream
git checkout main
git merge upstream/main
git checkout -b fix/short-description
```

Use branch names like `fix/connection-error`, `feat/sqlite-browser`, or `docs/setup-notes`.

## Run Locally

Install prerequisites:

- [Bun](https://bun.sh/)
- [Docker](https://www.docker.com/) if you want local development database instances

Install dependencies:

```bash
bun install
```

Start local databases when needed:

```bash
docker compose up -d
```

Run the app in development mode:

```bash
bun run dev
```

Optionally seed sample data:

```bash
bun run seed:opensearch
bun run seed:kafka
```

## Validate Changes

Before opening a pull request, run the relevant checks:

```bash
bun run lint
bun run typecheck
bun run test
bun run format:check
bun run build
```

Tests run through Vitest. Add or update coverage with `bun run test` when changing stores, utilities, IPC contracts, persistence, or data-source behavior.

## Commit Guidelines

Keep commits small and focused. Use clear, imperative commit messages:

```text
Add Redis key TTL editor
Fix SQLite table reload state
Document local Kafka seed data
```

Avoid mixing unrelated code, formatting, and dependency changes in one commit.

## Pull Requests

1. Push your branch to your fork:

```bash
git push origin fix/short-description
```

2. Open a pull request against the default branch.
3. Fill out the pull request template.
4. Link related issues when applicable.
5. Include screenshots or recordings for UI changes.
6. Keep the PR scoped to one bug fix, feature, or documentation update.

Maintainers may ask for changes before merging. Please keep discussion respectful and focused on the work.
