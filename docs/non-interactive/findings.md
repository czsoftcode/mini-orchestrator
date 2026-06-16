# `mini findings`

> The durable store of **review findings** (`.mini/findings/`) — from both the
> adversarial red-team and the human verify review. Decoupled from the run
> report, versioned with the code, so a finding survives the phase it was found
> in and can feed later work.

> **Console-only.** There is **no** `/mini:findings` slash variant. `add` is
> normally called by the [adversarial review](adversarial.md) and
> [verify](verify.md) steps themselves; `list` is for you, in a terminal.

## Synopsis

```bash
mini findings add --severity <blocker|should-know|nit> --title "<headline>" \
  [--source <adversarial|verify>] [--where "<file:line>"] [--body "<what breaks and how>"]

mini findings list            # open findings across all phases
mini findings list --all      # include resolved ones too

mini findings resolve <id...> # close one or more findings (e.g. 160-1 160-2)
mini findings resolve <id...> --reason "<why>"  # …and record why it was closed
mini findings reopen  <id...> # flip them back to open (clears any reason)
```

## Description

The review steps used to write their findings with an editor straight into the
**run report of the phase under review**. Once that phase closed, nobody opened
the report again — the finding was buried, and a corrupt or missing report
dropped it silently. `mini findings` fixes that: each finding goes into its own
durable file under `.mini/findings/`, carries an `open`/`resolved` status and a
`source` tag, and is listed across phases so later phases can pick up what is
still open.

- **`add`** records one finding **about the phase under review** — mini infers the
  origin phase (the current one, else the last closed one); you never pass it.
  `--source` tags which review step found it (`adversarial` | `verify`, default
  `adversarial`). It prints the assigned id and the file path, so a failed call is
  visible rather than silently swallowed. This is the *only* write a reviewer
  makes — it reports, it does not edit code.
- **`list`** prints the open findings across all phases (id, severity, source,
  location, title). `--all` includes resolved ones. An empty or missing store
  prints a friendly note and never errors.
- **`resolve <id...>`** closes one or more findings manually — for a finding a
  multi-fix phase addressed, or a `nit` you decide to dismiss. `--reason "<why>"`
  records the reason on **every** id in the batch (stored as a `**Reason:**` line);
  it is applied only on the open→resolved flip, so resolving an already-resolved id
  does **not** overwrite an earlier reason. **`reopen <id...>`** flips resolved
  findings back to `open` and **clears** any reason (a reopened finding has no
  closing reason); passing `--reason` to `reopen` is a usage error. Both take
  several ids, report one line per id, and are **idempotent**: an id already in the
  target state is a benign no-op, not an error. An unknown or malformed id is
  reported and makes the call exit non-zero, but the other ids in the batch are
  still processed.

Findings live in `.mini/findings/phase-{id}.md`, one file per origin phase, each
holding one or more entries:

```
## 155-1 · should-know · open
**Where:** src/foo.ts:42
**Reviewed-at:** 1a2b3c4…
**Source:** adversarial
Null cascades silently on empty input.

The parser returns undefined and the caller crashes two layers up.
```

The `## <id> · <severity> · <status>` header line is the machine-readable
contract — don't hand-edit it. The optional `**Where:**`, `**Reviewed-at:**`,
`**Source:**`, `**Range:**` and `**Reason:**` lines sit directly under it in any
order; each may be absent (older files predate `**Reviewed-at:**`/`**Source:**`,
and reviews outside git omit the SHA). A missing `**Source:**` defaults to
`adversarial`; a `**Source:**` whose value mini does not recognise (e.g. one a newer
mini version wrote) is **preserved verbatim**, not rewritten to the default.
`**Reason:**` is set by `resolve --reason` and removed on `reopen`.

## Options

| Flag | For | Description |
| --- | --- | --- |
| `--severity <level>` | `add` | `blocker` \| `should-know` \| `nit` (required). |
| `--source <step>` | `add` | `adversarial` \| `verify` — which review found it. Defaults to `adversarial`. |
| `--title <text>` | `add` | Short headline of the finding (required). |
| `--where <loc>` | `add` | Optional location, `file:line`. |
| `--body <text>` | `add` | Optional longer body — what breaks and how. |
| `--all` | `list` | Include resolved findings, not just the open ones. |
| `--reason <text>` | `resolve` | Why the finding was closed — recorded on every id in the batch. Rejected for `reopen`. |

`resolve` and `reopen` take finding ids as positional arguments (one or more),
not flags: `mini findings resolve 160-1 160-2`.

## Examples

```bash
$ mini findings add --severity should-know --title "Null cascades" \
    --where "src/parser.ts:42" --body "empty input returns undefined, caller crashes later"
[ok] Finding 155-1 recorded [should-know] → .mini/findings/phase-155.md

$ mini findings list
Open findings
  155-1 [should-know] adversarial src/parser.ts:42 @1a2b3c4 — Null cascades

$ mini findings resolve 155-1 --reason "fixed in phase 190"
[ok] Finding 155-1 resolved.

$ mini findings resolve 155-1        # idempotent — already in that state
Finding 155-1 is already resolved.

$ mini findings reopen 155-9         # unknown id → reported, exit 1
[x] No such finding: 155-9
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
- Open findings surface in [`mini next`](next.md) / [`/mini:next`](../interactive/next.md)
  as candidate **fix phases** (`id · severity · source · where — title`). A phase born from
  one is saved with `--from-finding <id>`, which records the link without closing
  the finding (it stays open until the fix is done and verified). That link lets
  [`mini discuss`](discuss.md) and [`mini plan`](plan.md) read the finding's full
  detail in any later session.
- **A finding gets resolved two ways.** Automatically: when a phase saved with
  `--from-finding <id>` reaches [`mini done`](done.md), that linked finding is
  flipped to `resolved` (and `mini undo` reopens it). Manually: `mini findings
  resolve <id...>` for anything the automatic link doesn't cover — a finding a
  multi-fix phase addressed, or a `nit` you dismiss. Pass `--reason "<why>"` to
  record why it was closed (a `doctor` orphan-check for decisions remains a planned
  follow-up).

## Related

- [`mini adversarial`](adversarial.md) / `/mini:adversarial` — the review step
  that records findings here
- [`mini verify`](verify.md) — the human UI/UX review counterpart
