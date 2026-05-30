# Fáze 26 — Bod 4. z .mini/improvements.md

**Cíl:** Fáze D1 - D4 budou vyřízené

## Kroky
- [hotovo] mini status zobrazí verdikt run reportu
- [hotovo] mini status ukáže počet otevřených verify bodů
- [hotovo] mini status vizuálně odliší osiřelou doing fázi
- [hotovo] Upravit help příkazu auto ohledně verify
- [hotovo] Ověřit konzistenci helpu do --max-turns
- [hotovo] Zpřehlednit stream render akcí a shrnutí

## Auto-commit
- Fáze 26: Bod 4. z .mini/improvements.md (`da6f24826c348193905b04f0f4f67ee4f1fc8d24`)

## Run report
---
phase: 26
verdict: done
steps:
  - title: "mini status zobrazí verdikt run reportu"
    status: done
  - title: "mini status ukáže počet otevřených verify bodů"
    status: done
  - title: "mini status vizuálně odliší osiřelou doing fázi"
    status: done
  - title: "Upravit help příkazu auto ohledně verify"
    status: done
  - title: "Ověřit konzistenci helpu do --max-turns"
    status: done
  - title: "Zpřehlednit stream render akcí a shrnutí"
    status: done
verify:
  - title: "Vizuální čitelnost streamovaného výstupu mini do --stream"
    detail: "D4 je subjektivní DX věc. Strojově jsem ověřil chování rendereru i souhrnu (nové testy v src/ui/streamRender.test.ts a src/ui/usage.test.ts) a změny: hlavička session je oddělená prázdným řádkem od proudu akcí a závěrečný „Souhrn streamu\" má teď bold label, aby vystoupil z tlumených akcí. Reálný barevný dojem na živém běhu jsem ale neviděl — mrkni na skutečný `mini do --stream`, jestli je výstup přehledný."
  - title: "Vizuální vykreslení markeru osiřelé doing fáze v mini status"
    detail: "Logiku isOrphanedDoing pokrývají unit testy (kroky/podfáze uzavřené → osiřelá). Marker „⚠ uvázlo: …\" jsem ale nešel vykreslit na reálném stavu, protože jsem podle zadání neměl sahat do .mini/state.json (aktuální fáze 26 má všechny kroky todo, takže se marker korektně nezobrazuje). Až nějaká fáze reálně uvázne v doing bez otevřené práce, zkontroluj prosím vzhled žlutého řádku."
---

# Fáze 26 — report z auto session

Vyřízeny body **D1–D4** z `.mini/improvements.md`.

## Co se udělalo

**D1 — `mini status` o výsledku auto session**
- Nová tolerantní čtečka run reportu v `state/runReport.ts`: `summarizeRunReportText` + `readRunReportSummary` (+ typ `RunReportSummary`). Na rozdíl od `parseRunReport` nevaliduje kroky a nikdy nehází — status nesmí spadnout kvůli zastaralému/poškozenému reportu.
- `commands/status.ts` u aktuální fáze načte report a vypíše řádek `run report: verdikt … · N bodů k ověření čeká` (verdikt barevně: hotovo zeleně, částečně žlutě, zablokováno červeně). Otevřené verify body se počítají proti `phase.resolvedVerify` (helper `openVerifyCount`).
- Osiřelá `doing` fáze (uvázlá ve stavu „dělá se" bez otevřené práce — buď všechny kroky, nebo všechny podfáze uzavřené) se odliší žlutým řádkem `⚠ uvázlo: …` s návodem zavřít ji přes `mini done`. Logika v pure helperu `isOrphanedDoing`.

**D2 — help příkazu `auto`**
- Popis už neslibuje „bez promptu" — jasně říká, že u bodů k ručnímu ověření se zastaví a zeptá člověka (`cli.ts`).

**D3 — konzistence helpu `do --max-turns`**
- Po R1 (fáze 25) je `--max-turns` reálně propojené (`cli.ts` → `doPhase` → stream i work cesta v `do.ts:147/161`). Help text odpovídá realitě a je konzistentní s `auto`. Ověřeno přes `mini do --help` / `mini auto --help` — žádná změna kódu nebyla potřeba.

**D4 — čitelnost streamu**
- `ui/streamRender.ts`: hlavička session se odděluje prázdným řádkem od proudu akcí.
- `ui/usage.ts`: závěrečný „Souhrn streamu" má teď bold label oddělený od (tlumených) metrik, aby blok vizuálně vystoupil.

## Ověření
- `tsc --noEmit` čistý.
- `vitest run`: **334 testů zelených** (baseline backlogu byl 286). Přidány testy: `summarizeRunReportText`/`readRunReportSummary` (runReport.test.ts), `openVerifyCount`/`runReportSummaryLines`/`isOrphanedDoing` (status.test.ts), nové `ui/usage.test.ts` a `ui/streamRender.test.ts`.
- Ruční smoke test: `mini status` vypsal run report řádek z dočasného fixture (`verdikt částečně · 2 body k ověření čeká`), fixture jsem pak smazal.

## Poznámky
- Dvě věci nechávám na lidský pohled (viz `verify` výše): subjektivní vizuální dojem ze streamu (D4) a vykreslení markeru osiřelé doing fáze — to jsem nešel spustit na reálném stavu, abych nesahal do `state.json`.
