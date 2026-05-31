#!/usr/bin/env node
// Guarded launcher for the npm `postinstall` hook. Pure Node (needs no build), so
// it works even in a fresh dev clone where dist/ doesn't exist yet — there it
// simply does nothing. In an installed/published package dist/ is present and we
// hand off to the compiled postinstall, which decides whether to install the
// slash commands (TTY) or just print a hint (no TTY). It never fails the install.
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const built = join(here, '..', 'dist', 'install', 'postinstall.js');

if (existsSync(built)) {
  try {
    const mod = await import(pathToFileURL(built).href);
    await mod.runPostinstall();
  } catch (err) {
    // Last-resort guard — never propagate a non-zero exit to npm.
    console.warn(`postinstall skipped: ${err?.message ?? err}`);
  }
}
