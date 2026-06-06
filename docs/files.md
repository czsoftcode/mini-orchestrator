# Files in the project

Everything mini tracks for a project lives in a single `.mini/` directory next to
your code. This page describes what each file is for; you rarely need to touch
them by hand (use the `mini` commands instead), but knowing the layout helps when
you inspect or version the state.

```
my-project/
└── .mini/
    ├── project.md                       # 1 page — what you're building, for whom, constraints
    ├── codebase.md                      # overview of the existing code (created/updated by `mini audit`)
    ├── state.json                       # lightweight header: phase index, statuses, models (layout v2)
    ├── state.prev.json                  # header backup for `mini undo` (only 1 step back)
    ├── phases/
    │   └── phase-{id}.json              # detail of one phase — steps, report, verify (layout v2)
    ├── graph.json                       # lightweight index of the machine-readable map
    ├── graph/
    │   └── <path>.md                    # map node per file — imports, exports, signatures
    ├── last-memory.md                   # short summary of the latest memory record (input of the `next` prompt)
    ├── discuss/
    │   └── phase-{id}.md                # optional notes from `mini discuss` (Intent / Key decisions / Watch out for)
    ├── run/
    │   └── phase-{id}.md                # report from `mini auto` (YAML statuses + free text)
    └── memory/
        └── phase-{id}.md                # summary of a finished phase (What was done / Key decisions / Loose ends)
```

`state.json` is only a **lightweight header** (phase index, statuses, models); the detail of each phase (steps, report, verify) lives separately in `.mini/phases/phase-{id}.json`. `mini undo` backs up both (`state.prev.json` + `phases-prev/`). `graph.json` + `graph/` are derivations of the source files (gitignored) — `mini map` regenerates them anytime. The autonomous `/mini:auto` additionally reads the stop signal `.mini/STOP` (created by `mini stop`).

You can edit `project.md` by hand. The state is better changed via the mini commands than by editing the JSON by hand. The files in `discuss/` are free markdown notes — you can edit or delete them at will; `plan` and `do` read them if they exist, otherwise they simply skip them. The files in `run/` are written by Claude at the end of every auto session — `done` reads the step statuses from them (see [`mini auto`](non-interactive/auto.md)).

`codebase.md` (optional, created by `mini audit`) is a technical overview of the project — directory structure, key modules, technologies. No prompt injects it automatically; Claude reads it itself in `do`/`plan`/`next` sessions via `Read`, instead of going through `src/` again every time. `mini audit` keeps the manual notes in it. Run it ad hoc, whenever it feels stale.

The files in `.mini/memory/` (`phase-{id}.md`, with a discriminator `phase-{id}-2.md`, `-3`, … on a repeated `done` of the same phase) are written at the end of `mini done` (and `mini auto`) after finalizing the phase as `done`. By default `mini` assembles them directly in TypeScript from the phase data (metadata + the verbatim content of the discuss and run report) — without calling the Claude API; it uses a short print-mode Claude session only when the `memory` scope is explicitly set (`mini model memory …`). They complement `git log` with a layer you won't find there — **why** solution X was chosen over Y, what loose ends remained, what to watch out for in the next phases. Memory records are append-only and `mini undo` does not touch them. `last-memory.md` holds a **short summary** of the latest record (read by the `next` prompt). For a `skipped` phase, memory is not written. The file is created **outside the commit** — when you want it versioned, commit it by hand.
