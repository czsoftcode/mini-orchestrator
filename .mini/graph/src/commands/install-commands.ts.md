## src/commands/install-commands.ts

Imports:
- { mkdir, readFile, rename, writeFile } from "node:fs/promises"
- { join } from "node:path"
- { log } from "../ui/log.js"

Exports:
- const COMMANDS_DIR
- function renderCommandMd(def: CommandDef): string
- function installCommands(cwd: string): Promise<void>
