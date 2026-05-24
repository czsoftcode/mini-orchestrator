---
phase: 13
verdict: done
steps:
  - title: "Přidat `memory` scope do ProjectModels a `mini model`"
    status: done
  - title: "Vytvořit prompt builder writeMemory.ts + snapshot test"
    status: done
  - title: "Implementovat writePhaseMemory se zápisem souboru a symlinkem"
    status: done
  - title: "Sloučit commit+memory do finalizePhaseSideEffects v done.ts"
    status: done
  - title: "Doplnit testy do done.test.ts (volá se jen u done)"
    status: done
  - title: "Aktualizovat README o memory soubory a scope"
    status: done
---

# Fáze 13 — report z auto session

## Co je hotové

- **`memory` scope**: rozšířen `ProjectModels` (`src/state/types.ts`),
  doplněn do `MODEL_SCOPES` a `SCOPE_LABELS` (`src/state/models.ts`).
  `mini model memory haiku` teď funguje bez dalších změn — CLI handler
  je generický nad `MODEL_SCOPES`.
- **Prompt builder** `src/prompts/writeMemory.ts` + snapshot test
  `src/prompts/writeMemory.test.ts` (5 testů, 2 snapshoty). Exportuje
  konstanty `MEMORY_DIR = '.mini/memory'` a `LAST_MEMORY_FILE =
  '.mini/last-memory.md'`. Prompt větví instrukce podle `hasAutoCommit`
  (ať Claude pouští `git show HEAD` jen když dává smysl) a podle
  existence `discuss/`/`run/` souborů.
- **`writePhaseMemory`** v `src/commands/writeMemory.ts`:
  - vytváří `.mini/memory/` idempotentně (`mkdir recursive`),
  - kontroluje existenci `discuss/` a `run/` reportů,
  - timestamp je FS-safe (`:` nahrazeno `-` — Windows compat),
  - spouští Claude print-mode session přes `askClaude` (allowedTools:
    `Read, Bash, Write`, model přes `resolveModel('memory', state)`),
  - aktualizuje `last-memory.md` přes `symlink` → fallback `copyFile`,
  - **nikdy nehází**: každá chyba je warning + workflow pokračuje.
  - Memory soubor je záměrně **mimo commit** — commit už proběhl předtím.
- **`finalizePhaseSideEffects(phase, state, cwd)`** v `done.ts` sloučila
  commit + memory do jednoho místa. Volá se ze všech tří finalizačních cest
  (`applyAutoReport`, `collectNotesAndSave`, `finalizePhase`).
  U `skipped` fáze se nevolá.
- **Testy** v `done.test.ts` (5 nových testů v bloku
  `memory zápis po finalizaci fáze`): ověřují že se memory zavolá
  u všech tří `done` cest, předá se správný `hasAutoCommit`, a že
  se **nezavolá** u `skipped` fáze. `writePhaseMemory` se mockuje
  přes `vi.mock('./writeMemory.js', …)` — testy nepouštějí skutečnou
  Claude session.
- **README**: tabulka `mini done` aktualizována, sekce souborů
  rozšířena o `memory/` a `last-memory.md`, doplněn popis chování
  v textu i v novém FAQ záznamu.

## Drobnosti, na které jsem narazil

- **Stará `dist/__snapshots__/`** obsahovala zastaralé snapshoty
  z dob, kdy se prompty psaly jinak. `npm test` (`vitest run`)
  je sbíral, protože vitest defaultně testuje i `*.test.js`.
  Smazal jsem `dist/prompts/__snapshots__/` a přebuildil — vitest
  je při dalším běhu vygeneroval znovu, tentokrát aktuální.
  Toto **není trvalá oprava** — při příští změně promptu padne to samé.
  Doporučení do dalších fází: buď přidat `vitest.config` s `exclude`
  pro `dist/**`, nebo `dist/` smazat před `npm test`.
- **Existující auto.test.ts** padl, protože jeho mock `askClaude`
  vrací `undefined` a `logUsage` na něm crashoval (memory session
  nově prochází přes askClaude). Doplnil jsem do něj
  `vi.mock('./writeMemory.js', …)` — testy tak vůbec nepouští
  memory větev.
- **`done.test.ts` existující testy** padaly z téhož důvodu —
  v každém ze tří `beforeEach` bloků jsem přidal `writePhaseMemoryMock`
  reset.

## Nezbylo nic otevřeného

- Všechny kroky hotové, build čistý (`tsc --noEmit` bez chyb),
  `npx vitest run src/` 211/211, plný `npx vitest run` 422/422.
- Reálnou Claude session memory zápisu uvidíš až po commitu této fáze —
  `mini done` spustí Claude print-mode a vytvoří
  `.mini/memory/phase-13-{ts}.md` + `.mini/last-memory.md` symlink.

## Otevřené otázky pro lidskou kontrolu

- Defaultní model pro `memory` scope: prompt ho neřeší explicitně —
  spadne do `models.default` přes `resolveModel`. Jestli chceš
  haiku jako default pro memory, můžeš si ho nastavit přes
  `mini model memory haiku`. Pevný default v kódu jsem nepřidával
  (analogicky jako u `audit`, který také zdědí default).
- `.gitignore` pro `.mini/memory/` jsem **nepřidal** — discuss
  záměru bylo "nechat verzované, analogie discuss/ a run/".
  Pokud bys nakonec memory soubory nechtěl ve verzi, ignoruj je
  ručně.
