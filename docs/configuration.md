# Configuration

Place `unused-deps.config.json` at the project root (or pass `--config`). It is
deep-merged over the built-in defaults — set only what differs. Add the
`$schema` line for editor autocomplete and inline validation:

```json
{
  "$schema": "./tools/unused-deps-checker/schema/config.schema.json",
  "js": {
    "scan": [ "src", "tools" ],
    "referenceDirs": [ "includes" ],
    "ignorePackages": [ "@types/*", "tslib" ]
  },
  "php": {
    "scan": [ "includes", "tests" ],
    "ignorePackages": [ "phpstan/*", "*-stubs" ]
  }
}
```

## `js`

| Key | Type | Default | Purpose |
|-----|------|---------|---------|
| `enabled` | boolean | `true` | Toggle the JS scan |
| `scan` | string[] | `["src","tools"]` | Dirs/files walked for imports + stylesheet `@import`/`@use` |
| `extensions` | string[] | `.ts .tsx .js .jsx .mjs .cjs .cts .mts` | Code extensions read for imports |
| `styleExtensions` | string[] | `.css .scss .sass .less` | Stylesheets read for `@import`/`@use`/`@tailwind` |
| `referenceDirs` | string[] | `[]` | Extra dirs scanned for **bareword references only** (e.g. PHP enqueue handles) |
| `referenceDirExtensions` | string[] | `.php .json .xml .neon .yml .yaml .txt` | Files read inside `referenceDirs` |
| `referenceFiles` | string[] | common configs | Extra root files in the reference corpus |
| `ignorePackages` | string[] | `["@types/*"]` | Never-reported names / `*`-globs |

## `php`

| Key | Type | Default | Purpose |
|-----|------|---------|---------|
| `enabled` | boolean | `true` | Toggle the PHP scan |
| `scan` | string[] | `["includes","tests"]` | PHP source roots searched for `Namespace\` usage |
| `referenceFiles` | string[] | `composer.json`, `phpstan.neon`, … | Dev-tooling config corpus |
| `ignorePackages` | string[] | phpstan/phpcs/stubs/… | Dev-only tooling allowlist |

## Notes

- **Root config files** (`eslint.config.mjs`, `postcss.config.js`,
  `phpstan.neon`, `config.*.json`, …) are auto-discovered — you rarely touch
  `referenceFiles`.
- **Manifests and lock files** never enter the reference corpus; only their
  `scripts`/`extra` blocks contribute, so a dependency cannot match its own name.
- **Platform requirements** (`php`, `ext-*`) are always skipped.
- `*` is the only wildcard in `ignorePackages` (e.g. `@types/*`, `eslint-*`,
  `*-stubs`).

Validate a config against the schema:

```bash
node scripts/validate-config.mjs path/to/unused-deps.config.json
```
