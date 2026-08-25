#!/usr/bin/env node

import { readFile } from 'node:fs/promises'
import process from 'node:process'

const files = process.argv.slice(2)
const findings = []

function tokenize(source) {
  const tokens = []
  let index = 0
  while (index < source.length) {
    const character = source[index]
    const next = source[index + 1]
    if (/\s/.test(character)) {
      index += 1
      continue
    }
    if (character === '/' && next === '/') {
      index = source.indexOf('\n', index + 2)
      if (index === -1) break
      continue
    }
    if (character === '/' && next === '*') {
      const end = source.indexOf('*/', index + 2)
      index = end === -1 ? source.length : end + 2
      continue
    }
    if (character === "'" || character === '"' || character === '`') {
      const quote = character
      index += 1
      while (index < source.length) {
        if (source[index] === '\\') index += 2
        else if (source[index] === quote) {
          index += 1
          break
        } else index += 1
      }
      continue
    }
    if (/[A-Za-z_$]/.test(character)) {
      const start = index
      index += 1
      while (index < source.length && /[A-Za-z0-9_$]/.test(source[index])) index += 1
      tokens.push({ position: start, value: source.slice(start, index) })
      continue
    }
    tokens.push({ position: index, value: character })
    index += 1
  }
  return tokens
}

function closingToken(tokens, openingIndex) {
  const pairs = { '(': ')', '[': ']', '{': '}' }
  const expected = pairs[tokens[openingIndex]?.value]
  if (!expected) return -1
  const stack = [expected]
  for (let index = openingIndex + 1; index < tokens.length; index += 1) {
    const value = tokens[index].value
    if (pairs[value]) stack.push(pairs[value])
    else if (value === stack.at(-1)) {
      stack.pop()
      if (stack.length === 0) return index
    }
  }
  return -1
}

function chainHasWhere(tokens, callOpeningIndex) {
  let index = closingToken(tokens, callOpeningIndex) + 1
  if (index === 0) return false
  while (index < tokens.length) {
    while (tokens[index]?.value === '!' || tokens[index]?.value === '?') index += 1
    if (tokens[index]?.value !== '.') return false
    const property = tokens[index + 1]?.value
    index += 2
    while (tokens[index]?.value === '?' || tokens[index]?.value === '!') index += 1
    if (property === 'where' && tokens[index]?.value === '(') return true
    if (tokens[index]?.value !== '(') continue
    const closingIndex = closingToken(tokens, index)
    if (closingIndex === -1) return false
    index = closingIndex + 1
  }
  return false
}

for (const file of files) {
  const source = await readFile(file, 'utf8')
  const tokens = tokenize(source)
  for (let index = 0; index < tokens.length - 3; index += 1) {
    const owner = tokens[index].value
    const method = tokens[index + 2].value
    if (
      (owner === 'db' || owner === 'trx') &&
      tokens[index + 1].value === '.' &&
      (method === 'delete' || method === 'update') &&
      tokens[index + 3].value === '(' &&
      !chainHasWhere(tokens, index + 3)
    ) {
      const line = source.slice(0, tokens[index].position).split('\n').length
      findings.push(`${file}:${line}`)
    }
  }
}

for (const finding of findings) console.log(`CHECK: ${finding}`)
if (findings.length > 0) process.exitCode = 1
