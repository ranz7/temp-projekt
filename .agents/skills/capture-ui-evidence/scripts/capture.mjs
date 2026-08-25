#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import {
  access,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rename,
  rm,
  writeFile
} from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const VIEWPORTS = [
  { width: 390, height: 844, label: 'mobile' },
  { width: 768, height: 1024, label: 'tablet' },
  { width: 1280, height: 800, label: 'desktop' }
]

const DEFAULT_BUDGETS = {
  fcpMs: 1800,
  lcpMs: 2500,
  cls: 0.1,
  inpMs: 200,
  blockingTimeMs: 200,
  transferBytes: 2_500_000,
  requestCount: 100,
  badResponses: 0,
  consoleErrors: 0,
  pageErrors: 0,
  failedRequests: 0
}

/**
 * The budgets that mean the same thing on a dev server as in production: a
 * broken request, a thrown error, a red line in the console. These always
 * decide the verdict.
 *
 * Everything else - paint timings, bytes, request count - is measured against
 * a production shape. A dev server compiles on demand and ships every module
 * as its own request, so gating on those numbers here fails runs for reasons
 * that say nothing about the change. They stay in the report as measurements
 * and only gate under `--strict`, which the skill reserves for production and
 * preview builds.
 */
const CORRECTNESS_BUDGETS = new Set([
  'badResponses',
  'consoleErrors',
  'pageErrors',
  'failedRequests'
])

const BASELINE_DELTA_METRICS = [
  'fcpMs',
  'lcpMs',
  'cls',
  'inpMs',
  'blockingTimeMs',
  'transferBytes',
  'requestCount'
]

const HELP = `Usage:
  ui-evidence --url <url> --surface <name> --out <directory> [options]
  (local: node .agents/skills/capture-ui-evidence/scripts/capture.mjs --url ... --surface ... --out ...)

Options:
  --video                  Record every measured run; keep the last WebM per viewport
  --flow <json>            Run an interaction flow (see .agents/skills/capture-ui-evidence/flows/README.md)
  --flow-min-width <px>    Run the flow only at viewports at least this wide; narrower ones are
                           still screenshotted, unflowed (for a surface that refuses to draw below a width)
  --storage-state <json>   Playwright storage state (use playwright/.auth/ui-evidence.json)
  --wait-for <selector>    Wait for a selector before measuring
  --budget <json>          Override default performance budgets
  --strict                 Exit non-zero when a budget is exceeded
  --runs <n>               Repeat each viewport n times; report per-metric medians (default: 1)
  --baseline <metrics.json>  Diff against a specific previous run (default: latest sibling with same surface)
  --no-baseline            Skip the baseline diff
  --trace                  Save a Playwright trace.zip per run in a gitignored diagnostics directory
  --har                    Save a HAR (without bodies) per run in a gitignored diagnostics directory
  --diagnostics-out <dir>  Override the gitignored trace/HAR directory
  --timeout <ms>           Navigation/action timeout (default: 60000)
  --settle <ms>            Quiet time before measuring (default: 1000)
  --help                   Show this help

Flow JSON is an array of actions. Supported actions:
  { "action": "navigate", "url": "/app/courses" }            relative URLs resolve against --url
  { "action": "click", "selector": "text=Start" }
  { "action": "fill", "selector": "#email", "value": "test@example.com" }
  { "action": "press", "selector": "#search", "key": "Enter" }
  { "action": "hover", "selector": "[data-card]" }
  { "action": "drag", "selector": "[data-handle]", "toXPx": 200, "toYPx": 140 }   or "dxPx"/"dyPx"
  { "action": "select", "selector": "#status", "value": "published" }
  { "action": "check", "selector": "#terms" } / { "action": "uncheck", ... }
  { "action": "upload", "selector": "input[type=file]", "files": ["./fixture.png"] }
  { "action": "paste", "selector": "textarea", "files": ["./shot.png"], "text": "hello" }   either key, or both
  { "action": "dropFiles", "selector": "[data-dropzone]", "files": ["./rows.csv"], "hold": 600 }
  { "action": "assert", "selector": "text=Zapisano", "state": "visible", "text": "Zapisano" }
  { "action": "waitFor", "selector": "text=Ready" }
  { "action": "wait", "ms": 500 }
  { "action": "scroll", "y": 700 }
Any step may add "screenshot": true to save a per-step PNG.
Any step may add "minWidth": 768 to sit out viewports narrower than that.
`

function parseArgs(argv) {
  const options = {
    baselinePath: null,
    budgetPath: null,
    diagnosticsDir: null,
    flowMinWidth: 0,
    flowPath: null,
    har: false,
    noBaseline: false,
    outDir: null,
    runs: 1,
    settleMs: 1000,
    storageState: null,
    strict: false,
    surface: 'surface',
    timeoutMs: 60_000,
    trace: false,
    url: null,
    video: false,
    waitFor: null
  }

  for (let index = 2; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--video') options.video = true
    else if (argument === '--strict') options.strict = true
    else if (argument === '--trace') options.trace = true
    else if (argument === '--har') options.har = true
    else if (argument === '--no-baseline') options.noBaseline = true
    else if (argument === '--help' || argument === '-h') {
      console.log(HELP)
      process.exit(0)
    } else if (argument === '--url') options.url = argv[++index]
    else if (argument === '--surface') options.surface = argv[++index]
    else if (argument === '--out') options.outDir = argv[++index]
    else if (argument === '--flow') options.flowPath = argv[++index]
    else if (argument === '--flow-min-width') options.flowMinWidth = Number(argv[++index])
    else if (argument === '--storage-state') options.storageState = argv[++index]
    else if (argument === '--wait-for') options.waitFor = argv[++index]
    else if (argument === '--budget') options.budgetPath = argv[++index]
    else if (argument === '--baseline') options.baselinePath = argv[++index]
    else if (argument === '--diagnostics-out') options.diagnosticsDir = argv[++index]
    else if (argument === '--runs') options.runs = Number(argv[++index])
    else if (argument === '--timeout') options.timeoutMs = Number(argv[++index])
    else if (argument === '--settle') options.settleMs = Number(argv[++index])
    else throw new Error(`Unknown argument: ${argument}\n\n${HELP}`)
  }

  if (!options.url || !options.outDir) {
    throw new Error(`Required: --url <url> --out <directory>\n\n${HELP}`)
  }
  if (!Number.isFinite(options.timeoutMs) || options.timeoutMs <= 0) {
    throw new Error('--timeout must be a positive number')
  }
  if (!Number.isFinite(options.settleMs) || options.settleMs < 0) {
    throw new Error('--settle must be a non-negative number')
  }
  if (!Number.isFinite(options.flowMinWidth) || options.flowMinWidth < 0) {
    throw new Error('--flow-min-width must be a non-negative number')
  }
  if (!Number.isInteger(options.runs) || options.runs < 1 || options.runs > 9) {
    throw new Error('--runs must be an integer between 1 and 9')
  }

  options.surface = sanitizeName(options.surface)
  return options
}

