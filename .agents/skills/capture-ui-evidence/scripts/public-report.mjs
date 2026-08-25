import path from 'node:path'

const PUBLIC_METRICS_SCHEMA_VERSION = 2
const METRIC_NAMES = ['blockingTimeMs', 'cls', 'fcpMs', 'inpMs', 'lcpMs', 'requestCount']
const COUNT_NAMES = [
  'badResponseCount',
  'consoleErrorCount',
  'failedRequestCount',
  'pageErrorCount'
]

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function metric(value, suffix = '') {
  return value === null ? 'N/A' : `${value}${suffix}`
}

function requirePlainObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object`)
  }
  return value
}

function requireExactKeys(value, expected, label) {
  requirePlainObject(value, label)
  const actual = Object.keys(value).sort()
  const wanted = [...expected].sort()
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) {
    throw new Error(`${label} contains unsupported fields`)
  }
}

function requireBoolean(value, label) {
  if (typeof value !== 'boolean') throw new Error(`${label} must be a boolean`)
  return value
}

function requirePositiveInteger(value, label, maximum = Number.MAX_SAFE_INTEGER) {
  if (!Number.isSafeInteger(value) || value < 1 || value > maximum) {
    throw new Error(`${label} must be a positive integer`)
  }
  return value
}

function requireNonNegativeInteger(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative integer`)
  }
  return value
}

function requireMetric(value, label) {
  if (value === null) return null
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new Error(`${label} must be a non-negative finite number or null`)
  }
  return value
}

function requireArtifactName(value, extension, label) {
  if (
    typeof value !== 'string' ||
    value.length > 180 ||
    !new RegExp(`^[a-z0-9][a-z0-9._-]*\\.${extension}$`).test(value) ||
    path.posix.basename(value) !== value ||
    path.win32.basename(value) !== value
  ) {
    throw new Error(`${label} must be a safe .${extension} filename`)
  }
  return value
}

function projectPublicMetrics(metrics) {
  requirePlainObject(metrics, 'metrics.json')
  requireBoolean(metrics.pass, 'metrics.json pass')
  requirePositiveInteger(metrics.runs ?? 1, 'metrics.json runs', 9)
  if (
    !Array.isArray(metrics.results) ||
    metrics.results.length === 0 ||
    metrics.results.length > 20
  ) {
    throw new Error('metrics.json must contain between 1 and 20 results')
  }

  const results = metrics.results.map((result, resultIndex) => {
    requirePlainObject(result, `result ${resultIndex + 1}`)
    requirePlainObject(result.assessment, `result ${resultIndex + 1} assessment`)
    requirePlainObject(result.metrics, `result ${resultIndex + 1} metrics`)
    requirePlainObject(result.viewport, `result ${resultIndex + 1} viewport`)
    const publicMetrics = {
      badResponseCount: Array.isArray(result.metrics.badResponses)
        ? result.metrics.badResponses.length
        : null,
      blockingTimeMs: result.metrics.blockingTimeMs,
      cls: result.metrics.cls,
      consoleErrorCount: Array.isArray(result.metrics.consoleErrors)
        ? result.metrics.consoleErrors.length
        : null,
      failedRequestCount: Array.isArray(result.metrics.failedRequests)
        ? result.metrics.failedRequests.length
        : null,
      fcpMs: result.metrics.fcpMs,
      inpMs: result.metrics.inpMs,
      lcpMs: result.metrics.lcpMs,
      pageErrorCount: Array.isArray(result.metrics.pageErrors)
        ? result.metrics.pageErrors.length
        : null,
      requestCount: result.metrics.requestCount
    }
    for (const countName of COUNT_NAMES) {
      requireNonNegativeInteger(
        publicMetrics[countName],
        `result ${resultIndex + 1} metrics ${countName}`
      )
    }
    for (const metricName of METRIC_NAMES) {
      publicMetrics[metricName] = requireMetric(
        publicMetrics[metricName],
        `result ${resultIndex + 1} metrics ${metricName}`
      )
    }

    const stepTimings = result.stepTimings ?? []
    if (!Array.isArray(stepTimings)) {
      throw new Error(`result ${resultIndex + 1} stepTimings must be an array or null`)
    }
    const stepScreenshots = stepTimings
      .filter(step => step?.screenshot !== null && step?.screenshot !== undefined)
      .map((step, stepIndex) => ({
        screenshot: requireArtifactName(
          step.screenshot,
          'png',
          `result ${resultIndex + 1} step screenshot ${stepIndex + 1}`
        ),
        step: requirePositiveInteger(step.step, `result ${resultIndex + 1} screenshot step`, 999)
      }))

    return {
      assessmentPass: requireBoolean(
        result.assessment.pass,
        `result ${resultIndex + 1} assessment pass`
      ),
      metrics: publicMetrics,
      primaryScreenshot: requireArtifactName(
        result.screenshot,
        'png',
        `result ${resultIndex + 1} screenshot`
      ),
      stepScreenshots,
      video:
        result.video === null || result.video === undefined
          ? null
          : requireArtifactName(result.video, 'webm', `result ${resultIndex + 1} video`),
      viewport: {
        height: requirePositiveInteger(
          result.viewport.height,
          `result ${resultIndex + 1} viewport height`,
          10000
        ),
        width: requirePositiveInteger(
          result.viewport.width,
          `result ${resultIndex + 1} viewport width`,
          10000
        )
      }
    }
  })

  if (metrics.pass !== results.every(result => result.assessmentPass)) {
    throw new Error('metrics.json overall result disagrees with viewport assessments')
  }

  return {
    pass: metrics.pass,
    results,
    runs: metrics.runs ?? 1,
    schemaVersion: PUBLIC_METRICS_SCHEMA_VERSION,
    strict: metrics.strict === true
  }
}

