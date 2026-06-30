# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.9.0] - 2026-06-30

### Added

- Added connection-specific keyboard shortcuts for PostgreSQL, SQLite, Redis, OpenSearch, Kafka, and RabbitMQ workflows.
- Added `Ctrl+R` as a refresh shortcut across all connection types, including OpenSearch.
- Added shortcuts for common actions such as focusing filters, selecting rows or keys, deleting selected items, paging results, switching subviews, running commands, sending requests, and publishing messages.

## [1.8.0] - 2026-06-30

### Added

- Allow PostgreSQL and SQLite custom queries to execute arbitrary SQL, including write statements.
- Add SQL syntax highlighting to the custom query editor.

### Changed

- Run PostgreSQL custom queries with the selected schema in the search path so unqualified table names match the active schema.
- Refresh table and sidebar data after successful custom query execution.

### Fixed

- Prevent JSON preview dialogs from crashing after closing a custom query JSON value.

## [1.7.3] - 2026-06-30

### Changed

- Truncate SQL JSON cell previews to 20 characters while keeping the full value available from the eye icon.

## [1.7.2] - 2026-06-29

### Fixed

- Kept PostgreSQL JSON/JSONB and array cells on a single row in table browsing and custom query results, with an eye icon for viewing the full formatted value.

## [1.7.1] - 2026-06-29

### Fixed

- Fixed SQLite connections failing with `__filename is not defined` by loading `better-sqlite3` as a native CommonJS dependency from the Electron main process.
- Updated the SQLite custom query default to use SQLite-compatible date/time syntax.

## [1.7.0] - 2026-06-28

### Added

- Syntax highlighting for JSON values in OpenSearch documents, Kafka messages, RabbitMQ messages, Redis pretty JSON views, PostgreSQL JSON cells, and PostgreSQL query results.

## [1.6.0] - 2026-06-27

### Added

- Light theme options for Linen, Sage, Sky, and Dusk.
- Searchable theme picker with separated dark and light theme groups.

### Changed

- Reworked theme definitions into a centralized data-driven registry for easier theme creation.
- Theme colors are now applied from shared token definitions instead of duplicated CSS theme selector blocks.

## [1.5.0] - 2026-06-27

### Added

- Home sidebar settings dialog with persisted theme selection.
- Theme options for Monochrome, Harbor, Rosé Pine, and One Dark.

### Changed

- Monochrome is now the default theme for new installs and fresh settings files.

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

[1.8.0]: https://github.com/thePanda-X/db-viewer/compare/v1.7.3...v1.8.0
[1.7.3]: https://github.com/thePanda-X/db-viewer/compare/v1.7.2...v1.7.3
[1.7.2]: https://github.com/thePanda-X/db-viewer/compare/v1.7.1...v1.7.2
[1.7.1]: https://github.com/thePanda-X/db-viewer/compare/v1.7.0...v1.7.1
[1.7.0]: https://github.com/thePanda-X/db-viewer/compare/v1.6.0...v1.7.0
[1.6.0]: https://github.com/thePanda-X/db-viewer/compare/v1.5.0...v1.6.0
[1.5.0]: https://github.com/thePanda-X/db-viewer/compare/v1.4.1...v1.5.0
[1.4.1]: https://github.com/thePanda-X/db-viewer/compare/v1.4.0...v1.4.1
[1.4.0]: https://github.com/thePanda-X/db-viewer/compare/v1.3.0...v1.4.0
[1.3.0]: https://github.com/thePanda-X/db-viewer/compare/v1.2.3...v1.3.0
[1.2.3]: https://github.com/thePanda-X/db-viewer/compare/v1.2.2...v1.2.3
[1.2.1]: https://github.com/thePanda-X/db-viewer/compare/v1.2.0...v1.2.1
[1.2.0]: https://github.com/thePanda-X/db-viewer/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/thePanda-X/db-viewer/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/thePanda-X/db-viewer/compare/v1.0.0...HEAD
