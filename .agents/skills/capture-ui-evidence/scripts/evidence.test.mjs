import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdir, mkdtemp, readdir, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import test, { after } from 'node:test'
import {
  assertNoTrackedDiagnostics,
  readScreenshotData,
  resolveEvidenceDirectory
} from './build-report.mjs'
import {
  assess,
  captureViewport,
  captureViewportOnce,
  combineDocumentMetrics,
  DEFAULT_BUDGETS,
  findBaseline,
  installPerformanceObservers,
  median,
  prepareDiagnosticsDirectory,
  redactUrl,
  resolveDiagnosticsDirectory,
  resolvePlaywright,
  runFlow,
  snapshotMetrics,
  validateStorageStatePath
} from './capture.mjs'
import {
  buildSelfContainedReport,
  projectPublicMetrics,
  referencedPublicArtifacts,
  SELF_CONTAINED_SCREENSHOT_BUDGET_BYTES
} from './public-report.mjs'
import { applyEvidenceLine, buildEvidenceLine } from './update-pr-body.mjs'

const measuredMetrics = {
  badResponses: [],
  blockingTimeMs: 0,
  cls: 0,
  consoleErrors: [],
  failedRequests: [],
  fcpMs: 500,
  inpMs: null,
  lcpMs: 800,
  pageErrors: [],
  requestCount: 1,
  transferBytes: 100
}

test('enabled budgets fail when a metric is unavailable', () => {
  const result = assess({ ...measuredMetrics, fcpMs: null }, { fcpMs: 1800 })

  assert.equal(result.pass, false)
  assert.equal(result.checks.find(check => check.name === 'fcpMs').pass, false)
})

test('a development run gates on errors, not on paint timings or page weight', () => {
  const result = assess(
    { ...measuredMetrics, fcpMs: 9000, requestCount: 400 },
    { ...DEFAULT_BUDGETS },
    false
  )

  assert.equal(result.pass, true)
  assert.equal(result.checks.find(check => check.name === 'fcpMs').pass, false)
  assert.equal(result.checks.find(check => check.name === 'fcpMs').enforced, false)
  assert.equal(result.checks.find(check => check.name === 'consoleErrors').enforced, true)
})

test('a development run still fails on a console error', () => {
  const result = assess(
    { ...measuredMetrics, consoleErrors: ['boom'] },
    { ...DEFAULT_BUDGETS },
    false
  )

  assert.equal(result.pass, false)
})

test('a strict run gates on paint timings too', () => {
  const result = assess({ ...measuredMetrics, fcpMs: 9000 }, { ...DEFAULT_BUDGETS }, true)

  assert.equal(result.pass, false)
})

test('null budgets disable their metric check', () => {
  const result = assess({ ...measuredMetrics, fcpMs: null }, { fcpMs: null })

  assert.equal(result.pass, true)
})

test('multi-run medians fail closed when any sample is unavailable', () => {
  assert.equal(median([null, null, 100]), null)
  assert.equal(median([100, 200, 300]), 200)
})

test('persisted URLs retain only the origin', () => {
  assert.equal(
    redactUrl('https://user:secret@example.com/reset/token?signature=secret#account'),
    'https://example.com/'
  )
  assert.equal(redactUrl('not a URL'), '[redacted-url]')
})

test('default baseline uses only matching evidence committed in HEAD', async () => {
  const repository = await mkdtemp(path.join(process.cwd(), '.ui-evidence-baseline-'))
  const git = args => execFileSync('git', args, { cwd: repository, encoding: 'utf8' }).trim()
  const previous = path.join(repository, 'evidence', 'previous', 'metrics.json')
  const untracked = path.join(repository, 'evidence', 'untracked', 'metrics.json')

  try {
    await mkdir(path.dirname(previous), { recursive: true })
    await writeFile(
      previous,
      JSON.stringify({ generatedAt: '2026-08-01T00:00:00.000Z', results: [], surface: 'home' })
    )
    git(['init', '-q'])
    git(['add', 'evidence/previous/metrics.json'])
    git([
      '-c',
      'user.name=UI Evidence Test',
      '-c',
      'user.email=ui-evidence@example.com',
      'commit',
      '-qm',
      'add baseline'
    ])
    const sha = git(['rev-parse', 'HEAD'])

    await mkdir(path.dirname(untracked), { recursive: true })
    await writeFile(
      untracked,
      JSON.stringify({ generatedAt: '2099-01-01T00:00:00.000Z', results: [], surface: 'home' })
    )

    const baseline = await findBaseline(
      {
        baselinePath: null,
        noBaseline: false,
        outDir: path.join(repository, 'evidence', 'current'),
        surface: 'home'
      },
      { root: repository, sha }
    )

    assert.equal(baseline.source, 'evidence/previous/metrics.json')
    assert.equal(baseline.sha, sha)
    assert.equal(baseline.report.generatedAt, '2026-08-01T00:00:00.000Z')
  } finally {
    await rm(repository, { force: true, recursive: true })
  }
})

