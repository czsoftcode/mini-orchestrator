---
phase: 71
verdict: done
steps:
  - title: "Přejmenovat skeleton .gitignore na gitignore"
    status: done
  - title: "Mapování zdroj→cíl v assets.ts"
    status: done
  - title: "syncSkeleton čte ze zdroje, píše na cíl"
    status: done
  - title: "Ověřit copy-assets.mjs a komentáře"
    status: done
  - title: "Testy a npm pack kontrola"
    status: done
  - title: "CHANGELOG a rebuild dist"
    status: done
---

# Fáze 71 — report z auto session

## Příčina
Klasický npm gotcha: `npm publish` používá soubory `.gitignore` k filtrování
obsahu balíčku a **samy je do tarballu nezabalí**. Skeleton sice lokálně po
buildu obsahoval `dist/skeleton/.mini/.gitignore`, ale do publikovaného balíčku
`mini-orchestrator` se nedostal → na novém počítači po `npm install -g` skeleton
`.gitignore` chyběl a `mini init`/`mini update` ho neměly odkud zkopírovat.

## Řešení
Skeleton drží gitignore pod npm-safe jménem `gitignore` (bez tečky), které npm
do balíčku zabalí. Do projektu se i nadále zapisuje jako `.gitignore`:

- `assets/skeleton/.mini/.gitignore` → `git mv` na `assets/skeleton/.mini/gitignore`.
- `assets.ts`: `SkeletonEntry` rozšířen o `srcRelPath` (cesta na disku); nová mapa
  `FILE_RENAMES = { gitignore: '.gitignore' }`. `readSkeletonEntries` u souboru
  `gitignore` vrací `relPath=.gitignore` (cíl) a `srcRelPath=gitignore` (zdroj);
  ostatní položky mají zdroj == cíl.
- `update.ts` (`syncSkeleton`, sdílí init i update): obsah se čte z
  `join(root, srcRelPath)`, zapisuje a loguje se na `relPath` (`.gitignore`).
- `copy-assets.mjs` kopíruje celý adresář, takže `gitignore` se přenese beze
  změny — upraveny jen komentáře (assets.ts, copy-assets.mjs).

## Ověření (strojově)
- `npm run build` OK, `dist/skeleton/.mini/gitignore` vznikl.
- `npm pack --dry-run`: tarball obsahuje `dist/skeleton/.mini/gitignore` (1.0 kB)
  a všech 4× `.gitkeep` — žádný `.gitignore` (s tečkou) ze skeletonu, takže nic
  k vyřazení. Tím je opravený přesně reportovaný symptom.
- `vitest run`: **651 testů zelených** (50 souborů). Upravené testy:
  `assets.test.ts` (na disku `gitignore`, cíl `.gitignore`, srcRelPath mapování),
  `update.test.ts` (kanonický obsah čte ze skeletonu jako `gitignore`).
- `init.test.ts`/`update.test.ts` dál ověřují, že v projektu vznikne
  `.mini/.gitignore` — beze změny, prošly.

## Poznámky
- `.gitkeep` soubory npm nefiltruje (nejsou speciální), takže skeleton adresáře
  zůstávají i v balíčku — řešili jsme cíleně jen `.gitignore`.
- Lokální `mini` nemusí ukazovat na tento build; pouštěno přes `node dist/cli.js`.
