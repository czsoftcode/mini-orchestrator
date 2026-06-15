# Phase 174 — Guard path traversal in graph rebuild

**Goal:** Add the '..'/absolute-path guard at the full graph-rebuild write site in buildGraph.ts (matching the incremental path at line 221), throwing on an out-of-tree path so a broken collector fails loudly instead of writing outside .mini/graph/; cover it with a test that feeds a collector an out-of-tree path.

## Steps
- [done] Extract path-guard helper
- [done] Apply guard in rebuild write loop
- [done] Test: out-of-tree path is rejected
- [done] Verify build, typecheck and existing tests pass

## Auto-commit
- Phase 174: Guard path traversal in graph rebuild

## Run report
---
phase: 174
verdict: done
steps:
  - title: "Extract path-guard helper"
    status: done
  - title: "Apply guard in rebuild write loop"
    status: done
  - title: "Test: out-of-tree path is rejected"
    status: done
  - title: "Verify build, typecheck and existing tests pass"
    status: done
---

# Phase 174 — report from the auto session

## What was done

Added a defense-in-depth path-traversal guard at the full graph-rebuild write
site (SEC-4 from `.mini/security/range-1-25.md`).

- **New exported helper `assertGraphPathInside(path)`** in `src/graph/buildGraph.ts`.
  It normalizes the path (`posix.normalize`) and throws a clear, path-naming
  `Error` when the path is empty, absolute (platform or posix), or escapes the
  tree via `..` (`..`, `../…`, or anything that normalizes to that, e.g.
  `a/../../evil`). It mirrors the `'..'`/absolute check the incremental path
  already has in `updateGraphFile` (buildGraph.ts:221), but **throws** instead of
  skipping: in a full rebuild an out-of-tree path means a broken collector, which
  should fail loudly rather than be silently dropped.
- **Applied it** at the top of the `for (const file of graphs)` loop in
  `writeGraphLayout`, before any path is built or written.
- **Tests** in `buildGraph.test.ts`: a new `describe('assertGraphPathInside')`
  block covering rejected out-of-tree inputs (`..`, `../evil`, `a/../../evil`,
  `/etc/passwd`, `''`), accepted normal repo-relative paths (incl. `a/../b.ts`
  which normalizes safely to `b.ts`, so the guard doesn't over-reject), and the
  error message naming the offending path.

## Verification

- `npx tsc --noEmit` — clean.
- `npx vitest run src/graph/buildGraph.test.ts` — 35 passed.
- Full suite `npx vitest run` — 87 files, 1185 tests passed.

## Notes / honest caveats

- This is a **preventive** guard, not a fix for a present bug. It's unreachable
  today because `collectFiles` only yields `git ls-files` / under-`cwd` walk
  paths. Its only value is blocking a future regression in the collector, which
  is exactly why the test exercises the helper directly rather than via
  `buildGraph` end-to-end — there is no supported way to make the real collector
  emit an out-of-tree path, so a full e2e test would require faking internals.
  The direct unit test keeps the guard from rotting into untested dead code.
- The guard does not touch the incremental `updateGraphFile` path; that one keeps
  its existing skip-on-out-of-tree behaviour by design (a single edited file going
  out of range is a no-op, not a hard failure).
