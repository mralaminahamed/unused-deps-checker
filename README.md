# unused-deps-checker

Find **unused `package.json` and `composer.json` dependencies** in a project.
Zero runtime dependencies (Node 18+ built-ins only), drops in as a **git
submodule**, and is tuned for WordPress-plugin layouts (Divi modules, WPCS
tooling) while working on any JS/PHP repo.

It is deliberately **conservative**: it favours not crying wolf. Everything it
reports is "no import or reference found — verify before removing", never an
automatic delete.

## How it works

For each declared dependency it assigns one status:

| Status | Meaning |
|--------|---------|
| `used` | (JS) imported/required somewhere · (PHP) its namespace appears in source |
| `config-ref` | not imported, but referenced by name in a build/lint config or a `scripts` entry (e.g. `sass-loader` in webpack, `phpstan` in a composer script) |
| `unused` | **no import and no reference found** — the actionable finding |
| `unresolved` | (PHP) package not installed under `vendor/` — run `composer install` to judge |
| `ignored` | matched an `ignorePackages` pattern (e.g. `@types/*`, `phpstan/*`) |
| `platform` | (PHP) `php` / `ext-*` requirement — not a package |

### JS detection (two tiers)

1. Extract every specifier from `import … from`, `import 'x'`, `import('x')`,
   `require('x')`, `require.resolve('x')` across the source corpus → normalise
   to a package name → **used**.
2. For the rest, scan a **reference corpus** (root config files + `scripts`) for
   the package name as a standalone token → **config-ref**. Boundary-aware, so
   `react` never matches inside `react-dom`.

### PHP detection

Resolves each Composer package's namespace from its installed
`vendor/<pkg>/composer.json` autoload (`psr-4` / `psr-0`), then looks for
`Namespace\` in your PHP source. Packages that autoload global `files` are
treated as used (their symbols can't be attributed by namespace). Dev tooling
(PHPStan, PHPCS, stubs…) is referenced in config, not code, so it's covered by
the reference scan plus a default ignore list.

> Manifests and lock files are **never** folded into the reference corpus — they
> list every dependency by name and would make each package match itself. Only
> the `scripts`/`extra` blocks of a manifest contribute.

## Usage

As a git submodule (matches the other `tools/` submodules in this project):

```bash
git submodule add https://github.com/mralaminahamed/unused-deps-checker.git tools/unused-deps-checker

# run from the project root
node tools/unused-deps-checker/bin/check-deps.mjs --root .
```

Add a script for convenience:

```jsonc
// package.json
"scripts": {
  "deps:check": "node tools/unused-deps-checker/bin/check-deps.mjs --root ."
}
```

### CLI

```
node bin/check-deps.mjs [options]

  --root <dir>     Project root to scan        (default: cwd)
  --config <file>  JSON config                 (default: <root>/unused-deps.config.json)
  --js-only        Scan package.json only
  --php-only       Scan composer.json only
  --json           Machine-readable JSON output
  --strict         Exit 1 if any unused dependency is found  (use in CI)
  --no-color       Disable ANSI colour
  -h, --help       Show help
```

`--strict` makes it CI-friendly: the command fails the build when a new unused
dependency lands.

## Configuration

Drop an `unused-deps.config.json` at the project root (see
[`unused-deps.config.sample.json`](unused-deps.config.sample.json)). It is
deep-merged over the defaults — set only what you need to change.

```json
{
  "js": {
    "scan": [ "src", "tools" ],
    "ignorePackages": [ "@types/*", "tslib" ]
  },
  "php": {
    "scan": [ "includes", "tests" ],
    "ignorePackages": [ "phpstan/*", "*-stubs" ]
  }
}
```

| Key | Default | Purpose |
|-----|---------|---------|
| `<eco>.enabled` | `true` | Toggle an ecosystem off |
| `js.scan` | `["src","tools"]` | Dirs/files walked for imports + references |
| `js.extensions` | `.ts .tsx .js .jsx .mjs .cjs …` | Code extensions to read |
| `js.referenceFiles` | common configs | Extra files folded into the reference corpus |
| `js.ignorePackages` | `["@types/*"]` | Never-reported patterns (`*` wildcard) |
| `php.scan` | `["includes","tests"]` | PHP source roots |
| `php.referenceFiles` | `composer.json`, `phpstan.neon`, … | Dev-tooling config corpus |
| `php.ignorePackages` | phpstan/phpcs/stubs/… | Dev-only tooling allowlist |

Root-level config files (`eslint.config.mjs`, `postcss.config.js`,
`phpstan.neon`, `phpcs.xml.dist`, `rector.php`, …) are **auto-discovered** — you
rarely need to touch `referenceFiles`.

## False positives — and what to do

A `config-ref`/`unused` split won't be perfect; treat `unused` as a **lead**:

- **Build deps provided indirectly** (e.g. `sass-loader`, `style-loader` pulled
  in by `@wordpress/scripts`) show as unused because nothing references them
  directly. Real, but removing them depends on your build chain — verify.
- **Runtime libs you removed but forgot to uninstall** (`moment`, `uuid`,
  `styled-components` with no imports) are the prime cleanup targets.
- Add anything intentional to `ignorePackages`.

## Development

```bash
node test/run.mjs     # self-test (zero deps, no runner)
node bin/check-deps.mjs --root <some-project>
```

## License

MIT © Al Amin Ahamed
