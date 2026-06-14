# Úkol: přidat do mini krok `adversarial-project` - nezávislý red-team review napříč projektem

> Zadání pro AI agenta. Je psané jako spec, ne jako hotový kód - naváž na existující
> konvence mini (názvy, sestavování promptů přes `mini context`, scoped read-only
> session přes `workWithClaude`, nálezy do `.mini/findings/` přes `mini findings add`).
> Než začneš, přečti si, jak je udělaný stávající `adversarial` (`src/commands/adversarial.ts`,
> `adversarialContext.ts`) a findings store (`src/state/findingsStore.ts`,
> `src/commands/findings.ts`) - tenhle krok je jejich celoprojektová varianta, ne
> nová věc od nuly.

---

## Cíl a filozofie

Mini má dnes `adversarial` - nezávislý red-team review **jedné fáze** mezi `do` a
`done`. Funguje, protože má úzký rozsah: jeden diff, jeden report, pár souborů.

Chybí krok, který se na kód podívá **z nadhledu napříč delším úsekem vývoje** -
najde zranitelnosti, nedodělky, regrese a slabiny návrhu, které jednotlivá fáze
nevidí, protože každá řešila jen svůj kousek. Typické použití: před releasem, po
větším refactoru, při převzetí projektu.

Klíčový princip zůstává stejný jako u per-fázového kroku: **recenzent nesmí být ve
stejné roli jako autor.** Spouští se ve **fresh session** se scoped read-only
nástroji - reviewer nesdílí kontext (a slepé skvrny) toho, kdo kód psal, a fyzicky
na něj nemůže sáhnout.

Druhý princip, specifický pro tenhle krok: **kód především, reporty jen jako
kontext.** Zaznamenané kroky (reporty fází) jsou autorova narrace - nesou autorovy
předpoklady. Zdrojem pravdy je `git diff`; reporty slouží jen jako mapa „co se v tom
úseku mělo dít", ne jako důkaz, že se to povedlo.

---

## Zařazení do cyklu

**Ruční, opt-in příkaz. Žádný `auto`, žádná heuristika.** Na rozdíl od per-fázového
`adversarial` se tenhle krok **nesmí** spouštět automaticky v `auto` ani jako součást
cyklu fáze. Je drahý (velký rozsah → velký objem výstupu) a šumivý; má smysl jen když
ho člověk vědomě vyvolá. Nehýbe stavem žádné fáze.

---

## Rozsah review - čísla fází primárně, git ref jako úniková cesta

Mini je postavené na fázích, takže primární rozhraní jsou **čísla fází**. Každá fáze
uzavřená přes `mini done` si ukládá `autoCommit` (`preSha` + `subject`) do
**per-fázového souboru `.mini/phases/phase-NNN.json`** (NE do `state.json`, tam má
fáze jen `id`/`title`/`status`). Načti ho přes `loadPhase(cwd, N)`.

Sémantika: **`preSha` fáze N = stav stromu těsně PŘED začátkem fáze N** (= commit
fáze N-1). Projekt postavený v mini od začátku má `preSha` u každé fáze - rozlišení
rozsahu je tím pádem triviální čtení jednoho pole, žádné dohledávání v gitu.

> Pozn.: v TOMHLE repu fáze 1-25 `preSha` z části nemají (vznikly před zavedením
> auto-commitu, část je naskládaná v iniciálním commitu). To je **historický artefakt
> tohohle projektu, ne obecný stav** - nestav kvůli němu do nástroje žádnou speciální
> logiku. Pro tyhle staré fáze se použije ruční git-ref režim (níže) a projedou se
> jedním dvěma zadáními, ne kódem.

**Primární rozhraní - `--from-phase` / `--to-phase`:**

- `mini adversarial-project --from-phase <N> --to-phase <M>`
  - `fromSha` = stored `preSha` fáze N (stav před začátkem N).
  - `toSha` = stored `preSha` fáze **M+1**, jinak `HEAD` (když je M poslední fáze).
  - subjektem review je **`git diff <fromSha>..<toSha>`** - to je „kód především".
- Default: `--to-phase` = poslední `done`; `--from-phase` = rozumný úsek zpět
  (vyber a zdůvodni - např. posledních N fází).
- Fáze v rozsahu slouží i jako **odvozený kontext**: jejich `id` + `title`
  (z `loadPhase`) přilož jako mapu úseku. Diff je pravda, titulky jen barva.
- **Rozlišení = jen čtení stored `preSha`. Žádná derivace z gitu, žádné parsování
  commit subjectů.** Když fáze v rozsahu stored `preSha` nemá → **hlasité selhání**
  s hintem „tahle fáze nemá zaznamenaný commit; projeď ji ručně přes `--from`/`--to`".
  Nikdy tiše neuhádni ani nespadni na prázdný diff.

**Úniková cesta - git ref (`--from` / `--to`):**

Pro fáze bez `preSha` a pro práci mimo fázový model:

- `mini adversarial-project --from <git-ref> --to <git-ref>` (tag, SHA, větev,
  `HEAD~30`, prázdný strom, …); `--to` default `HEAD`.
