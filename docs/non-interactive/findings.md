# `mini findings`

> The durable store of **adversarial review findings** (`.mini/findings/`).
> Decoupled from the run report, versioned with the code, so a finding survives
> the phase it was found in and can feed later work.

> **Console-only.** There is **no** `/mini:findings` slash variant. `add` is
> normally called by the [adversarial review](../adversarial-task.md) step
> itself; `list` is for you, in a terminal.

## Synopsis

```bash
mini findings add --severity <blocker|should-know|nit> --title "<headline>" \
  [--where "<file:line>"] [--body "<what breaks and how>"]

mini findings list            # open findings across all phases
mini findings list --all      # include resolved ones too
```

## Description

The adversarial review step used to write its findings with an editor straight
into the **run report of the phase under review**. Once that phase closed, nobody
opened the report again — the finding was buried. `mini findings` fixes that: each
finding goes into its own durable file under `.mini/findings/`, carries an
`open`/`resolved` status, and is listed across phases so later phases can pick up
what is still open.

- **`add`** records one finding **about the phase under review** — mini infers the
  origin phase (the current one, else the last closed one); you never pass it. It
  prints the assigned id and the file path, so a failed call is visible rather
  than silently swallowed. This is the *only* write the adversarial reviewer makes
  — it reports, it does not edit code.
- **`list`** prints the open findings across all phases (id, severity, location,
  title). `--all` includes resolved ones. An empty or missing store prints a
  friendly note and never errors.

Findings live in `.mini/findings/phase-{id}.md`, one file per origin phase, each
holding one or more entries:

```
## 155-1 · should-know · open
**Where:** src/foo.ts:42
**Reviewed-at:** 1a2b3c4…
Null cascades silently on empty input.

The parser returns undefined and the caller crashes two layers up.
```

The `## <id> · <severity> · <status>` header line is the machine-readable
contract — don't hand-edit it. The optional `**Where:**` and `**Reviewed-at:**`
lines sit directly under it; both may be absent (older files predate
`**Reviewed-at:**`, and reviews outside git omit it).

## Options

| Flag | For | Description |
| --- | --- | --- |
| `--severity <level>` | `add` | `blocker` \| `should-know` \| `nit` (required). |
| `--title <text>` | `add` | Short headline of the finding (required). |
| `--where <loc>` | `add` | Optional location, `file:line`. |
| `--body <text>` | `add` | Optional longer body — what breaks and how. |
| `--all` | `list` | Include resolved findings, not just the open ones. |

## Examples

```bash
$ mini findings add --severity should-know --title "Null cascades" \
    --where "src/parser.ts:42" --body "empty input returns undefined, caller crashes later"
[ok] Finding 155-1 recorded [should-know] → .mini/findings/phase-155.md

$ mini findings list
Open findings
  155-1 [should-know] src/parser.ts:42 @1a2b3c4 — Null cascades
```

## Notes

- **Findings are versioned** (committed), like `.mini/decisions/` and
  `.mini/memory/` — durability across sessions is the point. They are **not** in
  `.mini/.gitignore` (unlike the generated `.mini/run/` reports).
- Ids are sequential within a phase file (`155-1`, `155-2`, …). `add` continues
  after the highest existing index.
- **`reviewed-at` is a baseline, not the reviewed commit.** When `add` runs inside
  a git repo it stamps the finding with the current `HEAD` SHA (shown shortened as
  `@1a2b3c4` in `list`). Because a review runs **between `do` and `done`** — while
  the phase work is still uncommitted — that `HEAD` is the phase's **parent**
  commit: the code state the review *started from*, not the commit of the reviewed
  code (which only exists after `done`). Outside a git repo (or a fresh repo with
  no commit) the field is simply omitted. It lets a later consumer judge whether a
  finding may be stale after the code moved on.
- Flipping a finding to `resolved`, a `doctor` orphan-check and surfacing open
  findings inside `next`/`plan`/`do` are planned follow-ups; today the store only
  records and lists.

## Related

- [`mini adversarial`](adversarial.md) / `/mini:adversarial` — the review step
  that records findings here
- [`mini verify`](verify.md) — the human UI/UX review counterpart
