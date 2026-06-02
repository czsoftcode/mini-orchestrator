# Phase 114 — README demo of the cycle

**Goal:** Add a real terminal demo of the mini workflow cycle to README: a committed, reproducible recording script (a scripted non-interactive walkthrough recorded with asciinema and converted to a GIF via agg, no live Claude API) plus the generated GIF embedded near the Quick start section, with a static annotated fallback block for renderers that don't load the image.

## Steps
- [done] Scripted cycle walkthrough
- [done] Recording script
- [done] Generate and commit the GIF
- [done] Embed demo in README
- [done] Wrap up and checks

## Auto-commit
- Phase 114: README demo of the cycle

## Run report
---
phase: 114
verdict: done
steps:
  - title: "Scripted cycle walkthrough"
    status: done
  - title: "Recording script"
    status: done
  - title: "Generate and commit the GIF"
    status: done
  - title: "Embed demo in README"
    status: done
  - title: "Wrap up and checks"
    status: done
---

# Phase 114 — report from the auto session

## What was built
A real terminal demo of the mini workflow cycle, fully offline (no Claude API):

- **`demo/cycle.sh`** — a self-contained, non-interactive walkthrough of `init → next → plan → do → done`. Every command is a genuine mini command; the inputs a live Claude session would supply (the proposed phase, the steps, the report) are passed through the non-interactive `--apply` flags, so the output is real. It runs in a throwaway temp dir (git-initialised, cleaned up on exit) with a light typewriter effect and dimmed narration lines.
- **`demo/record.sh`** — records `cycle.sh` with `asciinema rec` (fixed 92×30 geometry, idle capped at 2 s) and renders **`demo/cycle.gif`** with `agg`. Idempotent, adds `~/.cargo/bin` to PATH, checks prerequisites with install hints.
- **`demo/cycle.gif`** — 1019×781, 245 frames, ~760 KB. Committed.
- **README** — the GIF is embedded at the top of *Quick start* (centered, width 760, absolute `raw.githubusercontent` URL so it renders on both GitHub and npm), with a caption pointing at `demo/record.sh` and a `<details>` static transcript fallback.
- **`.gitignore`** — ignores `demo/*.cast` (the recording intermediate); the committed artifact is the GIF.
- Ticked off backlog item #13 (`mini todo done 13`).

## Toolchain note
The recording chain is **asciinema → agg**, installable without root. `agg` had to be built from `cargo install --git https://github.com/asciinema/agg` (the crates.io `agg` is an unrelated library) and lives in `~/.cargo/bin`. VHS was rejected because it needs `ttyd`/`vhs` via apt and `sudo` is not passwordless here.

## Verified mechanically
- `npm run typecheck` — clean.
- `npm test` — 68 files, **854 tests pass**.
- The full offline cycle runs end-to-end and exits 0 (init→next→plan→do→done, real auto-commit in the temp repo).
- The GIF is a valid GIF89a; frames inspected (title / mid status / final do→done) render correctly.

## Human verification (done in chat)
The user opened `demo/cycle.gif` and confirmed the animation looks good ("vypadá to pekne"), so the visual/pacing check is cleared. The remaining check — that the GIF renders in the README on GitHub — is inherently post-push (the README points at `raw.githubusercontent.com/.../main/demo/cycle.gif`); verify it on the rendered README right after this phase is pushed.
