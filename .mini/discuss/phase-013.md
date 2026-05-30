# Fáze 13 — Záznam paměti po fázi

## Záměr

Po finalizaci fáze jako `done` (interaktivní `mini done` i auto-cesta přes
report) zapsat na disk paměťový artefakt `.mini/memory/phase-{id}-{timestamp}.md`
se stručným shrnutím hotové práce a aktualizovat symlink `.mini/last-memory.md`
na nejnovější záznam.

Účel: doplnit git history o vrstvu, kterou v `git log` nenajdu — **proč** bylo
zvoleno řešení X místo Y, jaké otevřené konce zůstaly, na co si dát pozor
v dalších fázích. Sourozenec `.mini/codebase.md` co do principu (read-on-demand
pro Claude), ale per-fázový a append-only.

## Klíčová rozhodnutí

- **Generátor:** samostatná Claude **print-mode** session (analogicky
  k `mini audit`, `mini next`). Nový prompt builder
  `src/prompts/writeMemory.ts` + odpovídající snapshot test.
  Vstupy do promptu:
  - `phase.title` / `goal` / `steps` / `humanNotes` ze `state.json`,
  - výstup `git show HEAD` (jen pokud auto-commit proběhl — viz dál),
  - obsah `.mini/run/phase-{id}.md` (jen pokud existuje, typicky u auto).
  - Allowed tools: `Read, Bash, Write` (Bash kvůli `git show`).

- **Soubor a struktura:** `.mini/memory/phase-{id}-{timestamp}.md`.
  Timestamp ISO 8601 v FS-safe podobě (např. `2026-05-24T14-30-00Z` — bez
  dvojteček). Fixní sekce v markdownu (jako u `discuss/`):
  ```
  # Fáze {id} — {title}

  ## Co se udělalo
  ## Klíčová rozhodnutí
  ## Otevřené konce
  ```

- **Pořadí v `done` flow** (po finalizaci `phase.status = 'done'`):
  1. `advanceToNextPhase(state)`
  2. `commitPhaseWork(phase, cwd)` — auto-commit (nebeznezměn)
  3. `writePhaseMemory(phase, cwd)` — Claude session, čte `git show HEAD`
  4. `save(state, cwd)`

  Memory soubor záměrně **mimo commit** (commit už proběhl). Když uživatel
  chce mít memory ve verzi, commitne ho ručně v dalším commitu.

- **Spouští se jen u `done`.** U `skipped` fáze memory nevzniká
  (málo co zapsat; `phase.humanNotes` ve state.json stačí).

- **Idempotence: vždy nový soubor.** Časový kolíček zaručí unikátnost; pokud
  by někdy bylo potřeba memory regenerovat (revert + nový pokus), vzniknou
  další záznamy. `last-memory.md` ukazuje vždy na nejnovější.

- **`last-memory.md` jako symlink** s fallbackem na `copyFile`. Před zápisem
  staršího symlinku ho odstranit (`unlink`, pokud existuje). Pořadí:
  `symlink(target, link)` → na chybu (typicky Windows bez SeCreateSymbolicLink
  práva) `copyFile(target, link)`. Žádný hard error, jen `log.dim` které
  se použilo.

- **Selhání memory session = warning, fáze zůstává done.**
  Memory je nice-to-have, neblokuje workflow. `log.warn('Memory pro fázi
  {id} se nepodařilo zapsat: …')` + hint.

- **Vlastní scope `memory`** v `mini model` — rozšířit `ProjectModels`
  o `memory?: string`, doplnit do `models.ts` a CLI handleru. Default
  fallback je sonnet/haiku přes `models.default` (memory není těžký úkol).

- **Není napojené na `mini undo`.** Memory soubory jsou append-only historie
  — undo do nich nezasahuje. Když undo provede `git reset --soft` na předchozí
  commit, memory soubor zůstává jako artefakt předchozího pokusu (případný
  budoucí `mini done` vytvoří nový s novým timestampem). Symlink
  `last-memory.md` nechat být.

## Pozor na

- **Volá se z více cest v `done.ts`.** Finalizace fáze jako `done` proběhne
  v: `applyAutoReport` (auto cesta), `collectNotesAndSave` (force-done přes
  interaktivní výběr), `finalizePhase` ("Hotová, funguje"). Aby se memory
  zápis nezapomněl nikde, vyplatí se ho **přimknout přímo k volání
  `commitPhaseWork`** — pomocná funkce typu `finalizePhaseSideEffects(phase, cwd)`,
  která dělá commit + memory v jednom místě.

- **Memory session musí umět běžet bez gitu.** Když projekt není git repo
  nebo `commitPhaseWork` neudělal commit (žádné změny, hook selhal), Claude
  v memory session nemá `git show HEAD` — prompt to musí ošetřit (řekni mu,
  ať `git show` nepouští, nebo ať jeho chybu ignoruje).

- **Adresář `.mini/memory/` vytvořit idempotentně** (`mkdir(..., { recursive: true })`)
  před spuštěním session, aby měl Claude kam zapsat.

- **FS-safe timestamp.** Windows neumí `:` v názvech souborů → použít
  formát s `-` místo `:` (např. `new Date().toISOString().replace(/:/g, '-')`).

- **Token cena.** Memory session se pustí po **každé** hotové fázi —
  na konci ukázat tokens summary (jako ostatní print-mode příkazy). Default
  model pro `memory` scope by měl být lacinější (haiku/sonnet).

- **`.gitignore`.** Rozhodnout, jestli `.mini/memory/` a `.mini/last-memory.md`
  jsou verzované, nebo gitignorované. Doporučení: **nechat verzované**
  (analogie `discuss/` a `run/`). Symlink v gitu funguje (uložen jako
  text s cílem), fallback copy taky.

- **README** doplnit:
  - sekci "Soubory v projektu" o `.mini/memory/phase-{id}-{timestamp}.md`
    a `.mini/last-memory.md`,
  - krátkou zmínku v popisu `mini done` / `mini auto`, že po finalizaci
    fáze vzniká memory záznam,
  - tabulku `mini model` scopes rozšířit o `memory`.

- **Snapshot test promptu** ve stejném stylu jako ostatní —
  `src/prompts/writeMemory.test.ts` s reprezentativními vstupy (fáze
  s kroky vs. bez kroků, s humanNotes vs. bez, s/bez git contextu).

- **Testy `done.ts` cest.** Doplnit do `done.test.ts` ověření, že po
  finalizaci jako `done` se zavolá memory zápis (mock writePhaseMemory)
  a že se nezavolá u `skipped`. Skutečnou Claude session v testu nepouštět.
