# Backlog vylepšení mini orchestrátoru

> Vznik: fáze 22 (čistě analytická). Tento dokument je **zásobník budoucích
> fází** — každá položka je formulovaná tak, aby `title` + `goal` šly rovnou
> předat do `mini next` (režim „popíšu to sám"). Nic z toho se ve fázi 22
> neimplementovalo.

## Jak s tímhle souborem pracovat

- Položky jsou seřazené podle oblasti a uvnitř oblasti podle priority.
- **Priorita:** `H` (vysoká — korektnost/UX bug), `M` (střední), `L` (nice-to-have / kosmetika).
- **Odhad:** `malá` (1 session), `střední`, `velká` fáze.
- Hotovou položku **škrtni** (`~~…~~`) nebo přesuň do sekce „Hotovo" na konci,
  ať při re-runu fáze 22 nevznikají duplicity.
- Baseline v době sepsání: **286 testů zelených, `tsc --noEmit` čistý.**

---

## 1. Správnost workflow

### ~~W1 — Osiřelá `doing` fáze po opravné podfázi~~  · `H` · malá · **hotovo (fáze 23)**
- **Oblast:** workflow
- **title:** `Dozavřít rodičovskou fázi po opravné podfázi`
- **goal:** `Po dokončení opravné podfáze (z block-verify) se rodičovská fáze, která uvázla ve stavu doing, automaticky znovu otevře k verifikaci nebo uzavře — nikdy nezůstane osiřelá.`
- **Proč:** Když člověk při verify označí bod jako `block`, `insertFixSubphase`
  (`done.ts:511`) založí podfázi a `advanceToNextPhase` (`done.ts:282`) se na ni
  posune. Jenže `advanceToNextPhase` vybírá jen fáze ve stavu `proposed/planned`
  — rodič zůstal `doing` (nastaveno v `do.ts:116`) a **už se na něj nikdy
  nevrátíme**. Po dokončení podfáze se přeskočí na další `proposed/planned` fázi
  a rodič navždy visí jako „dělá se". Explicitní loose end z fáze 21.
- **Návrh řešení (k rozmyšlení v plánu):** buď po dokončení poslední podfáze
  rodiče přepnout zpět na verifikaci, nebo rodiče rovnou uzavřít jako `done`
  s odkazem na podfázi, nebo zavést stav/`parentId` a `advanceToNextPhase`
  upravit, aby osiřelé `doing` bez otevřených podfází řešil.

### ~~W2 — `mini next` po podfázi tvoří desetinné ID~~  · `H` · malá · **hotovo (fáze 23)**
- **Oblast:** workflow
- **title:** `Opravit číslování nové fáze po opravné podfázi`
- **goal:** `mini next přidělí nové top-level fázi celé číslo (22) i tehdy, když ve stavu existuje opravná podfáze s desetinným ID (21.1) — žádné fáze typu 22.1.`
- **Proč:** `commitPhase` (`next.ts:181`) počítá `Math.max(0, ...ids) + 1`.
  Když ve `phases` existuje podfáze `21.1`, `Math.max` vrátí `21.1` a nové ID
  bude `22.1` — desetinné top-level ID, které rozbije číslování i pozdější
  `nextSubphaseId`. Oprava: `Math.floor(Math.max(0, ...ids)) + 1`.
- **Pozn.:** Drobná, ale tichá a snadno přehlédnutelná chyba dat ve `state.json`.

### ~~W3 — Auto mód se u verify tiše zastaví / přeskočí bez TTY~~  · `M` · střední · **hotovo (fáze 23)**
- **Oblast:** workflow / robustnost
- **title:** `Vyřešit chování verify v auto módu bez interaktivního terminálu`
- **goal:** `Auto mód u bodů k ručnímu ověření buď jasně oznámí, že čeká na člověka, nebo (bez TTY) detekuje neinteraktivní prostředí a zachová se bezpečně — nikdy verify tiše neprojde jako pass.`
- **Proč:** `done({auto})` volá v `handleVerify` (`done.ts:431`) `ask()` i v auto
  módu — to je záměr (verify se neobchází). Ale v neinteraktivním prostředí
  (CI, pipe, chybějící TTY) `prompts` typicky vrátí `undefined`; odpověď pak
  není `issue` ani `block`, takže se bod vyhodnotí jako **pass** a fáze se zavře
  bez skutečného ověření. Zároveň label příkazu `auto` v `cli.ts:63`
  („Dokončí celou fázi bez promptu") tomuhle odporuje.

### ~~W4 — Opakovaný `mini done` znovu nabízí už vyřešené verify body~~  · `M` · malá · **hotovo (fáze 23)**
- **Oblast:** workflow / DX
- **title:** `Nepřehrávat už vyřešené verify body při opakovaném mini done`
- **goal:** `Po opravě issue a opětovném mini done se znovu nezobrazují tytéž verify body z neměnícího se reportu — buď se report aktualizuje, nebo se vyřešené body přeskočí.`
- **Proč:** Při `issue` se fáze nezavře a uživatel ji má po opravě zavřít znovu
  (`done.ts:488`). Jenže `applyAutoReport` čte pořád **tentýž** `phase-{id}.md`,
  takže `handleVerify` znovu vyjede celý seznam verify bodů. Otravné a matoucí
  (vypadá to, že oprava „nezabrala").

---

## 2. Úklid a mrtvý kód

### ~~C1 — Doložit, že „mrtvý kód" z fáze 17 mrtvý NENÍ~~  · `L` · malá · **hotovo (fáze 24)**
- **Oblast:** úklid
- **title:** `Zrušit zavádějící TODO o smazání MEMORY_ALLOWED_TOOLS`
- **goal:** `Žádný komentář/úkol netvrdí, že MEMORY_ALLOWED_TOOLS, MEMORY_TIMEOUT_MS a buildWriteMemoryPrompt jsou mrtvé — jsou živé (explicitní memory režim) a to je u nich krátce zdokumentováno.`
- **Proč / zjištění:** Krok z fáze 17 „smazat `MEMORY_ALLOWED_TOOLS`,
  `MEMORY_TIMEOUT_MS`, import `buildWriteMemoryPrompt`" byl `skipped`
  **správně** — všechny tři dál používá `writeViaClaude`
  (`commands/writeMemory.ts:14,15,172,187,189`), který se spustí, když je scope
  `memory` ručně nastaven přes `mini model`. Tohle není dluh; jen je potřeba,
  aby budoucí čtenář nepokládal symboly za mrtvé a nesmazal je.

### ~~C2 — Migrovat deprecated `state.model` → `models.default`~~  · `L` · malá · **hotovo (fáze 24)**
- **Oblast:** úklid
- **title:** `Sjednotit konfiguraci modelu na models.default`
- **goal:** `Pole state.model (označené @deprecated) se při load jednorázově zmigruje do models.default a fallbacky na něj v kódu zmizí.`
- **Proč:** Zastaralé `state.model` (`types.ts:55`) se pořád čte na třech
  místech (`models.ts:18,22` v `resolveModel`/`getDefaultModel`,
  `status.ts:92` v `describeModels`). Jednorázová migrace ve `store.load`
  by tenhle rozkročený fallback zrušila.

### ~~C3 — Prořezat nepoužívané `PermissionMode` hodnoty~~  · `L` · malá · **hotovo (fáze 24)**
- **Oblast:** úklid
- **title:** `Zúžit typ PermissionMode na skutečně používané hodnoty`
- **goal:** `Typ PermissionMode obsahuje jen hodnoty, které mini reálně používá, nebo je u nepoužitých uveden důvod, proč v API zůstávají.`
- **Proč:** `work.ts:3` deklaruje 6 módů (`acceptEdits`, `auto`,
  `bypassPermissions`, `default`, `dontAsk`, `plan`), ale mini předává reálně
  jen `acceptEdits` (a `undefined`). Buď zúžit, nebo okomentovat jako záměrně
  široké zrcadlo CLI.

---

## 3. Robustnost a chybové stavy

### ~~R1 — `mini do --max-turns` se tiše ignoruje~~  · `H` · malá · **hotovo (fáze 25)**
- **Oblast:** robustnost / DX
- **title:** `Propojit mini do --max-turns až do Claude session`
- **goal:** `Volba mini do --max-turns N se skutečně propíše do běhu Claude (omezí počet odpovědí); dnes je definovaná, ale action ji zahodí.`
- **Proč:** `cli.ts:46-51` definuje `--max-turns` u příkazu `do` a parsuje ho
  (`parseMaxTurns`), ale handler volá `doPhase({ stream: opts.stream })` —
  **`maxTurns` se nepředá**. `doPhase` přitom `opts.maxTurns` umí použít
  (`do.ts:147,161`). Uživatelská volba je dnes no-op. Triviální oprava
  (`doPhase({ stream: opts.stream, maxTurns: opts.maxTurns })`), ideálně + test.

### ~~R2 — Chybí e2e/integrační test reálné auto smyčky~~  · `M` · velká · **hotovo (fáze 25)**
- **Oblast:** robustnost
- **title:** `Přidat e2e test auto smyčky proti reálnému Claude (volitelně)`
- **goal:** `Existuje aspoň jeden integrační/e2e test, který projede next→plan→do→done na malém dočasném projektu — buď s reálným claude za flagem, nebo s realistickým fake binárkou místo čistých unit mocků.`
- **Proč:** Auto smyčka (`commands/auto.test.ts`) je dnes pokrytá jen unit mocky
  jednotlivých kroků. Reálný průchod (spawn `claude`, zápis reportu, parse,
  posun stavu, commit) nikdo neověřil end-to-end. Velká, ale cenná pojistka
  proti regresím na švech mezi moduly.

### ~~R3 — Přívětivé hlášení při chybějící `claude` binárce~~  · `M` · malá · **hotovo (fáze 25)**
- **Oblast:** robustnost / DX
- **title:** `Sjednotit hlášku a návod při chybějícím claude binárce`
- **goal:** `Když claude binárka chybí (ENOENT), všechny cesty (do, stream, memory přes Claude) vypíšou stejnou srozumitelnou hlášku s návodem na instalaci, ne syrový ENOENT.`
- **Proč:** `work.ts:40` ENOENT zabalí a `do.ts:166` z toho udělá `claude-error`,
  ale v auto módu se ven dostane jen `log.dim`. Stojí za to ověřit i stream
  cestu (`claude/stream.ts`) a memory přes `askClaude`, a sjednotit UX
  (detekce „claude not found" → hint „nainstaluj Claude Code").

### ~~R4 — `mini next` nemá retry při neparsovatelné odpovědi~~  · `L` · malá · **hotovo (fáze 25)**
- **Oblast:** robustnost
- **title:** `Dát mini next jeden retry při nečitelném návrhu fáze`
- **goal:** `Když Claude odpoví bez TITLE:/GOAL:, mini next jednou zopakuje dotaz s upřesněním formátu, než to vzdá s parse-failed.`
- **Proč:** `parseSuggestion` (`next.ts:216`) hledá `TITLE:`/`GOAL:`. Při
  odchylce vrací `parse-failed` a v auto módu celá smyčka spadne hned v prvním
  kroku. Jeden cílený retry (nebo tolerantnější parser) zvedne spolehlivost
  bez velké práce.

---

## 4. DX a výstup CLI

### D1 — `mini status` neukazuje výsledek poslední auto session  · `M` · střední
- **Oblast:** DX
- **title:** `Rozšířit mini status o verdikt a body k ověření`
- **goal:** `mini status u aktuální fáze ukáže, jestli existuje run report, jeho verdikt a počet otevřených verify bodů, a vizuálně odliší osiřelou doing fázi bez otevřených kroků.`
- **Proč:** `status.ts` dnes ukazuje fáze, kroky, modely a hint, ale nic o tom,
  že proběhla auto session, jak dopadla, ani že nějaká fáze uvízla v `doing`
  (viz W1). Člověk po `mini auto` nevidí stav bez ručního čtení `.mini/run/`.

### D2 — Help text příkazu `auto` slibuje „bez promptu"  · `M` · malá
- **Oblast:** DX
- **title:** `Upřesnit popis příkazu auto ohledně verify`
- **goal:** `Popis mini auto v --help jasně říká, že u bodů k ručnímu ověření se zastaví a zeptá člověka — neslibuje plně bezobslužný běh.`
- **Proč:** `cli.ts:63` říká „Dokončí celou fázi bez promptu", ale `handleVerify`
  (`done.ts:431`) se u verify bodů ptá i v auto módu. Popis je zavádějící
  (souvisí s W3). Malá textová úprava, velký rozdíl v očekávání uživatele.

### D3 — `--max-turns` u `do` v helpu slibuje funkci, co nejede  · `M` · malá
- **Oblast:** DX
- **title:** `Sladit help mini do --max-turns se skutečným chováním`
- **goal:** `Nápověda mini do --max-turns odpovídá realitě — po opravě R1 funguje, takže stačí ověřit, že help i chování sedí (žádný mrtvý slib).`
- **Proč:** Přímo navázané na **R1** — dokud se `maxTurns` nepropojí, help
  popisuje neexistující chování. Po opravě R1 jen ověřit konzistenci.

### D4 — Čitelnost streamovaného výstupu  · `L` · malá
- **Oblast:** DX
- **title:** `Doladit čitelnost stream renderu mini do --stream`
- **goal:** `Streamovaný výstup (mini do --stream) je přehledný — akce, nástroje a závěrečné shrnutí ceny/tokenů jsou vizuálně oddělené a snadno čitelné.`
- **Proč:** Subjektivní DX věc nad `ui/streamRender.ts` + `ui/usage.ts`.
  Vyžaduje lidský pohled na reálný běh; sem patří jako nízká priorita.

---

## Hotovo

- **W1** — Osiřelá `doing` fáze po opravné podfázi (fáze 23): `closeOrphanedDoingParents` v `done.ts` dozavře rodiče, jakmile jsou všechny jeho podfáze uzavřené.
- **W2** — Desetinné ID po podfázi (fáze 23): `commitPhase` v `next.ts` používá `Math.floor(Math.max(...)) + 1`.
- **W3** — Verify v auto módu bez TTY (fáze 23): nový `ui/interactive.ts` + `handleVerify` bez TTY nezavře fázi (`verify-needs-human`), verify nikdy tiše neprojde jako pass.
- **W4** — Opakované přehrávání verify bodů (fáze 23): `Phase.resolvedVerify` drží už odbavené body, `handleVerify` je příště přeskočí.
- **C1** — „Mrtvý kód" z fáze 17 (fáze 24): `MEMORY_ALLOWED_TOOLS`/`MEMORY_TIMEOUT_MS` ve `writeMemory.ts` označeny komentářem jako živé (explicitní memory režim); žádné zavádějící TODO v kódu nebylo.
- **C2** — Migrace `state.model` → `models.default` (fáze 24): `migrate()` ve `store.load`/`loadPrev` přesune legacy pole; fallbacky zrušeny v `models.ts`, `status.ts`, `model.ts` i `import-gsd.ts`.
- **C3** — Zúžení `PermissionMode` (fáze 24): typ ve `work.ts` zúžen na reálně používanou hodnotu `'acceptEdits'`.
- **R1** — `mini do --max-turns` se ignoroval (fáze 25): `cli.ts` action předává `maxTurns` do `doPhase`; `do.test.ts` ověří propagaci do `workWithClaude` i `streamWithClaude`. Tím je vyřešený i premisa **D3** (help u `do --max-turns` teď odpovídá realitě).
- **R2** — Chybějící e2e test auto smyčky (fáze 25): `commands/auto.e2e.test.ts` projede `next → plan → do → done` proti fake `claude` binárce v PATH (reálný spawn, zápis i parse reportu) bez mockování Claude modulů.
- **R3** — Hláška při chybějícím `claude` (fáze 25): nový `claude/spawnError.ts` (`describeSpawnError`) sjednocuje ENOENT na návod na instalaci; volá ho `work.ts`, `stream.ts` i `ask.ts`.
- **R4** — Retry `mini next` při neparsovatelné odpovědi (fáze 25): `parseSuggestion` je tolerantní k markdown dekoraci / velikosti písmen, navíc `next()` dá při neúspěchu jeden retry s upřesněním formátu, než vrátí `parse-failed`.
