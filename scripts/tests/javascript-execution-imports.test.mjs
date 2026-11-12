import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import {collectActualExecutionSources as collectGeneral} from '../lib/ai-painter-execution-source-closure-v1.mjs'
import {collectActualExecutionSources as collectDecode} from '../lib/ai-painter-decode1-entry-weight-quality-source-closure-v1.mjs'

function fixture(t, files) {
  const parent = fs.realpathSync(os.tmpdir())
  const root = fs.mkdtempSync(path.join(parent, 'javascript-import-closure-'))
  t.after(() => {
    assert.equal(path.dirname(root), parent)
    assert(path.basename(root).startsWith('javascript-import-closure-'))
    assert.equal(fs.realpathSync(root), root)
    assert(!fs.lstatSync(root).isSymbolicLink())
    fs.rmSync(root, {recursive: true})
  })
  for (const [name, source] of Object.entries(files)) {
    fs.writeFileSync(path.join(root, name), source + "\nthrow Error('collected source must not execute')\n")
  }
  return {root, bind: file => ({path: file, sha256: crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex')})}
}

for (const [name, collect] of [['general', collectGeneral], ['decode', collectDecode]]) {
  test(`${name} accepts a JavaScript export preceding its imported binding`, t => {
    const options = fixture(t, {'entry.mjs': "export { value };\nimport { value } from './dep.mjs';", 'dep.mjs': 'export const value = 1;'})
    const result = collect({...options, required: {entry: 'entry.mjs'}})
    assert.deepEqual(Object.values(result).map(row => row.path).sort(), ['dep.mjs', 'entry.mjs'])
  })

  test(`${name} still rejects a missing JavaScript dependency after the export`, t => {
    const options = fixture(t, {'entry.mjs': "export { value };\nimport { value } from './missing.mjs';"})
    assert.throws(() => collect({...options, required: {entry: 'entry.mjs'}}), /unresolved static execution dependency/u)
  })

  test(`${name} still rejects an undefined JavaScript export`, t => {
    const options = fixture(t, {'entry.mjs': 'export { missing };'})
    assert.throws(() => collect({...options, required: {entry: 'entry.mjs'}}), /not defined/u)
  })

  test(`${name} retains TypeScript syntax and runtime dependencies for TypeScript files`, t => {
    const options = fixture(t, {'entry.ts': "import { value } from './dep.mjs';\nexport const output: number = value;", 'dep.mjs': 'export const value = 1;'})
    const result = collect({...options, required: {entry: 'entry.ts'}})
    assert.deepEqual(Object.values(result).map(row => row.path).sort(), ['dep.mjs', 'entry.ts'])
  })

  test(`${name} rejects TypeScript-only syntax in a JavaScript file`, t => {
    const options = fixture(t, {'entry.mjs': 'export const value: number = 1;'})
    assert.throws(() => collect({...options, required: {entry: 'entry.mjs'}}), SyntaxError)
  })
}
