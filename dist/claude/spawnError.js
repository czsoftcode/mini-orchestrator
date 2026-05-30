/**
 * Sjednocená chybová hláška, když selže spuštění `claude`.
 *
 * Všechna tři místa, kde mini spouští Claude binárku (`work.ts` neinteraktivně,
 * `stream.ts` streamovaně, `ask.ts` v print-módu), volala dřív vlastní variantu
 * „Nepodařilo se spustit claude: spawn claude ENOENT". To je pro uživatele
 * bez kontextu nesrozumitelné. Tahle funkce ENOENT (binárka chybí / není
 * v PATH) přeloží na srozumitelný návod na instalaci a ostatní chyby zabalí
 * jednotně, ať je UX při chybějícím `claude` všude stejné.
 */
export const CLAUDE_NOT_FOUND_MESSAGE = 'Příkaz „claude" nenalezen — vypadá to, že Claude Code není nainstalovaný nebo není v PATH.\n' +
    'Nainstaluj ho a přihlas se podle https://claude.com/claude-code, pak to zkus znovu.';
/**
 * Přeloží chybu ze `spawn('claude', …)` na výjimku se srozumitelnou hláškou.
 * ENOENT → návod na instalaci; cokoli jiného → jednotný obal.
 */
export function describeSpawnError(err) {
    if (err.code === 'ENOENT') {
        return new Error(CLAUDE_NOT_FOUND_MESSAGE);
    }
    return new Error(`Nepodařilo se spustit claude: ${err.message}`);
}
