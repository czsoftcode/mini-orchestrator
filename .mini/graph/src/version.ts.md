## src/version.ts

Imports:
- { readFileSync } from "node:fs"
- { readFile, writeFile } from "node:fs/promises"
- { join } from "node:path"

Exports:
- function readPackageVersion(): string @L14-22
- type BumpLevel @L25
- const BUMP_LEVELS @L27
- function isBumpLevel(value: string): value is BumpLevel @L29-31
- interface BumpResult @L33-36
- function bumpSemver(version: string, level: BumpLevel): string | null @L42-57
- function bumpPackageVersion(cwd: string, level: BumpLevel): Promise<BumpResult | null> @L73-96
