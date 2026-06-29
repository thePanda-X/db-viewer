# db-vwr

A multi-database desktop viewer and explorer built with Electron.

Browse, query, and manage multiple data systems through a single unified interface.

## Supported Data Sources

| Type             | Library                          | Capabilities                                                                               |
| ---------------- | -------------------------------- | ------------------------------------------------------------------------------------------ |
| **PostgreSQL**   | `pg`                             | Browse tables, run SQL queries (read/write), row editing, foreign key navigation           |
| **SQLite**       | `better-sqlite3`                 | Open local `.db`/`.sqlite` files, browse tables, query, edit                               |
| **Redis**        | `ioredis`                        | Key browsing by type (string/list/set/zset/hash/stream), TTL management, command execution |
| **OpenSearch**   | `@opensearch-project/opensearch` | Index listing, document search/CRUD, raw request execution                                 |
| **Apache Kafka** | `kafkajs`                        | Topic listing, consumer group management, message consumption                              |
| **RabbitMQ**     | `amqplib`                        | Exchange/queue/binding listing, message publishing, queue management                       |

## Prerequisites

- [Bun](https://bun.sh/) (package manager and runtime)
- [Docker](https://www.docker.com/) (optional — for running local database instances)

## Getting Started

### 1. Start development databases

```bash
docker compose up -d
```

### 2. Install dependencies

```bash
bun install
```

### 3. Start the dev server

```bash
bun run dev
```

This launches the Vite dev server with Electron hot-reload.

### 4. Seed sample data (optional)

```bash
bun run seed:opensearch
bun run seed:kafka
bun run seed:demo-db
```

`seed:demo-db` seeds the Docker PostgreSQL database (`testdb`, schema `demo`) and creates `demo-data/demo.sqlite`. Override with `DATABASE_URL`, `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD`, `POSTGRES_DEMO_SCHEMA`, or `SQLITE_DEMO_FILE`. Set `POSTGRES_DEMO_SKIP=true` to generate only the SQLite demo file.

## Build for Distribution

```bash
bun run build
```

Produces platform-specific installers in `release/<version>/`:

- **Windows**: NSIS Setup (`.exe`)
- **macOS**: DMG (`.dmg`)
- **Linux**: AppImage (`.AppImage`)

## Project Structure

```
src/            React frontend (Vite + Tailwind CSS + shadcn/ui)
electron/       Electron main process (database connections, IPC handlers)
shared/         Code shared between main and renderer (IPC channels, types)
scripts/        Seed data scripts for development
```

## License

Apache 2.0 — see [LICENSE](LICENSE).

You must retain the copyright notice in all copies or substantial portions of the software.
