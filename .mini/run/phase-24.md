---
phase: 24
verdict: done
steps:
  - title: "Zdokumentovat živé MEMORY_* symboly ve writeMemory.ts (C1)"
    status: done
  - title: "Odstranit zavádějící TODO o jejich smazání (C1)"
    status: done
  - title: "Přidat migraci state.model → models.default ve store.load (C2)"
    status: done
  - title: "Zrušit fallbacky na state.model v models.ts a status.ts (C2)"
    status: done
  - title: "Zúžit typ PermissionMode na reálně používané hodnoty (C3)"
    status: done
  - title: "Doplnit/upravit testy pro migraci a PermissionMode"
    status: done
  - title: "Ověřit zelené testy a čistý tsc --noEmit"
    status: done
---

# Fáze 24 — report z auto session

Body C1–C3 z `.mini/improvements.md` hotové. `tsc --noEmit` čistý, **295 testů
zelených** (24 souborů, exit 0).

## C1 — živé MEMORY_* symboly (writeMemory.ts)
- V kódu **žádné zavádějící TODO o jejich smazání nebylo** (ověřeno
  `git grep -i "mrtv|TODO|smaz|fáze 17"` — bez nálezu mimo legitimní použití).
  TODO „smazat MEMORY_ALLOWED_TOOLS / MEMORY_TIMEOUT_MS / import
  buildWriteMemoryPrompt" žilo jen v plánu fáze 17, ne ve zdroji.
- Nad konstanty `MEMORY_ALLOWED_TOOLS` a `MEMORY_TIMEOUT_MS` jsem doplnil
  komentář, že jsou **živé** (používá je `writeViaClaude` v explicitním memory
  režimu, scope `memory` přes `mini model`) a NEjsou mrtvý kód. Funkce už byly
  zdokumentované, takže teď to sedí i u konstant.

## C2 — migrace state.model → models.default
- `store.ts`: nová funkce `migrate()`, volaná z `load()` i `loadPrev()`. Při
  čtení přesune zastaralé `state.model` do `models.default` (existující
  `models.default` má přednost) a `state.model` odstraní.
- Zrušené read-fallbacky na `state.model`:
  - `models.ts` — `resolveModel` i `getDefaultModel` (čistě `state.models?.…`),
  - `status.ts` — `describeModels` (jen `state.models?.[scope]`),
  - `model.ts` — `showCurrent` (jen `m[scope]`; bylo to taky fallback),
  - `import-gsd.ts` — odstraněn dnes už mrtvý `preservedLegacyModel`
    (po migraci je `oldState.model` vždy `undefined`), aby se deprecated pole
    znovu nezapisovalo.
- `types.ts`: pole `model?` **ponecháno** (čte ho `migrate()` a defenzivně maže
  `mini model`), ale @deprecated komentář upřesněn, že ho nový kód nečte.

## C3 — zúžení PermissionMode
- `work.ts`: `PermissionMode` zúžen na `'acceptEdits'` (jediná hodnota, kterou
  mini reálně předává — `do.ts` posílá `'acceptEdits' | undefined`, `audit.ts`,
  `writeMemory.ts` a stream/ask také jen `'acceptEdits'`). Doplněn komentář, proč
  je typ užší než módy CLI a kam případně doplnit další. `ask.ts` a `stream.ts`
  typ jen reexportují/používají — beze změny chování.

## Testy
- `store.test.ts`: nový blok „migrace legacy `model` → `models.default`" (4
  testy: přesun + smazání pole, přednost existujícího `models.default`, no-op bez
  legacy pole, migrace i přes `loadPrev`).
- `status.test.ts`: testy `describeModels` přepsány — místo legacy fallbacku teď
  čte jen `state.models` a zastaralé `model` ignoruje (migrace se přesunula do
  `store.load`). Obsolete test „legacy se nepromítne do non-default scopů"
  odstraněn.
- PermissionMode je čistě typová věc — pokrývá ji `tsc --noEmit` nad všemi call
  sites + stávající testy, které předávají `'acceptEdits'` (stream.test,
  auto.test). Samostatný runtime test by neměl smysl.

## Poznámka k průběhu
Na začátku session se výsledky nástrojů vracely s velkým zpožděním v dávkách,
což jsem chvíli mylně vyhodnotil jako poškozený výstup a stihl zapsat chybný
„blocked" report — tenhle soubor ho přepisuje. Prostředí bylo po celou dobu
v pořádku; finální stav je ověřený (tsc + 295 testů zelených).
