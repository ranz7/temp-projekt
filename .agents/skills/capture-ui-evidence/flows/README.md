# Evidence flows

Committed, reusable interaction flows for `ui-evidence --flow`. One JSON file per surface,
named after the `--surface` value (`marketing-home.json`, `app-course-list.json`, …).

A flow is an array of steps executed after page load, before metrics are read. The flow IS
the UX evidence: its interactions feed the INP measurement, its steps are timed individually,
and with `--video` the recording shows exactly this journey.

Rules:

- End with an `assert` step — the flow must prove the outcome ("Zapisano" toast visible),
  not just perform clicks.
- Prefer user-facing selectors (`text=`, `role=`) over CSS internals — flows double as
  living documentation of the journey.
- Multi-page journeys use `{ "action": "navigate", "url": "/relative/path" }` — relative
  URLs resolve against `--url`.
- Add `"screenshot": true` to steps whose intermediate state matters (each saves a
  `-stepNN.png` next to the main screenshots).
- Add `"minWidth": 768` to steps a narrower viewport must sit out - for a screen the
  product deliberately refuses to draw there, like the campaign board under 768px.
  The step is recorded as skipped rather than failing the run.
- Authenticated journeys use `--storage-state playwright/.auth/ui-evidence.json`; the CLI rejects repository-local state unless git ignores it.

Supported actions: `navigate`, `click`, `fill`, `press`, `hover`, `drag`, `dropFiles`, `select`,
`check`, `uncheck`, `upload`, `paste`, `assert` (state + optional text), `waitFor`, `wait`,
`scroll`.
`drag` presses the element's centre and releases at `toXPx`/`toYPx` (viewport pixels) or
`dxPx`/`dyPx` from where it started - a real pointer press-move-release, so it drives
pointer-event handlers that HTML5 drag-and-drop would never reach.
`paste` focuses the element and dispatches a cancelable `paste` event whose clipboard already
holds `files`, `text`, or both - reach for it when the journey is Cmd/Ctrl+V with a screenshot in
the clipboard, which never opens the file picker `upload` drives.
`dropFiles` fires `dragenter`, `dragover` and `drop` at the element with the files on the
`DataTransfer` - the HTML5 journey `drag` deliberately leaves alone; add `"hold": <ms>` to pause
between `dragover` and `drop` so a `--video` run shows the drop target lit.
Both read the bytes from disk and rebuild the files inside the page, resolve their paths the way
`upload` does, and fail the step when a path is not there.
Full syntax: `ui-evidence --help`.
