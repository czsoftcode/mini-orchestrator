/**
 * Kanonická instrukce „jak číst kód projektu přes strojovou mapu". Sdílí ji
 * `next`, `discuss` a `plan` prompty (obě rodiny — interaktivní i headless), ať
 * agent navádí čtení přes graf místo slepého Read/Grep. Záměrně NE v do/auto:
 * tam agent kód sám mění, takže graf je zastaralý a opakovaný náklad indexu je
 * spíš režie.
 *
 * Drž znění těsné (token rozpočet) a neutrální — vkládá se doprostřed různých
 * promptů, takže žádné prompt-specifické věty (typu „nezapisuj nic").
 */
export const GRAPH_USAGE_HINT =
  'If you need to understand the state of the code, go through the machine-generated map: ' +
  '(1) read the index `.mini/graph.json` once (if it exists) — for each source file its path, ' +
  'its map in `.mini/graph/`, and the export names; keep the index in memory and share it across steps, ' +
  'do not read it repeatedly; ' +
  '(2) based on the exports, open only the relevant maps `.mini/graph/<path>.md` ' +
  '(imports, exports, signatures; for exports there is an anchor `@L<start>-<end>` = the declaration lines); ' +
  '(3) when you need the actual code, read it targeted via `Read` straight from the anchor ' +
  '(`offset` = start, `limit` = end − start + 1), not the whole file; ' +
  'when a map has no anchor, look up the symbol via the Grep tool (ripgrep). Small files can be read whole.';
