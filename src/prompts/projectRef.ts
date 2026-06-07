/**
 * Kanonický „reference mód" bloku projektu. Místo inlinování celého
 * `.mini/project.md` do promptu vykreslí jen pokyn: „přečti soubor, jen když ho
 * ještě nemáš v kontextu". Šetří opakované vložení projektu ve warm session
 * (slash `do`/`plan`/`discuss` běží mid-session, kde projekt typicky načetl už
 * dřívější krok). Cold cesty (`next`, terminálové `mini plan`/`mini discuss`)
 * zůstávají na inline a tenhle helper nevolají.
 *
 * Vrací jen **tělo** — nadpis `# Project` si vykresluje volající, ať to sedí do
 * struktury jeho promptu. Znění sází na „když nevíš, přečti", takže nejhorší
 * případ je jedno přečtení navíc (stejný náklad jako dnešní inline).
 */
export function projectRefBlock(): string {
  return (
    'The project is described in `.mini/project.md`. If you already **have it in ' +
    'context** from earlier in this session, **do not read it again**. If you are ' +
    'unsure — a long session where it may have scrolled out of context ' +
    '(compaction), or a new session after a crash — read `.mini/project.md` ' +
    '(whole, once) via the Read tool. **Read it only when you don\'t have it.**'
  );
}
