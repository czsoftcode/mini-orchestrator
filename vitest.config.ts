import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Testuj jen zdrojové soubory. `dist/` je build výstup (tsc) se starými
    // kopiemi testů a snapshotů — kdyby se spouštěl, vitest 4 ho už defaultně
    // nevylučuje a stálé snapshoty by haprovaly proti aktuálnímu kódu.
    include: ['src/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
  },
});
