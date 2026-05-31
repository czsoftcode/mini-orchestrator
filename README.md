# mini

Minimalistický CLI orchestrátor postavený nad **Claude Code**. Drží stav projektu, posílá Claudovi jen to nejnutnější a využívá tvoje Pro/Max předplatné (žádné API klíče).

Vznikl jako jednodušší alternativa k [GSD](https://github.com/gsd-build/get-shit-done), který spotřebovává moc tokenů — generuje hromadu MD souborů (`RESEARCH.md`, `PLAN.md`, `VERIFICATION.md`, …) a opakovaně je čte. `mini` drží **minimální stav** (`project.md` na jednu stránku + lehká hlavička `state.json` s detailem fází v `.mini/phases/`) a posílá Claudovi typicky 1 stránku + aktuální úkol.

## Co potřebuješ

- [Claude Code](https://claude.com/claude-code) (přihlášený přes Pro/Max nebo s API klíčem)
- Node.js 20+

## Instalace

```bash
npm install -g mini-orchestrator@latest
```

Příkaz se jmenuje `mini`. Aktualizace: stejný příkaz znovu. Odinstalace: `npm uninstall -g mini-orchestrator`.

Instalace bez `sudo`: nasměruj globální npm prefix do domovského adresáře (jednorázově) a měj jeho `bin` v `PATH`:

```bash
npm config set prefix "$HOME/.local" --location=user   # ~/.local/bin musí být v PATH
```

### Z gitu / pro vývoj

```bash
git clone https://github.com/czsoftcode/mini-orchestrator.git
cd mini-orchestrator
npm install
npm run build
node dist/cli.js --help        # nebo: alias mini='node $(pwd)/dist/cli.js'
```

## Quick start

```bash
mkdir muj-projekt && cd muj-projekt

mini init        # 4 otázky → vznikne .mini/project.md a .mini/state.json
mini next        # Claude navrhne první fázi
mini do          # spustí Claude Code session na fázi
                 # … pracuješ v Claude … /exit
mini done        # "funguje to?" → posune stav
mini next        # další fáze …
```

Nebo zkratka:

```bash
mini auto        # next → plan → do (s acceptEdits) → done; vše bez ptaní kromě finálního "funguje to?"
```

## Příkazy

| Příkaz | Co dělá |
|--------|---------|
| `mini init` | Založí nový projekt (project.md + prázdný state). V brownfield adresáři na konci nabídne spustit `mini audit`. |
| `mini next` | Claude navrhne další fázi |
| `mini audit` | Projde existující kód a vytvoří/aktualizuje `.mini/codebase.md` (přehled projektu pro pozdější Claude session) |
| `mini map` | Přegeneruje strojovou mapu projektu (`.mini/graph.json` + `.mini/graph/`). S `--file <cesta>` přemapuje jen jeden soubor (lze opakovat); s `--hook` čte cestu z hook JSON na stdin — viz [Strojová mapa projektu](#strojová-mapa-projektu-graf) |
| `mini discuss` | Volitelná diskuse o aktuální fázi před plánováním — Claude uloží shrnutí do `.mini/discuss/phase-{id}.md`, které pak `plan` a `do` použijí jako kontext |
| `mini plan` | Claude rozmění aktuální fázi na 3-7 kroků |
| `mini do` | Sestaví prompt, ukáže ti ho, spustí interaktivní Claude Code |
| `mini done` | Lidská verifikace ("funguje?"), posune stav, najde další fázi; po dokončení fáze volitelně bumpne verzi v `package.json` a zaklapne `CHANGELOG.md`, automaticky commitne práci do gitu (default `--bump none`, s `--push` i tag `v<verze>`) a zapíše memory záznam (`.mini/memory/phase-{id}.md`) |
| `mini verify` | Hloubková UI/UX kontrola fáze člověkem — Claude tě interaktivně provede vizuální/UX kontrolou (vyjde z `verify` bodů reportu) a nálezy zapíše do reportu (u uzavřené fáze i do paměti); stav fáze neposouvá. Cílí na aktuální fázi, jinak na poslední uzavřenou |
| `mini auto` | Chain: next → plan → do (acceptEdits) → done, vše bez ptaní kromě done |
| `mini status` | Co je projekt, kde jsme, modely, fáze a kroky |
| `mini undo` | Vrátí poslední změnu stavu (1 krok zpět, žádná hluboká historie); pokud `mini done` v posledním kroku auto-commitnul a HEAD pořád sedí na čistém stromě, nabídne i revert commitu (`git reset --soft`) |
| `mini stop` | Založí kooperativní stop signál `.mini/STOP` pro autonomní `/mini:auto` (typicky z druhého terminálu); `--clear` ho zruší — viz [Autonomní `/mini:auto`](#autonomní-miniauto) |
| `mini model …` | Per-projekt / per-scope volba modelu (viz níže) |
| `mini import-gsd` | Jednorázový import rozdělaného GSD projektu z `.planning/` |
| `mini migrate` | Jednorázový převod starého monolitického `state.json` na layout v2 (lehká hlavička + `.mini/phases/`); s `--renumber` přečísluje fáze na souvislá čísla a sjednotí názvy souborů |
| `mini update` | Srovná negenerovanou část projektu (skeleton `.mini/` + slash commandy) na aktuální verzi mini; idempotentní, nesahá na generované soubory. `--dry-run` jen ukáže, co by se změnilo |
| `mini install-commands` | Vygeneruje `.claude/commands/mini/*.md` (slash commandy `/mini:*`) do projektu — viz níže |
| `mini context <cmd>` | Vypíše na stdout aktuální session prompt pro krok cyklu (`next`/`discuss`/`plan`/`do`/`done`/`verify`); volají ho slash commandy |

## mini příkazy přímo v Claude Code

Celý cyklus `next → discuss → plan → do → done` jde projet i **přímo z Claude Code** přes nativní slash commandy, aniž by se uvnitř session spouštěl vnořený Claude.

```bash
mini install-commands     # jednorázově v cílovém projektu
```

Vznikne `.claude/commands/mini/{init,next,discuss,plan,do,done,verify,status,map,audit,auto}.md`. Pak v Claude Code:

```
/mini:init           # založí projekt (otázky v chatu) → nabídne /mini:map a /mini:audit
/mini:next [nápad]   # navrhne a uloží další fázi
/mini:discuss        # prodiskutuje fázi, uloží poznámky
/mini:plan           # rozmení fázi na kroky
/mini:do             # implementuje fázi a zapíše report
/mini:done           # lidská verifikace v chatu → posune stav
/mini:verify         # hloubková UI/UX kontrola fáze člověkem; nálezy zapíše do reportu (a paměti)
/mini:auto [args]    # autonomní režim: dotáhne víc fází za sebou (--max-phases N, --yolo, --verify, --discuss)
/mini:map            # přegeneruje graf projektu
/mini:status         # přehled fází (read-only)
/mini:audit          # přehled existující codebase do .mini/codebase.md
```

### Autonomní `/mini:auto`

`/mini:auto` projede celý cyklus fáze (`next → discuss(podmíněně) → plan → do → verify(podmíněně) → done`) a po dokončení jedné fáze plynule pokračuje další — **semi-autonomně**:

- **`--max-phases N`** (default 1) — kolik fází nejvýš dotáhnout za sebou; `--yolo` = běh bez zbytečného doptávání (funguje jen v session spuštěné s `--permission-mode acceptEdits`).
- **`--verify`** — vynutí krok `verify` v každé fázi. Bez něj auto spustí `verify` jen u **UI/UX fází** (posoudí z cíle/kroků/reportu): provede člověka hloubkovou kontrolou mezi `do` a `done`, nálezy zapíše do reportu (a tím i do paměti) a případné problémy opraví ještě v téže fázi před uzavřením.
- **`--discuss`** — vynutí krok `discuss` v každé fázi. Bez něj auto spustí `discuss` jen u **složitých fází** (nejednoznačný cíl, víc směrů).
- **Zastaví se a zeptá** u kroků, kde je potřeba člověk: `next` (vezme tvůj nápad na fázi), `discuss` (u složitých fází nebo s `--discuss`), `verify` (UI/UX kontrola) a u bodů k **ručnímu ověření** v `done`.
- **Tichý běh u `do`** — nepřevypráví každou editaci do chatu, jen krátce hlásí postup.
- **Kooperativní stop:** na hranicích kroků kontroluje stop signál (`.mini/STOP`) a čistě skončí; pro tvrdé přerušení uprostřed kroku použij Esc/Ctrl+C. Signál založíš příkazem `mini stop` (z druhého terminálu), zrušíš ho `mini stop --clear`.

Pozn.: tohle je slash varianta řízená Claudem v jedné session. CLI `mini auto` (níže) je samostatná cesta, která pouští Claude jako podproces a dotahuje **jednu** fázi.

Jak to funguje: tělo `.md` commandu je tenké — jen pustí `mini context <cmd>`, který vypíše vždy aktuální prompt včetně kontextu projektu. Agentní práci dělá Claude v běžící session; **stavové operace** (`.mini/state.json`, reporty, posun fáze) provádějí neinteraktivní pod-příkazy `mini … --apply`, takže stav zůstává v otestovaném TS. `install-commands` je idempotentní — pusť ho znovu po aktualizaci mini. CLI `mini …` přes terminál zůstává beze změny; slash commandy jsou doplněk, ne náhrada.

## Modely

Nastavení per projekt v `.mini/state.json`. Lze nastavit zvlášť pro `next`, `plan`, `do`, `importGsd`, `audit`, `memory` nebo společně přes `default`.

```bash
mini model                       # interaktivně (scope → model)
mini model show                  # tabulka aktuálního nastavení
mini model sonnet                # default = sonnet
mini model do opus               # do (Claude session) = opus
mini model plan haiku            # plan = haiku
mini model do default            # zruší override (zdědí default)
mini model reset                 # smaže všechno
```

**Doporučená kombinace pro úsporu:**
```bash
mini model sonnet                # default = sonnet pro lehké věci
mini model do opus               # do = opus na složité kódování
```

**Pozor:** "levnější" model neznamená vždy úsporu na Pro/Max limitu. Levnější modely často potřebují víc iterací → větší celková spotřeba tokenů. Pro `do` (skutečné kódování) bývá Opus i tak nejvýhodnější.

Po každém volání Claude (next/plan/import-gsd) uvidíš:

```
  (20.4k tokenů · 5 output · 14.1k z cache · ~$0.028 v API)
```

## Co se posílá Claudovi

`mini do` typicky pošle ~600-1000 tokenů (1 stránka `project.md` + aktuální fáze + 5 kroků). Žádná historie starých fází, žádné staré plány, žádné verifikační zprávy.

Pokud Claude potřebuje pochopit existující kód, **přečte si soubory sám** přes `Read`/`Glob`/`Grep` — to je levnější než předem nahrávat všechno do kontextu.

## Strojová mapa projektu (graf)

`mini map` projde zdrojáky a vytvoří **strojovou mapu** projektu:

- `.mini/graph.json` — lehký index: pro každý soubor cesta, jeho uzel a názvy exportů,
- `.mini/graph/<cesta>.md` — uzel na soubor: importy, exporty a signatury s kotvami na řádky (`@L<start>-<end>`).

Slouží Claudovi k **orientaci bez čtení celých souborů**: z indexu najde, kde symbol je, z uzlu na kterých řádcích, a teprve pak cíleně přečte jen ten úsek. Oba soubory jsou derivace zdrojáků (gitignorované) — kdykoli je lze přegenerovat.

### Inkrementální update (`--file`)

Plný `mini map` přemapuje celý strom. Pro úzké změny je tu inkrementální cesta, která sáhne **jen na jeden uzel**:

```bash
mini map --file src/foo.ts          # přemapuje jen src/foo.ts (uzel + záznam v indexu)
mini map --file a.ts --file b.ts    # víc souborů najednou
```

Protože uzly grafu jsou čistě per-file (žádné zpětné hrany), výsledek je identický s plným rebuildem dotčeného souboru — jen mnohem rychleji. Když `graph.json` ještě neexistuje, `--file` spadne na plný build. Nemapovatelné přípony a ignorované adresáře (`node_modules`, `dist`, …) jsou no-op; když zdroják mezitím zmizel, odebere se i jeho uzel.

### Auto-update po editaci (hook)

Pro **autonomní režim** se vyplatí držet graf čerstvý po každé editaci. Slouží k tomu PostToolUse hook, který po každém `Edit`/`Write` přemapuje jen dotčený soubor (lokální operace, žádné tokeny). Do `.claude/settings.json` cílového projektu přidej:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write|MultiEdit",
        "hooks": [
          { "type": "command", "command": "mini map --hook >/dev/null 2>&1 || true" }
        ]
      }
    ]
  }
}
```

`mini map --hook` si cestu editovaného souboru přečte z hook JSON na stdin sám (žádná závislost na `jq`); `>/dev/null 2>&1 || true` drží hook tichý a neblokující i bez nainstalovaného `mini`. Mazání a přejmenování souborů (přes shell) hook nezachytí — na ně občas pusť plný `mini map` jako rekonciliaci.

## Soubory v projektu

```
muj-projekt/
└── .mini/
    ├── project.md                       # 1 stránka — co stavíš, pro koho, omezení
    ├── codebase.md                      # přehled existujícího kódu (vytvoří/aktualizuje `mini audit`)
    ├── state.json                       # lehká hlavička: index fází, statusy, modely (layout v2)
    ├── state.prev.json                  # backup hlavičky pro `mini undo` (jen 1 krok zpět)
    ├── phases/
    │   └── phase-{id}.json              # detail jedné fáze — kroky, report, verify (layout v2)
    ├── graph.json                       # lehký index strojové mapy (viz níže)
    ├── graph/
    │   └── <cesta>.md                   # uzel mapy na soubor — importy, exporty, signatury
    ├── last-memory.md                   # krátké shrnutí nejnovějšího memory záznamu (vstup promptu `next`)
    ├── discuss/
    │   └── phase-{id}.md                # volitelné poznámky z `mini discuss` (Záměr / Klíčová rozhodnutí / Pozor na)
    ├── run/
    │   └── phase-{id}.md                # report z `mini auto` (YAML statusy + volný text)
    └── memory/
        └── phase-{id}.md                # shrnutí hotové fáze (Co se udělalo / Klíčová rozhodnutí / Otevřené konce)
