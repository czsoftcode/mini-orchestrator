## src/git.ts

Imports:
- { execFile } from "node:child_process"
- { promisify } from "node:util"

Exports:
- interface GitResult
- function runGit(args: string[], cwd: string): Promise<GitResult>
- function isGitRepo(cwd: string): Promise<boolean>
- function hasChanges(cwd: string): Promise<boolean>
- function commitAll(cwd: string, message: string): Promise<GitResult>
- function push(cwd: string): Promise<GitResult>
- function currentBranch(cwd: string): Promise<string | null>
- function headSha(cwd: string): Promise<string | null>
- function headSubject(cwd: string): Promise<string | null>
- function isCleanWorkingTree(cwd: string): Promise<boolean>
- function softResetTo(cwd: string, sha: string): Promise<GitResult>
