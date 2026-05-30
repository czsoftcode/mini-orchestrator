import { access, copyFile, mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
const STATE_DIR = '.mini';
const STATE_FILE = 'state.json';
const STATE_PREV_FILE = 'state.prev.json';
const PHASES_DIR = 'phases';
const PHASES_PREV_DIR = 'phases-prev';
const PROJECT_FILE = 'project.md';
const STOP_FILE = 'STOP';
/** Aktuální verze schématu stavu. 1 = starý monolitický `state.json`. */
export const SCHEMA_VERSION = 2;
/**
 * Stav je ve starém monolitickém formátu (version 1) a nový kód ho neumí číst.
 * Migrace je vědomá, ruční operace přes `mini migrate` — `load*` proto raději
 * spadne s jasným hintem, než aby tiše přepisovala data.
 */
export class LegacyStateError extends Error {
    foundVersion;
    constructor(foundVersion) {
        super('Stav je ve starém formátu (state.json verze 1). Spusť `mini migrate`, ' +
            'který ho rozdělí do nového layoutu (.mini/phases/).');
        this.foundVersion = foundVersion;
        this.name = 'LegacyStateError';
    }
}
function dir(cwd) {
    return join(cwd, STATE_DIR);
}
export function statePath(cwd = process.cwd()) {
    return join(dir(cwd), STATE_FILE);
}
export function statePrevPath(cwd = process.cwd()) {
    return join(dir(cwd), STATE_PREV_FILE);
}
export function phasesDir(cwd = process.cwd()) {
    return join(dir(cwd), PHASES_DIR);
}
function phasesPrevDir(cwd = process.cwd()) {
    return join(dir(cwd), PHASES_PREV_DIR);
}
/**
 * Společný základ názvu souboru fáze: `phase-<id>` s nulovým paddingem na min.
 * 3 číslice kvůli čitelnému řazení v adresáři (`phase-001`, … `phase-060`).
 * `padStart` jen doplňuje, NIKDY neořezává — fáze ≥ 1000 dostane přirozeně delší
 * stem (`phase-1000`). Pořadí fází se proto NESMÍ odvozovat z lexikografického
 * řazení názvů (přechod 999→1000 by `ls` mis-sortil); mini řadí podle pole fází
 * ve `state.json`. Sdílí ho `phases/` (.json) i `discuss/`/`memory/`/`run/` (.md).
 */
export function phaseStem(id) {
    return `phase-${String(id).padStart(3, '0')}`;
}
/** Název souboru fáze v `phases/` — JSON nad sdíleným stemem. */
export function phaseFileName(id) {
    return `${phaseStem(id)}.json`;
}
export function phasePath(cwd, id) {
    return join(phasesDir(cwd), phaseFileName(id));
}
export function projectPath(cwd = process.cwd()) {
    return join(dir(cwd), PROJECT_FILE);
}
/**
 * Cesta ke kooperativnímu stop signálu `.mini/STOP`. Když soubor existuje,
 * autonomní `/mini:auto` na svých kontrolních bodech čistě skončí. Zapisuje
 * a maže ho příkaz `mini stop` (resp. `mini stop --clear`).
 */
export function stopPath(cwd = process.cwd()) {
    return join(dir(cwd), STOP_FILE);
}
export async function exists(cwd = process.cwd()) {
    try {
        await access(statePath(cwd));
        return true;
    }
    catch {
        return false;
    }
}
export async function hasPrev(cwd = process.cwd()) {
    try {
        await access(statePrevPath(cwd));
        return true;
    }
    catch {
        return false;
    }
}
/**
 * Jednorázová migrace schématu hlavičky při čtení. Zatím řeší jen zastaralé
 * pole `model` → `models.default`: starší stavy držely jediný model v `model`,
 * dnes je vše v `models`. Když je `models.default` už nastaven, má přednost.
 * Po migraci se `model` odstraní.
 */
function migrateHeader(header) {
    if (header.model != null) {
        if (!header.models) {
            header.models = {};
        }
        if (header.models.default == null) {
            header.models.default = header.model;
        }
        delete header.model;
    }
    return header;
}
async function writeJsonAtomic(target, data) {
    const tmp = `${target}.tmp`;
    await writeFile(tmp, JSON.stringify(data, null, 2), 'utf-8');
    await rename(tmp, target);
}
/**
 * Zapíše JSON atomicky, ale jen když se serializovaný obsah liší od toho na
 * disku. Šetří diskové operace u stavu, který se z velké části nemění (např.
 * jen jedna fáze ze sady). Vrací `true`, pokud reálně zapsala. Chybějící cíl =
 * zapsat.
 */
async function writeJsonIfChanged(target, data) {
    const next = JSON.stringify(data, null, 2);
    let current = null;
    try {
        current = await readFile(target, 'utf-8');
    }
    catch {
        current = null;
    }
    if (current === next)
        return false;
    const tmp = `${target}.tmp`;
    await writeFile(tmp, next, 'utf-8');
    await rename(tmp, target);
    return true;
}
async function writeRawAtomic(target, content) {
    const tmp = `${target}.tmp`;
    await writeFile(tmp, content, 'utf-8');
    await rename(tmp, target);
}
function toHeader(state) {
    const header = {
        version: SCHEMA_VERSION,
        createdAt: state.createdAt,
        currentPhaseId: state.currentPhaseId,
        phases: state.phases.map((p) => ({ id: p.id, title: p.title, status: p.status })),
    };
    if (state.model != null)
        header.model = state.model;
    if (state.models != null)
        header.models = state.models;
    return header;
}
/** Načte jeden soubor fáze z daného adresáře; chybějící/nevalidní → `null`. */
async function readPhaseFile(dirPath, id) {
    try {
        const raw = await readFile(join(dirPath, phaseFileName(id)), 'utf-8');
        return JSON.parse(raw);
    }
    catch {
        return null;
    }
}
/** Sesype hlavičku + soubory fází z daného adresáře do plného `ProjectState`. */
function assembleState(header, phaseDirPath) {
    return (async () => {
        const phases = [];
        for (const summary of header.phases) {
            const detail = await readPhaseFile(phaseDirPath, summary.id);
            phases.push(detail ?? { id: summary.id, title: summary.title, status: summary.status });
        }
        const state = {
            version: SCHEMA_VERSION,
            createdAt: header.createdAt,
            currentPhaseId: header.currentPhaseId,
            phases,
        };
        if (header.models != null)
            state.models = header.models;
        return state;
    })();
}
/** Načte hlavičku stavu. Na starém formátu (version 1) vyhodí `LegacyStateError`. */
export async function loadHeader(cwd = process.cwd()) {
    const raw = await readFile(statePath(cwd), 'utf-8');
    const parsed = JSON.parse(raw);
    if (parsed.version !== SCHEMA_VERSION) {
        throw new LegacyStateError(parsed.version);
    }
    return migrateHeader(parsed);
}
export async function saveHeader(header, cwd = process.cwd()) {
    await mkdir(dir(cwd), { recursive: true });
    await writeJsonAtomic(statePath(cwd), header);
}
/** Načte detail jedné fáze; chybějící soubor → `null`. */
export async function loadPhase(cwd, id) {
    return readPhaseFile(phasesDir(cwd), id);
}
export async function savePhase(phase, cwd = process.cwd()) {
    await mkdir(phasesDir(cwd), { recursive: true });
    await writeJsonAtomic(phasePath(cwd, phase.id), phase);
}
/** Sesype hlavičku + všechny soubory fází do plného `ProjectState`. */
export async function loadFullState(cwd = process.cwd()) {
    const header = await loadHeader(cwd);
    return assembleState(header, phasesDir(cwd));
}
/** Zpětně kompatibilní načtení celého stavu (alias `loadFullState`). */
export const load = loadFullState;
/**
 * Zazálohuje aktuální stav (hlavičku i adresář fází) do prev-vrstvy pro `undo`.
 * Volá se před každým zápisem; na prvním uložení (žádný `state.json`) je no-op.
 */
async function snapshotPrev(cwd) {
    let oldHeader = null;
    try {
        oldHeader = await readFile(statePath(cwd), 'utf-8');
    }
    catch {
        oldHeader = null;
    }
    if (oldHeader === null)
        return;
    await writeRawAtomic(statePrevPath(cwd), oldHeader);
    // phases-prev má být zrcadlo aktuálního phases. Místo zahození a kopie celého
    // adresáře synchronizujeme diferenčně: kopírujeme jen soubory s odlišným
    // obsahem (nebo v prev chybějící) a mažeme z prev ty, co už v phases nejsou.
    await mkdir(phasesPrevDir(cwd), { recursive: true });
    let srcFiles = [];
    try {
        srcFiles = await readdir(phasesDir(cwd));
    }
    catch {
        srcFiles = [];
    }
    const keep = new Set();
    for (const f of srcFiles) {
        if (!f.endsWith('.json'))
            continue;
        keep.add(f);
        const src = join(phasesDir(cwd), f);
        const dst = join(phasesPrevDir(cwd), f);
        let prev = null;
        try {
            prev = await readFile(dst, 'utf-8');
        }
        catch {
            prev = null;
        }
        const cur = await readFile(src, 'utf-8');
        if (prev !== cur) {
            await copyFile(src, dst);
        }
    }
    let prevFiles = [];
    try {
        prevFiles = await readdir(phasesPrevDir(cwd));
    }
    catch {
        prevFiles = [];
    }
    for (const f of prevFiles) {
        if (f.endsWith('.json') && !keep.has(f)) {
            await rm(join(phasesPrevDir(cwd), f), { force: true });
        }
    }
}
/** Smaže soubory fází, které už nejsou v aktuální sadě id (např. po `undo`). */
async function prunePhaseFiles(cwd, keep) {
    let files = [];
    try {
        files = await readdir(phasesDir(cwd));
    }
    catch {
        return;
    }
    const keepNames = new Set([...keep].map((id) => phaseFileName(id)));
    for (const f of files) {
        if (f.endsWith('.json') && !keepNames.has(f)) {
            await rm(join(phasesDir(cwd), f), { force: true });
        }
    }
}
/**
 * Zpětně kompatibilní uložení celého stavu: zazálohuje předchozí stav pro
 * `undo`, rozseká `state` na hlavičku + soubory fází a zapíše je. Granulární
 * cesty (`saveHeader`/`savePhase`) zálohu neřeší — pro undo se používá `save`.
 */
export async function save(state, cwd = process.cwd()) {
    await mkdir(dir(cwd), { recursive: true });
    await mkdir(phasesDir(cwd), { recursive: true });
    await snapshotPrev(cwd);
    for (const phase of state.phases) {
        await writeJsonIfChanged(phasePath(cwd, phase.id), phase);
    }
    await prunePhaseFiles(cwd, new Set(state.phases.map((p) => p.id)));
    await writeJsonAtomic(statePath(cwd), toHeader(state));
}
/** Načte prev-vrstvu (hlavička + adresář fází) jako plný `ProjectState`. */
export async function loadPrev(cwd = process.cwd()) {
    const raw = await readFile(statePrevPath(cwd), 'utf-8');
    const header = migrateHeader(JSON.parse(raw));
    return assembleState(header, phasesPrevDir(cwd));
}
/** Vrátí prev-vrstvu zpět jako aktuální stav (hlavičku i adresář fází). */
export async function restorePrev(cwd = process.cwd()) {
    await rename(statePrevPath(cwd), statePath(cwd));
    await rm(phasesDir(cwd), { recursive: true, force: true });
    try {
        await rename(phasesPrevDir(cwd), phasesDir(cwd));
    }
    catch {
        await mkdir(phasesDir(cwd), { recursive: true });
    }
}
export async function readProject(cwd = process.cwd()) {
    return readFile(projectPath(cwd), 'utf-8');
}
export async function writeProject(content, cwd = process.cwd()) {
    await mkdir(dir(cwd), { recursive: true });
    const target = projectPath(cwd);
    await writeRawAtomic(target, content);
}
export function newState() {
    return {
        version: SCHEMA_VERSION,
        createdAt: new Date().toISOString(),
        currentPhaseId: null,
        phases: [],
    };
}
