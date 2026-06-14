# What gets sent to Claude

mini is deliberately frugal with context. Each step sends Claude only what it
needs for that step — not the whole project history — so a long-running project
doesn't keep inflating the prompt.

`mini do` typically sends **roughly 600–1000 tokens** (1 page of `project.md` + the current phase + its ~5 steps). No history of old phases, no old plans, no verification reports.

If Claude needs to understand the existing code, **it reads the files itself** via `Read`/`Glob`/`Grep` — that is cheaper than loading everything into context up front. The [machine-readable map](non-interactive/map.md) helps it jump straight to the right lines instead of reading whole files.

After every Claude call (`next`/`plan`/`import-gsd`) you'll see its cost:

```
  (20.4k tokens · 5 output · 14.1k from cache · ~$0.028 in API)
```

## How the slash commands fetch that context

The `/mini:*` slash commands don't carry frozen prompt text — their thin body
just runs `mini context <step>`, which prints the prompt built from the current
`.mini/` state. Valid steps are
`next | project | discuss | plan | do | done | decision | verify | adversarial | adversarial-project`.

Most steps take no arguments. The cross-phase red-team is the exception:
`mini context adversarial-project` accepts the same range flags as the
interactive `mini adversarial-project` command —

```
mini context adversarial-project --from-phase <N> --to-phase <M>
mini context adversarial-project --from <git-ref> --to <git-ref>
```

— and prints the review prompt for that phase range to stdout. On an invalid or
missing range it writes nothing to stdout, reports the reason on stderr, and
exits non-zero, so the slash command never feeds Claude an empty prompt.
