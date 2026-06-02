# Contributing to mini

Thanks for considering a contribution! **mini** is a minimalist CLI orchestrator
on top of Claude Code, and it stays useful by staying small. This guide covers
how to get set up, how the project is built, and what a good change looks like.

By participating you agree that your contributions are licensed under the
project's [MIT License](LICENSE).

## Ways to contribute

- **Report a bug** — open a [bug report](.github/ISSUE_TEMPLATE/bug_report.yml);
  include your `mini --version`, OS, and the exact commands.
- **Suggest a feature** — open a
  [feature request](.github/ISSUE_TEMPLATE/feature_request.yml). Proposals that
  keep mini's small footprint (send Claude only the essentials) are the easiest
  to land.
- **Ask a question** — use
  [Discussions](https://github.com/czsoftcode/mini-orchestrator/discussions)
  rather than an issue.
- **Send a pull request** — see below.

## Development setup

Requirements: **Node.js 20+**. Clone and build:

```bash
git clone https://github.com/czsoftcode/mini-orchestrator.git
cd mini-orchestrator
npm install
npm run build
node dist/cli.js --help        # or: alias mini='node $(pwd)/dist/cli.js'
```

Handy scripts:

| Command | What it does |
|---|---|
| `npm run build` | Compile TypeScript and copy assets into `dist/` |
| `npm run dev` | Run the CLI from source via `tsx` (e.g. `npm run dev -- status`) |
| `npm run typecheck` | Type-check without emitting (`tsc --noEmit`) |
| `npm test` | Run the full vitest suite |
| `npm run install-local` | Build and install your local version under `~/.local` (see the README's [From git / for development](README.md#from-git--for-development)) |

## Submitting a pull request

1. **Branch** off `main` and keep the change focused — ideally one self-contained
   thing. Split unrelated refactors into their own PR.
2. **Add or update tests.** This project ships a large vitest suite, including
   snapshot tests for the prompts; run `npm test` and update snapshots
   deliberately when output changes on purpose.
3. **Keep it green:** `npm run typecheck` and `npm test` must pass.
4. **Update the docs** (`README.md`, `docs/`) when you change behavior or add a
   command, and add a `CHANGELOG.md` entry under `[Unreleased]` for anything
   user-facing.
5. Open the PR; the template's checklist will guide you through the rest.

## Language

Everything inside the program is written in **English** — UI text, CLI help,
command output, error messages, code comments/JSDoc, and the documentation
(`README.md`, `CHANGELOG.md`). Identifiers (function/variable/type/file names)
and standard technical terms are left as they are. Some older code may still be
in another language; translate it to English when you touch it.

## How this project is built (mini dogfoods mini)

mini is developed with **mini itself**: work happens in small **phases**
(next → plan → do → done), tracked under `.mini/`. You do **not** need to use
that workflow to contribute — a normal branch + PR is perfectly fine. If you are
curious, the loop is shown at the top of the [README](README.md#quick-start),
and the phase history lives in `mini status` and `CHANGELOG.md`.

## Reporting security issues

Please do not open a public issue for a security vulnerability. Instead, contact
the maintainer privately so it can be addressed before disclosure.
