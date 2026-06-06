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
