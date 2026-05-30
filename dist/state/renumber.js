import { rename } from 'node:fs/promises';
import { join } from 'node:path';
import { phaseStem } from './store.js';
/**
 * Vytáhne id z názvu souboru fáze napříč schématy. Vrací `null`, když název není
 * soubor fáze (`phase-<num>[…].json|md`) — takový soubor migrace ignoruje.
 */
export function parsePhaseFile(filename) {
    const m = /^phase-(.+?)(\.json|\.md)$/.exec(filename);
    if (!m)
        return null;
    const ext = m[2] === '.json' ? 'json' : 'md';
    let core = m[1];
    let isPrev = false;
    if (core.endsWith('.prev')) {
        isPrev = true;
        core = core.slice(0, -'.prev'.length);
    }
    // Vedoucí číselný token (celé i desetinné), volitelně následovaný `-<rest>`
    // (memory timestamp nebo historický index `-2`).
    const idm = /^(\d+(?:\.\d+)?)(?:-(.*))?$/.exec(core);
    if (!idm)
        return null;
    const idStr = idm[1];
    return { id: Number.parseFloat(idStr), idStr, ext, isPrev, rest: idm[2] ?? null };
}
/**
 * Sestaví mapu staré id → nové id z pořadí fází. Nové id = pozice + 1 (souvislé
 * 1..N). Klíč i hodnota jsou čísla; stejné staré id se nesmí opakovat.
 */
export function buildRenumberMap(phases) {
    const map = new Map();
    phases.forEach((p, i) => map.set(p.id, i + 1));
    return map;
}
/** Kanonický cílový název pro `phases/` (.json) nebo `discuss/`/`run/` (.md). */
function simpleTarget(newId, p) {
    const suffix = p.isPrev ? '.prev' : '';
    return `${phaseStem(newId)}${suffix}.${p.ext}`;
}
/**
 * Naplánuje přejmenování pro adresář s 1:1 mapováním souboru na fázi
 * (`phases/`, `discuss/`, `run/`). Soubory, co nejsou fáze, ignoruje; fáze mimo
 * mapu zařadí mezi orphany.
 */
export function planSimpleDir(files, idMap) {
    const renames = [];
    const orphans = [];
    for (const f of files) {
        const p = parsePhaseFile(f);
        if (!p)
            continue;
        const newId = idMap.get(p.id);
        if (newId == null) {
            orphans.push(f);
            continue;
        }
        const to = simpleTarget(newId, p);
        if (to !== f)
            renames.push({ from: f, to });
    }
    return { renames, orphans };
}
/**
 * Naplánuje přejmenování `memory/`. Memory může mít víc souborů na jednu fázi
 * (historie). Soubory jedné nové fáze se seřadí (podle zbytku za id — ISO
 * timestamp i index řadí chronologicky) a dostanou `phase-XXX.md`,
 * `phase-XXX-2.md`, … Timestamp z názvu mizí.
 */
export function planMemoryDir(files, idMap) {
    const orphans = [];
    const groups = new Map();
    for (const f of files) {
        const p = parsePhaseFile(f);
        if (!p || p.ext !== 'md')
            continue;
        const newId = idMap.get(p.id);
        if (newId == null) {
            orphans.push(f);
            continue;
        }
        let bucket = groups.get(newId);
        if (!bucket) {
            bucket = [];
            groups.set(newId, bucket);
        }
        bucket.push({ file: f, parsed: p });
    }
    const renames = [];
    for (const [newId, items] of groups) {
        items.sort((a, b) => (a.parsed.rest ?? '').localeCompare(b.parsed.rest ?? ''));
        items.forEach((it, i) => {
            const to = i === 0 ? `${phaseStem(newId)}.md` : `${phaseStem(newId)}-${i + 1}.md`;
            if (to !== it.file)
                renames.push({ from: it.file, to });
        });
    }
    return { renames, orphans };
}
/**
 * Najde kolize: cílový název, na který míří víc přejmenování, nebo který už na
 * disku obsadil soubor, jenž se sám nepřejmenovává (typicky orphan). Migrace
 * při kolizi raději skončí, než aby přepsala data.
 */
export function findCollisions(renames, existingFiles) {
    const collisions = new Set();
    const seen = new Set();
    for (const r of renames) {
        if (seen.has(r.to))
            collisions.add(r.to);
        seen.add(r.to);
    }
    const renamedFrom = new Set(renames.map((r) => r.from));
    const existing = new Set(existingFiles);
    for (const r of renames) {
        if (existing.has(r.to) && !renamedFrom.has(r.to))
            collisions.add(r.to);
    }
    return [...collisions];
}
/**
 * Provede přejmenování v adresáři kolizně bezpečně, ve dvou fázích: nejdřív
 * všechny zdroje na unikátní dočasné názvy, pak z dočasných na finální. Tím se
 * obejde překryv starých a nových názvů (`29→030`, kde `phase-030` ještě patří
 * staré `30`). Předpokládá, že cíle jsou unikátní (ověřeno `findCollisions`).
 */
export async function executeRenames(dirAbs, renames) {
    if (renames.length === 0)
        return;
    const TMP = '.renumber-tmp';
    for (const r of renames) {
        await rename(join(dirAbs, r.from), join(dirAbs, `${r.from}${TMP}`));
    }
    for (const r of renames) {
        await rename(join(dirAbs, `${r.from}${TMP}`), join(dirAbs, r.to));
    }
}
