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
- const GRAPH_DIR
- const GRAPH_INDEX
- const LEGACY_GRAPH_FILE
- const GRAPH_INDEX_VERSION
- interface GraphIndexEntry
- interface GraphIndex
- interface BuildGraphResult
- interface BuildGraphOptions
- function buildGraph(cwd: string, options: BuildGraphOptions): Promise<BuildGraphResult>
- function hasMappableProject(cwd: string): Promise<boolean>
- function renderFileGraph(file: FileGraph): string
