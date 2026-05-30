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
