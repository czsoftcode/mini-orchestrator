## src/ui/ask.ts

Imports:
- { default, Answers, PromptObject } from "prompts"
- { log } from "./log.js"

Exports:
- function ask(questions: PromptObject<T> | Array<PromptObject<T>>): Promise<Answers<T>> @L4-13
- function nonEmpty(label) @L15-19
- function trim(value: string): string @L21-23
