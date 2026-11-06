import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import {verifyWeatherRegression} from '../lib/world-weather-regression.mjs'
import {ENVIRONMENT_EVIDENCE_MANIFEST} from '../lib/world-environment-evidence.mjs'

test('reads the registered weather dataset and reproduces the checkpoint results on 358 daily targets', () => {
  const result = verifyWeatherRegression()
  assert.equal(result.evaluationWindows, 358)
  assert.equal(result.sourceFields.length, 4)
  assert.equal(result.metrics.trajectoryOrigins.length, 12)
  assert.equal(result.metrics.productionAdmitted, false)
  assert.equal(Object.keys(result.metrics.conditions).length, 6)
  assert(result.bindings.every(ref => ref.path !== 'data/world-runtime/mvp-natural-owner-001/mvp-natural-world-001.json'))
})

test('rejects a replaced contract even if it is the same length and the evidence inventory is authentic', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'world-weather-quality-'))
  const files = []
  t.after(() => {
    const directories = new Set([root])
    for (const file of files) {
      fs.unlinkSync(file)
      for (let dir = path.dirname(file); dir.startsWith(root + path.sep); dir = path.dirname(dir)) directories.add(dir)
    }
    for (const dir of [...directories].sort((a,b) => b.length - a.length)) fs.rmdirSync(dir)
  })
  const manifest = fs.readFileSync(ENVIRONMENT_EVIDENCE_MANIFEST)
  const contractPath = JSON.parse(manifest).roots.evaluationContract
  const original = fs.readFileSync(contractPath)
  const changed = Buffer.from(original)
  changed[0] ^= 1
  for (const [name, bytes] of [[ENVIRONMENT_EVIDENCE_MANIFEST, manifest],[contractPath, changed]]) {
    const dest = path.join(root, name)
    fs.mkdirSync(path.dirname(dest), {recursive:true})
    fs.writeFileSync(dest, bytes, {flag:'wx'})
    files.push(dest)
  }
  assert.throws(() => verifyWeatherRegression(root), error => error.actual !== error.expected && error.message.includes(contractPath))
})
