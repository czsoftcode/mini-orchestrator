## src/commands/install-commands.ts

Imports:
- { mkdir, readFile, rename, writeFile } from "node:fs/promises"
- { join } from "node:path"
- { log } from "../ui/log.js"

Exports:
- const COMMANDS_DIR @L6
- function renderCommandMd(def: CommandDef): string @L94-115
- function installCommands(cwd: string): Promise<void> @L122-168