function validatePublicMetrics(metrics) {
  requireExactKeys(
    metrics,
    ['pass', 'results', 'runs', 'schemaVersion', 'strict'],
    'public metrics'
  )
  if (metrics.schemaVersion !== PUBLIC_METRICS_SCHEMA_VERSION) {
    throw new Error(`Unsupported public metrics schema: ${metrics.schemaVersion}`)
  }
  requireBoolean(metrics.pass, 'public metrics pass')
  requireBoolean(metrics.strict, 'public metrics strict')
  requirePositiveInteger(metrics.runs, 'public metrics runs', 9)
  if (
    !Array.isArray(metrics.results) ||
    metrics.results.length === 0 ||
    metrics.results.length > 20
  ) {
    throw new Error('public metrics must contain between 1 and 20 results')
  }

  metrics.results.forEach((result, resultIndex) => {
    requireExactKeys(
      result,
      ['assessmentPass', 'metrics', 'primaryScreenshot', 'stepScreenshots', 'video', 'viewport'],
      `public result ${resultIndex + 1}`
    )
    requireBoolean(result.assessmentPass, `public result ${resultIndex + 1} assessmentPass`)
    requireExactKeys(
      result.metrics,
      [...COUNT_NAMES, ...METRIC_NAMES],
      `public result ${resultIndex + 1} metrics`
    )
    for (const countName of COUNT_NAMES) {
      requireNonNegativeInteger(
        result.metrics[countName],
        `public result ${resultIndex + 1} metrics ${countName}`
      )
    }
    for (const metricName of METRIC_NAMES) {
      requireMetric(
        result.metrics[metricName],
        `public result ${resultIndex + 1} metrics ${metricName}`
      )
    }
    requireArtifactName(
      result.primaryScreenshot,
      'png',
      `public result ${resultIndex + 1} primaryScreenshot`
    )
    if (result.video !== null) {
      requireArtifactName(result.video, 'webm', `public result ${resultIndex + 1} video`)
    }
    requireExactKeys(
      result.viewport,
      ['height', 'width'],
      `public result ${resultIndex + 1} viewport`
    )
    requirePositiveInteger(
      result.viewport.height,
      `public result ${resultIndex + 1} viewport height`,
      10000
    )
    requirePositiveInteger(
      result.viewport.width,
      `public result ${resultIndex + 1} viewport width`,
      10000
    )
    if (!Array.isArray(result.stepScreenshots) || result.stepScreenshots.length > 100) {
      throw new Error(`public result ${resultIndex + 1} stepScreenshots must be an array`)
    }
    result.stepScreenshots.forEach((step, stepIndex) => {
      requireExactKeys(
        step,
        ['screenshot', 'step'],
        `public result ${resultIndex + 1} step screenshot ${stepIndex + 1}`
      )
      requireArtifactName(
        step.screenshot,
        'png',
        `public result ${resultIndex + 1} step screenshot ${stepIndex + 1}`
      )
      requirePositiveInteger(
        step.step,
        `public result ${resultIndex + 1} step number ${stepIndex + 1}`,
        999
      )
    })
  })
  if (metrics.pass !== metrics.results.every(result => result.assessmentPass)) {
    throw new Error('public metrics overall result disagrees with viewport assessments')
  }
  return metrics
}

