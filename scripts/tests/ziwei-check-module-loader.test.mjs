import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import { createZiweiCheckRequire } from '../lib/ziwei-check-module-loader.mjs'

test('Ziwei resolver check verifies canonical dictionary identity and unknown-star rejection', () => {
  const result = spawnSync(process.execPath, ['scripts/ziwei/check-content-detail-resolver.mjs'], {
    cwd: process.cwd(), windowsHide: true, timeout: 30000, encoding: 'utf8', maxBuffer: 1024 * 1024,
  })
  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /\[check-content-detail-resolver\] ok \(\d+ star insight\(s\)\)/u)
})

test('Ziwei check loader resolves nested TypeScript relative to its caller', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ziwei-check-loader-'))
  const require = createRequire(import.meta.url)
  const previous = require.extensions['.ts']
  try {
    fs.writeFileSync(path.join(root, 'dependency.ts'), 'export const value: number = 17;')
    fs.writeFileSync(path.join(root, 'entry.ts'), 'import { value } from "./dependency"; export const result: number = value + 25;')
    const load = createZiweiCheckRequire(pathToFileURL(path.join(root, 'check.mjs')))
    assert.equal(load('./entry.ts').result, 42)
    assert.equal(load.resolve('./entry.ts'), path.join(root, 'entry.ts'))
    assert.throws(() => load('./missing.ts'), { code: 'MODULE_NOT_FOUND' })
  } finally {
    if (previous) require.extensions['.ts'] = previous
    else delete require.extensions['.ts']
    for (const name of ['entry.ts', 'dependency.ts']) delete require.cache[path.join(root, name)]
    assert.equal(path.dirname(path.resolve(root)), path.resolve(os.tmpdir()))
    assert(path.basename(root).startsWith('ziwei-check-loader-'))
    fs.rmSync(root, { recursive: true })
  }
})
