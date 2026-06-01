---
phase: 96
verdict: done
steps:
  - title: "Refresh trigger state + decision"
    status: done
  - title: "Statusline fires on session start"
    status: done
  - title: "README and CHANGELOG"
    status: done
---

# Phase 96 — report from the auto session

Made the status-line upgrade check refresh on every new Claude Code session, on
top of the existing 5-hour TTL that now only covers a single long-running session.

## What was done
- **`src/upgrade/versionCheck.ts`** — added a refresh-trigger sidecar marker
  (`{ sessionId, triggeredAt }`) with `readTrigger`/`writeTrigger` (kept separate
  from the version cache, which `mini check-version` writes without session info),
  and a pure `shouldRefresh(cache, trigger, sessionId, now)`:
  - a brand-new session id → always refresh (fresh check on each Claude start),
  - same/unknown session → refresh only when the cache is stale (>5h TTL),
  - the TTL path is gated by `REFRESH_RETRY_MS` (5 min) so a perpetually-stale
    cache (failing fetch) can't spawn a refresh on every render,
  - no session id → degrades to the previous TTL-only behaviour.
- **Status line** — `StatusInput.session_id` added; the `statusline` command now
  reads the trigger marker, decides via `shouldRefresh`, and on a positive
  decision fires the detached `mini check-version` and writes the marker (so the
  next render in the same session won't re-fire before the cache updates).

## Verification done mechanically
- Full suite green: 773 tests (incl. 6 new `shouldRefresh` cases + trigger
  round-trip). `typecheck` clean. `build` ok.
- Smoke test with crafted cache/markers:
  - session A 1st render → writes marker for A;
  - session A 2nd render (fresh cache) → marker unchanged, no re-fire;
  - session B → new session, re-fires and updates the marker to B.
  The `↑ <version>` indicator rendered correctly throughout.

## Notes
- The visible output (the yellow `↑ <version>` segment) is unchanged from phase
  95 — this phase only changes *when* the background refresh fires, so there was
  nothing new for a human to judge visually (verify skipped).
- `session_id` is read defensively: if a future Claude Code payload omits it, the
  behaviour falls back to the 5h TTL refresh.
