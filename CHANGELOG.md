# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.4.1] - 2026-06-25

### Added

- Automatically display changelog after updates

## [1.4.0] - 2026-06-25

### Added

- OpenSearch multi-index export to JSON with mappings, settings, aliases, and documents.
- OpenSearch JSON import with destructive index overwrite and restored mappings/data.
- OpenSearch index multi-select with checkbox, Ctrl/Cmd-click, Shift-click, and context-menu actions for export and delete.

### Changed

- Moved OpenSearch import/export and bulk selection actions into sidebar and index context menus to reduce sidebar clutter.

## [1.3.0] - 2026-06-25

### Added

- PostgreSQL database export to portable JSON using the existing `pg` driver.
- PostgreSQL database import from JSON with destructive drop-and-recreate behavior for the selected database.
- PostgreSQL export metadata for schemas, extensions, enums, domains, sequences, tables, constraints, indexes, views, and typed row data.

### Fixed

- Recreate PostgreSQL extensions before importing tables so UUID defaults such as `uuid_generate_v4()` can be restored.
- Apply PostgreSQL primary, unique, check, and exclusion constraints before foreign keys during import.

## [1.2.3] - 2026-06-25

### Changed

- Render connection groups as folder icons using each folder's saved color.
- Improved folder color picker ordering and layout for a cleaner palette.

## [1.2.1] - 2026-06-23

### Added

- In-app update notifications that report when the app is already up to date.
- In-app update modal for pending updates with options to update now or skip for now.

### Changed

- Replaced native updater prompts with renderer-based update UI.

## [1.2.0] - 2026-06-22

### Added

- Auto-updating capabilities for the desktop application.
- Version number always visible next to logo.

## [1.1.0] - 2026-06-22

### Added

- Folder grouping for connections.

## [1.0.0] - 2026-06-15

### Added

- Initial stable release of the Electron desktop application for browsing PostgreSQL, SQLite, Redis, OpenSearch, Kafka, and RabbitMQ data sources.
- Database connection management and unified navigation for supported data sources.
- PostgreSQL and SQLite table browsing, SQL querying, row editing, and foreign key navigation.
- Redis key browsing by type, TTL management, and command execution.
- OpenSearch index listing, document search and editing, and raw request execution.
- Kafka topic listing, consumer group management, and message consumption.
- RabbitMQ exchange, queue, and binding browsing with message publishing and queue management.
- Platform-specific installer builds for Windows, macOS, and Linux.

[1.4.0]: https://github.com/thePanda-X/db-viewer/compare/v1.3.0...v1.4.0
[1.3.0]: https://github.com/thePanda-X/db-viewer/compare/v1.2.3...v1.3.0
[1.2.3]: https://github.com/thePanda-X/db-viewer/compare/v1.2.2...v1.2.3
[1.2.1]: https://github.com/thePanda-X/db-viewer/compare/v1.2.0...v1.2.1
[1.2.0]: https://github.com/thePanda-X/db-viewer/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/thePanda-X/db-viewer/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/thePanda-X/db-viewer/compare/v1.0.0...HEAD