```

`state.json` je jen **lehká hlavička** (index fází, statusy, modely); detail každé fáze (kroky, report, verify) leží zvlášť v `.mini/phases/phase-{id}.json`. `mini undo` zálohuje obojí (`state.prev.json` + `phases-prev/`). `graph.json` + `graph/` jsou derivace zdrojáků (gitignorované) — kdykoli je přegeneruje `mini map`. Autonomní `/mini:auto` navíc čte stop signál `.mini/STOP` (zakládá `mini stop`).

`project.md` můžeš ručně upravovat. Stav je lépe měnit přes mini příkazy než ruční editací JSONu. Soubory v `discuss/` jsou volné markdownové poznámky — můžeš je libovolně editovat nebo smazat; `plan` a `do` je čtou, pokud existují, jinak je prostě vynechají. Soubory v `run/` zapisuje Claude na konci každé auto session — `done` z nich vyčte statusy kroků (viz [Auto režim](#auto-režim)).

`codebase.md` (volitelný, vzniká přes `mini audit`) je technický přehled projektu — adresářová struktura, klíčové moduly, technologie. Žádný prompt ho automaticky neinjektuje; Claude si ho v `do`/`plan`/`next` sessionech sám přečte přes `Read`, místo aby pokaždé znova procházel `src/`. Ruční poznámky v něm `mini audit` zachová. Spouštěj ho ad hoc, kdykoli má pocit, že je zastaralý.

Soubory v `.mini/memory/` (`phase-{id}.md`, při opakovaném `done` téže fáze s rozlišovačem `phase-{id}-2.md`, `-3`, …) zapisuje na konci `mini done` (i `mini auto`) po finalizaci fáze jako `done`. Ve výchozím stavu je `mini` poskládá přímo v TypeScriptu z dat fáze (metadata + doslovný obsah discuss a run reportu) — bez volání Claude API; krátkou print-mode Claude session použije jen tehdy, když je explicitně nastaven `memory` scope (`mini model memory …`). Doplňují `git log` o vrstvu, kterou tam nenajdeš — **proč** se zvolilo řešení X místo Y, jaké otevřené konce zůstaly, na co si dát pozor v dalších fázích. Memory záznamy jsou append-only a `mini undo` do nich nezasahuje. `last-memory.md` drží **krátké shrnutí** nejnovějšího záznamu (čte ho prompt `next`). U `skipped` fáze se memory nepíše. Soubor vzniká **mimo commit** — když ho chceš mít ve verzi, commitni ho ručně.

## Auto režim

`mini auto` automatizuje jednu fázi:

1. `[1/4]` Navrhne další fázi (nebo pokračuje na rozdělané) — bez ptaní
2. `[2/4]` Rozmění na kroky (nebo přeskočí, pokud už kroky má) — bez ptaní
3. `[3/4]` Spustí Claude Code s `--permission-mode acceptEdits` (Edit/Write bez ptaní, Bash se pořád ptá) — bez ptaní
4. `[4/4]` Verifikace: zeptá se **tě**, jestli to funguje

Auto **vždy** končí na lidské verifikaci v `done` — to je tvůj checkpoint.

### Jeden Claude session na celou fázi

Na rozdíl od interaktivního `mini do` (které spustíš ručně na jeden krok) pouští auto **jeden Claude session na celou fázi**. Důvod: každý restart Clauda znamená znovurozkoukávání projektu (Read/Glob, načítání kontextu) bez přidané hodnoty.

Než session skončí, Claude zapíše report do `.mini/run/phase-{id}.md`. Report má dvě části:

- **YAML front matter** se statusy kroků (`done` / `skipped` / `blocked` / `todo`) a celkovým verdiktem fáze (`done` / `partial` / `blocked`) — z něj `done({auto})` posune stav v `state.json`.
- **Volný text** pod YAML blokem — krátké shrnutí pro tebe (co se povedlo, na co Claude narazil, otevřené otázky).

Pokud po session zbydou neuzavřené kroky (Claude nestihl, nebo report chybí), auto pustí další pokus — celkem **maximálně 3 průchody**. Druhý a třetí pokus dostanou v promptu odkaz na zálohovaný report (`phase-{id}.prev.md`), aby Claude věděl, kde předchozí pokus skončil. Po vyčerpání limitu auto skončí s warningem a předá štafetu tobě.

Když Claude session ukončí bez reportu (crash, `--max-turns`, ručně `/exit` bez zápisu), auto si nedovolí naslepo cokoli označit — sjede do interaktivního `done` a zeptá se tě per krok.

Reporty v `.mini/run/` zůstávají po finalizaci fáze jako historie — můžeš si je číst zpětně.

## Import z GSD

V adresáři s `.planning/`:

```bash
mini import-gsd
```

Claude přečte `PROJECT.md` a roadmap, vytvoří `.mini/project.md` a `.mini/state.json`. Importuje jen kostru — fáze + statusy. Detailní MD soubory v `.planning/` zůstávají, ale `mini` je ignoruje.

## FAQ

**Proč se Claude Code ptá pokaždé na povolení?**
V `mini do` je defaultně klasický permission mode (klikáš na každý Edit/Bash). V `mini auto` se používá `acceptEdits` — Edit/Write už neptá, ale Bash pořád ano (žádné náhodné `rm -rf`).

**Co když chci jednu fázi udělat, ale ne tak, jak ji Claude navrhl?**
`mini next` → "Upravit a přidat" → editujete název a cíl ručně. Nebo přidáš ručně do `state.json`.

**Co když je fáze "hotová" ale má todo kroky?**
`mini done` → "Označit fázi za hotovou" → zbylé kroky se označí jako `skipped` a posune se na další fázi.

**Můžu pozastavit a vrátit se zítra?**
Ano. Stav je v `.mini/state.json`, můžeš commitnout do gitu nebo si dát na cloud. `mini status` ti řekne, kde jste skončili.

**Commit a push po fázi?**
Když `mini done` (nebo `mini auto`) finalizuje fázi jako `done`, automaticky spustí `git add -A && git commit` se zprávou `Fáze {id}: {title}` (případně s tělem z poznámky). Pokud cwd není git repo, není co commitnout, nebo commit selže (např. pre-commit hook), pokračuje se dál a uživatel si commit dotáhne ručně. Push se nikdy nedělá automaticky — po commitu uvidíš hint `git push`, který spustíš sám.

**Bump verze, CHANGELOG a tag?**
Verzi v `package.json` `done` ve výchozím stavu **nebumpuje** (`--bump none`). S `--bump patch|minor|major` ji před commitem zvedne a u `minor`/`major` zaklapne sekci `## [Unreleased]` v `CHANGELOG.md` do datované verze (patche se kumulují). `--push` po commitu navíc pushne a vytvoří git tag `v<verze>` — proto `--push` vyžaduje explicitní `--bump` (bez něj by tag neměl novou verzi). Vše je opt-in: bez flagů done jen commitne práci fáze.