function sanitizeName(value) {
  const sanitized = String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
  if (!sanitized) throw new Error('Surface must contain a filename-safe character')
  return sanitized
}

function redactUrl(value) {
  try {
    const redacted = new URL(value)
    if (redacted.protocol !== 'http:' && redacted.protocol !== 'https:') {
      return '[redacted-url]'
    }
    return `${redacted.origin}/`
  } catch {
    return '[redacted-url]'
  }
}

function runGit(args, cwd, options = {}) {
  return execFileSync('git', args, {
    cwd,
    encoding: options.encoding ?? 'utf8',
    maxBuffer: options.maxBuffer ?? 16 * 1024 * 1024,
    stdio: options.stdio ?? ['ignore', 'pipe', 'pipe']
  })
}

function repositoryContext(cwd = process.cwd()) {
  try {
    const root = runGit(['rev-parse', '--show-toplevel'], cwd).trim()
    const sha = runGit(['rev-parse', 'HEAD'], root).trim()
    return { root, sha }
  } catch {
    return null
  }
}

function isContained(root, candidate) {
  const relative = path.relative(root, candidate)
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))
}

function repositoryRelativePath(repositoryRoot, absolutePath) {
  return path.relative(repositoryRoot, absolutePath).split(path.sep).join('/')
}

function headBlob(repository, relativePath) {
  const listing = runGit(['ls-tree', '-z', repository.sha, '--', relativePath], repository.root)
  const record = listing
    .split('\0')
    .find(entry => entry.slice(entry.indexOf('\t') + 1) === relativePath)
  if (!record) return null
  const [metadata] = record.split('\t', 1)
  const [mode, type, oid] = metadata.split(/\s+/)
  if (type !== 'blob' || !/^100(?:644|755)$/.test(mode)) return null
  return oid
}

function readHeadJson(repository, relativePath, label) {
  const oid = headBlob(repository, relativePath)
  if (!oid) return null
  const source = runGit(['cat-file', 'blob', oid], repository.root)
  try {
    return JSON.parse(source)
  } catch (error) {
    throw new Error(
      `${label} is not valid JSON in commit ${repository.sha}: ${relativePath}\n${error.message}`
    )
  }
}

async function validateStorageStatePath(storageState, cwd = process.cwd()) {
  await access(storageState)
  const repository = repositoryContext(cwd)
  if (!repository) return

  const canonicalPath = await realpath(storageState)
  if (!isContained(repository.root, canonicalPath)) return

  validatePrivateRepositoryPath(canonicalPath, repository, 'Storage state')
}

function validatePrivateRepositoryPath(absolutePath, repository, label) {
  if (!isContained(repository.root, absolutePath)) return

  const relativePath = repositoryRelativePath(repository.root, absolutePath)
  try {
    runGit(['ls-files', '--error-unmatch', '--', relativePath], repository.root, {
      stdio: 'ignore'
    })
    throw new Error(`${label} must not be tracked by git: ${relativePath}`)
  } catch (error) {
    if (error.message?.startsWith(`${label} must not`)) throw error
  }

  try {
    runGit(['check-ignore', '-q', '--no-index', '--', relativePath], repository.root, {
      stdio: 'ignore'
    })
  } catch {
    throw new Error(
      `Repository-local ${label.toLowerCase()} must be ignored by git: ${relativePath}`
    )
  }
}

function resolveDiagnosticsDirectory(options, repository = repositoryContext()) {
  if (!options.har && !options.trace) return null
  const outputDirectory = path.resolve(options.outDir)
  const defaultDirectory =
    repository && isContained(repository.root, outputDirectory)
      ? path.join(
          repository.root,
          '.ui-evidence-diagnostics',
          repositoryRelativePath(repository.root, outputDirectory)
        )
      : path.join(
          path.dirname(outputDirectory),
          '.ui-evidence-diagnostics',
          path.basename(outputDirectory)
        )
  const diagnosticDirectory = path.resolve(options.diagnosticsDir ?? defaultDirectory)
  if (isContained(outputDirectory, diagnosticDirectory)) {
    throw new Error('Trace/HAR diagnostics must be outside the evidence output directory')
  }
  if (repository) {
    validatePrivateRepositoryPath(diagnosticDirectory, repository, 'UI evidence diagnostics')
  }
  return diagnosticDirectory
}

async function prepareDiagnosticsDirectory(options, repository = repositoryContext()) {
  const diagnosticDirectory = resolveDiagnosticsDirectory(options, repository)
  if (!diagnosticDirectory) return null
  let ancestor = diagnosticDirectory
  while (true) {
    try {
      const info = await lstat(ancestor)
      if (info.isSymbolicLink()) {
        throw new Error(`UI evidence diagnostics must not traverse a symbolic link: ${ancestor}`)
      }
      if (!info.isDirectory()) {
        throw new Error(`UI evidence diagnostics parent is not a directory: ${ancestor}`)
      }
      break
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
      const parent = path.dirname(ancestor)
      if (parent === ancestor) throw error
      ancestor = parent
    }
  }
  await mkdir(diagnosticDirectory, { mode: 0o700, recursive: true })
  const [canonicalDiagnostics, canonicalOutput] = await Promise.all([
    realpath(diagnosticDirectory),
    realpath(options.outDir)
  ])
  if (isContained(canonicalOutput, canonicalDiagnostics)) {
    throw new Error('Trace/HAR diagnostics must resolve outside the evidence output directory')
  }
  if (repository) {
    validatePrivateRepositoryPath(canonicalDiagnostics, repository, 'UI evidence diagnostics')
  }
  return canonicalDiagnostics
}

