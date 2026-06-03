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
`mini <Tab>` → the full command list), after a command that command's option
flags (`mini done --<Tab>` → `--apply --accept-verify --bump --push`), and after
a flag that takes a fixed set of values, those values (`mini done --bump <Tab>` →
`none patch minor major`). Arguments that don't start with `-` and aren't a
known flag value fall back to filename completion.

The completed commands, flags and flag values are derived from `mini` itself at
the moment you generate the script, so they always match the installed version —
regenerate it after an upgrade to pick up new commands, flags or values.

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
  commands, flags or values.
- Flag-value completion covers only flags with a fixed set of choices (currently
  `--bump`); free-form values (a title, a path, a number) fall back to filename
  completion.

## Related

- [`mini install-commands`](install-commands.md) — installs the `/mini:*` slash
  commands (the in-session counterpart to the terminal CLI)
