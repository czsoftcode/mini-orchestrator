/**
 * Je aktuální proces napojený na interaktivní terminál (TTY)?
 *
 * Auto mód se u bodů k ručnímu ověření ptá člověka i bez `--auto` promptu
 * (verify se záměrně neobchází). Jenže bez TTY (CI, pipe, chybějící terminál)
 * `prompts` vrátí `undefined` a odpověď se vyhodnotí jako `pass` — fáze by se
 * tiše zavřela bez skutečného ověření. Proto interaktivitu nejdřív zkontrolujeme
 * a v neinteraktivním prostředí se zachováme bezpečně (fázi nezavřeme).
 *
 * Vyčleněno do vlastního modulu, aby šlo chování v testech mockovat.
 */
export function isInteractive() {
    return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}
