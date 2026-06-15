import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Testuj jen zdrojové soubory. `dist/` je build výstup (tsc) se starými
    // kopiemi testů a snapshotů — kdyby se spouštěl, vitest 4 ho už defaultně
    // nevylučuje a stálé snapshoty by haprovaly proti aktuálnímu kódu.
    include: ['src/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
    // Force colors off so test output is deterministic regardless of the
    // ambient environment. GitHub Actions sets CI=true, which picocolors treats
    // as "color supported" and turns ANSI escapes ON even without a TTY; that
    // splits literal substrings (e.g. pc.bold inserts codes inside "2. Title"),
    // breaking status assertions that pass locally where CI is unset.
    env: { NO_COLOR: '1' },
  },
});
