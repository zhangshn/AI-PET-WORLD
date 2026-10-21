import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'

const root = path.resolve(import.meta.dirname, '../..')
const retired = 'src/app/ai-painter-lab'
const names = ['page.tsx', 'page.module.css', 'ai-painter-lab-status.ts', 'candidate-review-data.ts',
  'candidate-review-panel.tsx', 'layered-asset-status.tsx', 'project-status-tables.tsx', 'quality-sample-status.tsx']
test('old single-asset Lab page and its eight private files are absent, with no replacement route', () => {
  for (const name of names) assert.equal(fs.existsSync(path.join(root, retired, name)), false, name)
  if (fs.existsSync(path.join(root, retired))) assert.deepEqual(fs.readdirSync(path.join(root, retired)), [])
})
test('live source and scripts do not import the retired Lab or its private modules', () => {
  const pattern = 'ai-painter-lab|ai-painter-lab-status|candidate-review-data|candidate-review-panel|layered-asset-status|project-status-tables|quality-sample-status'
  const result = spawnSync('rg', ['-n', pattern, 'src', 'scripts', '-g', '!ai-painter-lab-retirement.test.mjs'],
    { cwd: root, encoding: 'utf8', timeout: 10000, windowsHide: true })
  assert.ifError(result.error)
  assert.equal(result.status, 1, result.stdout || result.stderr)
})
test('shared APIs, original assets, datasets and quality scripts survive page retirement', () => {
  for (const file of ['src/app/api/ai-painter/assets/[assetId]/[view]/route.ts',
    'src/app/api/ai-painter/candidate-reviews/route.ts', 'src/app/api/ai-painter/quality-samples/[sampleId]/image/route.ts',
    'src/app/api/ai-painter/training-control/route.ts', 'src/app/api/ai-painter/current-training/route.ts']) {
    assert.ok(fs.statSync(path.join(root, file)).isFile(), file)
  }
  for (const dir of ['data/ai-painter-assets', 'data/ai-painter-quality', 'data/ai-painter-datasets', 'data/world-samples', 'ml/ai-painter']) {
    assert.ok(fs.statSync(path.join(root, dir)).isDirectory(), dir)
  }
})
test('task snapshot restores all eight files exactly and shared API bytes remain unchanged', {
  skip: !process.env.AI_PAINTER_LAB_RETIREMENT_SNAPSHOT,
}, () => {
  const snapshot = path.resolve(process.env.AI_PAINTER_LAB_RETIREMENT_SNAPSHOT)
  const value = JSON.parse(fs.readFileSync(snapshot, 'utf8'))
  const sha = bytes => createHash('sha256').update(bytes).digest('hex')
  assert.equal(value.files.length, 8)
  for (const file of value.files) {
    assert.ok(names.some(name => file.logicalPath === `${retired}/${name}`))
    const original = fs.readFileSync(path.join(path.dirname(snapshot), 'originals', path.basename(file.logicalPath)))
    assert.equal(original.length, file.bytes); assert.equal(sha(original), file.sha256)
  }
  for (const file of value.sharedApi) {
    assert.ok(file.path.startsWith('src/app/api/ai-painter/') && !file.path.includes('..'))
    assert.equal(sha(fs.readFileSync(path.join(root, file.path))), file.sha256, file.path)
  }
})
test('live old URL returns404 while AI console and backup page remain available', {
  skip: !process.env.AI_PAINTER_LAB_RETIREMENT_ORIGIN,
}, async t => {
  const origin = new URL(process.env.AI_PAINTER_LAB_RETIREMENT_ORIGIN)
  assert.equal(origin.protocol, 'http:'); assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname))
  for (const [route, expected] of [['/ai-painter-lab', 404], ['/ai-console', 200], ['/local-backup', 200]]) {
    const response = await fetch(new URL(route, origin), { redirect: 'manual', signal: AbortSignal.timeout(20000) })
    await response.arrayBuffer()
    assert.equal(response.status, expected, route)
    t.diagnostic(JSON.stringify({ route, status: response.status, acceptance: 'actual_local_http_not_browser_hydration' }))
  }
})
