# ADR instruction kept inline in the done prompt

## Decision
The full ADR-collection instruction (threshold, format, printf snippet) lives inline in the /mini:done prompt, paid on every done (~360 tokens/phase). The alternative — a thin trigger in done plus an on-demand `mini context decision` that loads the full instruction only when invoked — was deferred to the backlog, not adopted now.

## Why
The on-demand split saves tokens only if ADRs are rare, and only if the thin trigger stays sharp enough not to raise the rate of *forgotten* decisions. That reliability is unproven, and the whole point of the layer is to not lose the "why". An inline instruction forces the agent to weigh an ADR every time, which is the safer default until real usage shows ADRs are both rare and reliably caught with a thinner prompt. Token cost is paid once per phase — acceptable versus a leaky decision layer.
