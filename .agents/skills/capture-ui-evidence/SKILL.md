---
name: capture-ui-evidence
description: "Capture and publish UI performance evidence for frontend changes: CDP metrics and budgets (including INP from real flow interactions), console/network failures, responsive screenshots, WebM recordings of the measured run, baseline diff vs previous evidence, HyperDX trace correlation, and a UI evidence link in the PR description. Use after changing UI, UX, CSS, routes, client interactions, loading behavior, or frontend performance; also use when asked to verify that a page feels fast, clear, responsive, accessible, or Apple-like. Do not use for changes with no browser-visible impact."
---

Make the changed route reachable. Start your own dev server on a random port in 3200-3899 (`PORT=$((3200 + RANDOM % 700)) bun run dev`) rather than reusing 3000/3001 — a port that answers is not proof it serves *your* branch. Substitute that port into every URL below, then from repo root:

```bash
# managed host
ui-evidence --url http://127.0.0.1:3000/<route> --surface <s> \
  --out evidence/<YYYY-MM-DD-HH.MM>-<slug> --video

# local
node .agents/skills/capture-ui-evidence/scripts/capture.mjs \
  --url http://127.0.0.1:3000/<route> --surface <s> \
  --out evidence/<YYYY-MM-DD-HH.MM>-<slug> --video
```

`--flow .agents/skills/capture-ui-evidence/flows/<s>.json` is required for UX evidence (INP + outcome). End flows with `assert`. DSL: `flows/README.md`. Other flags: `--help`.

Screenshots are read at one constant height, never one constant width: a 1280-wide desktop shot squeezed into the same column as a 390-wide phone shot is unreadable at exactly the viewport that carries the most detail. `build-report.mjs` already lays them out that way - one height, width following the aspect ratio, the row scrolling sideways inside its own container. Hold to that in any report you assemble by hand, and caption each shot with the viewport it was taken at.

Judge screenshots at 390/768/1280 and `README.md` / `metrics.json`. Console errors, page errors, broken requests and baseline REGRESSIONS = defects.

The verdict counts only what means the same thing on a dev server as in production: broken requests, page errors, console errors. Paint timings, page weight and request count are reported as measurements and gate only under `--strict` - a dev server compiles on demand and serves every module as its own request, so failing a run on them says nothing about the change. Read them anyway: a number far off its budget is a lead, just not a verdict. INP missing on a flow run = not UX evidence. Backend slowness → `traceparent` in metrics → `algo-debug-performance`. `--strict` only on prod/preview builds. Re-run after fixes.

Publish (after push + PR; `evidence/` is gitignored — it never enters git). Evidence is published as a Claude Artifact, not hosted on any project infra:

```bash
node .agents/skills/capture-ui-evidence/scripts/build-report.mjs --dir evidence/<YYYY-MM-DD-HH.MM>-<slug>
```

This embeds the responsive screenshots (and flow-step screenshots) as inline `data:` images into one self-contained `report.html` and prints its path. WebM recordings are never embedded (they would blow the artifact's size budget) — the report notes how many were captured; review them locally before merging. Then, in your own turn, call the `Artifact` tool with that `report.html` path to publish it and get back a URL. Finally write or replace the UI evidence link in the PR description with that URL:

```bash
node .agents/skills/capture-ui-evidence/scripts/update-pr-body.mjs --dir evidence/<YYYY-MM-DD-HH.MM>-<slug> --report-url <artifact-url>
```

Never publish `--storage-state`, trace/HAR, tokens, or student/customer content — screenshots embedded in the artifact are the only evidence that leaves your machine, and artifacts default to private until the reader is given the link.
