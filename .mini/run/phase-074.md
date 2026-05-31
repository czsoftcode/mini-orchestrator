---
phase: 74
verdict: done
steps:
  - title: "auditCodebase.ts → AJ"
    status: done
  - title: "importGsd.ts → AJ"
    status: done
  - title: "Doplnit slovníček + ověřit"
    status: done
---

# Fáze 74 — report z auto session

## Co se udělalo
- **`auditCodebase.ts` přeložen do angličtiny** — celá próza, fixní šablona sekcí
  `codebase.md` (Přehled→Overview, Adresářová struktura→Directory structure,
  Klíčové moduly→Key modules, Technologie→Technologies), sekce "How to proceed" a
  "You may use". Cesta `.mini/codebase.md` (`CODEBASE_FILE`) beze změny.
- **`importGsd.ts` přeložen do angličtiny** — próza a placeholdery v `<…>`.
  Response-kontrakt `NAME:/WHAT:/FOR_WHOM:/CONSTRAINTS:/PHASES:`, stavová slova
  (`done/doing/todo/skipped`) i mapovací klíče cizích nástrojů
  (`completed/archived/finished`, `in_progress/active`, `pending/planned/proposed`,
  `cancelled/canceled`) ponechány beze změny — parsuje je `import-gsd.ts` + `store.ts`.
- **Slovníček `docs/i18n-glossary.md` rozšířen** o nové termíny (How to proceed,
  You may use, sekce codebase.md) a o kontrakt importu GSD v sekci "co se nepřekládá".
- Aktualizovány aserce v `auditCodebase.test.ts` a `importGsd.test.ts`, přegenerovány
  2 snapshoty.

## Ověření (strojově)
- Před commitem ověřeno, že sekce `codebase.md` ani markery importu se **neparsují**
  nikde kromě samotných promptů (audit) resp. že kontrakt importu se parsuje a proto
  zůstává beze změny (`grep` po `import-gsd.ts`/`store.ts`).
- `npm test` → 50 souborů, 651 testů, vše zelené.
- `npm run build` → tsc + copy-assets bez chyb.

## Na co dát pozor / otevřené
- **Dogfooding seam:** sekce `codebase.md` jsou teď v promptu anglicky, ale tento
  repo má vlastní `.mini/codebase.md` ještě s českými nadpisy. Při příštím `mini audit`
  na tomto repu by Claude mohl řešit nesoulad nadpisů (instruuje se ale na `Edit` +
  zachování ručních poznámek, takže to není kritické). U **nových** projektů je vše
  konzistentně anglicky. Sekce `codebase.md` se nikde strojově neparsují.
- **Migrace pokračuje:** zbývají `discussPhase.ts`, `writeMemory.ts`, `autoPhase.ts`,
  sdílený `graphHint.ts` a velký `sessionContext.ts`. `graphHint.ts` + `sessionContext.ts`
  + `discussPhase.ts` je vhodné přeložit společně (sdílený graph hint), aby nevznikl šev.
