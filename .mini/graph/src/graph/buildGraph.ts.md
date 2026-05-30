## src/graph/buildGraph.ts

Imports:
- { access, mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises"
- { dirname, join, posix, relative, sep } from "node:path"
- { isGitRepo, runGit } from "../git.js"
- { mapFile } from "./mapper.js"
- { mapPhpFile } from "./phpMapper.js"
- { mapPythonFile } from "./pythonMapper.js"
- { mapRustFile } from "./rustMapper.js"
- type { ExportInfo, FileGraph, ImportInfo } from "./types.js"

Exports:
- const GRAPH_DIR @L11
- const GRAPH_INDEX @L13
- const LEGACY_GRAPH_FILE @L15
- const GRAPH_INDEX_VERSION @L18
- interface GraphIndexEntry @L57-64
- interface GraphIndex @L67-71
- interface BuildGraphResult @L73-82
- interface BuildGraphOptions @L84-87
- function buildGraph(cwd: string, options: BuildGraphOptions): Promise<BuildGraphResult> @L99-121
- function hasMappableProject(cwd: string): Promise<boolean> @L188-196
- function renderFileGraph(file: FileGraph): string @L335-360
