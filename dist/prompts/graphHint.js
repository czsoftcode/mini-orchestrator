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
export const GRAPH_USAGE_HINT = 'Pokud potřebuješ pochopit stav kódu, postupuj přes strojovou mapu: ' +
    '(1) jednou si načti index `.mini/graph.json` (pokud existuje) — pro každý zdroják cestu, ' +
    'jeho mapu v `.mini/graph/` a názvy exportů; index si drž v paměti a sdílej ho napříč kroky, ' +
    'nenačítej ho opakovaně; ' +
    '(2) podle exportů cíleně otevři jen relevantní mapy `.mini/graph/<cesta>.md` ' +
    '(importy, exporty, signatury; u exportů je kotva `@L<start>-<end>` = řádky deklarace); ' +
    '(3) když potřebuješ samotný kód, čti ho cíleně přes `Read` rovnou od kotvy ' +
    '(`offset` = start, `limit` = end − start + 1), ne celý soubor; ' +
    'když mapa kotvu nemá, dohledej symbol přes Grep tool (ripgrep). Malé soubory klidně celé.';
