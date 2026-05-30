## src/graph/buildGraph.ts

Imports:
- { access, mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises"
- { dirname, join, posix, relative, sep } from "node:path"
- { isGitRepo, runGit } from "../git.js"
- { mapFile } from "./mapper.js"
- { mapGoFile } from "./goMapper.js"
- { mapPhpFile } from "./phpMapper.js"
- { mapPythonFile } from "./pythonMapper.js"
- { mapRustFile } from "./rustMapper.js"
- type { ExportInfo, FileGraph, ImportInfo } from "./types.js"

Exports:
- const GRAPH_DIR @L12
- const GRAPH_INDEX @L14
- const LEGACY_GRAPH_FILE @L16
- const GRAPH_INDEX_VERSION @L19
- interface GraphIndexEntry @L58-65
- interface GraphIndex @L68-72
- interface BuildGraphResult @L74-83
- interface BuildGraphOptions @L85-88
- function buildGraph(cwd: string, options: BuildGraphOptions): Promise<BuildGraphResult> @L100-122
- function hasMappableProject(cwd: string): Promise<boolean> @L191-200
- function renderFileGraph(file: FileGraph): string @L340-365
