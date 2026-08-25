---
name: patch-spec
description: Use when a locked spec must change — implementation surfaced new product ambiguity, PR feedback alters behaviour, or the user says "patch the spec". Not for starting a new feature (write-spec).
---

Express path: amend the locked spec, confirm only the delta, ship only the delta.

1. Find the spec — user's pointer, else newest in `.agents/specs/` matching the branch topic.
2. Edit the bullets — add or replace decisions. Decision bullets only, no headings or rationale; done when deleting any line loses a product decision. Ambiguity inside the patch itself: one question, recommended answer.
3. Show only the changed bullets. Wait. Confirm is the go signal: `implement-spec` scoped to the delta.
