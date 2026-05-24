#!/usr/bin/env node
import { Command, InvalidArgumentError } from 'commander';

const program = new Command();

function parseMaxTurns(value: string): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) {
    throw new InvalidArgumentError('Musí to být celé kladné číslo (např. 5).');
  }
  return n;
}

program
  .name('mini')
  .description('Mini orchestrátor nad Claude Code — drží stav projektu a posílá Claudovi jen to nejnutnější.')
  .version('0.1.0');

program
  .command('init')
  .description('Založí nový projekt v aktuálním adresáři.')
  .action(async () => {
    const { init } = await import('./commands/init.js');
    await init();
  });

program
  .command('next')
  .description('Navrhne, co by mělo přijít jako další fáze.')
  .action(async () => {
    const { next } = await import('./commands/next.js');
    await next();
  });

program
  .command('plan')
  .description('Rozmění aktuální fázi na konkrétní kroky.')
  .action(async () => {
    const { plan } = await import('./commands/plan.js');
    await plan();
  });

program
  .command('do')
  .description('Spustí Claude Code na aktuální fázi nebo kroku.')
  .option('--stream', 'Spustit Claude v neinteraktivním print-módu se streamovaným JSON výstupem (průběžně zobrazí aktuální akci, na konci shrne cenu a tokeny).')
  .option('--max-turns <n>', 'Maximální počet odpovědí Claude Code v session — po N odpovědích se session automaticky zastaví (šetří tokeny).', parseMaxTurns)
  .action(async (opts: { stream?: boolean; maxTurns?: number }) => {
    const { doPhase } = await import('./commands/do.js');
    await doPhase({ stream: opts.stream });
  });

program
  .command('done')
  .description('Lidská verifikace — zeptá se, jestli to funguje, a posune stav.')
  .action(async () => {
    const { done } = await import('./commands/done.js');
    await done();
  });

program
  .command('auto')
  .description('Auto chain: next → plan → (do → done){pro každý krok}. Dokončí celou fázi bez promptu.')
  .option('--max-turns <n>', 'Maximální počet odpovědí Claude Code v každé session — po N odpovědích se session automaticky zastaví (šetří tokeny).', parseMaxTurns)
  .action(async (opts: { maxTurns?: number }) => {
    const { auto } = await import('./commands/auto.js');
    await auto({ maxTurns: opts.maxTurns });
  });

program
  .command('discuss')
  .description('Otevře interaktivní session Claude Code zaměřenou na aktuální fázi — lze prodiskutovat záměr před plánováním.')
  .action(async () => {
    const { discuss } = await import('./commands/discuss.js');
    await discuss();
  });

program
  .command('undo')
  .description('Vrátí poslední změnu stavu o krok zpět.')
  .action(async () => {
    const { undo } = await import('./commands/undo.js');
    await undo();
  });

program
  .command('status')
  .description('Ukáže, kde se v projektu právě nacházíme.')
  .action(async () => {
    const { status } = await import('./commands/status.js');
    await status();
  });

program
  .command('import-gsd')
  .description('Jednorázový import rozdělaného GSD projektu z .planning/.')
  .action(async () => {
    const { importGsd } = await import('./commands/import-gsd.js');
    await importGsd();
  });

program
  .command('audit')
  .description('Projde existující kód a vytvoří/aktualizuje .mini/codebase.md (přehled pro pozdější Claude session).')
  .action(async () => {
    const { audit } = await import('./commands/audit.js');
    await audit();
  });

program
  .command('map')
  .description('Přegeneruje strojovou mapu projektu (.mini/graph.md) — exporty, importy a signatury TS/PHP/Rust souborů.')
  .action(async () => {
    const { map } = await import('./commands/map.js');
    await map();
  });

program
  .command('model [scope] [name]')
  .description('Model pro projekt. Příklady: "mini model" (interaktivně), "mini model show", "mini model sonnet" (default), "mini model do opus", "mini model do default" (zruší override), "mini model reset".')
  .action(async (scope?: string, name?: string) => {
    const { model } = await import('./commands/model.js');
    await model(scope, name);
  });

program.parseAsync().catch((err) => {
  console.error(err);
  process.exit(1);
});
