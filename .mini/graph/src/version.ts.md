## src/version.ts

Imports:
- { readFile, writeFile } from "node:fs/promises"
- { join } from "node:path"

Exports:
- type BumpLevel
- const BUMP_LEVELS
- function isBumpLevel(value: string): value is BumpLevel
- interface BumpResult
- function bumpSemver(version: string, level: BumpLevel): string | null
- function bumpPackageVersion(cwd: string, level: BumpLevel): Promise<BumpResult | null>
