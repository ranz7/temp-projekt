#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import { lstat, mkdir, readdir, readFile, realpath, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

import { buildSelfContainedReport, projectPublicMetrics } from './public-report.mjs'

function run(command, args, options = {}) {
  const output = execFileSync(command, args, {
    cwd: options.cwd,
    encoding: 'utf8',
    stdio: options.stdio ?? ['ignore', 'pipe', 'pipe']
  })
  return typeof output === 'string' ? output.trim() : ''
}

function parseArgs(argv) {
  let directory = null
  let out = null
  for (let index = 2; index < argv.length; index += 1) {
    if (argv[index] === '--dir') directory = argv[++index]
    else if (argv[index] === '--out') out = argv[++index]
    else if (argv[index] === '--help' || argv[index] === '-h') {
      console.log('Usage: node build-report.mjs --dir evidence/<evidence-directory> [--out <path>]')
      process.exit(0)
    } else throw new Error(`Unknown argument: ${argv[index]}`)
  }
  if (!directory) throw new Error('Required: --dir evidence/<evidence-directory>')
  return { directory, out }
}

function isContained(root, candidate) {
  const relative = path.relative(root, candidate)
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))
}

async function resolveEvidenceDirectory(repositoryRoot, requestedDirectory) {
  const canonicalRepositoryRoot = await realpath(repositoryRoot)
  const lexicalDirectory = path.resolve(canonicalRepositoryRoot, requestedDirectory)
  if (!isContained(canonicalRepositoryRoot, lexicalDirectory)) {
    throw new Error('Evidence directory must be inside the current repository')
  }
  const directoryInfo = await lstat(lexicalDirectory)
  if (!directoryInfo.isDirectory() || directoryInfo.isSymbolicLink()) {
    throw new Error('Evidence directory must be a regular directory, not a symbolic link')
  }
  const absoluteDirectory = await realpath(lexicalDirectory)
  if (!isContained(canonicalRepositoryRoot, absoluteDirectory)) {
    throw new Error('Canonical evidence directory must remain inside the current repository')
  }
  const relativeDirectory = path
    .relative(canonicalRepositoryRoot, absoluteDirectory)
    .split(path.sep)
    .join('/')
  if (!relativeDirectory) throw new Error('Evidence directory cannot be the repository root')
  return { absoluteDirectory, relativeDirectory, repositoryRoot: canonicalRepositoryRoot }
}

function assertNoTrackedDiagnostics(files, directory) {
  const diagnostics = files.filter(file => /(?:\.har|-trace\.zip)$/i.test(file))
  if (diagnostics.length > 0) {
    throw new Error(
      `Evidence diagnostics must not be embedded in ${directory}: ${diagnostics.join(', ')}`
    )
  }
}

async function readScreenshotData(absoluteDirectory, filenames) {
  const data = new Map()
  for (const filename of filenames) {
    const source = path.join(absoluteDirectory, filename)
    const sourceInfo = await lstat(source)
    if (!sourceInfo.isFile() || sourceInfo.isSymbolicLink()) {
      throw new Error(`Refusing to embed non-regular artifact: ${filename}`)
    }
    data.set(filename, await readFile(source))
  }
  return data
}

async function main() {
  const { directory: requestedDirectory, out } = parseArgs(process.argv)
  const resolved = await resolveEvidenceDirectory(
    run('git', ['rev-parse', '--show-toplevel']),
    requestedDirectory
  )
  const { absoluteDirectory, relativeDirectory, repositoryRoot } = resolved
  const sha = run('git', ['rev-parse', 'HEAD'], { cwd: repositoryRoot })

  const entries = await readdir(absoluteDirectory, { withFileTypes: true })
  const diskFiles = entries
    .filter(entry => entry.isFile() && !entry.isSymbolicLink())
    .map(entry => entry.name)
  assertNoTrackedDiagnostics(diskFiles, relativeDirectory)

  const rawMetrics = JSON.parse(
    await readFile(path.join(absoluteDirectory, 'metrics.json'), 'utf8')
  )
  const metrics = projectPublicMetrics(rawMetrics)

  run('gh', ['auth', 'status'], { cwd: repositoryRoot, stdio: 'ignore' })
  const repository = JSON.parse(
    run('gh', ['repo', 'view', '--json', 'nameWithOwner'], { cwd: repositoryRoot })
  ).nameWithOwner
  const pr = JSON.parse(
    run('gh', ['pr', 'view', '--json', 'number,url,headRefOid'], { cwd: repositoryRoot })
  )
  if (pr.headRefOid !== sha) {
    throw new Error(
      `Push HEAD (${sha.slice(0, 7)}) before building the report; PR has ${pr.headRefOid.slice(0, 7)}`
    )
  }

  const screenshotFilenames = new Set()
  for (const result of metrics.results) {
    screenshotFilenames.add(result.primaryScreenshot)
    for (const step of result.stepScreenshots) screenshotFilenames.add(step.screenshot)
  }
  const screenshotData = await readScreenshotData(absoluteDirectory, [...screenshotFilenames])

  const html = buildSelfContainedReport({
    metrics,
    prNumber: pr.number,
    reportName: path.posix.basename(relativeDirectory),
    repository,
    screenshotData,
    sha
  })

  const outputPath = out
    ? path.resolve(repositoryRoot, out)
    : path.join(absoluteDirectory, 'report.html')
  await mkdir(path.dirname(outputPath), { recursive: true })
  await writeFile(outputPath, html)

  console.log(outputPath)
  console.log(
    'Next: publish this file with the Artifact tool to get a report URL, then run update-pr-body.mjs.'
  )
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    console.error(error.stack || error.message)
    process.exit(1)
  })
}

export { assertNoTrackedDiagnostics, readScreenshotData, resolveEvidenceDirectory }
