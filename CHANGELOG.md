# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[1.2.1]: https://github.com/thePanda-X/db-viewer/compare/v1.2.0...v1.2.1
[1.2.0]: https://github.com/thePanda-X/db-viewer/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/thePanda-X/db-viewer/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/thePanda-X/db-viewer/compare/v1.0.0...HEAD
