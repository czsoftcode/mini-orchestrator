# Fáze 10 — Příkaz mini audit a úprava init

## Záměr
Přidat nový příkaz `mini audit`, který spustí Claude Code session,
projde existující kód v `cwd` a vytvoří (nebo inkrementálně aktualizuje)
`.mini/codebase.md` s technickým přehledem projektu.

Účel souboru je **read-on-demand pro Claude** — žádný prompt ho automaticky
neinjektuje, ale Claude si ho v `do`/`plan`/`next` sessionech může sám
přečíst přes `Read`, místo aby pokaždé znova procházel `src/`. Tomu odpovídá
i tone obsahu: cesty, názvy modulů, technologie, krátké odrážky — žádná
delší prosa pro člověka.

Druhá část fáze: po `mini init` v brownfield adresáři (něco už tam je
mimo `.mini/`) se interaktivně zeptá „spustit `mini audit` teď?" a při
souhlasu rovnou audit pustí.

## Klíčová rozhodnutí

- **Soubor:** `.mini/codebase.md`. Sourozenec `project.md`, ne v podadresáři
  (na rozdíl od `discuss/phase-{id}.md` a `run/phase-{id}.md` — protože
  není per-fázový artefakt, ale per-projekt).

- **Žádná automatická injekce do promptů.** `next`/`plan`/`do`/`discuss`/`auto`
  promptbuildery se v této fázi nemění. Claude má přístup přes `Read` jako
  k jakémukoli jinému souboru projektu.

- **Fixní struktura sekcí** (analogie `discuss/phase-{id}.md`):
  ```
  # {název projektu} — přehled kódu

  ## Přehled
  ## Adresářová struktura
  ## Klíčové moduly
  ## Technologie
  ```
  Konkrétní názvy sekcí se mohou v implementaci ještě uhladit; podstatné
  je, že struktura je předepsaná a stabilní (umožní pozdější strojové
  vytahování konkrétních sekcí, pokud by se v dalších fázích integrovala
  do promptů).

- **Session režim:** neinteraktivní (print mode), jako `mini next`/`plan`/
  `import-gsd`. User vidí výsledek a tokens summary. Není to interaktivní
  konverzace.

- **Allowed tools pro audit session:** `Read, Grep, Glob, LS, Write, Edit`.
  `Edit` je důležitý kvůli inkrementálnímu update (viz níže).

- **Inkrementální update.** Pokud `.mini/codebase.md` už existuje, Claude
  ho **přečte jako první** a upravuje jen sekce, které neodpovídají reálu.
  Ruční poznámky uživatele se zachovávají. Prompt musí být explicitní:
  „nepřepisuj celý soubor; oprav jen co nesedí". Doporučený tool: `Edit`
  (po načtení původního obsahu), ne `Write` přepsání celého.

- **Greenfield = odmítnout s warningem.** Pokud v `cwd` (kromě `.mini/`,
  `.git/`, `node_modules/`, `dist/`, a podobných build artefaktů) nic není,
  audit neběží — `log.warn('Není co auditovat — adresář je prázdný.')` +
  hint. Žádný skeleton soubor.

- **Úprava `init`:** Po standardním init flow se zkontroluje, jestli je
  cwd brownfield (heuristika stejná jako u greenfield odmítnutí auditu —
  něco nad rámec ignorovaných adresářů). Pokud ano, dodatečný confirm
  `Spustit teď mini audit?` (default true). Při souhlasu se zavolá `audit()`
  jako další krok. Při ne — `log.hint('Můžeš spustit kdykoli: mini audit')`.

- **Workflow pozice:** Audit je samostatný, manuálně volaný příkaz.
  Nesedí v žádném auto-chainu (tj. `mini auto` ho nevolá). Spouští se
  ad hoc, kdykoli má user pocit, že `codebase.md` zastaral.

## Pozor na

- **Inkrementální update je psychicky náročný úkol pro model.** Claude
  má sklony buďto soubor přepsat celý (nemusí zaregistrovat existující),
  nebo se naopak „bát" zasáhnout a nic neopravit. Prompt by měl výslovně:
  (a) v první větě říct „pokud `.mini/codebase.md` existuje, přečti si
  ho jako úplně první akci", (b) instruovat použít `Edit` nad `Write`,
  (c) říct „udržuj ruční poznámky uživatele i tam, kde nejsou striktně
  generované".

- **Brownfield detekce v `init` i `audit`** musí filtrovat:
  `.git/`, `.mini/`, `node_modules/`, `dist/`, `.next/`, `build/`,
  `.cache/`, `.turbo/`, `coverage/`. Bez filtrace by `init` v čerstvě
  klonovaném prázdném gitu hlásil brownfield. Filtraci sdílet mezi
  `init.ts` a `audit.ts` (vytáhnout do utility).

- **Heuristika brownfieldu** může být i naivní: „v `cwd` existuje cokoli
  mimo ignored seznam". Není potřeba detekovat konkrétní jazyky / framework
  — to už zjistí audit sám.

- **`mini status`** by se v této fázi rozšiřovat neměl (zobrazení
  „codebase.md existuje / chybí / poslední audit"). Out of scope; nech
  na pozdější fázi, pokud se ukáže jako užitečné.

- **Adresář `.mini/`** v okamžiku spuštění auditu garantovaně existuje
  (audit lze spustit jen v projektu s `.mini/state.json` — stejná `exists()`
  guard jako `discuss`/`plan`/`do`). Není třeba `mkdir`.

- **Cena auditu** může být znatelná na velkých projektech (Claude přečte
  package.json + projde src/). Pošli na konec sessionu tokens summary,
  jako to dělají ostatní print-mode příkazy.

- **README** doplnit:
  - tabulku příkazů o `mini audit`,
  - sekci „Soubory v projektu" o `.mini/codebase.md`,
  - zmínit v popisu `mini init`, že se může na konci ptát na audit.

- **Snapshot testy promptů** v `src/prompts/__snapshots__/` — nový
  `auditCodebase.ts` builder dostane svůj `auditCodebase.test.ts` ve
  stejném stylu jako `discussPhase.test.ts` / `planPhase.test.ts`.

- **Per-scope model:** `mini model` momentálně řeší scope `next`, `plan`,
  `do`, `importGsd`, `default`. Audit je další samostatná Claude session
  — vyplatí se přidat scope `audit` analogicky? Pravděpodobně ano
  (audit může mít rád sonnet kvůli rychlosti i ceně). Drobnost, ale
  zaslouží si vlastní rozhodnutí v `plan` fázi.

- **Permission mode:** print mode session — Edit/Write jdou bez ptaní
  (`acceptEdits` ekvivalent). Nutné si v `workWithClaude` ověřit, že
  print-mode helpery to neztratí.