test('repository-local storage state must be ignored and untracked', async () => {
  const repository = await mkdtemp(path.join(process.cwd(), '.ui-evidence-auth-'))
  const git = args => execFileSync('git', args, { cwd: repository, stdio: 'pipe' })
  const tracked = path.join(repository, 'tracked-state.json')
  const unignored = path.join(repository, 'state.json')
  const ignored = path.join(repository, 'playwright', '.auth', 'ui-evidence.json')

  try {
    await writeFile(path.join(repository, '.gitignore'), 'playwright/.auth/\n')
    await writeFile(tracked, '{}\n')
    git(['init', '-q'])
    git(['add', '.gitignore', 'tracked-state.json'])
    git([
      '-c',
      'user.name=UI Evidence Test',
      '-c',
      'user.email=ui-evidence@example.com',
      'commit',
      '-qm',
      'add auth policy'
    ])
    await writeFile(unignored, '{}\n')
    await mkdir(path.dirname(ignored), { recursive: true })
    await writeFile(ignored, '{}\n')

    await assert.rejects(validateStorageStatePath(tracked, repository), /must not be tracked/)
    await assert.rejects(validateStorageStatePath(unignored, repository), /must be ignored/)
    await assert.doesNotReject(validateStorageStatePath(ignored, repository))
  } finally {
    await rm(repository, { force: true, recursive: true })
  }
})

test('buildEvidenceLine renders a marker line and a markdown link with status and short sha', () => {
  const sha = 'abcdef1234567890'
  const reportUrl = 'https://claude.ai/code/artifact/deadbeef'
  const line = buildEvidenceLine({ pass: true, reportUrl, sha })

  assert.equal(
    line,
    `<!-- algoacademy-ui-evidence -->\n[UI evidence](${reportUrl}) - PASS - commit \`${sha.slice(0, 7)}\``
  )

  const failed = buildEvidenceLine({ pass: false, reportUrl, sha })
  assert.match(failed, /\]\([^)]+\) - FAIL - commit `abcdef1`/)
})

test('applyEvidenceLine appends a first evidence line after a blank separator', () => {
  const existing = '## Summary\n\nShip the assistant panel layout.'
  const evidenceLine = buildEvidenceLine({
    pass: true,
    reportUrl: 'https://example.com/report',
    sha: '111111122222222'
  })
  const next = applyEvidenceLine(existing, evidenceLine)

  assert.equal(next, `${existing}\n\n${evidenceLine}`)
  assert.equal(next.slice(0, existing.length), existing)
})

test('applyEvidenceLine replaces only the evidence line and keeps surrounding body bytes', () => {
  const before = '## Risk Assessment\n\n**Level:** Low\n**Rationale:** layout only.\n\n'
  const after = '\n\n## Test plan\n\nOpen the assistant panel on desktop.\n'
  const previous = buildEvidenceLine({
    pass: false,
    reportUrl: 'https://example.com/old-report',
    sha: 'aaaaaaa11111111'
  })
  const nextLine = buildEvidenceLine({
    pass: true,
    reportUrl: 'https://example.com/new-report',
    sha: 'bbbbbbb22222222'
  })
  const body = `${before}${previous}${after}`
  const next = applyEvidenceLine(body, nextLine)

  assert.equal(next, `${before}${nextLine}${after}`)
  assert.equal(next.slice(0, before.length), before)
  assert.equal(next.slice(next.length - after.length), after)
})

test('applyEvidenceLine on an empty or null body returns just the evidence line', () => {
  const evidenceLine = buildEvidenceLine({
    pass: true,
    reportUrl: 'https://example.com/report',
    sha: 'cccccccc3333333'
  })

  assert.equal(applyEvidenceLine('', evidenceLine), evidenceLine)
  assert.equal(applyEvidenceLine(null, evidenceLine), evidenceLine)
})

test('applyEvidenceLine is idempotent when the same evidence line is applied twice', () => {
  const existing = '## Risk Assessment\n\n**Level:** Low\n'
  const evidenceLine = buildEvidenceLine({
    pass: true,
    reportUrl: 'https://example.com/report',
    sha: 'ddddddd4444444'
  })
  const once = applyEvidenceLine(existing, evidenceLine)
  const twice = applyEvidenceLine(once, evidenceLine)

  assert.equal(twice, once)
})

test('build-report rejects trace and HAR diagnostics found in the evidence directory', () => {
  assert.throws(
    () => assertNoTrackedDiagnostics(['metrics.json', 'surface.har'], 'evidence/capture'),
    /must not be embedded/
  )
  assert.throws(
    () =>
      assertNoTrackedDiagnostics(
        ['evidence/capture/private/surface-trace.zip'],
        'evidence/capture'
      ),
    /must not be embedded/
  )
  assert.doesNotThrow(() =>
    assertNoTrackedDiagnostics(['metrics.json', 'surface.png'], 'evidence/capture')
  )
})

