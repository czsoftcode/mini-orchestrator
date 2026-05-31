---
description: mini — implement the current phase and write a report
---

This is the **do** step of the mini workflow, run directly in Claude Code. You implement the current phase and write a report at the end. Change the state in `.mini/` only with `mini ... --apply` commands, never edit `.mini/state.json` by hand.

Proceed in this order:

1. **Start the phase.** Run in Bash `mini do --apply` — it marks the phase as in progress (`doing`) and creates `.mini/run/`, so that the step tracking and the report have somewhere to go. Run it **before** you start implementing.
2. **Load the prompt.** Run `mini context do` and follow the printed instructions (project context, steps, report format).
3. **Implement.** After each finished step, mark it done **immediately**: `mini do --apply --step-done "<exact step name>"` (copy the name character by character from the "Steps" section in the prompt).
4. **Write the report.** At the end, use the Write tool to save the report into `.mini/run/phase-{id}.md` exactly in the format from the prompt (YAML statuses + free text). Only then finish.

If a step runs into a blocker you can't get around yourself, stop and hand control back to the user.
