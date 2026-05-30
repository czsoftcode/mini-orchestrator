## src/graph/buildGraph.test.ts

Imports:
- { mkdir, mkdtemp, readFile, readdir, writeFile } from "node:fs/promises"
- { tmpdir } from "node:os"
- { join } from "node:path"
- { afterEach, beforeEach, describe, expect, it } from "vitest"
- { buildGraph, GRAPH_DIR, GRAPH_INDEX, GRAPH_INDEX_VERSION, hasMappableProject, LEGACY_GRAPH_FILE, renderFileGraph } from "./buildGraph.js"
- type { GraphIndex } from "./buildGraph.js"
- { runGit } from "../git.js"
