---
name: review-diff
description: Use for the human's final look at a branch or working tree — after implement-spec verifies, when the user says "review the diff", or before a PR is requested.
---

Digest the diff so the human reviews in one glance.

- Table, one row per area: what changed · leftover risk. Every changed file lands in exactly one row.
- **Read** — file:line spans worth human eyes: the risky fraction, not a tour. Trivial diff → `Read: nothing`.
- Leftovers from verify, verbatim.
- Every row and finding in plain language (CLAUDE.md → Lanes): behaviour first, symbol names after.

Findings go to the human; fixes start on their word.
