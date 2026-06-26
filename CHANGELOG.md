# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.0]

### Added
- `referenceDirs` / `referenceDirExtensions` config — fold extra directories
  (e.g. `includes/`) into the bareword reference corpus, so packages enqueued
  from PHP by handle (`magnific-popup`, `underscore`…) aren't false-flagged.
- JSON Schema (`schema/config.schema.json`) for `unused-deps.config.json` with
  editor IntelliSense via `$schema`, and a zero-dependency validator
  (`scripts/validate-config.mjs`).
- CI workflow (Node 18/20/22): self-test, schema validation, CLI smoke run.
- `CONTRIBUTING.md`, `CHANGELOG.md`, `docs/`, `.editorconfig`, `.gitattributes`.

## [1.1.0]

### Added
- Stylesheet scanning (`.css`/`.scss`/`.sass`/`.less`) for `@import` / `@use` /
  `@forward` / `@tailwind`, so packages used only via stylesheets (`tailwindcss`,
  `@fontsource/*`, `lightgallery`…) are recognised as used.
- Auto-discovery of `config.*.json` root files, so asset-copy tooling that lists
  packages by name (`config.node_modules.json`, `config.vendors.json`) counts as
  a reference.

### Fixed
- Manifests and lock files are excluded from the reference corpus (only
  `scripts`/`extra` contribute), so a dependency can no longer match its own name
  in the require block — eliminating the "0 unused" false negative.

## [1.0.0]

### Added
- Initial release: zero-dependency Node scanner for unused `package.json`
  (JS imports/requires) and `composer.json` (psr-4/psr-0 namespace) dependencies.
- Two-tier JS detection (imports → bareword config/script reference), boundary
  aware so `react` never matches `react-dom`.
- `--strict` (CI exit code), `--json`, `--js-only` / `--php-only` flags.
- Self-test fixture and MIT license.

[1.2.0]: https://github.com/mralaminahamed/unused-deps-checker/releases/tag/v1.2.0
[1.1.0]: https://github.com/mralaminahamed/unused-deps-checker/releases/tag/v1.1.0
[1.0.0]: https://github.com/mralaminahamed/unused-deps-checker/releases/tag/v1.0.0