test('trace and HAR diagnostics resolve outside evidence to an ignored path', async () => {
  const repositoryRoot = await mkdtemp(path.join(process.cwd(), '.ui-evidence-diagnostics-test-'))
  const git = args => execFileSync('git', args, { cwd: repositoryRoot, stdio: 'pipe' })
  try {
    await writeFile(path.join(repositoryRoot, '.gitignore'), '/.ui-evidence-diagnostics/\n')
    git(['init', '-q'])
    git(['add', '.gitignore'])
    git([
      '-c',
      'user.name=UI Evidence Test',
      '-c',
      'user.email=ui-evidence@example.com',
      'commit',
      '-qm',
      'ignore diagnostics'
    ])
    const repository = {
      root: repositoryRoot,
      sha: git(['rev-parse', 'HEAD']).toString().trim()
    }
    const outDir = path.join(repositoryRoot, 'evidence', 'capture')
    await mkdir(outDir, { recursive: true })
    const resolved = resolveDiagnosticsDirectory(
      { diagnosticsDir: null, har: true, outDir, trace: true },
      repository
    )

    assert.equal(
      resolved,
      path.join(repositoryRoot, '.ui-evidence-diagnostics', 'evidence', 'capture')
    )
    assert.equal(
      await prepareDiagnosticsDirectory(
        { diagnosticsDir: null, har: true, outDir, trace: true },
        repository
      ),
      resolved
    )
    assert.throws(
      () =>
        resolveDiagnosticsDirectory(
          {
            diagnosticsDir: path.join(repositoryRoot, 'diagnostics'),
            har: true,
            outDir,
            trace: false
          },
          repository
        ),
      /must be ignored by git/
    )

    await rm(path.join(repositoryRoot, '.ui-evidence-diagnostics'), {
      force: true,
      recursive: true
    })
    await symlink(outDir, path.join(repositoryRoot, '.ui-evidence-diagnostics'))
    await assert.rejects(
      prepareDiagnosticsDirectory(
        { diagnosticsDir: null, har: true, outDir, trace: false },
        repository
      ),
      /must not traverse a symbolic link|must be ignored by git/
    )
  } finally {
    await rm(repositoryRoot, { force: true, recursive: true })
  }
})

test('CLS uses the largest valid session window', () => {
  const originalPerformanceObserver = globalThis.PerformanceObserver
  const originalWindow = globalThis.window
  const observers = new Map()

  globalThis.window = {}
  globalThis.PerformanceObserver = class {
    constructor(callback) {
      this.callback = callback
    }

    observe(options) {
      observers.set(options.type, this.callback)
    }
  }

  try {
    installPerformanceObservers()
    observers.get('layout-shift')({
      getEntries: () => [
        { hadRecentInput: false, startTime: 0, value: 0.05 },
        { hadRecentInput: false, startTime: 500, value: 0.04 },
        { hadRecentInput: false, startTime: 1600, value: 0.08 },
        { hadRecentInput: false, startTime: 2000, value: 0.02 },
        { hadRecentInput: true, startTime: 2200, value: 0.5 },
        { hadRecentInput: false, startTime: 7000, value: 0.09 }
      ]
    })

    assert.equal(globalThis.window.__algoUiEvidence.cls, 0.1)
  } finally {
    if (originalPerformanceObserver === undefined) delete globalThis.PerformanceObserver
    else globalThis.PerformanceObserver = originalPerformanceObserver
    if (originalWindow === undefined) delete globalThis.window
    else globalThis.window = originalWindow
  }
})

test('interaction observations report to a collector that outlives document replacement', () => {
  const originalPerformanceObserver = globalThis.PerformanceObserver
  const originalWindow = globalThis.window
  const reported = []

  try {
    for (const duration of [240, 80]) {
      const observers = new Map()
      globalThis.window = {
        __algoUiEvidenceReportInteraction: interaction => reported.push(interaction)
      }
      globalThis.PerformanceObserver = class {
        constructor(callback) {
          this.callback = callback
        }

        observe(options) {
          observers.set(options.type, this.callback)
        }
      }
      installPerformanceObservers()
      observers.get('event')({
        getEntries: () => [{ duration, interactionId: duration, name: 'click', startTime: 10 }]
      })
    }

    assert.deepEqual(
      reported.map(interaction => interaction.duration),
      [240, 80]
    )
  } finally {
    if (originalPerformanceObserver === undefined) delete globalThis.PerformanceObserver
    else globalThis.PerformanceObserver = originalPerformanceObserver
    if (originalWindow === undefined) delete globalThis.window
    else globalThis.window = originalWindow
  }
})

test('publisher selects only artifacts referenced by metrics', () => {
  const artifacts = referencedPublicArtifacts(
    projectPublicMetrics({
      pass: true,
      runs: 1,
      results: [
        {
          assessment: { pass: true },
          metrics: measuredMetrics,
          screenshot: 'surface-w390.png',
          stepTimings: [{ screenshot: 'surface-w390-step02.png', step: 2 }],
          video: null,
          viewport: { height: 844, width: 390 }
        },
        {
          assessment: { pass: true },
          metrics: measuredMetrics,
          screenshot: 'surface-w1440.png',
          stepTimings: [],
          video: 'surface-w1440.webm',
          viewport: { height: 900, width: 1440 }
        }
      ]
    })
  )

  assert.deepEqual(artifacts, {
    primaryScreenshots: ['surface-w390.png', 'surface-w1440.png'],
    stepScreenshots: ['surface-w390-step02.png'],
    videos: ['surface-w1440.webm']
  })
})

test('report builder rejects screenshots missing from the evidence directory', async () => {
  const source = await mkdtemp(path.join(process.cwd(), '.ui-evidence-source-'))
  try {
    await assert.rejects(readScreenshotData(source, ['missing.png']), /ENOENT|no such file/)
  } finally {
    await rm(source, { force: true, recursive: true })
  }
})

