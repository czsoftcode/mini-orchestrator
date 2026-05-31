// Zkopíruje statické assety (které tsc neumí — kompiluje jen src/ → dist/) do
// dist/. Spouští se v `npm run build` hned po `tsc`. Cross-platform (čistý Node,
// žádný bash), takže funguje i mimo Linux/macOS.
//
// Zatím jediný asset: `assets/skeleton/` → `dist/skeleton/`. Skeleton je statická
// kostra `.mini/` (adresáře + gitignore), ze které čerpá `mini init` i
// `mini update`. Runtime ho hledá přes src/assets.ts (dist/assets.js) relativně
// k dist/, proto musí ležet uvnitř dist/.
//
// Pozn.: gitignore je ve skeletonu schválně bez tečky (`gitignore`, ne
// `.gitignore`) — `npm publish` by soubor `.gitignore` z tarballu vyřadil.
// Do projektu ho `mini init/update` zapíše jako `.gitignore` (assets.ts:FILE_RENAMES).

import { cp, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const src = new URL('assets/skeleton/', root);
const dest = new URL('dist/skeleton/', root);

await rm(fileURLToPath(dest), { recursive: true, force: true });
await cp(fileURLToPath(src), fileURLToPath(dest), { recursive: true });

console.log('→ assets copied: assets/skeleton → dist/skeleton');
