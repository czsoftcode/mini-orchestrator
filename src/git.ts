import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface GitResult {
  ok: boolean;
  stdout: string;
  stderr: string;
}

/**
 * Spustí `git <args>` v `cwd` a vrátí výsledek. Nikdy nehází — `ok: false`
 * pokrývá jak nenulový exit, tak ENOENT (chybí git binárka) i jiné chyby.
 * Tím nám orchestrátor nikdy nespadne na tom, že uživatel nemá nakonfigurovaný
 * git, nebo že není v gitovém repu.
 */
export async function runGit(args: string[], cwd: string): Promise<GitResult> {
  try {
    const { stdout, stderr } = await execFileAsync('git', args, { cwd });
    return { ok: true, stdout: stdout.toString(), stderr: stderr.toString() };
  } catch (err) {
    const e = err as { stdout?: string | Buffer; stderr?: string | Buffer };
    return {
      ok: false,
      stdout: e.stdout ? e.stdout.toString() : '',
      stderr: e.stderr ? e.stderr.toString() : '',
    };
  }
}

export async function isGitRepo(cwd: string): Promise<boolean> {
  const r = await runGit(['rev-parse', '--is-inside-work-tree'], cwd);
  return r.ok && r.stdout.trim() === 'true';
}

export async function hasChanges(cwd: string): Promise<boolean> {
  const r = await runGit(['status', '--porcelain'], cwd);
  if (!r.ok) return false;
  return r.stdout.trim().length > 0;
}

/**
 * Naivně přidá vše (`git add -A`) a vytvoří jeden commit s daným message.
 * Zámerně `add -A`: fáze přidává nové soubory (zdrojáky, testy, README úpravy)
 * a uživatel je chce mít v commitu. Nechtěné soubory řeší `.gitignore`.
 */
export async function commitAll(cwd: string, message: string): Promise<GitResult> {
  const addR = await runGit(['add', '-A'], cwd);
  if (!addR.ok) return addR;
  return runGit(['commit', '-m', message], cwd);
}

/**
 * `git push` na nakonfigurovaný upstream. Best-effort jako zbytek wrapperu —
 * nikdy nehází: chybějící remote/upstream, odmítnutý push i absence gitu skončí
 * jako `ok: false` se stderr ze gitu, ať to volající umí vypsat jako warning.
 */
export async function push(cwd: string): Promise<GitResult> {
  return runGit(['push'], cwd);
}

/**
 * Vytvoří lokální git tag `tag` na aktuálním HEAD. Best-effort jako zbytek
 * wrapperu — nikdy nehází: existující tag, absence HEAD i absence gitu skončí
 * jako `ok: false` se stderr ze gitu, ať to volající umí vypsat jako warning.
 */
export async function createTag(cwd: string, tag: string): Promise<GitResult> {
  return runGit(['tag', tag], cwd);
}

/**
 * Pushne jeden tag na nakonfigurovaný `origin`. Best-effort: chybějící remote i
 * odmítnutí skončí jako `ok: false`, workflow se tím nezablokuje.
 */
export async function pushTag(cwd: string, tag: string): Promise<GitResult> {
  return runGit(['push', 'origin', tag], cwd);
}

export async function currentBranch(cwd: string): Promise<string | null> {
  const r = await runGit(['rev-parse', '--abbrev-ref', 'HEAD'], cwd);
  if (!r.ok) return null;
  const name = r.stdout.trim();
  return name.length > 0 ? name : null;
}

/**
 * SHA aktuálního HEAD commitu (`null`, pokud HEAD neexistuje — např. čerstvý
 * repo bez commitu — nebo nejsme v gitovém repu).
 */
export async function headSha(cwd: string): Promise<string | null> {
  const r = await runGit(['rev-parse', 'HEAD'], cwd);
  if (!r.ok) return null;
  const sha = r.stdout.trim();
  return sha.length > 0 ? sha : null;
}

/**
 * SHA rodiče HEAD (`HEAD^`). Slouží `mini undo` k ověření, že commit fáze je
 * pořád vrchní — `HEAD^ === autoCommit.preSha`. Vrací `null`, když rodič
 * neexistuje (úplně první commit) nebo `git` selže.
 */
export async function headParentSha(cwd: string): Promise<string | null> {
  const r = await runGit(['rev-parse', 'HEAD^'], cwd);
  if (!r.ok) return null;
  const sha = r.stdout.trim();
  return sha.length > 0 ? sha : null;
}

/**
 * První řádek (subject) HEAD commit message. Slouží jako lidsky čitelný popis
 * commitu v UI undo.
 */
export async function headSubject(cwd: string): Promise<string | null> {
  const r = await runGit(['log', '-1', '--pretty=%s', 'HEAD'], cwd);
  if (!r.ok) return null;
  const subject = r.stdout.trim();
  return subject.length > 0 ? subject : null;
}

/**
 * Pracovní strom je čistý, pokud `git status --porcelain` nic nevypíše.
 * Zahrnuje untracked soubory — pro účely undo nechceme dělat soft reset, když
 * uživatel má nějaké rozdělané věci, které by se zamíchaly do staged změn.
 */
export async function isCleanWorkingTree(cwd: string): Promise<boolean> {
  const r = await runGit(['status', '--porcelain'], cwd);
  if (!r.ok) return false;
  return r.stdout.trim().length === 0;
}

/**
 * `git reset --soft <sha>` — HEAD se vrátí na `sha`, ale změny z odložených
 * commitů zůstanou nastagované v indexu. Uživatel si pak může rozhodnout,
 * jestli je commitne znovu, nebo upraví a commitne jinak.
 */
export async function softResetTo(cwd: string, sha: string): Promise<GitResult> {
  return runGit(['reset', '--soft', sha], cwd);
}
