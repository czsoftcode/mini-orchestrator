import basePrompts, { type Answers, type PromptObject } from 'prompts';
import { log } from './log.js';

export async function ask<T extends string = string>(
  questions: PromptObject<T> | Array<PromptObject<T>>,
): Promise<Answers<T>> {
  return basePrompts(questions, {
    onCancel: () => {
      log.dim('Zrušeno.');
      process.exit(130);
    },
  });
}

export function nonEmpty(label = 'Pole nesmí být prázdné.') {
  return (value: string): true | string => {
    return value.trim().length > 0 ? true : label;
  };
}

export function trim(value: string): string {
  return value.trim();
}
