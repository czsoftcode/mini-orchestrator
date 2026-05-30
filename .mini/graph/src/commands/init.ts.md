## src/commands/init.ts

Imports:
- { basename } from "node:path"
- { isBrownfield } from "../state/brownfield.js"
- { exists, newState, save, writeProject } from "../state/store.js"
- { ask, nonEmpty, trim } from "../ui/ask.js"
- { log } from "../ui/log.js"

Exports:
- function init(): Promise<void>