async function loadJson(filePath, label) {
  const source = await readFile(filePath, 'utf8')
  try {
    return JSON.parse(source)
  } catch (error) {
    throw new Error(`${label} is not valid JSON: ${filePath}\n${error.message}`)
  }
}

async function resolvePlaywright() {
  const candidates = [
    process.env.ALGO_UI_EVIDENCE_ROOT,
    path.dirname(new URL(import.meta.url).pathname),
    process.cwd(),
    path.join(process.cwd(), 'apps/algoacademy'),
    path.join(process.cwd(), 'apps/algolabs')
  ].filter(Boolean)

  for (const candidate of candidates) {
    const requireFromCandidate = createRequire(path.join(candidate, 'noop.cjs'))
    for (const packageName of ['playwright', '@playwright/test']) {
      try {
        return requireFromCandidate(packageName)
      } catch {
        // Try the next package or installation root.
      }
    }
  }

  throw new Error(
    'Playwright is unavailable. Devbox: re-run the Ansible UI evidence capability. Local: install Playwright in an app workspace (bunx playwright install chromium).'
  )
}

function makeTraceparent() {
  const traceId = randomBytes(16).toString('hex')
  const spanId = randomBytes(8).toString('hex')
  return { header: `00-${traceId}-${spanId}-01`, traceId }
}

const TRANSFER_MIME_TYPES = {
  '.csv': 'text/csv',
  '.gif': 'image/gif',
  '.heic': 'image/heic',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.json': 'application/json',
  '.md': 'text/markdown',
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain',
  '.webp': 'image/webp',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
}

/**
 * The type an operating system would have attached to the file, because an app
 * that only accepts screenshots decides on `file.type` and would reject every
 * paste that arrived as a nameless blob.
 */
function transferMimeType(filePath) {
  return TRANSFER_MIME_TYPES[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream'
}

async function readTransferFiles(step) {
  const requested = Array.isArray(step.files) ? step.files : [step.files].filter(Boolean)
  return Promise.all(
    requested.map(async entry => {
      const filePath = path.resolve(String(entry))
      const bytes = await readFile(filePath).catch(() => {
        throw new Error(`file not found: ${filePath}`)
      })
      return {
        base64: bytes.toString('base64'),
        name: path.basename(filePath),
        type: transferMimeType(filePath)
      }
    })
  )
}

/**
 * Runs inside the page: the clipboard and the drag source live in the operating
 * system, out of Playwright's reach, so the files travel as bytes and the
 * DataTransfer the app reads is built here, on the element the operator aimed at.
 */
async function dispatchTransferSequence(element, payload) {
  const transfer = new DataTransfer()
  for (const file of payload.files) {
    const bytes = Uint8Array.from(atob(file.base64), character => character.charCodeAt(0))
    transfer.items.add(new File([bytes], file.name, { type: file.type }))
  }
  if (typeof payload.text === 'string') transfer.setData('text/plain', payload.text)

  for (const event of payload.events) {
    if (event.delayMs > 0) {
      await new Promise(resolve => setTimeout(resolve, event.delayMs))
    }
    element.dispatchEvent(
      event.type === 'paste'
        ? new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: transfer })
        : new DragEvent(event.type, { bubbles: true, cancelable: true, dataTransfer: transfer })
    )
  }
}

