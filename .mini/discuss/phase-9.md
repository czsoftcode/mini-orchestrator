# Fáze 9 — Jeden průchod Claude na fázi

## Záměr
Změnit `mini auto` tak, aby místo restartu Claude session pro každý krok pustil
**jeden Claude session na celou fázi**. Důvod: každý restart stojí Claude
znovu rozkoukávání projektu (Read/Glob, načítání kontextu) — bez přidané hodnoty.

Současný stav: `auto.ts` má smyčku přes kroky (`while (true)` na řádcích ~60-89),
kde každá iterace = `doPhase` na 1 focusedStep + `done`. Po této fázi se smyčka
změní na default 1 průchod + fallback retry.

## Klíčová rozhodnutí

- **Mění se jen `mini auto`, ne interaktivní `mini do`.** Interaktivní `do`
  zůstává krokový (s `focusedStep`) — user si stále může pustit `do` mezi
  kroky ručně pro kontrolu. Auto má vlastní variantu promptu (buď nový
  prompt builder, nebo parametr `wholePhase` v `buildDoPhasePrompt`).

- **Kroky v auto-promptu = vodítko, ne checklist k editaci stavu.** Claude
  dostane seznam kroků jako plán; do `state.json` přímo nezasahuje.

- **Report `.mini/run/phase-{id}.md`** — Claude na konci session zapíše
  report se strukturovaným YAML/JSON front matterem:
  - statusy jednotlivých kroků (done / skipped / blocked / todo)
  - celkový verdict fáze (done / partial / blocked)
  - volný text vespod (poznámky, co se nepovedlo, atd.)
  Strojově parsovatelný blok zaručí, že formátování textu nepoškodí parsing.

- **`done({auto:true})` čte report.** V auto módu před označením kroků
  zkontroluje `.mini/run/phase-{id}.md` a podle něj nastaví status každého
  kroku v `state.json`. Validuje názvy kroků proti aktuálnímu stavu.

- **Fallback smyčka, max 3 iterace.** Pokud po session zbyly kroky se statusem
  `todo` nebo `doing` (tj. ne `done` ani `skipped`), auto pustí další iteraci
  až do limitu 3 celkových průchodů. Po 3 neúspěšných pokusech auto skončí
  s warningem.

- **Druhá/třetí iterace dostane kontext.** V retry promptu se Claudovi
  explicitně řekne: které kroky už jsou hotové, na čem dělat dál, plus
  odkaz na předchozí `.mini/run/phase-{id}.md` (může si ho přečíst pro
  pochopení kde předchozí pokus skončil).

- **Chybějící report → interaktivní fallback.** Pokud po session neexistuje
  `.mini/run/phase-{id}.md`, auto NEoznačí nic naslepo — přejde do
  interaktivního `done` a zeptá se člověka per krok.

- **Report zůstává po finalizaci fáze** (analogicky k `discuss/`). Slouží
  jako historie; user ho může číst zpětně.

## Pozor na

- **Bezpečnost parsování reportu**: validovat YAML/JSON blok, neignorovat
  chyby; matchovat názvy kroků proti `state.json` (Claude může title
  drobně překroutit — buď strict match, nebo fuzzy + warning).

- **Předčasné ukončení Claude session bez reportu** (user napsal `/exit`,
  `--max-turns` doběhl, crash) → musí se rozpoznat a sjet do interaktivního
  `done`, neoznačovat nic.

- **`.mini/run/` adresář** vytvořit před spuštěním Claude (analogicky k
  `.mini/discuss/` ve fázi 8), aby ho Claude mohl zapsat bez kolize.

- **Discuss notes integrace už existuje** (`readDiscussNotes`) — nový
  auto-prompt je musí taky zahrnout, stejně jako stávající `buildDoPhasePrompt`.

- **`done` v auto módu má dnes logiku „označ všechny todo jako done"** —
  tu nahradit čtením reportu. Klasický (ne-auto) `done` se nemění.

- **Snapshot testy** v `prompts/doPhase.test.ts` — buď přidat case pro
  auto-variantu, nebo zachovat současné a přidat nový soubor pro
  whole-phase prompt builder.

- **README** doplnit o `.mini/run/phase-{id}.md` a vysvětlit nové chování
  auto vs do.

- **`max-turns` v retry**: pokud user spustí `mini auto --max-turns N`,
  každá iterace dostane stejný limit, nebo ho rozdělit? Doporučení:
  každá iterace dostane plný `N` (jednoduchost; pokud user chce omezit
  celkovou spotřebu, sníží `N`).