test('self-contained report embeds screenshots as data URIs, escapes metadata, and notes omitted recordings', () => {
  const metrics = projectPublicMetrics({
    pass: true,
    results: [
      {
        assessment: { pass: true },
        metrics: measuredMetrics,
        screenshot: 'surface-w390.png',
        stepTimings: [{ screenshot: 'surface-w390-step02.png', step: 2 }],
        video: 'surface-w390.webm',
        viewport: { height: 844, width: 390 }
      }
    ],
    runs: 1
  })
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1])
  const screenshotData = new Map([
    ['surface-w390.png', png],
    ['surface-w390-step02.png', png]
  ])
  const html = buildSelfContainedReport({
    metrics,
    prNumber: 865,
    reportName: 'evidence/<unsafe>',
    repository: 'AlgoAcademyPL/algoacademy.pl',
    screenshotData,
    sha: 'a'.repeat(40)
  })

  assert.match(html, new RegExp(`data:image/png;base64,${png.toString('base64')}`))
  assert.match(html, /evidence\/&lt;unsafe&gt;/)
  assert.doesNotMatch(html, /evidence\/<unsafe>/)
  assert.match(html, /Flow step screenshots/)
  assert.match(html, /Step 2/)
  assert.match(html, /1 interaction recording\(s\) were captured/)
  assert.doesNotMatch(html, /<video/)
})

test('self-contained report omits screenshots that exceed the embedding budget', () => {
  const metrics = projectPublicMetrics({
    pass: true,
    results: [
      {
        assessment: { pass: true },
        metrics: measuredMetrics,
        screenshot: 'surface-w390.png',
        stepTimings: [],
        video: null,
        viewport: { height: 844, width: 390 }
      }
    ],
    runs: 1
  })
  const oversized = Buffer.alloc(SELF_CONTAINED_SCREENSHOT_BUDGET_BYTES + 1)
  const html = buildSelfContainedReport({
    metrics,
    prNumber: 865,
    reportName: 'evidence/home',
    repository: 'AlgoAcademyPL/algoacademy.pl',
    screenshotData: new Map([['surface-w390.png', oversized]]),
    sha: 'a'.repeat(40)
  })

  assert.match(html, /Screenshot omitted \(over size budget\): surface-w390\.png/)
  assert.doesNotMatch(html, /data:image\/png/)
})

test('public metrics projection omits raw diagnostics and URL metadata', () => {
  const projected = projectPublicMetrics({
    pass: true,
    results: [
      {
        assessment: { pass: true },
        metrics: {
          ...measuredMetrics,
          consoleErrors: ['token=secret'],
          failedRequests: [{ url: 'https://example.com/student/42' }]
        },
        screenshot: 'surface-w390.png',
        serverTimings: [{ name: 'sql', value: 'student@example.com' }],
        stepTimings: [{ screenshot: 'surface-w390-step02.png', selector: '#student', step: 2 }],
        traceId: 'secret-trace',
        video: null,
        viewport: { height: 844, width: 390 }
      }
    ],
    runs: 1,
    url: 'https://example.com/student/42?token=secret'
  })
  const serialized = JSON.stringify(projected)

  assert.equal(projected.results[0].metrics.consoleErrorCount, 1)
  assert.equal(projected.results[0].metrics.failedRequestCount, 1)
  assert.doesNotMatch(serialized, /secret|student|trace|serverTiming|https:/)
})

test('evidence directory resolution rejects a symlink outside the repository', async () => {
  const repository = await mkdtemp(path.join(process.cwd(), '.ui-evidence-repository-'))
  const outside = await mkdtemp(path.join(process.cwd(), '.ui-evidence-outside-'))
  try {
    await symlink(outside, path.join(repository, 'evidence-link'))
    await assert.rejects(
      resolveEvidenceDirectory(repository, 'evidence-link'),
      /regular directory, not a symbolic link/
    )
  } finally {
    await rm(repository, { force: true, recursive: true })
    await rm(outside, { force: true, recursive: true })
  }
})

