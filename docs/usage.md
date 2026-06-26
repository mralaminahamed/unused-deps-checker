# Usage

## Install

As a git submodule (recommended for WordPress-plugin monorepos):

```bash
git submodule add https://github.com/mralaminahamed/unused-deps-checker.git tools/unused-deps-checker
```

Or clone standalone and run it against any project with `--root`.

## Run

```bash
node tools/unused-deps-checker/bin/check-deps.mjs --root .
```

Add convenience scripts to the host `package.json`:

```jsonc
"scripts": {
  "deps:check": "node tools/unused-deps-checker/bin/check-deps.mjs --root . --config ./unused-deps.config.json",
  "deps:check:strict": "node tools/unused-deps-checker/bin/check-deps.mjs --root . --config ./unused-deps.config.json --strict"
}
```

## CLI flags

| Flag | Description |
|------|-------------|
| `--root <dir>` | Project root to scan (default: cwd) |
| `--config <file>` | JSON config (default: `<root>/unused-deps.config.json`) |
| `--js-only` | Scan `package.json` only |
| `--php-only` | Scan `composer.json` only |
| `--json` | Machine-readable output |
| `--strict` | Exit `1` if any unused dependency is found (CI gate) |
| `--no-color` | Disable ANSI colour |
| `-h`, `--help` | Show help |

## Status meanings

| Status | Meaning |
|--------|---------|
| `used` | JS: imported/required, or referenced via stylesheet `@import`/`@use`. PHP: namespace appears in source |
| `config-ref` | Referenced by name in a config, `scripts` entry, or `referenceDirs` (e.g. PHP enqueue handle) |
| `unused` | No import and no reference found — the actionable finding |
| `unresolved` | PHP package not installed under `vendor/` — run `composer install` |
| `ignored` | Matched an `ignorePackages` pattern |
| `platform` | PHP `php` / `ext-*` requirement (not a package) |

## CI

```yaml
- run: node tools/unused-deps-checker/bin/check-deps.mjs --root . --strict
```

`--strict` fails the build when a new unused dependency lands. Tune
`ignorePackages` to silence intentional indirect dependencies (build loaders,
ESLint plugins) so the signal stays meaningful.
