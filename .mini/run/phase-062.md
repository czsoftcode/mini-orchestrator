---
phase: 62
verdict: done
steps:
  - title: "Asset skeletonu v repu + ship přes build"
    status: done
  - title: "Modul pro resolvování skeletonu"
    status: done
  - title: "Idempotentní sync skeletonu (atomický, dry-run)"
    status: done
  - title: "Příkaz mini update + CLI"
    status: done
  - title: "mini init píše skeleton"
    status: done
  - title: "Testy"
    status: done
---

# Fáze 62 — report z auto session

## Co se udělalo
Zaveden statický **skeleton `.mini/`** jako jediný zdroj pravdy pro `mini init`
i nový `mini update`.

- **`assets/skeleton/.mini/`** v repu: `.gitignore` (kopie aktuálního) + adresáře
  `phases/ memory/ discuss/ run/`, každý s `.gitkeep` (drží prázdný dir v gitu).
- **Ship přes build:** `scripts/copy-assets.mjs` (čistý Node, cross-platform)
  kopíruje `assets/skeleton` → `dist/skeleton`; `package.json` build je teď
  `tsc && node scripts/copy-assets.mjs`. `files: ["dist"]` i `install-local`
  (kopíruje `dist`) tím skeleton dostanou zadarmo — nic navíc v install-local.sh.
- **`src/assets.ts`:** `skeletonDir()` (zkouší `dist/skeleton/.mini`, fallback
  `assets/skeleton/.mini` — funguje z buildu/instalace i ze src v testech) a
  `readSkeletonEntries()` (rekurzivně vrátí dirs + files, `.gitkeep` přeskočí).
- **`src/commands/update.ts`:** `syncSkeleton(cwd, {dryRun})` — chybějící dirs
  `mkdir`, soubory porovná obsahově a přepíše jen liší-li se (atomicky tmp+rename),
  `.gitkeep` do projektu nepíše, vrací počty. `update(cwd, {dryRun})` — guard na
  `exists(cwd)` (jinak no-project + hint `mini init`), zavolá `syncSkeleton` +
  `installCommands`, vypíše souhrn.
- **`install-commands.ts`** rozšířen o `{dryRun}` a návratové počty (aby
  `mini update --dry-run` nic nezapsal). Veřejné API kompatibilní (volitelný 2. arg).
- **CLI:** `mini update [--dry-run]` zaregistrován v `cli.ts`.
- **`mini init`** po `writeProject`+`save` volá `syncSkeleton(cwd)` — `project.md`
  a `state.json` zůstávají generované zvlášť (do skeletonu nepatří).

## Ověřeno
- `npm run build` → `dist/skeleton/.mini/{.gitignore, 4 dirs/.gitkeep}` existuje.
- Smoke test na temp projektu: `update --dry-run` nezapsal nic; ostrý `update`
  vytvořil dirs (bez `.gitkeep`) + `.gitignore` + 8 commandů.
- `npm run typecheck` čistý.
- Nové testy: `src/assets.test.ts`, `src/commands/update.test.ts`,
  `src/commands/init.test.ts` (mock prompts) — pokrývají doplnění, obsahový přepis
  `.gitignore`, idempotenci, dry-run (skeleton i commandy), guard bez projektu,
  init píše skeleton + project/state.
- Celá sada: **610 testů prošlo** (49 souborů).

## Poznámky / na co dát pozor
- **Rozsah:** `migrate` záměrně mimo (jednorázová věc). `update` je pro opakované
  srovnání negenerované části (skeleton + commandy) na aktuální verzi mini.
- **Přepis je tvrdý:** skeleton soubory jsou mini-owned, `update` ruční úpravy
  `.mini/.gitignore` přepíše na kanonickou podobu (řeší git, je `--dry-run`).
- **Skeleton je zatím `.gitignore` + 4 dirs.** Přidání dalších statických souborů
  je triviální — stačí je vložit do `assets/skeleton/.mini/`.
- **`.gitkeep` jen v repu**, do projektu se nekopíruje → prázdné dirs v projektu
  nejsou v gitu trackované, dokud nedostanou obsah (to je OK, brzy ho dostanou).