async function runFlow({ beforeNavigate, page, flow, options, viewport, writeArtifacts }) {
  const stepTimings = []
  for (const [index, step] of flow.entries()) {
    const action = step?.action
    const startedAt = Date.now()
    let stepScreenshot = null

    // A screen the product refuses to draw below some width cannot be walked
    // there - the campaign board says "open this wider" under 768px. A step
    // that names its minWidth sits the narrow viewport out instead of failing
    // the whole run on behaviour that is deliberate.
    if (typeof step?.minWidth === 'number' && viewport.width < step.minWidth) {
      stepTimings.push({
        action,
        durationMs: 0,
        screenshot: null,
        selector: step.selector ?? step.url ?? null,
        skipped: `viewport ${viewport.width}px is under minWidth ${step.minWidth}px`,
        step: index + 1
      })
      continue
    }

    try {
      if (action === 'navigate') {
        const target = new URL(String(step.url ?? ''), options.url).toString()
        await beforeNavigate()
        await page.goto(target, { waitUntil: 'domcontentloaded', timeout: options.timeoutMs })
      } else if (action === 'click') {
        await page.locator(step.selector).first().click({ timeout: options.timeoutMs })
      } else if (action === 'fill') {
        await page
          .locator(step.selector)
          .first()
          .fill(String(step.value ?? ''), { timeout: options.timeoutMs })
      } else if (action === 'press') {
        await page.locator(step.selector).first().press(step.key, { timeout: options.timeoutMs })
      } else if (action === 'hover') {
        await page.locator(step.selector).first().hover({ timeout: options.timeoutMs })
      } else if (action === 'drag') {
        // A real press-move-release, not Playwright's dragTo: the interactions
        // worth filming here are pointer-event driven (a floating button, a
        // resize grip), and HTML5 drag-and-drop never fires for them.
        const locator = page.locator(step.selector).first()
        await locator.waitFor({ state: 'visible', timeout: options.timeoutMs })
        const box = await locator.boundingBox()
        if (!box) {
          throw new Error(`element ${JSON.stringify(step.selector)} has no box to drag`)
        }

        const fromX = box.x + box.width / 2
        const fromY = box.y + box.height / 2
        const toX = step.toXPx === undefined ? fromX + Number(step.dxPx ?? 0) : Number(step.toXPx)
        const toY = step.toYPx === undefined ? fromY + Number(step.dyPx ?? 0) : Number(step.toYPx)

        await page.mouse.move(fromX, fromY)
        await page.mouse.down()
        // Many small moves, so the page sees the drag it would see from a hand
        // rather than one teleport its threshold logic could miss entirely.
        await page.mouse.move(toX, toY, { steps: Number(step.steps ?? 24) })
        await page.mouse.up()
        await page.waitForTimeout(200)
      } else if (action === 'select') {
        await page
          .locator(step.selector)
          .first()
          .selectOption(step.value, { timeout: options.timeoutMs })
      } else if (action === 'check' || action === 'uncheck') {
        await page
          .locator(step.selector)
          .first()
          .setChecked(action === 'check', { timeout: options.timeoutMs })
      } else if (action === 'upload') {
        const files = Array.isArray(step.files) ? step.files : [step.files].filter(Boolean)
        await page.locator(step.selector).first().setInputFiles(files, {
          timeout: options.timeoutMs
        })
      } else if (action === 'paste') {
        // What Cmd/Ctrl+V produces, not what it takes to get there: the OS
        // clipboard cannot be loaded with a screenshot from here, so the app
        // gets the one thing it actually reads - a cancelable, bubbling paste
        // event whose clipboardData already holds the files and the text.
        const files = await readTransferFiles(step)
        if (files.length === 0 && step.text === undefined) {
          throw new Error('paste needs "files", "text", or both')
        }

        const locator = page.locator(step.selector).first()
        await locator.waitFor({ state: 'visible', timeout: options.timeoutMs })
        await locator.focus({ timeout: options.timeoutMs })
        await locator.evaluate(dispatchTransferSequence, {
          events: [{ delayMs: 0, type: 'paste' }],
          files,
          text: step.text === undefined ? null : String(step.text)
        })
        await page.waitForTimeout(200)
      } else if (action === 'dropFiles') {
        // The HTML5 journey `drag` deliberately leaves out. The whole sequence
        // is dispatched, not just the drop, because a panel that lights up on
        // dragenter and needs dragover cancelled to accept anything would sit
        // dark through a lone drop event and prove nothing on the recording.
        const files = await readTransferFiles(step)
        if (files.length === 0) {
          throw new Error('dropFiles needs at least one entry in "files"')
        }

        const locator = page.locator(step.selector).first()
        await locator.waitFor({ state: 'visible', timeout: options.timeoutMs })
        await locator.evaluate(dispatchTransferSequence, {
          // The hold sits between dragover and drop, where a hand hesitates -
          // and where a --video run has its only chance to film the lit target.
          events: [
            { delayMs: 0, type: 'dragenter' },
            { delayMs: 0, type: 'dragover' },
            { delayMs: Number(step.hold ?? 0), type: 'drop' }
          ],
          files,
          text: step.text === undefined ? null : String(step.text)
        })
        await page.waitForTimeout(200)
      } else if (action === 'assert') {
        const locator = page.locator(step.selector).first()
        await locator.waitFor({ state: step.state ?? 'visible', timeout: options.timeoutMs })
        if (step.text) {
          const content = (await locator.textContent()) ?? ''
          if (!content.includes(step.text)) {
            throw new Error(
              `expected text ${JSON.stringify(step.text)} not found in ${JSON.stringify(content.slice(0, 200))}`
            )
          }
        }
      } else if (action === 'waitFor') {
        await page
          .locator(step.selector)
          .first()
          .waitFor({ state: step.state ?? 'visible', timeout: options.timeoutMs })
      } else if (action === 'wait') {
        await page.waitForTimeout(Number(step.ms ?? 0))
      } else if (action === 'scroll') {
        await page.evaluate(
          y => window.scrollTo({ top: y, behavior: 'smooth' }),
          Number(step.y ?? 0)
        )
        await page.waitForTimeout(400)
      } else {
        throw new Error(`unsupported action ${JSON.stringify(action)}`)
      }

      if (step.screenshot === true && writeArtifacts) {
        stepScreenshot = `${options.surface}-w${viewport.width}-step${String(index + 1).padStart(2, '0')}.png`
        await page.screenshot({
          animations: 'disabled',
          path: path.join(options.outDir, stepScreenshot)
        })
      }
    } catch (error) {
      throw new Error(`Flow step ${index + 1} failed (${action}): ${error.message}`)
    }
    stepTimings.push({
      action,
      durationMs: Date.now() - startedAt,
      screenshot: stepScreenshot,
      selector: step.selector ?? step.url ?? null,
      step: index + 1
    })
  }
  return stepTimings
}

function installPerformanceObservers() {
  window.__algoUiEvidence = {
    cls: 0,
    clsSessionLastTime: null,
    clsSessionStartTime: null,
    clsSessionValue: 0,
    interactions: [],
    lcpMs: null,
    longTasks: []
  }

  try {
    new PerformanceObserver(list => {
      for (const entry of list.getEntries()) {
        if (entry.hadRecentInput) continue

        const evidence = window.__algoUiEvidence
        const startsNewSession =
          evidence.clsSessionStartTime === null ||
          entry.startTime - evidence.clsSessionLastTime >= 1000 ||
          entry.startTime - evidence.clsSessionStartTime >= 5000

        if (startsNewSession) {
          evidence.clsSessionStartTime = entry.startTime
          evidence.clsSessionValue = entry.value
        } else {
          evidence.clsSessionValue += entry.value
        }
        evidence.clsSessionLastTime = entry.startTime
        evidence.cls = Math.max(evidence.cls, evidence.clsSessionValue)
      }
    }).observe({ type: 'layout-shift', buffered: true })
  } catch {}

  try {
    new PerformanceObserver(list => {
      const entries = list.getEntries()
      const lastEntry = entries.at(-1)
      if (lastEntry) window.__algoUiEvidence.lcpMs = lastEntry.startTime
    }).observe({ type: 'largest-contentful-paint', buffered: true })
  } catch {}

  try {
    new PerformanceObserver(list => {
      for (const entry of list.getEntries()) {
        window.__algoUiEvidence.longTasks.push({
          duration: entry.duration,
          startTime: entry.startTime
        })
      }
    }).observe({ type: 'longtask', buffered: true })
  } catch {}

  try {
    new PerformanceObserver(list => {
      for (const entry of list.getEntries()) {
        if (!entry.interactionId) continue
        const interaction = {
          duration: entry.duration,
          interactionId: entry.interactionId,
          name: entry.name,
          startTime: entry.startTime,
          timeOrigin: performance.timeOrigin
        }
        window.__algoUiEvidence.interactions.push(interaction)
        if (typeof window.__algoUiEvidenceReportInteraction === 'function') {
          try {
            void Promise.resolve(window.__algoUiEvidenceReportInteraction(interaction)).catch(
              () => {}
            )
          } catch {}
        }
      }
    }).observe({ type: 'event', buffered: true, durationThreshold: 16 })
  } catch {}
}