function referencedPublicArtifacts(metrics) {
  validatePublicMetrics(metrics)
  const primaryScreenshots = []
  const stepScreenshots = []
  const videos = []
  const seen = new Set()
  const add = (collection, filename) => {
    if (!filename || seen.has(filename)) return
    seen.add(filename)
    collection.push(filename)
  }
  for (const result of metrics.results) {
    add(primaryScreenshots, result.primaryScreenshot)
    for (const step of result.stepScreenshots) add(stepScreenshots, step.screenshot)
    add(videos, result.video)
  }
  return { primaryScreenshots, stepScreenshots, videos }
}

const SELF_CONTAINED_SCREENSHOT_BUDGET_BYTES = 12 * 1024 * 1024

function dataUri(buffer) {
  return `data:image/png;base64,${buffer.toString('base64')}`
}

function buildSelfContainedReport({
  metrics,
  prNumber,
  reportName,
  repository,
  screenshotData,
  sha
}) {
  validatePublicMetrics(metrics)
  const embedded = new Map()
  const omitted = new Set()
  let budgetBytes = 0
  const embed = filename => {
    if (embedded.has(filename) || omitted.has(filename)) return
    const buffer = screenshotData.get(filename)
    if (!buffer) throw new Error(`Screenshot data is missing for referenced artifact: ${filename}`)
    if (budgetBytes + buffer.byteLength > SELF_CONTAINED_SCREENSHOT_BUDGET_BYTES) {
      omitted.add(filename)
      return
    }
    budgetBytes += buffer.byteLength
    embedded.set(filename, dataUri(buffer))
  }
  for (const result of metrics.results) {
    embed(result.primaryScreenshot)
    for (const step of result.stepScreenshots) embed(step.screenshot)
  }

  const metricRows = metrics.results.map(result => {
    const values = result.metrics
    return `<tr>
      <td><span class="status ${result.assessmentPass ? 'pass' : 'fail'}">${result.assessmentPass ? 'PASS' : 'FAIL'}</span></td>
      <td>${escapeHtml(result.viewport.width)} px</td>
      <td>${escapeHtml(metric(values.fcpMs, ' ms'))}</td>
      <td>${escapeHtml(metric(values.lcpMs, ' ms'))}</td>
      <td>${escapeHtml(metric(values.cls))}</td>
      <td>${escapeHtml(metric(values.inpMs, ' ms'))}</td>
      <td>${escapeHtml(metric(values.blockingTimeMs, ' ms'))}</td>
      <td>${escapeHtml(metric(values.requestCount))}</td>
      <td>${escapeHtml(`${values.badResponseCount}/${values.consoleErrorCount}/${values.pageErrorCount}/${values.failedRequestCount}`)}</td>
    </tr>`
  })
  const screenshots = metrics.results.map(result => {
    const file = result.primaryScreenshot
    const source = embedded.get(file)
    return `<figure>
      ${source ? `<a href="${source}"><img src="${source}" alt="Viewport ${escapeHtml(result.viewport.width)} pixels" loading="lazy"></a>` : `<p class="omitted">Screenshot omitted (over size budget): ${escapeHtml(file)}</p>`}
      <figcaption>${escapeHtml(result.viewport.width)} × ${escapeHtml(result.viewport.height)}</figcaption>
    </figure>`
  })
  const stepGroups = metrics.results
    .filter(result => result.stepScreenshots.length > 0)
    .map(
      result => `<article class="step-group">
        <h3>${escapeHtml(result.viewport.width)} × ${escapeHtml(result.viewport.height)}</h3>
        <div class="gallery">${result.stepScreenshots
          .map(step => {
            const source = embedded.get(step.screenshot)
            return `<figure>
              ${source ? `<a href="${source}"><img src="${source}" alt="Viewport ${escapeHtml(result.viewport.width)} pixels, flow step ${escapeHtml(step.step)}" loading="lazy"></a>` : `<p class="omitted">Screenshot omitted (over size budget): ${escapeHtml(step.screenshot)}</p>`}
              <figcaption>Step ${escapeHtml(step.step)}</figcaption>
            </figure>`
          })
          .join('')}</div>
      </article>`
    )
  const videoCount = metrics.results.filter(result => result.video).length

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>UI evidence · PR #${prNumber}</title>
  <style>
    /* Every colour is stated on the element that uses it. The page is embedded
       in a host that paints its own background and sets its own text colour,
       and inheriting half of that palette is what turns this table into black
       on black. */
    :root {
      --ground: #09090b; --surface: #111113; --line: #27272a;
      --ink: #fafafa; --ink-muted: #a1a1aa; --link: #93c5fd;
      --pass-bg: #052e16; --pass-line: #166534; --pass-ink: #86efac;
      --fail-bg: #450a0a; --fail-line: #991b1b; --fail-ink: #fca5a5;
      /* Screenshots share one rendered height so a 1280-wide desktop shot and
         a 390-wide phone shot are read at the same scale. Width follows the
         aspect ratio; the row scrolls sideways inside its own container. */
      --shot-height: 560px;
      color-scheme: dark;
      font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: var(--ground); color: var(--ink);
    }
    @media (max-width: 700px) { :root { --shot-height: 380px; } }
    * { box-sizing: border-box; }
    body { background: var(--ground); color: var(--ink); margin: 0; }
    main { width: min(1180px, calc(100% - 32px)); margin: 0 auto; padding: 56px 0 80px; }
    header { margin-bottom: 32px; }
    .eyebrow { color: var(--ink-muted); font-size: 13px; font-weight: 650; letter-spacing: .08em; text-transform: uppercase; }
    h1, h2, h3 { color: var(--ink); }
    h1 { font-size: clamp(32px, 6vw, 64px); letter-spacing: -.055em; line-height: .98; margin: 10px 0 18px; }
    h2 { font-size: 24px; letter-spacing: -.025em; margin: 48px 0 16px; }
    h3 { margin: 0 0 12px; }
    p { color: var(--ink-muted); line-height: 1.6; }
    a { color: var(--link); }
    .summary { display: flex; flex-wrap: wrap; gap: 10px; }
    .pill, .status { background: var(--surface); border: 1px solid var(--line); border-radius: 999px; color: var(--ink); display: inline-flex; font-size: 12px; font-weight: 700; padding: 6px 10px; }
    .pass { background: var(--pass-bg); border-color: var(--pass-line); color: var(--pass-ink); }
    .fail { background: var(--fail-bg); border-color: var(--fail-line); color: var(--fail-ink); }
    .panel { background: var(--surface); border: 1px solid var(--line); border-radius: 20px; overflow: hidden; }
    .table-wrap { overflow-x: auto; }
    table { background: var(--surface); border-collapse: collapse; color: var(--ink); min-width: 900px; width: 100%; }
    th, td { background: var(--surface); border-bottom: 1px solid var(--line); color: var(--ink); padding: 14px 16px; text-align: left; white-space: nowrap; }
    th { color: var(--ink-muted); font-size: 12px; letter-spacing: .04em; text-transform: uppercase; }
    tr:last-child td { border-bottom: 0; }
    .gallery { align-items: flex-start; display: flex; gap: 16px; overflow-x: auto; padding-bottom: 8px; }
    .gallery > figure { flex: 0 0 auto; max-width: none; }
    figure, .step-group { background: var(--surface); border: 1px solid var(--line); border-radius: 20px; color: var(--ink); margin: 0; padding: 12px; }
    .step-group { overflow: hidden; }
    figure img { background: #fff; border-radius: 12px; display: block; height: var(--shot-height); width: auto; }
    figcaption { color: var(--ink-muted); font-size: 13px; padding: 12px 4px 2px; }
    .omitted { font-size: 13px; }
    .steps { display: grid; gap: 16px; }
    .step-group .gallery { margin-top: 8px; }
    footer { border-top: 1px solid var(--line); margin-top: 56px; padding-top: 20px; }
  </style>
</head>
<body>
  <main>
    <header>
      <div class="eyebrow">AlgoAcademy UI evidence · ${escapeHtml(repository)} · PR #${prNumber}</div>
      <h1>${escapeHtml(reportName)}</h1>
      <div class="summary">
        <span class="status ${metrics.pass ? 'pass' : 'fail'}">${metrics.pass ? 'PASS' : 'FAIL'}</span>
        <span class="pill">commit ${escapeHtml(sha.slice(0, 7))}</span>
        <span class="pill">${escapeHtml(metrics.runs)} run(s) / viewport</span>
      </div>
      <p>Sanitized deterministic lab capture. INP is the worst interaction latency observed in the recorded flow.</p>
      <p>${
        metrics.strict
          ? 'Strict run: paint timings, page weight and request count decide the verdict alongside the error counts.'
          : 'The verdict counts broken requests, page errors and console errors. Paint timings, page weight and request count are measured but do not gate: this ran against a development server, which compiles on demand and serves every module as its own request.'
      }</p>
    </header>

    <section>
      <h2>Performance budget</h2>
      <div class="panel table-wrap">
        <table>
          <thead><tr><th>Result</th><th>Viewport</th><th>FCP</th><th>LCP</th><th>CLS</th><th>INP</th><th>Blocking</th><th>Requests</th><th>HTTP / console / page / request</th></tr></thead>
          <tbody>${metricRows.join('')}</tbody>
        </table>
      </div>
    </section>

    <section>
      <h2>Responsive screenshots</h2>
      <div class="gallery">${screenshots.join('')}</div>
    </section>

    ${stepGroups.length > 0 ? `<section><h2>Flow step screenshots</h2><div class="steps">${stepGroups.join('')}</div></section>` : ''}

    <footer><p>Screenshots are embedded inline; this page is self-contained and requires no external host.${videoCount > 0 ? ` ${videoCount} interaction recording(s) were captured for this run but are not embedded here (they would exceed the artifact size budget) - review them locally in the evidence directory before merging.` : ''}</p></footer>
  </main>
</body>
</html>`
}

export {
  buildSelfContainedReport,
  projectPublicMetrics,
  referencedPublicArtifacts,
  SELF_CONTAINED_SCREENSHOT_BUDGET_BYTES,
  validatePublicMetrics
}
