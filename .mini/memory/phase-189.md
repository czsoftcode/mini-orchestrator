# Phase 189 — Patch dev-tooling supply-chain findings

**Goal:** Bump the transitive dev dependencies (esbuild to 0.28.1, vite to 8.0.16, vitest to 4.1.9, tsx) via lockfile update or package.json overrides so the four Semgrep supply-chain findings clear, while keeping npm test green and npm audit clean.

## Steps
- [done] Bump pinned versions in package-lock.json
- [done] npm audit reports 0 vulnerabilities
- [done] Confirm all four Semgrep deps are off vulnerable versions
- [done] npm test and npm run build stay green

## Auto-commit
- Phase 189: Patch dev-tooling supply-chain findings

## Run report
---
phase: 189
verdict: done
steps:
  - title: "Bump pinned versions in package-lock.json"
    status: done
  - title: "npm audit reports 0 vulnerabilities"
    status: done
  - title: "Confirm all four Semgrep deps are off vulnerable versions"
    status: done
  - title: "npm test and npm run build stay green"
    status: done
---

# Phase 189 — report from the auto session

## What was done

`npm update vite esbuild vitest tsx` bumped the transitive dev-tooling
dependencies in `package-lock.json` to their patched versions. No `overrides`
block was needed and none was added — every parent range already allowed the
fix (vitest accepts vite `^6 || ^7 || ^8`, tsx accepts esbuild `~0.28.0`).
`package.json` is untouched: the direct devDeps `tsx ^4.19.0` and
`vitest ^4.1.7` still satisfy the new resolved versions.

Resolved versions after the bump (`npm ls`):

- esbuild 0.28.0 → **0.28.1** (covers GHSA-g7r4-m6w7-qqqr and GHSA-gv7w-rqvm-qjhr)
- vite 8.0.14 → **8.0.16** (covers CVE-2026-53571)
- vitest 4.1.7 → **4.1.9**
- tsx 4.22.3 → **4.22.4**
- launch-editor: not installed in the tree (`npm ls launch-editor` empty), so
  CVE-2026-53632 has nothing to resolve against here.

`npm update` reported "removed 2 packages, changed 17 packages … found 0
vulnerabilities".

## Verification (all mechanical, done here)

- `npm audit` → **0 vulnerabilities**.
- `npm ls vite esbuild vitest tsx` confirms all four are off the flagged
  versions.
- `npm test` → **1263 passed (87 files)** on the bumped vitest 4.1.9.
- `npm run build` → exit 0, `dist/cli.js` regenerated (tsc + asset copy).

## Honest framing / caveats

All four Semgrep findings were in **dev-only** tooling and none ship in the
published npm package (`files` = `dist`, `scripts/postinstall.mjs`,
`README.md`). The vulnerabilities were also not reachable in this project's
usage (esbuild "untrusted search path" is the Deno CLI entrypoint; vite
`fs.deny` bypass needs an exposed dev server on Windows; launch-editor needs
the dev server to open an editor). So this is dashboard/hygiene cleanup, not an
exploit fix — but the dashboard is now clean and the test/build chain still
works.

The fix lives in `package-lock.json`. Semgrep re-scans the lockfile, so the
four findings should clear on the next scan of `main` once this is committed.
