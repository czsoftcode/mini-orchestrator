# Fáze 22 — Návrh na vylepšení mini orchestrátoru

## Záměr

Fáze je **čistě analytická — nic se neimplementuje.** Cílem je projít vyzrálý
projekt (po 21 fázích) a sepsat strukturovaný **backlog návrhů na vylepšení**
napříč čtyřmi oblastmi: správnost workflow, úklid/mrtvý kód, robustnost a
chybové stavy, DX a výstup CLI.

Backlog slouží jako zásobník budoucích fází — jednotlivé položky se mají dát
přímo předat do `mini next` jako další fáze.

## Klíčová rozhodnutí

- **Výstup = jeden dokument `.mini/improvements.md`** (verzovaný markdown v repu,
  checked-in). Přežije fázi, dá se k němu vracet a škrtat hotové položky.
- **Žádná implementace** v této fázi. `mini plan` má rozseknout fázi na kroky
  typu „projdi oblast X a sepiš nálezy", ne „naprogramuj X".
- **Formát každé položky backlogu:**
  - priorita (H / M / L)
  - odhad pracnosti (malá / střední / velká fáze)
  - oblast / kategorie (workflow / úklid / robustnost / DX)
  - návrh `title` + `goal` ve formátu, který jde rovnou předat do `mini next`
- **Pokryté oblasti (všechny čtyři):** správnost workflow, úklid/mrtvý kód,
  robustnost a chybové stavy, DX a výstup CLI.

### Konkrétní kandidáti, které z analýzy nesmí vypadnout

(Vyplynuly už z grafu a paměti — slouží jako záchytné body, ne jako úplný seznam.)

- **Osiřelá `doing` fáze** — po `block` verify vznikne opravná podfáze, ale
  rodičovská fáze zůstane navždy ve stavu `doing` a `advanceToNextPhase` ji
  přeskočí. Nikdy se nedozavře. (Explicitní loose end z fáze 21.)
- **Mrtvý kód** — krok z fáze 17 „smazat `MEMORY_ALLOWED_TOOLS`,
  `MEMORY_TIMEOUT_MS`, import `buildWriteMemoryPrompt`" byl `skipped`. Ověřit
  a najít případný další nepoužívaný povrch.
- **Chybějící e2e/integrační test** — auto smyčka je testovaná jen s mocky,
  reálný průchod Claudem nikdo neověřil.
- **Robustnost** — chování při chybějící `claude` / `git` binárce, při selhání
  parsování run reportu, kvalita fallbacků.
- **DX** — chybové hlášky, help texty, doladění `mini status`, čitelnost streamu.

## Pozor na

- **Prompt pro `do` musí cílit na analýzu, ne kód.** Výsledky analýzy Claude
  sám neověří → skoro vše patří do sekce `verify` run reportu (lidský pohled).
  Verdict fáze bude pravděpodobně `done` s plným `verify` seznamem.
- **Nepřekročit záměr** — pokušení rovnou „opravit" osiřelou doing fázi nebo
  smazat mrtvý kód. To NEPATŘÍ do této fáze; jen to zapsat jako položku backlogu.
- **Položky musí být akční** — formulovat title/goal tak, aby šly bez další
  diskuse hodit do `mini next`. Vyhnout se vágním „zlepšit kvalitu".
- **Idempotence dokumentu** — pokud `.mini/improvements.md` už existuje (re-run),
  aktualizovat, ne slepě připisovat duplicity.
