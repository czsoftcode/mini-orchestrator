# Fáze 62 — mini update + skeleton

**Cíl:** Zavést verzovaný .mini skeleton (negenerované soubory, zatím .gitignore) jako shipovaný asset (install-local ho kopíruje vedle dist, přibalí se přes package.json files) coby jediný zdroj pravdy. mini init z něj píše počáteční .mini/. Nový příkaz mini update skeleton + slash commandy (install-commands) idempotentně srovná do existujícího projektu — vytvoří chybějící, přepíše změněné, ostatní nechá beze změny, vypíše souhrn. migrate je záměrně mimo (jednorázová věc).

## Kroky
- [hotovo] Asset skeletonu v repu + ship přes build
- [hotovo] Modul pro resolvování skeletonu
- [hotovo] Idempotentní sync skeletonu (atomický, dry-run)
- [hotovo] Příkaz mini update + CLI
- [hotovo] mini init píše skeleton
- [hotovo] Testy

## Auto-commit
- Fáze 62: mini update + skeleton (`ec24598dd1d36ef2e174f77c1db90527389c2c30`)

## Diskuse
# Fáze 62 — mini update + skeleton

## Záměr
Zavést **skeleton** = statická, napříč projekty identická negenerovaná část `.mini/`.
Obsah skeletonu (rozhodnuto): **adresářová struktura + `.gitignore`**. Žádné prázdné
placeholder soubory v cílovém projektu (při overwrite-to-canonical jsou zbytečné
riziko přepisu). Skeleton je jediný zdroj pravdy, ze kterého čerpá `mini init`
(zakládání projektu) i nový `mini update` (srovnání už existujícího projektu na
aktuální verzi mini).

Mimo skeleton (programově generované, NEpatří tam): `project.md` + `state.json`
(init, z odpovědí/timestampů/pole fází), `state.prev.json` (undo-záloha),
`codebase.md` (mini audit), `graph.json` + `graph/` (map/done), `last-memory.md`
(done). Init/done je píší dál samostatně.

## Klíčová rozhodnutí
- **Lokace assetu + ship:** skeleton v repu jako `assets/skeleton/.mini/`. Build ho
  zkopíruje do `dist/skeleton/` (tsc kopíruje jen `src/` → potřeba copy krok v
  `build`, např. `tsc && node scripts/copy-assets.mjs` nebo cp). Tím ho
  `files: ["dist"]` přibalí pro npm i `install-local` (kopíruje `dist`) dostane
  zadarmo — jeden mechanismus, nic navíc v install-local.sh.
- **Runtime hledání:** centralizovat do dedikovaného modulu (např. `src/assets.ts`
  → `dist/assets.js`), který resolvuje `new URL('./skeleton', import.meta.url)` =
  `dist/skeleton`. Nepoužívat relativní `../skeleton` z náhodného modulu — hloubka
  v `dist/` se liší (cli.js vs commands/*.js). Vzor je `version.ts:16`.
- **Přepis (update):** skeleton soubory jsou mini-owned → update je **vždy srovná na
  kanonický** (přepíše změněné). Ruční úpravy se ztratí, řeší git. Stejné chování
  jako `install-commands` u commandů. Atomický zápis tmp+rename.
- **Dry-run:** `mini update --dry-run` vypíše co by vytvořil / přepsal / nechal beze
  změny, ale nic nezapíše. Konzistentní s `migrate`.
- **Souhrn:** update vypíše vytvořeno / změněno / beze změny (jako install-commands).
- **Rozsah update:** skeleton + zavolá `install-commands` (slash commandy mají
  vlastní generátor z `COMMAND_DEFS`, zůstávají mimo skeleton; update je zastřeší).
  `migrate` je **záměrně mimo** (jednorázová věc).
- **Guard:** `update` běží jen když `.mini` existuje (`exists(cwd)`), jinak hint
  `mini init`. Nesahá na generované: `project.md`, `state.json`, `phases/*.json`,
  `graph/`, `graph.json`.
- **init:** po položení skeletonu dál píše `project.md` + `state.json`. Existující
  overwrite větev (`init.ts:17-29`) musí se skeletonem koexistovat.

## Pozor na
- **Prázdné adresáře a git (rozhodnuto):** git neuloží prázdný adresář. V **repu**
  `assets/skeleton/.mini/<dir>/` ponese `.gitkeep`, aby se struktura dostala do gitu.
  Ale `init`/`update` v **cílovém projektu** adresář jen `mkdir`nou a `.gitkeep`
  (ani jiný placeholder) tam **nezapíšou** — copy logika `.gitkeep` přeskakuje.
  Cílový projekt dostane jen adresáře + `.gitignore`. V plánu jen potvrdit seznam
  dirs (kandidáti: `phases/`, `memory/`, `discuss/`, `run/`). (Dnes je `init`
  nevytváří — vznikají on-demand přes `mkdir`; skeleton to sjednotí.)
- **Které soubory jsou „static/negenerované":** jen `.gitignore` (+ adresářová
  struktura). Vše ostatní je generované a do skeletonu NEpatří — viz Záměr.
- **Build copy krok cross-platform:** `cp -r` je bash-only; pro `npm run build` na
  všech OS radši malý node skript (`copy-assets.mjs`). install-local už bash je, ale
  build běží přes npm.
- **Idempotence:** na čerstvě nainstalovaném/narovnaném projektu musí být update
  no-op (vše „beze změny"). Ověřit testem.
- **Testy:** fixture v temp adresáři — (1) prázdný `.mini` → update doplní skeleton;
  (2) změněný `.gitignore` → update přepíše na kanonický; (3) aktuální projekt →
  no-op; (4) `--dry-run` nic nezapíše; (5) bez `.mini` → guard + hint; (6) init
  položí skeleton i `project.md`/`state.json`.

## Run report
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
