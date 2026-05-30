# Fáze 40 — Diskuzní poznámky načítat jednou

## Záměr
V jedné Claude Code chat session se diskuzní poznámky mají do kontextu dostat
jen jednou. `plan` i `auto` zůstávají vstupní body cyklu a poznámky **inlinují
dál**. Pouze interaktivní `/mini:do` přejde na **odkaz + read-once podmínku**
místo inline textu, protože v session už je skoro vždy načetl `plan`/`auto` a
Claude si je drží v paměti.

Pozn.: reálná úspora je v **deduplikaci přes session**, ne v jednom loadu — na
jeden izolovaný load je inline levnější (žádná režie Read callu). Token-report
proto NENÍ hlavní metrika.

## Klíčová rozhodnutí

### Rozsah: jen `/mini:do` slash command
`buildAutoPhasePrompt` volají tři místa:
- `context.ts:126` — slash `/mini:do` (interaktivní, stejná chat session jako
  `/mini:plan`) → **PŘEPNOUT na reference mód**.
- `do.ts:88` — headless `mini do` (spawnuje vlastní Claude session, poznámky
  z plan tam nejsou) → **zůstává inline** (dedup nedává smysl, reference by jen
  přidal Read režii).
- `auto` (vlastní větší šablona v měření) → **zůstává inline** (vstupní bod,
  jeden čistý load).

### API builderu — nový opt-in příznak, default inline
Do `AutoPhaseContext` přidat opt-in pro reference mód, default = stávající inline
chování (ať se auto, headless do, existující volání i snapshoty nezmění).
Návrh: `useDiscussNotesRef?: boolean`.
- `false`/neuvedeno → dnešní inline větev (`discussNotes` text), beze změny.
- `true` → místo inline textu vykreslit **odkaz** na
  `.mini/discuss/phase-${phase.id}.md` (relativní cesta, konzistentně s tím, jak
  prompt odkazuje na `.mini/run/phase-N.md`) + read-once podmínku.

`context.ts` (do větev) nastaví `useDiscussNotesRef` podle toho, zda poznámky
existují: `discussNotes != null && discussNotes.trim() !== ''`. Inline text už
do builderu pro reference mód nepředávat (jen příznak; builder si relativní
cestu poskládá z `phase.id`).

### Chování reference bloku
- Stejný nadpis `# Poznámky k fázi (z diskuse)` (ať je rozpoznatelný), ale místo
  textu poznámek odkaz + instrukce ve smyslu:
  „Poznámky z diskuse jsou v `.mini/discuss/phase-N.md`. Pokud jsi je v této
  session už četl (typicky při `/mini:plan` nebo na začátku `auto`), znovu je
  nečti. Jinak si je přečti přes Read."
- **Standalone `/mini:do`** (čistá session bez plan): spolehnout se, že si soubor
  přečte Claude sám přes Read — žádná inline pojistka. Instrukce musí být
  jednoznačná.
- **Když poznámky neexistují** (soubor chybí / prázdný): blok úplně vynechat —
  ani odkaz, ani instrukce (stejně jako dnes inline blok zmizí při notes == null).
  Žádné posílání Read na neexistující soubor.

### Měření
`src/tokens/measure.ts` (řádek `do`, ~ř. 210) dnes měří inline builderem. Přepnout
ho na **reference mód** (`useDiscussNotesRef: true`), aby řádek `do` v reportu
odrážel realitu statického promptu `/mini:do`. K reportu/řádku přidat poznámku,
že **Read call za běhu se do čísla nepočítá** (číslo tedy podhodnocuje reálný
náklad jednoho izolovaného `do`). `auto` řádek nechat inline.

### Ověření = snapshot + unit testy (ne číslo v reportu)
- `autoPhase.test.ts`: nové testy pro `useDiscussNotesRef: true`:
  - obsahuje odkaz `.mini/discuss/phase-{id}.md` + read-once formulaci,
  - NEobsahuje inline text poznámek,
  - když příznak false/neuveden → beze změny (existující snapshoty a test
    „omits notes block" platí dál).
- `context.test.ts`: nový test — `/mini:do` s existujícím souborem
  `.mini/discuss/phase-1.md` → výstup obsahuje odkaz + read-once, ne inline text;
  bez souboru blok chybí (stávající `do` test).
- Token-report jen **přegenerovat**, BEZ tvrdé prahové hodnoty.

## Pozor na
- Default `useDiscussNotesRef` musí být vypnutý → výstup `auto`, headless `mini do`
  i existující snapshoty `autoPhase.test.ts.snap` se NESMÍ změnit.
- `context.ts` musí rozlišit „poznámky neexistují" (vynechat blok) vs „existují"
  (vykreslit odkaz) — využít návratovou hodnotu `readDiscussNotes` (null/blank).
- Odkaz renderovat jako **relativní** `.mini/discuss/phase-${phase.id}.md`
  (ne absolutní z `discussNotesPath(cwd,…)`), aby šel z promptu otevřít stejně
  jako `.mini/run/phase-N.md`.
- Token-report je zavádějící metrika (nevidí Read call) — formulovat jen jako
  „přegenerováno", ne „do kleslo pod X".
- `mini discuss --apply` neexistuje — shrnutí se zapisuje přímo do tohoto souboru.
