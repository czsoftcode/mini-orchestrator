import basePrompts, { type Answers, type PromptObject } from 'prompts';
import { log } from './log.js';

export async function ask<T extends string = string>(
  questions: PromptObject<T> | Array<PromptObject<T>>,
): Promise<Answers<T>> {
  return basePrompts(questions, {
    onCancel: () => {
      log.dim('Cancelled.');
      process.exit(130);
    },
  });
}

export function nonEmpty(label = 'Field must not be empty.') {
  return (value: string): true | string => {
    return value.trim().length > 0 ? true : label;
  };
}

export function trim(value: string): string {
  return value.trim();
}