test('publisher deployment shares one implementation and one ops filesystem', {
  skip: 'infra/ is not in this repository'
}, async () => {
  const [
    devboxVariables,
    omnigentVariables,
    publisherTasks,
    devboxTasks,
    omnigentTasks,
    omnigentCompose,
    caddyfile,
    devboxScenario,
    omnigentScenario
  ] = await Promise.all([
    readFile('infra/devbox/ansible/group_vars/devbox/main.yml', 'utf8'),
    readFile('infra/omnigent/ansible/group_vars/omnigent/main.yml', 'utf8'),
    readFile('infra/ansible/capabilities/install-ui-evidence-publisher/tasks/main.yml', 'utf8'),
    readFile('infra/devbox/ansible/capabilities/install-ui-evidence/tasks/main.yml', 'utf8'),
    readFile('infra/omnigent/ansible/capabilities/deploy-omnigent-host/tasks/main.yml', 'utf8'),
    readFile(
      'infra/omnigent/ansible/capabilities/deploy-omnigent-host/templates/host.compose.yml.j2',
      'utf8'
    ),
    readFile(
      'infra/omnigent/ansible/capabilities/deploy-caddy-edge/templates/Caddyfile.j2',
      'utf8'
    ),
    readFile('infra/devbox/ansible/scenarios/setup-devbox.yml', 'utf8'),
    readFile('infra/omnigent/ansible/scenarios/setup-omnigent.yml', 'utf8')
  ])

  for (const variables of [devboxVariables, omnigentVariables]) {
    assert.match(variables, /ui_evidence_staging_root: "{{ .*ui_evidence_ops_root }}\/staging"/)
    assert.match(variables, /ui_evidence_intake_root: "{{ .*ui_evidence_ops_root }}\/intake"/)
    assert.match(variables, /ui_evidence_public_root: "{{ .*ui_evidence_ops_root }}\/public"/)
  }
  assert.match(omnigentVariables, /expected_validation_failures:/)
  assert.match(omnigentVariables, /omnigent_ui_evidence_ops_package_root:/)
  assert.doesNotMatch(omnigentTasks, /Normalize GitHub .* validation errors/)
  assert.match(
    omnigentTasks,
    /contents_write_validation\s+== omnigent_github_permission_validation_contract\.expected_validation_failures\.contents/
  )
  const dependencyTask = omnigentTasks.split(
    '- name: Install Chromium system libs inside host container (root)'
  )[1]
  assert.match(dependencyTask, /omnigent_ui_evidence_ops_package_root/)
  assert.match(dependencyTask, /\/opt\/algo-runtime\/bin\/node/)
  assert.match(dependencyTask, /PATH={{ omnigent_root_runtime_path }}/)
  assert.doesNotMatch(dependencyTask, /omnigent_ui_evidence_root.*install-deps/)
  const devboxDependencyTask = devboxTasks.split(
    '- name: Install Chromium OS dependencies for browser evidence'
  )[1]
  assert.match(devboxDependencyTask, /devbox_ui_evidence_ops_package_root/)
  assert.match(devboxDependencyTask, /\/usr\/local\/bin\/node/)
  assert.doesNotMatch(devboxDependencyTask, /devbox_ui_evidence_root.*install-deps/)
  const stagingTask = publisherTasks
    .split('- name: Ensure UI evidence staging root exists')[1]
    .split('- name: Ensure UI evidence intake root exists')[0]
  assert.ok(stagingTask.includes('owner: root'))
  assert.ok(
    stagingTask.includes('group: "{{ ui_evidence_process_group_entry.stdout.split(\':\')[2] }}"')
  )
  assert.ok(stagingTask.includes('mode: "2730"'))
  assert.match(publisherTasks, /User={{ ui_evidence_service_user }}/)
  assert.match(publisherTasks, /ProtectHome=true/)
  assert.match(publisherTasks, /InaccessiblePaths=-\/run\/docker\.sock/)
  assert.match(publisherTasks, /ui_evidence_runtime_root.*ui_evidence_node_dist.*bin\/node/)
  assert.match(
    publisherTasks,
    /ReadWritePaths={{ ui_evidence_staging_root }} {{ ui_evidence_intake_root }} {{ ui_evidence_public_root }} \/run\/algo-ui-evidence/
  )
  assert.doesNotMatch(publisherTasks, /ReadWritePaths={{ ui_evidence_ops_root }}/)
  assert.doesNotMatch(devboxTasks, /algo-ui-evidence-publisher\.service/)
  assert.doesNotMatch(omnigentTasks, /algo-ui-evidence-publisher\.service/)
  assert.match(
    omnigentCompose,
    /{{ omnigent_ui_evidence_staging_root }}:{{ omnigent_ui_evidence_staging_root }}:rw/
  )
  assert.match(omnigentCompose, /{{ omnigent_ops_node_root }}:\/opt\/algo-runtime:ro/)
  assert.ok(caddyfile.includes('directory/(?:[A-Za-z0-9_-]+/)+'))
  assert.ok(caddyfile.includes('publication\\.json'))
  assert.match(devboxScenario, /role: install-ui-evidence-publisher/)
  assert.match(devboxScenario, /ui_evidence_node_version: "{{ devbox_node_version }}"/)
  assert.match(omnigentScenario, /role: install-ui-evidence-publisher/)
  assert.match(omnigentScenario, /ui_evidence_node_version: "{{ omnigent_node_version }}"/)
})

