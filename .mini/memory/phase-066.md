# Fáze 66 — mini stop pro zastavení auto

**Cíl:** Přidat CLI příkaz 'mini stop' (a 'mini stop --clear'), který založí/smaže soubor .mini/STOP. Autonomní /mini:auto ho už na svých kontrolních bodech čte a po dokončení rozdělaného kroku se čistě zastaví. Součástí je registrace v cli.ts, implementace v src/commands/, testy a krátká zmínka v README/auto.md.

## Kroky
- [hotovo] stopPath helper v store.ts
- [hotovo] Implementace příkazu mini stop
- [hotovo] Registrace mini stop v cli.ts
- [hotovo] Testy stop.test.ts
- [hotovo] Dokumentace README a auto.md

## Auto-commit
- Fáze 66: mini stop pro zastavení auto (`ace5061e7cfa032526fa45b36bc896a10626e9a5`)

## Run report
---
phase: 66
verdict: done
steps:
  - title: "stopPath helper v store.ts"
    status: done
  - title: "Implementace příkazu mini stop"
    status: done
  - title: "Registrace mini stop v cli.ts"
    status: done
  - title: "Testy stop.test.ts"
    status: done
  - title: "Dokumentace README a auto.md"
    status: done
---

# Fáze 66 — report z auto session

Dotáhl jsem kooperativní stop, na který už byly v fázi 65 připravené háčky v `auto.md`.

## Co se udělalo
- **`stopPath(cwd)`** v `src/state/store.ts` (+ konstanta `STOP_FILE = 'STOP'`) — kanonická cesta k `.mini/STOP` s doc-komentářem.
- **`src/commands/stop.ts`** — `stop({ clear })`: bez projektu jen `log.warn` a return; bez flagu zapíše `.mini/STOP` (timestamp), s `--clear` ho smaže (`rm force`). Obě varianty idempotentní.
- **Registrace v `cli.ts`** — `mini stop` s volbou `--clear` a českým popisem, lazy import.
- **`src/commands/stop.test.ts`** — 4 testy: zápis signálu, `--clear` smazání, idempotence obou směrů, chování bez projektu. Vzor podle `undo.test.ts` (temp dir + chdir).
- **Dokumentace** — README i `install-commands.ts` (auto.md): přepsáno „přijde v další fázi" na popis hotového `mini stop` / `mini stop --clear`; nadpis sekce zbaven „připraveno pro budoucí". Aktualizován assert v `install-commands.test.ts` (nově ověřuje výskyt `mini stop`). `auto.md` přegenerován.

## Ověření (strojově, hotovo)
- `npm run build` OK.
- Celá suite: **631 testů / 50 souborů — vše zelené.**
- Smoke test reálného binárky v temp projektu: `mini stop` založí `.mini/STOP`, `mini stop --clear` ho smaže; bez projektu korektně varuje a nic nezaloží.

## Poznámky / na co dát pozor
- **Globální `mini` ukazuje na nainstalovanou verzi 1.3.0**, ne na lokální build — `mini install-commands` proto regeneroval ze staré verze („beze změny"). auto.md jsem přegeneroval přes `node dist/cli.js install-commands`. Po vydání nové verze mini bude potřeba globální binárku zaktualizovat, jinak slash commandy zůstanou na staré verzi.
- Stop je čistě kooperativní: Claude soubor čte jen na kontrolních bodech (mezi kroky cyklu a po každém `--step-done`). Tvrdé přerušení uprostřed kroku zůstává na Esc/Ctrl+C.
