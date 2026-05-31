# Instructions for Claude Code in this project

## Project language

**Everything inside the program is written in English** — the tool is meant to
be international and publicly available. So write in English:

- UI texts, CLI help, command output and logs
- error messages
- comments and JSDoc in the code
- **project documentation** (`README.md`, `CHANGELOG.md`) — including **new
  entries in `CHANGELOG.md`** (write phase records via `/mini:done` in English)

> Note: Some of the code may still be in Czech — the translation is happening
> gradually, phase by phase. Whenever you come across Czech text in the program,
> translate it into English.

Left untouched (not translated):

- identifiers in the code (function, variable and type names, file names)
- standard technical terms (`Promise`, `snapshot test`, `parser`, …)
- quoted foreign error messages and tool output
- the parsers' response contract (`TITLE:`, `GOAL:`, `STEP:`, …) and status
  words (`done`/`doing`/`todo`/…)