test('managed Bun runtimes use repository-pinned archive checksums', {
  skip: 'infra/ is not in this repository'
}, async () => {
  const [devboxVariables, devboxRuntime, omnigentVariables, omnigentTasks] = await Promise.all([
    readFile('infra/devbox/ansible/group_vars/devbox/main.yml', 'utf8'),
    readFile('infra/devbox/ansible/capabilities/install-runtime/tasks/main.yml', 'utf8'),
    readFile('infra/omnigent/ansible/group_vars/omnigent/main.yml', 'utf8'),
    readFile('infra/omnigent/ansible/capabilities/deploy-omnigent-host/tasks/main.yml', 'utf8')
  ])

  for (const variables of [devboxVariables, omnigentVariables]) {
    assert.match(variables, /bun_checksums:/)
    assert.match(variables, /aarch64: [0-9a-f]{64}/)
    assert.match(variables, /x86_64: [0-9a-f]{64}/)
  }
  for (const tasks of [devboxRuntime, omnigentTasks]) {
    assert.match(tasks, /releases\/download\/bun-v{{ .*bun_version }}/)
    assert.match(tasks, /checksum: "sha256:{{ .*bun_checksums/)
    assert.doesNotMatch(tasks, /curl -fsSL https:\/\/bun\.sh\/install \| bash/)
  }
})

test('general test safeguards remain discoverable outside backend integration files', {
  skip: '.cursor/rules from the source skill repo are not present here'
}, async () => {
  const [generalRule, backendRule] = await Promise.all([
    readFile('.cursor/rules/advanced/testing-best-practices.mdc', 'utf8'),
    readFile('.cursor/rules/backend/integration-testing-patterns.mdc', 'utf8')
  ])

  assert.doesNotMatch(generalRule, /^globs:/m)
  assert.match(generalRule, /Mock the complete structure/)
  assert.match(generalRule, /Never mock the database/)
  assert.match(backendRule, /^globs: packages\/backend\/src\/modules\/.*integration\.test\.ts/m)
})

test('bulk-write gate evaluates every chain independently', async () => {
  const directory = await mkdtemp(path.join(process.cwd(), '.bulk-write-gate-'))
  const guarded = path.join(directory, 'guarded.ts')
  const unguarded = path.join(directory, 'unguarded.ts')
  try {
    await writeFile(guarded, 'await db.update(users).set(values).where(eq(users.id, id))\n')
    await writeFile(unguarded, 'await db.delete(users)\n')
    let error = null
    try {
      execFileSync(
        'bun',
        ['.agents/skills/algo-review-branch/scripts/check-bulk-writes.mjs', guarded, unguarded],
        { encoding: 'utf8' }
      )
    } catch (caught) {
      error = caught
    }
    assert.ok(error)
    assert.ok(error.stdout.includes(`CHECK: ${unguarded}:1`))
    assert.ok(!error.stdout.includes(guarded))
  } finally {
    await rm(directory, { force: true, recursive: true })
  }
})

test('environment wizard JSON helper preserves settings and upserts secrets', async () => {
  const directory = await mkdtemp(path.join(process.cwd(), '.setup-env-helper-'))
  const settings = path.join(directory, 'settings.local.json')
  const harness = path.join(directory, 'harness.sh')
  try {
    const template = await readFile('.agents/skills/algo-setup-env/template.sh', 'utf8')
    const library = template.split(
      '# ──────────────────────────────────────────────────────────────────────────\n# STAGES'
    )[0]
    await writeFile(settings, '{"permissions":{"allow":["Read"]}}\n')
    await writeFile(
      harness,
      `${library}\nwrite_json "$1" env.ALGOACADEMY_API_KEY first\nwrite_json "$1" env.ALGOACADEMY_API_KEY second\n`
    )
    execFileSync('bash', ['-n', harness])
    execFileSync('bash', [harness, settings], { stdio: 'pipe' })

    const document = JSON.parse(await readFile(settings, 'utf8'))
    assert.deepEqual(document.permissions, { allow: ['Read'] })
    assert.equal(document.env.ALGOACADEMY_API_KEY, 'second')
  } finally {
    await rm(directory, { force: true, recursive: true })
  }
})

test('report builder reads only referenced screenshots and rejects a symlinked one', async () => {
  const source = await mkdtemp(path.join(process.cwd(), '.ui-evidence-source-'))
  try {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1])
    await writeFile(path.join(source, 'surface-w390.png'), png)
    await writeFile(path.join(source, 'surface-w390-step02.png'), png)
    await writeFile(path.join(source, 'private-storage-state.json'), 'secret')

    const data = await readScreenshotData(source, ['surface-w390.png', 'surface-w390-step02.png'])
    assert.deepEqual([...data.keys()].sort(), ['surface-w390-step02.png', 'surface-w390.png'])
    assert.deepEqual(data.get('surface-w390.png'), png)

    await symlink(
      path.join(source, 'surface-w390.png'),
      path.join(source, 'surface-w390-symlink.png')
    )
    await assert.rejects(
      readScreenshotData(source, ['surface-w390-symlink.png']),
      /non-regular artifact/
    )
  } finally {
    await rm(source, { force: true, recursive: true })
  }
})

test('metric snapshots stay fixed after video-only activity', () => {
  const liveMetrics = {
    badResponses: [{ status: 404, url: 'https://example.com/missing' }],
    consoleErrors: ['before cutoff'],
    failedRequests: [],
    pageErrors: [],
    requestCount: 2,
    transferBytes: 300
  }
  const metrics = snapshotMetrics({
    browserMetrics: {
      evidence: { cls: 0.01, lcpMs: 700, longTasks: [{ duration: 75, startTime: 10 }] },
      navigation: { domContentLoadedEventEnd: 400, duration: 800, loadEventEnd: 600 },
      paints: { 'first-contentful-paint': 500 },
      resourceCount: 2
    },
    cdpMetrics: { JSHeapUsedSize: 1024, Nodes: 20 },
    endedAt: 1800,
    liveMetrics,
    startedAt: 1000
  })

  liveMetrics.badResponses.push({ status: 500, url: 'https://example.com/video' })
  liveMetrics.consoleErrors.push('during video')
  liveMetrics.failedRequests.push({ error: 'failed', method: 'GET', url: 'https://example.com' })
  liveMetrics.pageErrors.push('during video')
  liveMetrics.requestCount += 10
  liveMetrics.transferBytes += 5000

  assert.deepEqual(metrics.badResponses, [{ status: 404, url: 'https://example.com/missing' }])
  assert.deepEqual(metrics.consoleErrors, ['before cutoff'])
  assert.deepEqual(metrics.failedRequests, [])
  assert.deepEqual(metrics.pageErrors, [])
  assert.equal(metrics.requestCount, 2)
  assert.equal(metrics.transferBytes, 300)
  assert.equal(metrics.wallTimeMs, 800)
})

