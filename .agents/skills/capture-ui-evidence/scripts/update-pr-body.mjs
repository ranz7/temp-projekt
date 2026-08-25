#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { resolveEvidenceDirectory } from './build-report.mjs'
import { projectPublicMetrics } from './public-report.mjs'

const EVIDENCE_MARKER = '<!-- algoacademy-ui-evidence -->'

function run(command, args, options = {}) {
  const output = execFileSync(command, args, {
    cwd: options.cwd,
    encoding: 'utf8',
    input: options.input,
    stdio: options.stdio ?? ['ignore', 'pipe', 'pipe']
  })
  return typeof output === 'string' ? output.trim() : ''
}

function parseArgs(argv) {
  let directory = null
  let reportUrl = null
  for (let index = 2; index < argv.length; index += 1) {
    if (argv[index] === '--dir') directory = argv[++index]
    else if (argv[index] === '--report-url') reportUrl = argv[++index]
    else if (argv[index] === '--help' || argv[index] === '-h') {
      console.log(
        'Usage: node update-pr-body.mjs --dir evidence/<evidence-directory> --report-url <artifact-url>'
      )
      process.exit(0)
    } else throw new Error(`Unknown argument: ${argv[index]}`)
  }
  if (!directory) throw new Error('Required: --dir evidence/<evidence-directory>')
  if (!reportUrl) throw new Error('Required: --report-url <artifact-url>')
  const parsed = new URL(reportUrl)
  if (parsed.protocol !== 'https:')
    throw new Error('--report-url must be a credential-free HTTPS URL')
  if (parsed.username || parsed.password)
    throw new Error('--report-url must be a credential-free HTTPS URL')
  return { directory, reportUrl: parsed.toString() }
}

function buildEvidenceLine({ reportUrl, pass, sha }) {
  const status = pass ? 'PASS' : 'FAIL'
  const shortSha = sha.slice(0, 7)
  return `${EVIDENCE_MARKER}\n[UI evidence](${reportUrl}) - ${status} - commit \`${shortSha}\``
}

function lineBreakLength(text) {
  if (text.startsWith('\r\n')) return 2
  if (text.startsWith('\n') || text.startsWith('\r')) return 1
  return 0
}

function applyEvidenceLine(existingBody, evidenceLine) {
  const body = existingBody ?? ''
  const markerIndex = body.indexOf(EVIDENCE_MARKER)
  if (markerIndex === -1) {
    if (!body) return evidenceLine
    if (body.endsWith('\n\n') || body.endsWith('\r\n\r\n')) return `${body}${evidenceLine}`
    if (body.endsWith('\n') || body.endsWith('\r')) return `${body}\n${evidenceLine}`
    return `${body}\n\n${evidenceLine}`
  }

  const afterMarker = body.slice(markerIndex + EVIDENCE_MARKER.length)
  const breakAfterMarker = lineBreakLength(afterMarker)
  const afterFirstLine = body.slice(markerIndex + EVIDENCE_MARKER.length + breakAfterMarker)
  const newlineAt = afterFirstLine.search(/\r?\n/)
  const linkLineEnd = newlineAt === -1 ? afterFirstLine.length : newlineAt
  const replaceEnd = markerIndex + EVIDENCE_MARKER.length + breakAfterMarker + linkLineEnd
  return `${body.slice(0, markerIndex)}${evidenceLine}${body.slice(replaceEnd)}`
}

async function main() {
  const { directory: requestedDirectory, reportUrl } = parseArgs(process.argv)
  const resolved = await resolveEvidenceDirectory(
    run('git', ['rev-parse', '--show-toplevel']),
    requestedDirectory
  )
  const { absoluteDirectory, repositoryRoot } = resolved
  const sha = run('git', ['rev-parse', 'HEAD'], { cwd: repositoryRoot })

  const rawMetrics = JSON.parse(
    await readFile(path.join(absoluteDirectory, 'metrics.json'), 'utf8')
  )
  const metrics = projectPublicMetrics(rawMetrics)

  run('gh', ['auth', 'status'], { cwd: repositoryRoot, stdio: 'ignore' })
  const pr = JSON.parse(
    run('gh', ['pr', 'view', '--json', 'number,url,headRefOid,body'], { cwd: repositoryRoot })
  )
  if (pr.headRefOid !== sha) {
    throw new Error(
      `Push HEAD (${sha.slice(0, 7)}) before updating the description; PR has ${pr.headRefOid.slice(0, 7)}`
    )
  }

  const evidenceLine = buildEvidenceLine({
    pass: metrics.pass,
    reportUrl,
    sha
  })
  const nextBody = applyEvidenceLine(pr.body, evidenceLine)
  run('gh', ['pr', 'edit', '--body-file', '-'], {
    cwd: repositoryRoot,
    input: nextBody,
    stdio: ['pipe', 'pipe', 'pipe']
  })
  console.log(`Updated UI evidence link on ${pr.url}`)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    const stderr = error.stderr?.toString().trim()
    console.error(stderr || error.stack || error.message)
    process.exit(1)
  })
}

export { applyEvidenceLine, buildEvidenceLine }