- Bere se to, co uživatel zadal; SHA se nehledají přes fáze. Neplatný ref → selhat
  hned a srozumitelně, ne až uvnitř session.
- `--from-phase`/`--to-phase` a `--from`/`--to` se nesmí míchat v jednom běhu
  (jeden zdroj rozsahu) - kolizi odmítni jasnou chybou.

---

## Co má příkaz dělat

1. Nový CLI příkaz `mini adversarial-project --from-phase <N> --to-phase <M>`
   (primárně) s únikovou cestou `--from <ref> --to <ref>` a slash command
   `/mini:adversarial-project`, generovaný přes `install-commands` (idempotentně);
   tělo volá `mini context adversarial-project …`.
2. Rozsah se nejdřív vyřeší na dvojici SHA (viz sekce „Rozsah review"):
   - z fází přes `loadPhase(N).autoCommit.preSha` (primárně), nebo
   - z git refů (úniková cesta),
   - chybějící mapování / neplatný ref → **hlasité selhání před session**.
3. Recykluj infrastrukturu per-fázového kroku - **nestav vedle ní**:
   - fresh session přes `workWithClaude`,
   - scoped read-only nástroje (viz níže),
   - zápis nálezů přes `mini findings add` do `.mini/findings/`.
4. `mini context adversarial-project` sestaví **tenký index, ne data dump**:
   - `project.md` (1 strana),
   - rozsah review (vyřešené `<fromSha>..<toSha>` + lidsky čitelné fáze/refy),
   - seznam fází v rozsahu - jen `id` + `title` (z `loadPhase`), **ne** plné reporty,
   - explicitní `git diff <fromSha>..<toSha>` příkaz, který si reviewer spustí sám.

   Žádné plné reporty fází do promptu (`phase-154.md` má 24 000 řádků). Reviewer si
   data dotahuje sám přes `Read`/`git show` - díky read tools nemusíš řešit
   map-reduce ani token budget v kódu.
5. Reviewer dostane instrukci přepnout do role nezávislého recenzenta (prompt níže).

---

## Scoped nástroje (read-only + zápis nálezů)

Stejná logika jako u `adversarial`: **žádný `Edit`** je load-bearing záruka, že
reviewer nesáhne na kód. Oproti per-fázovému setu přidej `mini findings list` kvůli
deduplikaci (viz níže).

```
Read, Grep, Glob, LS,
Bash(git diff:*), Bash(git log:*), Bash(git show:*),
Bash(mini findings list:*),
Bash(mini findings add:*),
```

> Pozn.: jak striktně Claude Code vynucuje scoped `Bash(... :*)` vzory není tady
> nezávisle ověřené - vynechání `Edit` je ta skutečná pojistka, ne whitelist Bash.

---

## Nálezy (findings) - zásah do schématu

- Přidej `project` do `FINDING_SOURCES` (dnes `adversarial` | `verify`) v
  `findingsStore.ts`. `mini findings add --source project` pak taguje nálezy z tohoto
  kroku.
- **Atribuce k fázi:** projektový nález není o jedné fázi. Nejmenší změna: pověsit ho
  na koncovou fázi rozsahu (`--to-phase M`, resp. poslední `done` u git-ref režimu),
  stejně jako dnes `findings add` odvozuje cílovou fázi. Plnohodnotné řešení (nález
  vázaný jen na soubor bez phase ID) je větší zásah - pro první verzi nech atribuci
  na koncové fázi a poznamenej to jako vědomé zjednodušení.
- **Deduplikace:** reviewer si v promptu **nejdřív** spustí `mini findings list`,
  aby viděl, co už je otevřené, a nehlásil podruhé totéž. Bez tohohle kroku projektový
  průchod znovu najde věci, co už v `.mini/findings/` jsou.

---

## Bezpečnost = delegace, ne vlastní logika

Uživatel chce „najít zranitelnosti", ale **generický LLM-adversarial není security
auditor** - mělký sken vydávaný za audit je horší než žádný, protože dává falešný
pocit bezpečí.

- Tenhle krok **nedělá** vlastní security analýzu (žádný injection/secrets/traversal
  checklist v promptu).
- Na konci promptu i ve výstupu příkazu uveď hint: *„Pro bezpečnostní audit spusť
  `/security-review` (vestavěný skill Claude Code)."*
- Projektový adversarial řeší bugy, nedodělky, regrese a slabiny návrhu - bezpečnost
  patří jinam.

---

## Prompt pro agenta (jádro kroku) - návrh textu

```
Přepni se do role nezávislého recenzenta, který tento kód NEPSAL a přebírá projekt
z nadhledu. Tvým úkolem není potvrdit, že to funguje - je najít, čím se to rozbije.

Zdroj pravdy je `git diff <from>..<to>`, ne reporty fází. Reporty (pokud je dostaneš)
ber jen jako mapu „co se mělo dít" - nevěř jim, ověřuj proti kódu.

Nejdřív si spusť `mini findings list` a NEHLÁSE znovu nálezy, které už tam jsou.

Pak projdi rozsah a hledej:

1. UNHAPPY PATH napříč úsekem - co se stane při prázdném, poškozeném, neočekávaném
   vstupu, null/undefined, timeoutu, souběhu? Ukaž konkrétní vstup, který to položí.
2. TICHÉ PŘEDPOKLADY a REGRESE - kde fáze předpokládá tvar dat/stav, který jiná fáze
   mezitím změnila? Kde můžou chyby kaskádovat potichu místo aby selhaly nahlas?
3. NEDODĚLKY - co bylo začaté a nedotažené, TODO bez návaznosti, mrtvý kód, větve
   bez pokrytí, rozbitý kontrakt mezi moduly.
4. PŘEDČASNÁ SLOŽITOST - vrstva/abstrakce řešící problém, co (ještě) neexistuje.
5. TESTY - testují i selhání, nebo jen happy path? Co v tomhle rozsahu NENÍ pokryté?

Bezpečnost neřeš do hloubky - na konci jen doporuč spustit `/security-review`.

Každý nález zapiš přes `mini findings add` se severitou (blocker | should-know | nit),
lokací (soubor:řádek) a krátkým popisem, čím se projeví. Source = project.
Nepiš obecné „vypadá to dobře" - když opravdu nic nenajdeš, vyjmenuj KONKRÉTNĚ, co
jsi prověřil a jak. Na kód nesahej (nemáš Edit) - jen zapisuj nálezy.
```

---

## Co řešit při návrhu (rozhodni a zdůvodni v PR)

- **Default rozsahu.** Co je `--from-phase` bez argumentu? Vyber rozumný úsek zpět
  (např. posledních N fází od poslední `done`) a zdůvodni; když rozsah nejde určit,
  hlásí chybu, ne tichý `HEAD~1`.
- **Rozlišení `preSha`.** Jen čtení stored `autoCommit.preSha` přes `loadPhase`.
  Chybí-li → hlasité selhání s hintem na git-ref režim. Žádnou derivaci z gitu ani
  parsování subjectů nestav - je to složitost kvůli artefaktu jednoho repa.
- **Prázdný / obří diff.** Co když `<fromSha>..<toSha>` je prázdný (ukazují na totéž)
  nebo naopak gigantický? Prázdný → jasná hláška, ne běh naprázdno. Obří → reviewer
  si data tahá sám, ale zvaž varování uživateli, že rozsah je velký.
- **Neplatný / smíchaný rozsah.** Neplatný git ref → selhat hned. Smíchání
  `--from-phase` s `--from` v jednom běhu → odmítnout jasnou chybou (jeden zdroj rozsahu).
- **Model.** Stejně jako u `adversarial` zvaž `mini model adversarial-project <model>`
  - red-team z nadhledu chce schopnost, ne úsporu. Rozhodni a zdůvodni.
- **Nehýbat stavem.** Krok jen zapisuje nálezy, žádnou fázi neuzavírá.

---

## Hotovo, když

- `mini adversarial-project --from-phase N --to-phase M` (i git-ref režim) a
  `/mini:adversarial-project` běží, vyřeší rozsah na dvojici SHA, spustí fresh
  read-only session a nálezy jdou do `.mini/findings/` se `source: project`.
- Rozsah se rozliší jen ze stored `preSha`; fáze bez `preSha`, neplatný / prázdný
  rozsah a smíchané rozhraní **selžou hlasitě** s hintem, nikdy netiše neprojdou na
  špatný diff.
- `mini findings list` je ve scoped nástrojích a prompt vynucuje dedup před zápisem.
- `install-commands` generuje nový slash command idempotentně.
- `FINDING_SOURCES` umí `project`; round-trip findings store (parse → serialize)
  novou hodnotu nepoškodí (viz stávající test `findingsStore.test.ts`).
- README + `mini --help` doplněné; `mini doctor` případně počítá nový command.
- Testy v duchu zbytku mini: sestavení promptu (snapshot), chování na prázdném /
  neplatném rozsahu, hlasité selhání `--from-phase` u fáze bez stored `preSha`,
  `source: project` round-trip.

---

## Poznámky k záměru (kontext, ne příkazy)

- Spec záměrně nedává hotový TypeScript - mini má zaběhané konvence, do kterých se
  krok napasuje, ne vyroste vedle nich.
- Primární rozhraní jsou čísla fází, protože mini je na fázích postavené a každá fáze
  uzavřená přes `mini done` si ukládá `autoCommit.preSha` do `.mini/phases/phase-NNN.json`
  (NE do `state.json` - tam má fáze jen `id/title/status`). V projektu vedeném v mini
  od začátku to platí pro všechny fáze; chybějící `preSha` u prvních fází tohohle repa
  je historický artefakt, na který se nástroj neoptimalizuje - od toho je git-ref
  úniková cesta. Nestav kvůli tomu artefaktu derivaci z gitu.
- „Kód především, reporty jako kontext" drží nezávislost recenzenta. Kdyby reviewer
  bral reporty jako rovnocenný vstup, přebral by autorovy slepé skvrny - a tím by krok
  ztratil smysl.
- Bezpečnost je vědomě delegovaná na `/security-review`. Nepřidávej do tohohle kroku
  vlastní security sken - falešný pocit bezpečí je horší než přiznané „tohle neřeším".
