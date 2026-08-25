---
name: feature
description: User-invoked feature lane — one command drives questions → spec → task plan → implement → evidence PR → babysit to merge.
disable-model-invocation: true
argument-hint: <feature idea | spec path>
---

**Start on today's `main`** - `git fetch origin main`, then branch from it, or merge it into a branch already carrying this lane's work (`resolving-merge-conflicts` if it stops). A lane begun on a stale base hands its conflicts to the human.

Drive one feature end to end. Each phase names the skill that owns its mechanics — invoke it there; lines here are the loop's own contract on top. The loop asks the user exactly twice: the question rounds in phase 1, and the task-matrix choice in phase 3. Nowhere else — never ask whether to dispatch, whether to babysit, or for permission to continue. A question a non-programmer cannot answer is not asked yet, it is rewritten; answer options describe what the user will see or what becomes allowed. Product ambiguity mid-flight → `patch-spec`, then continue where the loop stopped.

1. **Questions** — before any spec text exists. `write-spec` steps 1–3: size the lane, read the code, then run the rounds. Lane is decided by the questions, not by gut size: one open product decision means *standard*, many coupled ones *epic*, and *oneshot* only when there is genuinely nothing to ask. A oneshot that turns out to need a question is not a oneshot — say so, call it standard, and ask. Argument already a confirmed spec in `.agents/specs/` → start at 3.
2. **Spec** — rounds closed, `write-spec` steps 4–6 write the file. Bullets say what must be done, each under 40 words, ambiguity dead. Show the path and the bullets; no confirmation gate here, the answers already are the confirmation.
3. **Tasks** — `implement-spec` steps 1–2 build the matrix. Loop deltas: show the user the spec alongside it, render the matrix as a chat table (`group · task · files · Best value · Best results`), name each task in under 40 words, and give every task's definition the unit/integration tests that judge its own chunk (repo testing rules: real DB + `seedX`). Then the loop's one remaining question, every lane including oneshot: edit the tasks first, implement on Best value, or implement on Best results (`model-pick` fills both columns; the answer sets the path for every dispatch of the run). This is the last user input of the loop.
4. **Implement** — `implement-spec` dispatch + review. Implementation always goes to subagents, never to the root — that is not a question. Loop deltas: a worker's task is done only with its tests written and green; root reviews each result against the spec and module boundaries, a defect goes back to the same worker with the finding until it passes; a finished worker commits only its own files — conventional title a few words, body under 40.
5. **Evidence PR** — root, zero questions: run the feature end to end (`capture-ui-evidence` for anything browser-visible) and fix what breaks yourself, UI issues included. Assemble the evidence as ONE HTML page — recordings + screenshots of the working feature grouped sensibly. Then `algo-git-pr`: body = what was done as bullets under 40 words each, `## Risk Assessment` with a rationale, and the evidence link (`reportUrl` from capture-ui-evidence publish — the click-to-open rendered report).
6. **Babysit to merge** — `algo-git-pr` fires it; the lane ends when that loop does, not when the PR appears.

At every phase boundary say which phase ended, which starts.
