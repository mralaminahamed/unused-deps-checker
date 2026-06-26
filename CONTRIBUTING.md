# Contributing

Thanks for helping improve unused-deps-checker.

## Principles

1. **Zero runtime dependencies.** The tool must run with nothing but Node 18+
   built-ins (`node bin/check-deps.mjs`). Do not add packages to `dependencies`.
2. **Conservative over clever.** A false "unused" erodes trust faster than a
   missed one. When detection is ambiguous, classify as `config-ref`/`used`, not
   `unused`.
3. **Minimal diffs.** Match the surrounding style (tabs, WordPress-ish JS).

## Workflow

```bash
node test/run.mjs                 # self-test (no runner, no deps)
node scripts/validate-config.mjs  # validate sample config against schema
node bin/check-deps.mjs --root .  # smoke-run against this repo
```

- Add a self-test assertion in `test/run.mjs` for any new behaviour.
- If you add a config key, update `schema/config.schema.json`,
  `src/config.mjs` defaults, `unused-deps.config.sample.json`, and `docs/`.
- Update `CHANGELOG.md` under the next version.

## Pull requests

Branch off `trunk`, keep one logical change per PR, ensure CI (Node 18/20/22)
is green. Merge via merge commit.
