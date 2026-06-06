# Ideas & changes

> Archive of future ideas and changes for this project. Managed by `mini todo`
> (`add` / `done` / `remove`); `mini next` offers the open items as candidate
> phase ideas. You can also edit this checklist by hand.
- [x] do mini:todo přidat nápovědu list
- [x] mini todo edit <n> "<text>" — úprava textu existující položky archivu
- [x] mini todo clear --done — hromadné smazání odškrtnutých položek (úklid archivu)
- [x] mini status zobrazí počet otevřených todo (Ideas: N open) vedle přehledu fází
- [x] přidat příkaz mini changelog a /mini:changelog, který vypíše změny v mini
- [x] mini changelog --version <v>: výpis konkrétní verze ze CHANGELOG.md
- [x] mini doctor: diagnostika projektu (schema stavu, slash commandy, statusline, čerstvost verze) jako checklist
- [x] mini status --json: strojově čitelný výstup stavu projektu pro skripty/integrace
- [x] mini status zobrazí dobu trvání fáze z startedAt/completedAt
- [x] Zrušit příkaz update a udělat z něj alias pro upgrade (kdyby se někdo spletl)
- [x] Příkaz import-gsd udělat i jako slash příkaz /mini:import-gsd
- [x] vytvorit dokumentaci pro import-gsd
- [x] README screenshot/asciinema demo cyklu
- [x] GitHub Issues šablony, CONTRIBUTING
- [x] mini completion: bash/zsh shell completion script for the CLI (mini completion bash)
- [ ] C/C++ language mapper for mini map (only major gap in language coverage)
- [x] mini next auto-ticks the source todo item the phase was created from
- [x] mini doctor: check for orphaned 'doing' phases and stale run reports
- [x] mini status --phase <n>: detail of a single phase (steps + detail + run report)
- [x] Lightweight decisions/ADR layer: capture the *why* behind a phase (rationale of a choice), not just goal + commit — today the reasoning is lost. Inspired by DocFlow's decisions/ folder; keep it lean (optional `decision` note per phase, surfaced in status/graph).
- [x] Decision records: collection in /mini:done — agent drafts an ADR from what actually happened (or prompts), human approves/edits; nothing written when there was no real crossroads.
- [ ] Decision records: consistency — mini doctor orphan-check (decision file with no matching phase, same pattern as stale run reports) and mini undo removes/restores the decision file.
- [x] Decision records: mark phases that have an ADR in the mini status overview (cheap via one readdir of .mini/decisions/, no per-phase JSON reads).
- [x] Slim the done prompt: move the ADR instruction to an on-demand 'mini context decision' (add decision to CONTEXT_COMMANDS); done keeps only a thin trigger. Saves ~250 tokens/phase ONLY IF the trigger stays sharp enough not to raise the rate of forgotten ADRs (acceptance criterion, not an implementation detail).
- [x] README: "mini vs. native Claude Code plan mode" section — preempt the "why not the built-in plan mode?" question with a short comparison table (persistence, cross-session, progress tracking, git auto-commit, auto mode).
- [x] README: "Your first phase" / first-5-minutes walkthrough after npm install — first command, what the user sees, sample output.
- [ ] GitHub repo: add topics/tags for discoverability — claude-code, ai, cli, llm, workflow, developer-tools, anthropic (repo setting, not a code change).
- [ ] demo: re-record demo/cycle.gif to show the slash-command flow (/mini:init/next/plan/do/done) instead of the CLI cycle, so the GIF matches the new primary path in the README quick start.
- [ ] README slim-down: merge ## Models + ## Status line into short blurbs that link to docs/ command pages (model.md, install-statusline.md) instead of re-documenting flags inline.
- [ ] README slim-down: condense the graph sections (## Machine-readable project map, ### Incremental update, ### Auto-update hook) into one short paragraph + link to docs/non-interactive/map.md; the detailed --file/hook mechanics belong in docs.
- [ ] README slim-down: trim ## Auto mode + ## Import from GSD to a short pointer each, linking to docs/{interactive,non-interactive}/auto.md and import-gsd.md instead of duplicating their behaviour.
- [ ] README: add a top-level Documentation link near the intro/Quick start pointing to docs/README.md (the full two-variant command reference), so the central index is discoverable from the README.