test('multi-page journeys aggregate every document at one measurement boundary', () => {
  const combined = combineDocumentMetrics([
    {
      evidence: {
        cls: 0.02,
        interactions: [{ duration: 80 }],
        lcpMs: 700,
        longTasks: [{ duration: 75 }]
      },
      navigation: { domContentLoadedEventEnd: 300, duration: 800, loadEventEnd: 500 },
      paints: { 'first-contentful-paint': 400 },
      resourceCount: 5
    },
    {
      evidence: {
        cls: 0.08,
        interactions: [{ duration: 220 }],
        lcpMs: 1200,
        longTasks: [{ duration: 90 }]
      },
      navigation: { domContentLoadedEventEnd: 600, duration: 1400, loadEventEnd: 900 },
      paints: { 'first-contentful-paint': 750 },
      resourceCount: 9
    }
  ])

  assert.equal(combined.documentCount, 2)
  assert.equal(combined.evidence.cls, 0.08)
  assert.equal(combined.evidence.lcpMs, 1200)
  assert.deepEqual(combined.evidence.interactions, [{ duration: 80 }, { duration: 220 }])
  assert.equal(combined.evidence.longTasks.length, 2)
  assert.deepEqual(combined.navigation, {
    domContentLoadedEventEnd: 600,
    duration: 1400,
    loadEventEnd: 900
  })
  assert.equal(combined.paints['first-contentful-paint'], 750)
  assert.equal(combined.resourceCount, 14)
})

test('failed video captures close contexts and remove unique temporary directories', async () => {
  const outDir = await mkdtemp(path.join(process.cwd(), '.ui-evidence-test-'))
  const temporaryDirectories = []
  let closedContextCount = 0
  const browser = {
    async newContext(options) {
      temporaryDirectories.push(options.recordVideo.dir)
      return {
        async exposeBinding() {},
        async addInitScript() {
          throw new Error('capture failed')
        },
        async close() {
          closedContextCount += 1
        }
      }
    }
  }
  const capture = () =>
    captureViewport({
      browser,
      budgets: {},
      flow: null,
      options: {
        outDir,
        storageState: null,
        surface: 'test',
        video: true
      },
      viewport: { height: 844, label: 'mobile', width: 390 }
    })

  try {
    await Promise.all([
      assert.rejects(capture(), /capture failed/),
      assert.rejects(capture(), /capture failed/)
    ])
    assert.equal(new Set(temporaryDirectories).size, 2)
    assert.equal(closedContextCount, 2)
    assert.deepEqual(await readdir(outDir), [])
  } finally {
    await rm(outDir, { force: true, recursive: true })
  }
})

test('non-final metric runs retain all instrumentation without retaining public artifacts', async () => {
  const outDir = await mkdtemp(path.join(process.cwd(), '.ui-evidence-test-'))
  const diagnosticsDir = await mkdtemp(path.join(process.cwd(), '.ui-evidence-diagnostics-test-'))
  let contextOptions = null
  let tracingStarted = 0
  const browser = {
    async newContext(options) {
      contextOptions = options
      return {
        async exposeBinding() {},
        async addInitScript() {},
        tracing: {
          async start() {
            tracingStarted += 1
          }
        },
        async newPage() {
          throw new Error('stop after context creation')
        },
        async close() {}
      }
    }
  }

  try {
    await assert.rejects(
      captureViewportOnce({
        browser,
        flow: null,
        options: {
          diagnosticsDir,
          har: true,
          outDir,
          storageState: null,
          surface: 'test',
          trace: true,
          video: true
        },
        runCount: 3,
        runNumber: 1,
        viewport: { height: 844, label: 'mobile', width: 390 },
        writeArtifacts: false
      }),
      /stop after context creation/
    )
    assert.deepEqual(contextOptions.recordVideo.size, { height: 844, width: 390 })
    assert.equal(contextOptions.recordHar.path, path.join(diagnosticsDir, 'test-w390-run01.har'))
    assert.equal(tracingStarted, 1)
    assert.deepEqual(await readdir(outDir), [])
  } finally {
    await rm(outDir, { force: true, recursive: true })
    await rm(diagnosticsDir, { force: true, recursive: true })
  }
})

const ONE_PIXEL_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

const CHAT_PANEL_PAGE = `
<section aria-label="Kraken assistant">
  <textarea aria-label="Message"></textarea>
</section>
<script>
  window.__received = { drag: [], paste: [] }
  const describe = list =>
    [...list].map(file => ({ name: file.name, size: file.size, type: file.type }))
  const panel = document.querySelector('section')
  const message = document.querySelector('textarea')

  message.addEventListener('paste', event => {
    event.preventDefault()
    window.__received.paste.push({
      cancelable: event.cancelable,
      files: describe(event.clipboardData.files),
      target: event.target.getAttribute('aria-label'),
      text: event.clipboardData.getData('text/plain')
    })
  })

  for (const type of ['dragenter', 'dragover', 'drop']) {
    panel.addEventListener(type, event => {
      event.preventDefault()
      window.__received.drag.push({
        atMs: performance.now(),
        files: describe(event.dataTransfer.files),
        type: event.type,
        types: [...event.dataTransfer.types]
      })
    })
  }
</script>`

let sharedBrowser = null