**Memory záznam po fázi?**
Po finalizaci fáze jako `done` (a po auto-commitu) se zapíše `.mini/memory/phase-{id}.md` se shrnutím **co se udělalo / klíčová rozhodnutí / otevřené konce**, a do `last-memory.md` jeho krátké shrnutí pro prompt `next`. Ve výchozím stavu se memory skládá přímo v `mini` bez volání Clauda (zadarmo a okamžitě); Claude print-mode session se použije jen při explicitně nastaveném `memory` scope. Memory je nice-to-have — když zápis selže, vypíše se warning a workflow pokračuje. Když si `memory` scope zapneš, doporučujeme lacinější model (`mini model memory haiku`), protože se spouští po každé hotové fázi.

**Undo po auto-commitu?**
`mini undo` si pamatuje pre-commit HEAD u poslední auto-commitované fáze (v `state.json` na `phase.autoCommit`). Když po `mini done` zavoláš `mini undo`, nabídne ti vedle revertu state.json i `git reset --soft` zpět na předchozí commit — ale jen pokud HEAD pořád sedí na auto-commitu a pracovní strom je čistý. Když si mezitím commitnul něco dalšího nebo máš rozdělané změny, undo vrátí jen `state.json` a vypíše hint, jak commit zrušit ručně.

**Funguje to s API klíčem místo Pro/Max?**
Ano, `mini` jen spouští `claude` jako podproces — autentizaci řeší samotný Claude Code podle toho, jak je nastavený.

## Workflow tipy

- Začni `mini auto` na první 1-2 fáze, abys viděl, jak ti to sedí
- Pak přepínej mezi `mini auto` (rychlé) a klasickým `mini do` (kontrola)
- Pokud Claude navrhne hloupost v `mini next` v auto, **stiskni Ctrl+C** a spusť bez auto
- Po každé fázi `mini status` ukáže celkový pokrok

## Licence / atribuce

Tvoje vlastní. Generováno za spolupráce Claude Code.
