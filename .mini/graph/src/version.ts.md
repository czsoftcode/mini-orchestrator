## src/version.ts

Imports:
- { readFile, writeFile } from "node:fs/promises"
- { join } from "node:path"

Exports:
- type BumpLevel @L5
- const BUMP_LEVELS @L7
- function isBumpLevel(value: string): value is BumpLevel @L9-11
- interface BumpResult @L13-16
- function bumpSemver(version: string, level: BumpLevel): string | null @L22-37
- function bumpPackageVersion(cwd: string, level: BumpLevel): Promise<BumpResult | null> @L53-76