function round(value, digits = 0) {
  if (value === null || value === undefined || !Number.isFinite(value)) return null
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

function metricMap(metrics) {
  return Object.fromEntries(metrics.map(metric => [metric.name, metric.value]))
}

async function readDocumentMetrics(page) {
  return page.evaluate(() => {
    const navigation = performance.getEntriesByType('navigation')[0]?.toJSON?.() ?? null
    const paints = Object.fromEntries(
      performance.getEntriesByType('paint').map(entry => [entry.name, entry.startTime])
    )
    return {
      evidence: window.__algoUiEvidence,
      navigation,
      paints,
      resourceCount: performance.getEntriesByType('resource').length
    }
  })
}

function maximum(values) {
  const finite = values.filter(Number.isFinite)
  return finite.length > 0 ? Math.max(...finite) : null
}

function combineDocumentMetrics(documents) {
  const navigationFields = ['domContentLoadedEventEnd', 'duration', 'loadEventEnd']
  return {
    documentCount: documents.length,
    evidence: {
      cls: maximum(documents.map(document => document.evidence?.cls)),
      interactions: documents.flatMap(document => document.evidence?.interactions ?? []),
      lcpMs: maximum(documents.map(document => document.evidence?.lcpMs)),
      longTasks: documents.flatMap(document => document.evidence?.longTasks ?? [])
    },
    navigation: Object.fromEntries(
      navigationFields.map(field => [
        field,
        maximum(documents.map(document => document.navigation?.[field]))
      ])
    ),
    paints: {
      'first-contentful-paint': maximum(
        documents.map(document => document.paints?.['first-contentful-paint'])
      )
    },
    resourceCount: documents.reduce((total, document) => total + (document.resourceCount ?? 0), 0)
  }
}

function median(values) {
  if (values.length === 0 || values.some(value => !Number.isFinite(value))) return null
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

function assess(metrics, budgets, enforcePerformance = true) {
  const checks = [
    ['fcpMs', metrics.fcpMs, budgets.fcpMs],
    ['lcpMs', metrics.lcpMs, budgets.lcpMs],
    ['cls', metrics.cls, budgets.cls],
    ['inpMs', metrics.inpMs, budgets.inpMs],
    ['blockingTimeMs', metrics.blockingTimeMs, budgets.blockingTimeMs],
    ['transferBytes', metrics.transferBytes, budgets.transferBytes],
    ['requestCount', metrics.requestCount, budgets.requestCount],
    ['badResponses', metrics.badResponses.length, budgets.badResponses],
    ['consoleErrors', metrics.consoleErrors.length, budgets.consoleErrors],
    ['pageErrors', metrics.pageErrors.length, budgets.pageErrors],
    ['failedRequests', metrics.failedRequests.length, budgets.failedRequests]
  ].map(([name, value, budget]) => ({
    budget,
    enforced: enforcePerformance || CORRECTNESS_BUDGETS.has(name),
    name,
    pass:
      budget === null ||
      budget === undefined ||
      (value !== null && value !== undefined && value <= budget),
    value
  }))

  return {
    checks,
    pass: checks.every(check => !check.enforced || check.pass)
  }
}

function snapshotMetrics({ browserMetrics, cdpMetrics, endedAt, liveMetrics, startedAt }) {
  const longTasks = browserMetrics.evidence?.longTasks ?? []
  const blockingTimeMs = longTasks.reduce(
    (total, task) => total + Math.max(0, task.duration - 50),
    0
  )
  const interactions = browserMetrics.evidence?.interactions ?? []
  const inpMs = interactions.length > 0 ? Math.max(...interactions.map(i => i.duration)) : null
  const navigation = browserMetrics.navigation ?? {}

  return {
    badResponses: liveMetrics.badResponses.map(response => ({ ...response })),
    blockingTimeMs: round(blockingTimeMs),
    cls: round(browserMetrics.evidence?.cls ?? null, 3),
    consoleErrors: [...liveMetrics.consoleErrors],
    domContentLoadedMs: round(navigation.domContentLoadedEventEnd),
    failedRequests: liveMetrics.failedRequests.map(request => ({ ...request })),
    fcpMs: round(browserMetrics.paints?.['first-contentful-paint'] ?? null),
    inpMs: round(inpMs),
    interactionCount: interactions.length,
    jsHeapUsedBytes: round(cdpMetrics.JSHeapUsedSize),
    lcpMs: round(browserMetrics.evidence?.lcpMs ?? null),
    loadMs: round(navigation.loadEventEnd),
    longTaskCount: longTasks.length,
    navigationDurationMs: round(navigation.duration),
    navigationCount: browserMetrics.documentCount ?? 1,
    nodeCount: round(cdpMetrics.Nodes),
    pageErrors: [...liveMetrics.pageErrors],
    requestCount: liveMetrics.requestCount,
    resourceCount: browserMetrics.resourceCount,
    transferBytes: round(liveMetrics.transferBytes),
    wallTimeMs: endedAt - startedAt
  }
}

async function captureViewportOnce({
  browser,
  flow,
  options,
  runCount = 1,
  runNumber = 1,
  viewport,
  writeArtifacts
}) {
  const recordVideo = options.video
  const temporaryVideoDirectory = recordVideo
    ? await mkdtemp(path.join(options.outDir, '.video-tmp-'))
    : null
  let context = null
  let contextClosed = false
  let page = null
  const interactions = []
  const traceparent = makeTraceparent()
  const runSuffix = runCount > 1 ? `-run${String(runNumber).padStart(2, '0')}` : ''
  const harName = `${options.surface}-w${viewport.width}${runSuffix}.har`
  const traceName = `${options.surface}-w${viewport.width}${runSuffix}-trace.zip`
  if ((options.har || options.trace) && !options.diagnosticsDir) {
    throw new Error('Trace/HAR diagnostics require a separate diagnostics directory')
  }

  try {
    context = await browser.newContext({
      extraHTTPHeaders: { traceparent: traceparent.header },
      recordHar: options.har
        ? { content: 'omit', path: path.join(options.diagnosticsDir, harName) }
        : undefined,
      ...(recordVideo
        ? {
            recordVideo: {
              dir: temporaryVideoDirectory,
              size: { width: viewport.width, height: viewport.height }
            }
          }
        : {}),
      storageState: options.storageState ?? undefined,
      viewport: { width: viewport.width, height: viewport.height }
    })
    await context.exposeBinding('__algoUiEvidenceReportInteraction', ({ frame }, interaction) => {
      if (page && frame === page.mainFrame()) interactions.push(interaction)
    })
    await context.addInitScript(installPerformanceObservers)
    if (options.trace) {
      await context.tracing.start({ screenshots: true, snapshots: true })
    }

    page = await context.newPage()
    page.setDefaultTimeout(options.timeoutMs)
    const cdp = await context.newCDPSession(page)
    await Promise.all([cdp.send('Network.enable'), cdp.send('Performance.enable')])

    const liveMetrics = {
      badResponses: [],
      consoleErrors: [],
      failedRequests: [],
      pageErrors: [],
      requestCount: 0,
      serverTimings: [],
      transferBytes: 0
    }

    page.on('console', message => {
      if (message.type() === 'error') liveMetrics.consoleErrors.push(message.text())
    })
    page.on('pageerror', error => liveMetrics.pageErrors.push(error.message))
    page.on('request', () => {
      liveMetrics.requestCount += 1
    })
    page.on('requestfailed', request => {
      liveMetrics.failedRequests.push({
        error: request.failure()?.errorText ?? 'unknown',
        method: request.method(),
        url: redactUrl(request.url())
      })
    })
    page.on('response', response => {
      if (response.status() >= 400) {
        liveMetrics.badResponses.push({
          status: response.status(),
          url: redactUrl(response.url())
        })
      }
      const serverTiming = response.headers()['server-timing']
      if (serverTiming && liveMetrics.serverTimings.length < 25) {
        liveMetrics.serverTimings.push({
          serverTiming,
          url: redactUrl(response.url())
        })
      }
    })
    cdp.on('Network.loadingFinished', event => {
      liveMetrics.transferBytes += event.encodedDataLength ?? 0
    })

    const startedAt = Date.now()
    await page.goto(options.url, { waitUntil: 'domcontentloaded', timeout: options.timeoutMs })
    try {
      await page.waitForLoadState('networkidle', { timeout: Math.min(options.timeoutMs, 15_000) })
    } catch {
      // Streaming, analytics, and hot-reload connections may keep a dev page busy.
    }
    if (options.waitFor) {
      await page.locator(options.waitFor).first().waitFor({ timeout: options.timeoutMs })
    }
    const documentMetrics = []
    const stepTimings = flow
      ? await runFlow({
          beforeNavigate: async () => {
            documentMetrics.push(await readDocumentMetrics(page))
          },
          flow,
          options,
          page,
          viewport,
          writeArtifacts
        })
      : null
    await page.waitForTimeout(options.settleMs)

    const [finalDocumentMetrics, rawCdpMetrics] = await Promise.all([
      readDocumentMetrics(page),
      cdp.send('Performance.getMetrics')
    ])
    documentMetrics.push(finalDocumentMetrics)
    const browserMetrics = combineDocumentMetrics(documentMetrics)
    const seenInteractions = new Set()
    const allInteractions = [
      ...interactions,
      ...(browserMetrics.evidence?.interactions ?? [])
    ].filter(interaction => {
      const key = JSON.stringify(interaction)
      if (seenInteractions.has(key)) return false
      seenInteractions.add(key)
      return true
    })
    browserMetrics.evidence = {
      ...browserMetrics.evidence,
      interactions: allInteractions
    }
    const metrics = snapshotMetrics({
      browserMetrics,
      cdpMetrics: metricMap(rawCdpMetrics.metrics),
      endedAt: Date.now(),
      liveMetrics,
      startedAt
    })
    const serverTimings = liveMetrics.serverTimings.map(timing => ({ ...timing }))

    const screenshotName = `${options.surface}-w${viewport.width}.png`
    if (writeArtifacts) {
      await page.screenshot({
        animations: 'disabled',
        path: path.join(options.outDir, screenshotName)
      })
    }

    if (options.trace) {
      await context.tracing.stop({
        path: path.join(options.diagnosticsDir, traceName)
      })
    }

    const video = recordVideo ? page.video() : null
    await context.close()
    contextClosed = true
    let videoName = null
    if (video && writeArtifacts) {
      const temporaryPath = await video.path()
      videoName = `${options.surface}-w${viewport.width}.webm`
      await rename(temporaryPath, path.join(options.outDir, videoName))
    }

    return {
      harFile: options.har ? harName : null,
      metrics,
      screenshot: writeArtifacts ? screenshotName : null,
      serverTimings,
      stepTimings,
      traceId: traceparent.traceId,
      traceFile: options.trace ? traceName : null,
      video: videoName
    }
  } finally {
    if (context && !contextClosed) await context.close().catch(() => {})
    if (temporaryVideoDirectory) {
      await rm(temporaryVideoDirectory, { force: true, recursive: true })
    }
  }
}

const NUMERIC_METRICS = [
  'blockingTimeMs',
  'cls',
  'domContentLoadedMs',
  'fcpMs',
  'inpMs',
  'interactionCount',
  'jsHeapUsedBytes',
  'lcpMs',
  'loadMs',
  'longTaskCount',
  'navigationDurationMs',
  'navigationCount',
  'nodeCount',
  'requestCount',
  'resourceCount',
  'transferBytes',
  'wallTimeMs'
]

function combineRuns(runs) {
  if (runs.length === 1) return runs[0]
  const last = runs.at(-1)
  const metrics = { ...last.metrics }
  for (const name of NUMERIC_METRICS) {
    const digits = name === 'cls' ? 3 : 0
    metrics[name] = round(median(runs.map(run => run.metrics[name])), digits)
  }
  for (const listName of ['badResponses', 'consoleErrors', 'pageErrors', 'failedRequests']) {
    const seen = new Set()
    metrics[listName] = runs
      .flatMap(run => run.metrics[listName])
      .filter(item => {
        const key = JSON.stringify(item)
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
  }
  return { ...last, metrics, traceIds: runs.map(run => run.traceId) }
}

async function captureViewport({ browser, budgets, flow, options, viewport }) {
  const runs = []
  const runCount = options.runs ?? 1
  for (let run = 1; run <= runCount; run += 1) {
    const writeArtifacts = run === runCount
    if (runCount > 1) console.log(`  run ${run}/${runCount}...`)
    runs.push(
      await captureViewportOnce({
        browser,
        flow,
        options,
        runCount,
        runNumber: run,
        viewport,
        writeArtifacts
      })
    )
  }
  const combined = combineRuns(runs)

  return {
    assessment: assess(combined.metrics, budgets, options.strict === true),
    harFile: combined.harFile,
    label: viewport.label,
    metrics: combined.metrics,
    runs: runCount,
    screenshot: combined.screenshot,
    serverTimings: combined.serverTimings,
    stepTimings: combined.stepTimings,
    traceId: combined.traceId,
    traceIds: combined.traceIds ?? [combined.traceId],
    traceFile: combined.traceFile,
    video: combined.video,
    viewport: { height: viewport.height, width: viewport.width }
  }
}

async function findBaseline(options, repository = repositoryContext()) {
  if (options.noBaseline) return null
  if (options.baselinePath) {
    const absolutePath = path.resolve(options.baselinePath)
    const source =
      repository && isContained(repository.root, absolutePath)
        ? repositoryRelativePath(repository.root, absolutePath)
        : path.basename(absolutePath)
    return {
      report: await loadJson(options.baselinePath, 'Baseline file'),
      source
    }
  }
  if (!repository) return null
  const parent = path.dirname(path.resolve(options.outDir))
  if (!isContained(repository.root, parent)) return null
  const relativeParent = repositoryRelativePath(repository.root, parent)
  const current = path.basename(path.resolve(options.outDir))
  const candidates = []
  const committedPaths = runGit(
    ['ls-tree', '-rz', '--name-only', repository.sha, '--', relativeParent],
    repository.root
  )
    .split('\0')
    .filter(Boolean)
  for (const relativePath of committedPaths) {
    const pathWithinParent = path.posix.relative(relativeParent, relativePath)
    const parts = pathWithinParent.split('/')
    if (parts.length !== 2 || parts[0] === current || parts[1] !== 'metrics.json') continue
    try {
      const report = readHeadJson(repository, relativePath, 'Baseline candidate')
      if (report.surface === options.surface && report.generatedAt) {
        candidates.push({ report, sha: repository.sha, source: relativePath })
      }
    } catch {
      // Not an evidence directory — skip.
    }
  }
  candidates.sort((a, b) =>
    String(a.report.generatedAt).localeCompare(String(b.report.generatedAt))
  )
  return candidates.at(-1) ?? null
}

function computeBaselineDiff(results, baseline) {
  if (!baseline) return null
  const diffs = []
  for (const result of results) {
    const previous = baseline.report.results?.find(
      candidate => candidate?.viewport?.width === result.viewport.width
    )
    if (!previous) continue
    for (const metricName of BASELINE_DELTA_METRICS) {
      const currentValue = result.metrics[metricName]
      const previousValue = previous.metrics?.[metricName]
      if (!Number.isFinite(currentValue) || !Number.isFinite(previousValue)) continue
      const digits = metricName === 'cls' ? 3 : 0
      diffs.push({
        baseline: previousValue,
        current: currentValue,
        delta: round(currentValue - previousValue, digits),
        metric: metricName,
        width: result.viewport.width
      })
    }
  }
  return {
    diffs,
    generatedAt: baseline.report.generatedAt,
    sha: baseline.sha ?? null,
    source: baseline.source
  }
}

function formatMetric(value, unit = '') {
  return value === null || value === undefined ? 'N/A' : `${value}${unit}`
}

function formatBytes(bytes) {
  if (bytes === null || bytes === undefined) return 'N/A'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 ** 2) return `${round(bytes / 1024, 1)} KiB`
  return `${round(bytes / 1024 ** 2, 2)} MiB`
}

function formatDelta(diff) {
  const arrow = diff.delta > 0 ? '▲' : diff.delta < 0 ? '▼' : '='
  const value =
    diff.metric === 'transferBytes'
      ? formatBytes(Math.abs(diff.delta))
      : `${Math.abs(diff.delta)}${diff.metric.endsWith('Ms') ? ' ms' : ''}`
  return `${arrow} ${diff.delta === 0 ? 'no change' : value}`
}

function buildReadme(report) {
  const rows = report.results.map(result => {
    const metrics = result.metrics
    return `| ${result.assessment.pass ? 'PASS' : 'FAIL'} | ${result.viewport.width} | ${formatMetric(metrics.fcpMs, ' ms')} | ${formatMetric(metrics.lcpMs, ' ms')} | ${formatMetric(metrics.cls)} | ${formatMetric(metrics.inpMs, ' ms')} | ${formatMetric(metrics.blockingTimeMs, ' ms')} | ${formatBytes(metrics.transferBytes)} | ${metrics.requestCount} | ${metrics.badResponses.length}/${metrics.consoleErrors.length}/${metrics.pageErrors.length}/${metrics.failedRequests.length} |`
  })
  const overBudget = predicate =>
    report.results.flatMap(result =>
      result.assessment.checks
        .filter(check => !check.pass && predicate(check))
        .map(
          check =>
            `- ${result.viewport.width}px: \`${check.name}\` = ${check.value} (budget <= ${check.budget})`
        )
    )
  const failures = overBudget(check => check.enforced)
  const measuredOverBudget = overBudget(check => !check.enforced)

  const screenshots = report.results
    .filter(result => result.screenshot)
    .map(
      result =>
        `### ${result.label} (${result.viewport.width}px)\n\n[![${report.surface} at ${result.viewport.width}px](./${result.screenshot})](./${result.screenshot})`
    )
    .join('\n\n')
  const videos = report.results
    .filter(result => result.video)
    .map(result => `- [${result.label} (${result.viewport.width}px)](./${result.video})`)

  const stepRows = (report.results.find(result => result.stepTimings)?.stepTimings ?? []).map(
    step =>
      `| ${step.step} | ${step.action} | \`${step.selector ?? ''}\` | ${step.durationMs} ms |${step.screenshot ? ` [png](./${step.screenshot}) |` : ' |'}`
  )

  const regressionRows = (report.baseline?.diffs ?? [])
    .filter(diff => diff.delta !== 0)
    .map(
      diff =>
        `| ${diff.width} | \`${diff.metric}\` | ${diff.baseline} | ${diff.current} | ${formatDelta(diff)} |`
    )

  const traceLine = report.results
    .map(result => `${result.viewport.width}px: \`${result.traceId}\``)
    .join(' · ')
  const baselineRevision = report.baseline?.sha ? ` at commit \`${report.baseline.sha}\`` : ''

  return `# UI evidence: ${report.surface}

- **URL:** ${report.url}
- **Captured:** ${report.generatedAt}
- **Runs per viewport:** ${report.runs}${report.runs > 1 ? ' (numbers are per-metric medians; visuals from the last run)' : ''}
- **UI changed:** yes
- **Verdict:** ${report.pass ? 'PASS' : 'FAIL'}${report.strict ? ' (strict: paint timings, bytes and request counts gate too)' : ' (broken requests, page errors and console errors gate; timings and weight are measured, not gated)'}

## What changed

- Replace this line with a concise description of the user-visible change.

## Performance

| Result | Width | FCP | LCP | CLS | INP* | Blocking | Transfer | Requests | HTTP/console/page/request errors |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
${rows.join('\n')}

*INP column = worst interaction latency observed in this lab run (N/A without a flow — run \`--flow\` for responsiveness evidence).

${failures.length > 0 ? `### Budget failures\n\n${failures.join('\n')}\n` : 'No broken request, page error or console error was recorded.\n'}
${measuredOverBudget.length > 0 ? `### Over the production budget, not gated here\n\nThis run was not \`--strict\`, so paint timings, bytes and request counts are measurements rather than a gate - a dev server compiles on demand and serves every module separately.\n\n${measuredOverBudget.join('\n')}\n` : ''}
${
  regressionRows.length > 0
    ? `### Change vs previous evidence\n\nBaseline: \`${report.baseline.source}\`${baselineRevision} (${report.baseline.generatedAt})\n\n| Width | Metric | Was | Is | Δ |\n|---:|---|---:|---:|---|\n${regressionRows.join('\n')}\n`
    : report.baseline
      ? `### Change vs previous evidence\n\nNo metric deltas vs \`${report.baseline.source}\`${baselineRevision}.\n`
      : ''
}
Lab measurements are directional. Use a production build or deployed preview for a strict performance gate; development-mode compilation can inflate timings.${report.videoWithMetrics ? ' Video recording was enabled for every measured run, so reported medians do not mix recorded and unrecorded samples.' : ''}${report.results.some(result => result.metrics.navigationCount > 1) ? ' Multi-page flows aggregate every document: paint, layout, and navigation timings use the worst document while requests, transfers, long tasks, errors, and interactions cover the full journey.' : ''}${report.diagnosticsEnabled ? ' Trace/HAR instrumentation was enabled for every measured run and stored separately in the gitignored diagnostics directory.' : ''}

## Backend correlation

Each viewport run sent a W3C \`traceparent\` header — ${traceLine}. Query HyperDX for these trace ids to correlate browser timings with backend spans.${report.results.some(result => result.serverTimings.length > 0) ? ' Server-Timing samples are in `metrics.json`.' : ' No Server-Timing headers were observed.'}

## Screenshots

${screenshots}

${videos.length > 0 ? `## Interaction videos\n\n${videos.join('\n')}\n` : ''}
${stepRows.length > 0 ? `## Flow steps\n\n| # | Action | Target | Duration | Screenshot |\n|---:|---|---|---:|---|\n${stepRows.join('\n')}\n` : ''}
## UX review

- [ ] Primary action and information hierarchy are immediately clear.
- [ ] Spacing, typography, color, focus, loading, and motion feel deliberate.
- [ ] No clipping, overflow, layout shift, or unusable state at 390/768/1280px.
- [ ] Interaction latency (INP) reviewed when a flow ran.
- [ ] Console, page, response, and request failures were reviewed.

## Residual risks

- Replace this line with real residual risks, or write “None identified”.
`
}

async function main() {
  const options = parseArgs(process.argv)
  const playwright = await resolvePlaywright()
  const customBudgets = options.budgetPath ? await loadJson(options.budgetPath, 'Budget file') : {}
  const budgets = { ...DEFAULT_BUDGETS, ...customBudgets }
  const flow = options.flowPath ? await loadJson(options.flowPath, 'Flow file') : null
  if (flow && !Array.isArray(flow)) throw new Error('Flow JSON must contain an array')
  if (options.storageState) await validateStorageStatePath(options.storageState)

  await mkdir(options.outDir, { recursive: true })
  options.diagnosticsDir = await prepareDiagnosticsDirectory(options)
  const browser = await playwright.chromium.launch({ headless: true })
  const results = []

  try {
    for (const viewport of VIEWPORTS) {
      // A surface can refuse to draw below a width - the campaign board puts up
      // a "use a wider screen" notice under 768px. Its flow cannot run there, so
      // the viewport is still captured, just without the flow: the screenshot of
      // the notice is the evidence for that width, and saying so out loud keeps
      // a skipped flow from reading as a flow that passed.
      const flowFitsViewport = flow !== null && viewport.width >= options.flowMinWidth
      const suffix = flow !== null && !flowFitsViewport ? ' - no flow, under --flow-min-width' : ''
      console.log(`Capturing ${viewport.label} (${viewport.width}x${viewport.height})${suffix}...`)
      results.push(
        await captureViewport({
          browser,
          budgets,
          flow: flowFitsViewport ? flow : null,
          options,
          viewport
        })
      )
    }
  } finally {
    await browser.close()
  }

  const baseline = computeBaselineDiff(results, await findBaseline(options))
  const report = {
    baseline,
    budgets,
    diagnosticsEnabled: Boolean(options.diagnosticsDir),
    generatedAt: new Date().toISOString(),
    pass: results.every(result => result.assessment.pass),
    results,
    runs: options.runs,
    strict: options.strict === true,
    surface: options.surface,
    url: redactUrl(options.url),
    videoWithMetrics: options.video
  }
  await writeFile(path.join(options.outDir, 'metrics.json'), `${JSON.stringify(report, null, 2)}\n`)
  await writeFile(path.join(options.outDir, 'README.md'), buildReadme(report))

  console.log(`Wrote UI evidence to ${options.outDir}`)
  if (options.diagnosticsDir) {
    console.log(`Wrote private trace/HAR diagnostics to ${options.diagnosticsDir}`)
  }
  console.log(`Budget result: ${report.pass ? 'PASS' : 'FAIL'}`)
  if (baseline?.diffs?.some(diff => diff.delta > 0)) {
    console.log(
      'Regressions vs previous evidence detected — see README "Change vs previous evidence".'
    )
  }
  if (options.strict && !report.pass) process.exitCode = 2
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    console.error(error.stack ?? error.message)
    process.exit(1)
  })
}

export {
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
}
