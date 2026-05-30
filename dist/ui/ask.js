import basePrompts from 'prompts';
import { log } from './log.js';
export async function ask(questions) {
    return basePrompts(questions, {
        onCancel: () => {
            log.dim('Zrušeno.');
            process.exit(130);
        },
    });
}
export function nonEmpty(label = 'Pole nesmí být prázdné.') {
    return (value) => {
        return value.trim().length > 0 ? true : label;
    };
}
export function trim(value) {
    return value.trim();
}
