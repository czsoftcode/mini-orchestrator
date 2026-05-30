# Fáze 40 — Diskuzní poznámky načítat jednou

**Cíl:** do session prompt (buildAutoPhasePrompt v cestě 'do') přestane inlinovat celé diskuzní poznámky — místo toho odkáže na soubor .mini/discuss/phase-N.md s instrukcí 'přečti přes Read tool, jen pokud jsi je v této session ještě nečetl (typicky už je máš z plan/auto)'. plan i auto poznámky inlinují dál jako vstupní bod cyklu. Cílem je nenačítat poznámky v jedné Claude session podruhé; ověřitelné aktualizovanými snapshot/unit testy (do prompt obsahuje odkaz + read-once podmínku místo inline textu).

## Kroky
- [hotovo] Builder buildAutoPhasePrompt: přidat opt-in příznak useDiscussNotesRef?: boolean (default vypnuto) do AutoPhaseContext; když true, místo inline textu vykreslit pod nadpisem '# Poznámky k fázi (z diskuse)' odkaz na relativní .mini/discuss/phase-${phase.id}.md + read-once instrukci; když false/neuvedeno → dnešní inline větev beze změny. Ověřitelné: npm run typecheck zelený, funkce přijímá nový příznak.
- [hotovo] Unit testy builderu v autoPhase.test.ts: nové testy pro useDiscussNotesRef: true (výstup obsahuje .mini/discuss/phase-{id}.md + read-once formulaci a NEobsahuje inline text poznámek); při vypnutém příznaku se výstup nemění. Ověřitelné: npm test zelené, existující snapshoty autoPhase.test.ts.snap beze změny.
- [hotovo] context.ts (větev do) přepnout na reference + test v context.test.ts: do větev nastaví useDiscussNotesRef podle existence poznámek (non-null & non-blank) a inline text builderu nepředá; když poznámky chybí, blok se vynechá. Nový test: /mini:do s existujícím .mini/discuss/phase-1.md → odkaz + read-once, ne inline; bez souboru blok chybí. Ověřitelné: npm test zelené, nový context test.
- [hotovo] measure.ts řádek do → reference mód (useDiscussNotesRef: true) + poznámka v reportu, že Read call za běhu se nepočítá (auto zůstává inline); brána a přegenerování reportu: npm run typecheck, npm run build, npm test zelené a npm run measure-tokens přegeneruje .mini/token-report.md (bez tvrdé prahové hodnoty). Ověřitelné: brána zelená, report přegenerován.

## Auto-commit
- Fáze 40: Diskuzní poznámky načítat jednou (`bdcb8c92584f8bd98f11b5352f5a79c1c0c420f2`)

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
