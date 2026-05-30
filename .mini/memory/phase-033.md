# Fáze 33 — /mini:map slash command

**Cíl:** Přidat slash command /mini:map (tenký wrapper nad CLI mini map), kterým lze přímo v Claude Code přegenerovat graf projektu (.mini/graph/ + .mini/graph.json) a výsledek (cesta indexu + počet souborů) předat uživateli — analogicky k /mini:status.

## Kroky
- [hotovo] Přidat 'map' def do COMMAND_DEFS v src/commands/install-commands.ts — read-only styl jako status (vlastní body, žádné mini context): tělo spustí 'mini map' a výsledek (cesta indexu + počet souborů) předá uživateli. Výstup: installCommands vygeneruje i map.md s tělem volajícím 'mini map'.
- [hotovo] Aktualizovat závěrečný log.hint v installCommands o /mini:map v seznamu příkazů. Výstup: hint vypisuje i /mini:map.
- [hotovo] Rozšířit testy v install-commands.test.ts — map.md v očekávaném seznamu souborů, idempotence i v polích názvů, a nový test, že map.md volá 'mini map' a ne 'mini context'. Výstup: aktualizované testy zelené.
- [hotovo] Vygenerovat command do projektu a ověřit build — npm run typecheck/build/test, pak node dist/cli.js install-commands → vznikne .claude/commands/mini/map.md; ručně ověřit tělo /mini:map. Výstup: vše zelené, map.md na disku.

## Auto-commit
- Fáze 33: /mini:map slash command (`fe7d9598a846d27b1bda67f589c19f070e2cb3a1`)

## Run report
---
phase: 33
verdict: done
steps:
  - title: "Přidat 'map' def do COMMAND_DEFS v src/commands/install-commands.ts — read-only styl jako status (vlastní body, žádné mini context): tělo spustí 'mini map' a výsledek (cesta indexu + počet souborů) předá uživateli. Výstup: installCommands vygeneruje i map.md s tělem volajícím 'mini map'."
    status: done
  - title: "Aktualizovat závěrečný log.hint v installCommands o /mini:map v seznamu příkazů. Výstup: hint vypisuje i /mini:map."
    status: done
  - title: "Rozšířit testy v install-commands.test.ts — map.md v očekávaném seznamu souborů, idempotence i v polích názvů, a nový test, že map.md volá 'mini map' a ne 'mini context'. Výstup: aktualizované testy zelené."
    status: done
  - title: "Vygenerovat command do projektu a ověřit build — npm run typecheck/build/test, pak node dist/cli.js install-commands → vznikne .claude/commands/mini/map.md; ručně ověřit tělo /mini:map. Výstup: vše zelené, map.md na disku."
    status: done
---

# Fáze 33 — report z auto session

Cíl splněn: slash command `/mini:map` přibyl jako tenký read-only wrapper nad
existujícím CLI `mini map`. Analogicky k `/mini:status` má vlastní `body` a
nevolá `mini context` — jen spustí `mini map`, který přegeneruje graf projektu
(`.mini/graph/` + index `.mini/graph.json`) ze zdrojáků, a Claude pak výsledek
(cestu indexu + počet zmapovaných souborů) předá uživateli.

## Co vzniklo / změnilo se

- **`src/commands/install-commands.ts`**:
  - nový `map` def v `COMMAND_DEFS` (read-only styl jako `status`, vlastní
    `body` volající `mini map`, description „mini — přegeneruj graf projektu
    (doplněk)"),
  - závěrečný `log.hint` rozšířen o `/mini:map`.
- **`src/commands/install-commands.test.ts`**:
  - očekávaný seznam souborů obsahuje `map.md`,
  - nový test „map command volá mini map, ne mini context",
  - pole názvů v idempotenčním testu rozšířeno o `map`.
- **`.claude/commands/mini/map.md`** — vygenerován přes `node dist/cli.js
  install-commands`.

## Ověření

- `npm run typecheck` ✓, `npm run build` ✓
- `npm test` ✓ — **420 testů, 35 souborů** zelených (předtím 419).
- `node dist/cli.js install-commands` → vytvořil `map.md` (1 nový, 6 beze
  změny), hint vypisuje všech 7 commandů včetně `/mini:map`. Obsah `map.md`
  ručně ověřen — frontmatter s description, tělo volá `mini map`, nezmiňuje
  `mini context`.

## Poznámky

- Bez migrace / breaking změn: jde čistě o přídavek k existující sadě commandů.
  `install-commands` je idempotentní, takže opětovné spuštění v jiných projektech
  jen doplní `map.md` a zbytek nechá beze změny.
