# Changelog

Všechny podstatné změny v tomto projektu jsou zaznamenány zde. Formát vychází
z [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) a projekt používá
[sémantické verzování](https://semver.org/lang/cs/).

## [Unreleased]

### Added

- **Interní prompty `next`/`plan`/`do` přeloženy do angličtiny.** Headless cesta
  (`mini next/plan/do` přes API) generuje instrukce pro Claude nově anglicky;
  response-kontrakt (`TITLE:`/`GOAL:`/`STEP:`) zůstává beze změny. Založen sdílený
  slovníček překladu `docs/i18n-glossary.md` jako opora pro další fáze. (Interaktivní
  slash-command cesta a sdílená nápověda ke grafu se přeloží v navazujících fázích.)
- **Prompty `audit` a import GSD přeloženy do angličtiny.** Audit teď generuje
  `.mini/codebase.md` s anglickými nadpisy sekcí (Overview / Directory structure /
  Key modules / Technologies); import GSD má anglickou prózu. Strojové kontrakty
  (`NAME:`/`WHAT:`/`FOR_WHOM:`/`CONSTRAINTS:`/`PHASES:` i stavová slova) zůstávají beze změny.
- **`/mini:auto --discuss`** — flag vynutí krok `discuss` v každé fázi běhu
  (analogicky k `--verify`). Bez něj se `discuss` spouští jen podmíněně u složitých fází.
- **Verify v autonomním `/mini:auto`** — cyklus teď mezi `do` a `done` spustí krok
  `verify` u **UI/UX fází** (Claude posoudí z cíle/kroků/reportu). Nový flag
  **`--verify`** ho vynutí v každé fázi. Nálezy se zapíšou do reportu (a tím i do
  paměti) a případné problémy se opraví ještě v téže fázi před uzavřením.

### Changed

- **`mini done` commitne fázi v jednom commitu — po `done` ve worktree nic nevisí.**
  Memory záznam, přegenerovaný graf i finální `state.json` (posun na `done`) vznikají
  nově **před** commitem, takže je `git add -A` pobere do jediného commitu fáze.
  Dřív se commitovalo dřív a tyhle artefakty zůstávaly viset do další fáze.
  `mini undo` identifikuje commit fáze přes `preSha` (`HEAD^ === preSha`) místo
  vlastního sha — ten se do commitnutého stavu už neukládá (závisel by sám na sobě;
  starší fáze ho v `state.json` mají dál, zpětná kompatibilita zachována).
- **`mini verify` / `/mini:verify` už není read-only** — po kontrole zapíše nálezy
  do run reportu (`## Nálezy z verify`), odkud se přes report dostanou i do paměti;
  u už uzavřené fáze je připíše i přímo do memory souboru. Stav fáze dál neposouvá.
- **README sjednocen se skutečným stavem nástroje.** Doplněny chybějící příkazy
  (`mini stop`/`migrate`/`update`) i verzování/CHANGELOG/tag u `done`; strom
  `.mini/` aktualizován na layout v2 (`phases/`, `graph.json` + `graph/`); opraven
  popis memory (soubor `phase-{id}.md` bez timestampu, `last-memory.md` je krátké
  shrnutí, ne symlink).

### Fixed

- **Po instalaci z npm `mini init` zakládá `.mini/.gitignore`.** Skeleton drží
  gitignore pod npm-safe jménem `gitignore` (bez tečky) — `npm publish` totiž
  soubory `.gitignore` z tarballu vyřazuje, takže na novém počítači ve skeletonu
  chyběl a `mini init`/`mini update` ho do projektu nezaložily. Do projektu se
  i nadále zapisuje jako `.gitignore` (přejmenování řeší `assets.ts:FILE_RENAMES`).

## [1.4.0] - 2026-05-30

### Added

- **`mini verify` / `/mini:verify`** — hloubková UI/UX kontrola fáze člověkem.
  Claude tě interaktivně provede vizuální/UX kontrolou (připraví scénu, projde
  `verify` body z reportu, doplní širší UX procházku a posbírá nálezy). Cílí na
  aktuální fázi, jinak na poslední uzavřenou. Je **read-only** — stav neposouvá,
  to zůstává na `done`.
- **`mini stop`** — kooperativní zastavení autonomního `/mini:auto`. Založí signál
  `.mini/STOP` (z druhého terminálu); běžící `/mini:auto` ho na hranicích kroků
  přečte, dokončí rozdělaný krok, zapíše report a čistě skončí. `mini stop --clear`
  signál smaže. Obě varianty jsou idempotentní.
- **Autonomní `/mini:auto`** — slash command teď dotáhne víc fází za sebou
  (`next → discuss(podmíněně) → plan → do → done → opakuj`) s `--max-phases N`
  (default 1) a `--yolo`. Zastaví se a zeptá u kroků vyžadujících člověka (`next`,
  `discuss`, body k ručnímu ověření v `done`), u `do` běží tiše (nepřevypráví
  editace). Kooperativní stop háčky (`.mini/STOP`) čte na hranicích kroků — signál
  zakládá `mini stop` (viz výše).
- **`.claude/settings.json`** s allowlistem (`mini:*`, build/test, git), aby
  autonomní běh neotravoval s potvrzováním příkazů.
- **`mini map --file <cesta>`** — inkrementální update grafu: přemapuje jen jeden
  soubor (uzel `.mini/graph/<cesta>.md` + záznam v `graph.json`, atomicky přes
  tmp+rename, se zachováním pořadí) místo plného rebuildu. Lze opakovat pro víc
  souborů. Zmizelý soubor odebere uzel i záznam; nemapovatelné přípony a ignorované
  adresáře jsou no-op; chybějící index spadne na plný build. Protože uzly grafu jsou
  per-file, výsledek je identický s plným rebuildem dotčeného souboru.
- **`mini map --hook`** — pro autonomní režim: přečte cestu editovaného souboru
  z PostToolUse hook JSON na stdin a inkrementálně ji přemapuje (bez závislosti na
  `jq`). Bez cesty tiše no-opuje. README popisuje snippet do `.claude/settings.json`,
  který po každém `Edit`/`Write` drží graf čerstvý; `mini init` na něj upozorní.
- **`/mini:init`** — inicializace projektu přímo z Claude Code: slash command se
  v session zeptá na čtyři věci (název, co stavíš, pro koho, omezení), uloží projekt
  přes nové neinteraktivní `mini init --apply --name/--what/--for-whom/--constraints
  [--force]` a podle obsahu adresáře nabídne další kroky — u existujícího kódu
  `/mini:map` a `/mini:audit`, jinak `/mini:next`.
- **`/mini:audit`** — slash command, který pustí `mini audit` (přehled existující
  codebase do `.mini/codebase.md`) přímo z Claude Code.

## [1.3.0] - 2026-05-30

### Added

- **`mini update`** — srovná negenerovanou část projektu na aktuální verzi mini:
  statický skeleton `.mini/` (adresáře + `.gitignore`) a slash commandy
  `.claude/commands/mini/*.md`. Idempotentní — vytvoří chybějící, přepíše změněné
  (skeleton soubory jsou mini-owned), ostatní nechá beze změny a vypíše souhrn.
  `--dry-run` ukáže náhled bez zápisu. Skeleton žije jako shipovaný asset
  (`assets/skeleton/` → `dist/skeleton`) a je jediný zdroj pravdy: čerpá z něj
  i `mini init` a snadno se rozšiřuje o další statické soubory.
- **`mini migrate --renumber`** — přečísluje fáze na souvislá celá čísla
  (1..N podle pořadí ve `state.json`) a sjednotí názvy souborů ve všech čtyřech
  adresářích (`phases/`, `discuss/`, `run/`, `memory/`) na kanonický `phase-XXX`.
  Narovná projekty se smíšeným/legacy číslováním (např. desetinná „opravná" id
  `1.1`…`28.1` vedle celých). Zvládá různá stará schémata názvů (paddované
  i nepaddované, `.prev.md`, memory s timestampem). Idempotentní; `--dry-run`
  ukáže náhled mapování bez zápisu, jinak se před změnou ptá na potvrzení.
  Orphany (soubory bez záznamu ve stavu) nechává být s varováním, při kolizi
  cílových názvů se zastaví, aby nic nepřepsal.
- Mapa znalostního grafu nově podporuje **Ruby** (`.rb`): vytáhnou se importy
  (`require` i `require_relative`, vč. závorkové formy) a top-level deklarace —
  `def` (se signaturou parametrů vč. splat `*`/`**`, keyword `key:`, default
  hodnot, `&block` i endless metod `def x = …`) a typy `class` (kind `class`)
  a `module` (kind `module`). Default viditelnost je `public`; holé
  `private`/`protected` i `private def …` skryjí následující členy. Viditelné
  instanční i třídní metody (`def self.x`) a atributy
  (`attr_reader`/`attr_writer`/`attr_accessor`) se připojí k typu s kotvami na
  řádky. Komentáře (`#` i blokové `=begin`/`=end`) a stringy se ignorují.
  Projekt se rozpozná i podle `Gemfile`.
- Mapa znalostního grafu nově podporuje **Swift** (`.swift`): vytáhnou se
  importy (vč. submodulů `import Foo.Bar` a kindových `import struct Foo.Bar`)
  a top-level deklarace — `func` (se signaturou parametrů, default hodnot,
  variadik `Int...`, generik, `async`/`throws` i `where` klauzule) a typy
  `class`/`struct`/`enum`/`protocol`/`extension`/`actor`. Default viditelnost je
  `internal`; `private`/`fileprivate` se vynechá (`private(set)` zůstává
  viditelné). Viditelné metody se připojí k typu s kotvami na řádky,
  `static`/`class func` jsou označené. Komentáře (vč. **vnořených** block
  komentářů), doc komentáře i stringy (vč. víceřádkových `"""…"""` a raw
  `#"…"#`) se korektně ignorují. Projekt se rozpozná i podle `Package.swift`.
- Mapa znalostního grafu nově podporuje **Kotlin** (`.kt`/`.kts`): vytáhnou se
  importy (vč. wildcard `import a.b.*` a aliasů `import a.b.C as D`) a top-level
  deklarace — `fun` (se signaturou parametrů, default hodnot, `vararg`, generik
  i extension receiveru) a typy `class`/`interface`/`object`/`enum class`/
  `data class`/`sealed class|interface`/`annotation class`. Default viditelnost
  je `public`; `private`/`internal` se vynechá. Viditelné metody se připojí
  k typu s kotvami na řádky. Komentáře (vč. **vnořených** block komentářů), KDoc,
  char literály i stringy (vč. raw `"""…"""`) se korektně ignorují. Projekt se
  rozpozná i podle `build.gradle.kts`.
- Mapa znalostního grafu nově podporuje **C#** (`.cs`): vytáhnou se usingy
  (`using`, `using static`, `global using` i aliasy `using Foo = A.B`) a top-level
  typy uvnitř `namespace` (block i file-scoped) — `class`/`struct`/`interface`/
  `enum`/`record` (vč. `record class`/`record struct`), s `public`/`internal`
  metodami (signatury parametrů vč. `params`, default hodnot a `static`)
  připojenými k typu a kotvami na řádky. Komentáře, XML doc, char literály
  i stringy ve všech variantách (verbatim `@"…"`, interpolované `$"…"`, raw
  `"""…"""`) se korektně ignorují. Projekt se rozpozná i podle `*.sln`/`*.csproj`.
- `mini done`/`mini auto`: volba `--bump none` — uzavře fázi bez navýšení verze
  (vhodné pro dílčí fáze, kde se verze zvedne až na konci celku).
- Mapa znalostního grafu nově podporuje **Javu** (`.java`): z tříd se vytáhnou
  importy (`import`, `import static` i wildcard `import a.b.*`) a top-level typy —
  `class`/`interface`/`enum`/`record`/`@interface` deklarované jako `public`/`protected`,
  s `public`/`protected` metodami (vč. signatur parametrů, varargs a `static`)
  připojenými k typu a kotvami na řádky. Komentáře, javadoc, stringy i text bloky
  (`"""…"""`) se korektně ignorují. Projekt se rozpozná i podle `pom.xml` nebo
  `build.gradle`(`.kts`).
- Mapa znalostního grafu nově podporuje **Go** (`.go`): z balíčku se vytáhnou
  importy (single i blokový `import ( … )` vč. aliasů, `_` blank a `.` dot importů)
  a top-level exporty — funkce se signaturou, `struct`/`interface`, typové aliasy
  a `const`/`var` (i seskupené), exportované podle velkého počátečního písmene.
  Metody se připojují k receiver typu, vše s kotvami na řádky. Projekt se rozpozná
  i podle `go.mod`.

### Changed

- **`mini init`** nově zakládá `.mini/` z téhož skeletonu jako `mini update`
  (adresáře `phases/`, `memory/`, `discuss/`, `run/` + `.gitignore`); `project.md`
  a `state.json` se dál generují zvlášť.
- **Výchozí chování `--bump` je nově `none`** (dřív `patch`): `mini done` ani
  `mini auto` už verzi v `package.json` ve výchozím stavu nenavyšují. Pro
  povýšení použij `--bump patch|minor|major`.
- `--push` nově vyžaduje explicitní `--bump patch|minor|major` — push bez úrovně
  verze (nebo s `none`) skončí chybou. Push = vydání, proto musí mít verzi pro tag.
- **Sjednocené názvy souborů fází** ve všech adresářích `.mini/`: `discuss/`,
  `memory/` i `run/` nově používají stejný formát `phase-XXX` (3 číslice
  s nulovým paddingem) jako `phases/`. Z názvu memory zmizel ISO timestamp;
  opakovaný záznam téže fáze se odliší příponou `-2`, `-3`, … místo data.
  Existující soubory byly přejmenovány.

## [1.2.0] - 2026-05-30

### Added

- Mapa znalostního grafu nově podporuje **Python** (`.py`/`.pyi`): z modulu se
  vytáhnou importy (`import`, `from ... import` vč. relativních, aliasů, `*` a
  víceřádkových) a top-level exporty — funkce (`def`/`async def`) se signaturou,
  třídy s veřejnými metodami a UPPER_CASE/anotované konstanty, s kotvami na řádky.
  Projekt se rozpozná i podle `pyproject.toml`/`setup.py`; `.venv/` a
  `__pycache__/` se ignorují.

## [1.1.0] - 2026-05-30

### Added

- `/mini:done` nově vytváří a udržuje `CHANGELOG.md` ve formátu Keep a Changelog
  1.1.0: Claude z reportu hotové fáze zapisuje změny pod `## [Unreleased]`
  (sekce `Added` / `Changed` / `Fixed`). Při vydání s `--bump minor`/`major`
  a `--push` se obsah `## [Unreleased]` zaklapne do datované sekce
  `## [verze] - datum` (shodné s git tagem) a nahoru se vloží nová prázdná
  `## [Unreleased]`; patche se kumulují v `Unreleased` až do dalšího vydání.
