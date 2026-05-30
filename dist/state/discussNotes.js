import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { phaseStem } from './store.js';
export const DISCUSS_DIR = join('.mini', 'discuss');
export function discussNotesPath(cwd, phaseId) {
    return join(cwd, DISCUSS_DIR, `${phaseStem(phaseId)}.md`);
}
export async function readDiscussNotes(cwd, phaseId) {
    try {
        return await readFile(discussNotesPath(cwd, phaseId), 'utf-8');
    }
    catch {
        return null;
    }
}
