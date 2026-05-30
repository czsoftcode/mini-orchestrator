# Fáze 28 — /mini:status slash command

**Cíl:** Přidat read-only command /mini:status, který přes mini status vypíše přehled fází přímo v Claude Code session, a nechat ho generovat příkazem mini install-commands.

## Kroky
- [hotovo] Rozšířit CommandDef v install-commands.ts o volitelné vlastní tělo (body?), renderCommandMd ho použije místo výchozího mini context těla
- [hotovo] Přidat definici status do COMMAND_DEFS s tělem, které pustí mini status a instruuje Claude přehled předat uživateli v chatu (bez --apply)
- [hotovo] Aktualizovat závěrečný hint v installCommands o /mini:status
- [hotovo] Doplnit testy v install-commands.test.ts — status.md vzniká a jeho tělo volá mini status, ne mini context
- [hotovo] Pustit mini install-commands a ověřit, že .claude/commands/mini/status.md existuje a má správné tělo

## Auto-commit
- Fáze 28: /mini:status slash command (`6bb46c52c1579824ea4f58e1e70753a3041be5fd`)

## Run report
---
phase: 28
verdict: done
steps:
  - title: "Rozšířit CommandDef v install-commands.ts o volitelné vlastní tělo (body?), renderCommandMd ho použije místo výchozího mini context těla"
    status: done
  - title: "Přidat definici status do COMMAND_DEFS s tělem, které pustí mini status a instruuje Claude přehled předat uživateli v chatu (bez --apply)"
    status: done
  - title: "Aktualizovat závěrečný hint v installCommands o /mini:status"
    status: done
  - title: "Doplnit testy v install-commands.test.ts — status.md vzniká a jeho tělo volá mini status, ne mini context"
    status: done
  - title: "Pustit mini install-commands a ověřit, že .claude/commands/mini/status.md existuje a má správné tělo"
    status: done
verify:
  - title: "Skutečné spuštění /mini:status v živé Claude Code session"
    detail: "Command jsem vygeneroval a strojově ověřil (soubor, tělo, testy) a /mini:status se objevil v seznamu dostupných commandů. Reálné odklikání /mini:status v běžící session, kde výstup přebírá Claude, ověříš ty."
---

# Fáze 28 — report z auto session

Cíl fáze splněn: přibyl read-only slash command `/mini:status`, který přes `mini status`
vypíše přehled fází přímo v Claude Code session, a generuje ho `mini install-commands`.

## Co vzniklo

- **`CommandDef.body?`** (`src/commands/install-commands.ts`) — volitelné vlastní tělo .md.
  Když chybí, použije se výchozí tělo cyklu s `mini context <name>`. `renderCommandMd`
  teď renderuje `def.body ?? <výchozí tělo>`, takže read-only commandy nemusí mít
  session prompt přes `mini context`.
- **Definice `status` v `COMMAND_DEFS`** — tělo pustí `mini status` a instruuje Claude
  předat přehled uživateli v chatu; explicitně read-only (nic neukládá, žádný `--apply`).
- **Hint v `installCommands`** rozšířen o `/mini:status`.
- **Testy** (`install-commands.test.ts`) — soubor `status.md` se generuje, jeho tělo volá
  `mini status` a **ne** `mini context`; idempotence testuje i `status`.

## Ověření

- `npm run typecheck` ✓, `npm run build` ✓
- `npm test` ✓ — **381 testů, 33 souborů** (1 nový test pro status command)
- Reálné generování přes lokální build (`node dist/cli.js install-commands`): vznikl
  `.claude/commands/mini/status.md` se správným frontmatterem i tělem (`mini status`,
  bez `mini context`). `/mini:status` se objevil v seznamu dostupných slash commandů.

## Poznámka k nasazení

`mini` na PATH (`~/.local/bin/mini`) ukazuje na **starší instalovanou verzi**
(`~/.local/share/mini/versions/0.1.0/dist/cli.js`), která ještě neumí status command
generovat. Pro generování jsem proto použil čerstvý lokální `dist/`. Samotný
`mini status` (CLI) ve verzi 0.1.0 už existuje (fáze 20), takže `/mini:status` funguje
i se stávajícím globálním `mini`. Až bude vhodné, stojí za to globální instalaci
obnovit z nového buildu (mimo rozsah této fáze).
