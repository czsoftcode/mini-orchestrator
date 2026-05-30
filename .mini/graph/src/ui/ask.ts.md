## src/ui/ask.ts

Imports:
- { default, Answers, PromptObject } from "prompts"
- { log } from "./log.js"

Exports:
- function ask(questions: PromptObject<T> | Array<PromptObject<T>>): Promise<Answers<T>>
- function nonEmpty(label)
- function trim(value: string): string
