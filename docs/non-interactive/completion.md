# `mini completion`

> Prints a shell completion script for `mini` that completes the top-level
> command names.

> **Console-only.** This command has **no** `/mini:completion` slash variant —
> shell completion only makes sense in a terminal. It is one of the few mini
> commands with a single documentation page.

## Synopsis

```bash
mini completion bash    # print the bash completion script
mini completion zsh     # print the zsh completion script
```

## Description

The script is written to stdout — you wire it into your shell once and then
`Tab` completes `mini`'s subcommands (`mini ver<Tab>` → `mini verify`,
`mini <Tab>` → the full command list). Arguments past the command name fall back
to filename completion.

The completed command list is derived from `mini` itself at the moment you
generate the script, so it always matches the installed version — regenerate it
after an upgrade to pick up new commands.

## Enabling it

**bash** — source it from your `~/.bashrc` (or `~/.bash_profile`):

```bash
echo 'source <(mini completion bash)' >> ~/.bashrc
```

The bash script is self-contained and does **not** require the
`bash-completion` package.

**zsh** — make sure completion is initialised (`autoload -Uz compinit &&
compinit`), then source it from your `~/.zshrc`:

```bash
echo 'source <(mini completion zsh)' >> ~/.zshrc
```

Open a new shell (or `source ~/.bashrc` / `source ~/.zshrc`) for it to take
effect.

## Arguments

| Argument | Description |
| --- | --- |
| `<shell>` | The target shell: `bash` or `zsh`. An unsupported value prints an error and exits non-zero. |

## Notes

- Regenerate the script after `mini upgrade` so completion knows about any new
  commands.
- Only the top-level command names are completed; per-command flags are not.

## Related

- [`mini install-commands`](install-commands.md) — installs the `/mini:*` slash
  commands (the in-session counterpart to the terminal CLI)
