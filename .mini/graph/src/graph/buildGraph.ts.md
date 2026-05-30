## src/graph/buildGraph.ts

Imports:
- { access, mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises"
- { dirname, join, posix, relative, sep } from "node:path"
- { isGitRepo, runGit } from "../git.js"
- { mapFile } from "./mapper.js"
- { mapPhpFile } from "./phpMapper.js"
- { mapRustFile } from "./rustMapper.js"
- type { ExportInfo, FileGraph, ImportInfo } from "./types.js"

Exports:
- const GRAPH_DIR @L10
- const GRAPH_INDEX @L12
- const LEGACY_GRAPH_FILE @L14
- const GRAPH_INDEX_VERSION @L17
- interface GraphIndexEntry @L53-60
- interface GraphIndex @L63-67
- interface BuildGraphResult @L69-78
- interface BuildGraphOptions @L80-83
- function buildGraph(cwd: string, options: BuildGraphOptions): Promise<BuildGraphResult> @L95-117
- function hasMappableProject(cwd: string): Promise<boolean> @L182-188
- function renderFileGraph(file: FileGraph): string @L326-351
