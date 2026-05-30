## src/git.ts

Imports:
- { execFile } from "node:child_process"
- { promisify } from "node:util"

Exports:
- interface GitResult @L6-10
- function runGit(args: string[], cwd: string): Promise<GitResult> @L18-30
- function isGitRepo(cwd: string): Promise<boolean> @L32-35
- function hasChanges(cwd: string): Promise<boolean> @L37-41
- function commitAll(cwd: string, message: string): Promise<GitResult> @L48-52
- function push(cwd: string): Promise<GitResult> @L59-61
- function currentBranch(cwd: string): Promise<string | null> @L63-68
- function headSha(cwd: string): Promise<string | null> @L74-79
- function headSubject(cwd: string): Promise<string | null> @L85-90
- function isCleanWorkingTree(cwd: string): Promise<boolean> @L97-101
- function softResetTo(cwd: string, sha: string): Promise<GitResult> @L108-110
