# Fáze 45 — Sdílená instrukce o grafu

**Cíl:** Vytáhnout návod 'jak využít .mini/graph.json + graph/ při čtení kódu' do jednoho sdíleného bloku a konzistentně ho vložit do promptů, které dnes graf zmiňují nejednotně nebo vůbec (next, discuss, plan; rozsah do/auto doladit v diskusi), aby agent navigoval kód přes graf místo slepého Read/Grep; ověřitelné aktualizovanými snapshoty promptů + zelená brána.

## Kroky
- [hotovo] Modul graphHint.ts s konstantou
- [hotovo] Vložit hint do next builderů
- [hotovo] Vložit hint do plan + discuss builderů
- [hotovo] Snapshoty + zelená brána

## Auto-commit
- Fáze 45: Sdílená instrukce o grafu (`74f66d7a916fee05a566c81a173d928930611393`)

## Pozor na
- **Nahrazovat, ne přidávat**: u next (`sessionContext`) a discuss už věta o grafu
  je — vyměnit za sdílený blok, ať nevznikne duplicita.
- **Prompt-specifické věty nechat zvlášť**: discuss má navíc „kromě poznámek nic
  nezapisuj"; plan má „Nezapisuj nic". To do sdíleného bloku NEPATŘÍ.
- **Blok musí znít neutrálně**, ať sedí do next/plan/discuss (ne do/auto).
- **Snapshoty se pohnou**: `nextPhase`, `planPhase`, `discussPhase` + interaktivní
  `sessionContext` (next, plan). `autoPhase` se hnout NESMÍ (mimo rozsah) — pokud
  se hne, něco je špatně. Projít `npm test` a aktualizovat jen očekávané.
- **`.mini/token-report.md`** lze po fázi přegenerovat (`npm run measure-tokens`,
  `measure.ts` čerpá ze `sessionContext`) — volitelné.
- Brána zelená: `npm run typecheck`, `npm test`, `npm run build`.