async function chatPanelPage() {
  const { chromium } = await resolvePlaywright()
  sharedBrowser ??= await chromium.launch()
  const page = await sharedBrowser.newPage()
  await page.setContent(CHAT_PANEL_PAGE)
  return page
}

async function writeFixtureFile(name, contents) {
  const directory = await mkdtemp(path.join(process.cwd(), '.ui-evidence-files-'))
  const filePath = path.join(directory, name)
  await writeFile(filePath, contents)
  return { directory, filePath }
}

after(async () => {
  await sharedBrowser?.close()
})

test('a pasted file arrives on the clipboard event the app listens for', async () => {
  const png = Buffer.from(ONE_PIXEL_PNG_BASE64, 'base64')
  const { directory, filePath } = await writeFixtureFile('screenshot.png', png)
  const outDir = await mkdtemp(path.join(process.cwd(), '.ui-evidence-test-'))
  const page = await chatPanelPage()

  try {
    const timings = await runFlow({
      beforeNavigate: async () => {},
      flow: [
        {
          action: 'paste',
          files: [filePath],
          screenshot: true,
          selector: 'textarea[aria-label="Message"]',
          text: 'look at this'
        }
      ],
      options: { outDir, surface: 'test', timeoutMs: 5000, url: 'about:blank' },
      page,
      viewport: { height: 844, label: 'mobile', width: 390 },
      writeArtifacts: true
    })

    const received = await page.evaluate(() => window.__received.paste)
    assert.equal(received.length, 1)
    assert.equal(received[0].target, 'Message')
    assert.equal(received[0].cancelable, true)
    assert.equal(received[0].text, 'look at this')
    assert.deepEqual(received[0].files, [
      { name: 'screenshot.png', size: png.length, type: 'image/png' }
    ])
    assert.equal(timings[0].screenshot, 'test-w390-step01.png')
    assert.deepEqual(await readdir(outDir), ['test-w390-step01.png'])
  } finally {
    await page.close()
    await rm(directory, { force: true, recursive: true })
    await rm(outDir, { force: true, recursive: true })
  }
})

test('a text-only paste carries text and no invented file', async () => {
  const page = await chatPanelPage()

  try {
    await runFlow({
      beforeNavigate: async () => {},
      flow: [{ action: 'paste', selector: 'textarea[aria-label="Message"]', text: 'hello' }],
      options: { outDir: null, surface: 'test', timeoutMs: 5000, url: 'about:blank' },
      page,
      viewport: { height: 844, label: 'mobile', width: 390 },
      writeArtifacts: false
    })

    const received = await page.evaluate(() => window.__received.paste)
    assert.equal(received.length, 1)
    assert.equal(received[0].text, 'hello')
    assert.deepEqual(received[0].files, [])
  } finally {
    await page.close()
  }
})

test('dropped files reach the panel through the whole drag sequence', async () => {
  const csv = Buffer.from('name,email\nDoctor,doctor@example.com\n')
  const { directory, filePath } = await writeFixtureFile('contacts.csv', csv)
  const page = await chatPanelPage()

  try {
    await runFlow({
      beforeNavigate: async () => {},
      flow: [
        {
          action: 'dropFiles',
          files: [filePath],
          hold: 300,
          selector: 'section[aria-label="Kraken assistant"]'
        }
      ],
      options: { outDir: null, surface: 'test', timeoutMs: 5000, url: 'about:blank' },
      page,
      viewport: { height: 844, label: 'mobile', width: 390 },
      writeArtifacts: false
    })

    const received = await page.evaluate(() => window.__received.drag)
    assert.deepEqual(
      received.map(event => event.type),
      ['dragenter', 'dragover', 'drop']
    )
    for (const event of received) assert.ok(event.types.includes('Files'))
    assert.deepEqual(received.at(-1).files, [
      { name: 'contacts.csv', size: csv.length, type: 'text/csv' }
    ])
    assert.ok(received.at(-1).atMs - received[1].atMs >= 250)
  } finally {
    await page.close()
    await rm(directory, { force: true, recursive: true })
  }
})

test('a file that is not on disk fails the step instead of pasting or dropping nothing', async () => {
  const page = await chatPanelPage()
  const missing = path.join(process.cwd(), '.ui-evidence-missing', 'gone.png')

  try {
    await assert.rejects(
      runFlow({
        beforeNavigate: async () => {},
        flow: [{ action: 'paste', files: [missing], selector: 'textarea[aria-label="Message"]' }],
        options: { outDir: null, surface: 'test', timeoutMs: 5000, url: 'about:blank' },
        page,
        viewport: { height: 844, label: 'mobile', width: 390 },
        writeArtifacts: false
      }),
      new RegExp(`Flow step 1 failed \\(paste\\): file not found: ${missing}`)
    )
    await assert.rejects(
      runFlow({
        beforeNavigate: async () => {},
        flow: [
          {
            action: 'dropFiles',
            files: [missing],
            selector: 'section[aria-label="Kraken assistant"]'
          }
        ],
        options: { outDir: null, surface: 'test', timeoutMs: 5000, url: 'about:blank' },
        page,
        viewport: { height: 844, label: 'mobile', width: 390 },
        writeArtifacts: false
      }),
      /Flow step 1 failed \(dropFiles\): file not found:/
    )
    assert.deepEqual(await page.evaluate(() => window.__received), { drag: [], paste: [] })
  } finally {
    await page.close()
  }
})
