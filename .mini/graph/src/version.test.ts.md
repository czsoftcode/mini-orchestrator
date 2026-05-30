## src/version.test.ts

Imports:
- { afterEach, beforeEach, describe, expect, it } from "vitest"
- { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
- { tmpdir } from "node:os"
- { join } from "node:path"
- { fileURLToPath } from "node:url"
- { bumpPackageVersion, bumpSemver, isBumpLevel, readPackageVersion } from "./version.js"
