# Úkol: přidat do mini krok `adversarial` — nezávislý red-team review fáze

> Zadání pro AI agenta. Je psané jako spec, ne jako hotový kód — naváž na existující
> konvence mini (názvy, sestavování promptů přes `mini context`, reporty jako YAML
> front matter + volný text, stav v TS přes `--apply`). Než začneš, přečti si, jak
> jsou udělané příručky `discuss` a `verify`, a drž se jejich vzoru.

---

## Cíl a filozofie

Mini má dnes `verify` (lidské UI/UX review) a `done` ("does it work?" — lidský
checkpoint). Chybí krok, kde **model** kriticky prověří kód, který právě vznikl —
ne aby potvrdil, že funguje, ale aby našel, čím se rozbije.

Klíčový princip: **recenzent nesmí být ve stejné roli jako autor.** Agent, který
kód napsal, sdílí svoje vlastní slepé skvrny — testuje to, co předpokládal.
Adversarial krok ho má postavit do role někoho, kdo ten kód *nepsal* a má ho prolomit.

---

## Zařazení do cyklu

Symetricky k `discuss` a `verify`: volitelný krok mezi `do` a `done`.

- **Nehýbe stavem fáze** (stejně jako `verify`).
- Cílí na aktuální fázi, jinak na poslední uzavřenou.
- V `auto` se spouští buď s explicitním `--adversarial`, nebo automaticky u fází,
  které sahají na rizikové oblasti (viz heuristika níže) — analogicky k tomu, jak
  `verify` běží u UI/UX fází a `discuss` u těžkých fází.

---

## Co má příkaz dělat

1. Nový CLI příkaz `mini adversarial` (+ neinteraktivní `--apply`) a slash command
   `/mini:adversarial`, generovaný přes `install-commands`; tělo volá
   `mini context adversarial`.
2. `mini context adversarial` sestaví prompt z:
   - `project.md` (1 strana),
   - aktuální fáze + její kroky,
   - reportu fáze z `run/` nebo `phases/`,
   - a pokud existuje, `graph.json` / `graph/` pro dotčené soubory.

   **Žádná historie starých fází.** Drž to v duchu mini: posílej jen to podstatné.
3. Agent dostane explicitní instrukci přepnout do role nezávislého recenzenta
   (viz prompt níže).
4. Výstup se zapíše do reportu fáze jako vlastní sekce (YAML front matter se statusem
   nálezů + volný text), aby to `done` a memory mohly přečíst. Navrhovaný status:
   `adversarial: pass | findings | blocked`.

---

## Prompt pro agenta (jádro kroku) — návrh textu

```
Přepni se do role nezávislého recenzenta, který tento kód NEPSAL. Tvým úkolem
není potvrdit, že to funguje — tvým úkolem je najít, čím to rozbiju.

Předpokládej, že tam chyba je. Projdi:

1. UNHAPPY PATH — co se stane při prázdném, poškozeném, neočekávaném vstupu,
   null/undefined, timeoutu, souběhu? Ukaž konkrétní vstup, který to položí.
2. TICHÉ PŘEDPOKLADY — kde kód předpokládá typ, tvar dat nebo stav, aniž by to
   ověřil? Kde můžou chyby kaskádovat potichu místo aby selhaly nahlas?
3. PŘEDČASNÁ SLOŽITOST — je tu vrstva/abstrakce, která řeší problém, co zatím
   neexistuje? Co by šlo zjednodušit bez ztráty funkce?
4. TESTY — pokud existují, testují i selhání, nebo jen happy path? Co NENÍ pokryté?

Pro každý nález uveď: kde (soubor:řádek), čím se projeví, jak vážné to je
(blocker / měl bys vědět / drobnost). Nepiš obecné "vypadá to dobře" — pokud
opravdu nic nenajdeš, vyjmenuj KONKRÉTNĚ, co jsi prověřil a jak.

Na závěr vyplň YAML hlavičku reportu: adversarial: pass|findings|blocked.
```

---

## Heuristika pro auto (kdy spustit bez `--adversarial`)

Spusť automaticky, když fáze sahá na: zpracování externího/uživatelského vstupu,
parsing, síť, autentizaci, práci se soubory, datové transformace — tedy přesně tam,
kde edge cases bolí. Heuristiku odvoď z goal/steps/reportu fáze, stejně jako se dnes
odvozuje "UI/UX fáze" pro `verify`. U čistě interních refaktorů nebo dokumentace ať
se nespouští.

---

## Co řešit při návrhu (rozhodni a zdůvodni v PR)

- **Token cost.** Tohle zvýší objem výstupu — proto je to opt-in krok, ne globální
  pravidlo. Zvaž, jestli pro `adversarial` nedávat jiný model než `do` (přes
  `mini model adversarial <model>`). Argument pro silnější model: red-team chce
  schopnost, ne úsporu. Rozhodni a zdůvodni.
- **Stejný vs. čerstvý model.** Ideál je, aby recenzent nebyl tentýž běh co autor.
  Minimum je nová session (čistý kontext). Lepší je umožnit `mini model adversarial`
  jiný model než `do`, aby nesdílel autorovy sklony. Naviguj k tomu druhému, ale
  neprosazuj nic, co mini architektura neunese.
- **Kam s nálezy.** Zapisovat do existujícího reportu fáze (sekce navíc), ne vedle —
  ať to `done` / memory čtou bez nové cesty.
- **Nehýbat stavem.** `adversarial` jen píše nálezy, fázi neuzavírá. Uzavření zůstává
  lidským rozhodnutím v `done` (případně informovaným tím, co adversarial našel).

---

## Hotovo, když

- `mini adversarial` i `/mini:adversarial` běží, cílí na správnou fázi, zapisují
  nálezy do reportu se statusem.
- `mini auto --adversarial` vynutí krok v každé fázi; bez flagu se spustí u rizikových
  fází dle heuristiky.
- `install-commands` generuje nový slash command idempotentně.
- README + `mini --help` doplněné; `mini doctor` případně počítá nový command.
- Pár testů v duchu zbytku mini (status v reportu, heuristika rizikové fáze).

---

## Poznámky k záměru (kontext, ne příkazy)

- Spec záměrně nedává hotový TypeScript — mini má vlastní zaběhané konvence, do
  kterých se má krok napasovat, ne vyrůst vedle nich.
- Konflikt verifikace × token cost není zameten, je to vědomé rozhodnutí k učinění:
  verifikace stojí kontext, proto je krok vypínatelný.
- Heuristika "kdy spustit" (vstup/parsing/síť/auth/soubory/transformace) je seznam
  míst, kde edge cases reálně bolí — drž se ho, ne obecného "rizikové".
