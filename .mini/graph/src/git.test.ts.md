## src/git.test.ts

Imports:
- { afterEach, beforeEach, describe, expect, it } from "vitest"
- { execFile } from "node:child_process"
- { mkdtemp, rm, writeFile } from "node:fs/promises"
- { tmpdir } from "node:os"
- { join } from "node:path"
- { promisify } from "node:util"
- { commitAll, currentBranch, hasChanges, headSha, headSubject, isCleanWorkingTree, isGitRepo, push, runGit, softResetTo } from "./git.js"
