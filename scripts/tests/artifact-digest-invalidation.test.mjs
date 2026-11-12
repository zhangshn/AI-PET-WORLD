import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import { DatabaseSync } from 'node:sqlite'
import { test } from 'node:test'
const ts = createRequire(process.cwd() + '/package.json')('typescript')

function loadFunction(file, name, dependencies) {
  const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true)
  const fn = source.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === name)
  assert(fn, name)
  const text = fn.getText(source).replace(/^export /u, '')
  const script = ts.transpileModule(`globalThis.invoke = (${text});`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  }).outputText
  const context = vm.createContext(dependencies)
  vm.runInContext(script, context, { filename: file, timeout: 1000 })
  return context.invoke
}

function fixture() {
  const db = new DatabaseSync(':memory:')
  db.exec(`CREATE TABLE artifacts (
    logical_path TEXT PRIMARY KEY, physical_uri TEXT NOT NULL, storage_layer TEXT NOT NULL,
    run_id TEXT, artifact_type TEXT, byte_size INTEGER NOT NULL, modified_at_utc TEXT NOT NULL,
    sha256 TEXT, migration_id TEXT, indexed_at_utc TEXT NOT NULL
  )`)
  const index = loadFunction('scripts/lib/ai-pet-world-storage-catalog.mjs', 'indexArtifact', {
    openStorageCatalog: () => db, artifactType: () => 'record',
  })
  const runtime = path.resolve('fixture-runtime'), physical = path.resolve('fixture-physical')
  const input = { logicalPath: '.runtime/report.json', physicalUri: path.join(physical, 'report.json'),
    storageLayer: 'hot', runId: 'fixture-run', artifactType: 'record', byteSize: 20,
    modifiedAtUtc: '2026-01-01T00:00:00.000Z', sha256: 'a'.repeat(64) }
  index(input)
  let closes = 0
  const runtimeIndex = info => loadFunction('src/server/ai-pet-world-storage-catalog.ts', 'indexRuntimeArtifactPaths', {
    openCatalog: () => ({ prepare: db.prepare.bind(db), close: () => { closes++ } }),
    path, aiPetWorldRuntimeRoot: runtime, aiPetWorldPhysicalRuntimeRoot: physical,
    collectRuntimeFiles: async () => [path.join(runtime, 'report.json')],
    runtimeArtifactStat: async () => ({ size: info.byteSize, mtime: new Date(info.modifiedAtUtc) }), artifactType: () => 'record',
  })(['fixture'], 'fixture-run')
  return { db, index, input, runtimeIndex, closes: () => closes,
    row: () => db.prepare('SELECT * FROM artifacts WHERE logical_path=?').get(input.logicalPath) }
}

for (const [label, changes] of [
  ['changed size', { byteSize: 30 }],
  ['changed modification time', { modifiedAtUtc: '2026-01-02T00:00:00.000Z' }],
  ['unchanged metadata without a fresh content hash', {}],
  ['changed physical location', { physicalUri: 'another-file' }],
]) test(`script artifact writer invalidates old digest: ${label}`, () => {
  const f = fixture()
  try {
    f.index({ ...f.input, ...changes, sha256: null })
    const row = f.row()
    assert.equal(row.sha256, null)
    assert.equal(row.byte_size, changes.byteSize ?? f.input.byteSize)
    assert.equal(row.physical_uri, changes.physicalUri ?? f.input.physicalUri)
    assert.equal(row.run_id, f.input.runId)
  } finally { f.db.close() }
})

test('script artifact writer records a supplied replacement digest', () => {
  const f = fixture()
  try { f.index({ ...f.input, byteSize: 25, sha256: 'b'.repeat(64) }); assert.equal(f.row().sha256, 'b'.repeat(64)) }
  finally { f.db.close() }
})

for (const [label, changes] of [
  ['changed size', { byteSize: 30 }],
  ['changed time', { modifiedAtUtc: '2026-01-02T00:00:00.000Z' }],
  ['unchanged metadata', {}],
]) test(`server metadata-only indexing invalidates old digest: ${label}`, async () => {
  const f = fixture()
  try {
    const result = await f.runtimeIndex({ ...f.input, ...changes })
    assert.equal(result.indexed, 1)
    assert.equal(f.row().sha256, null)
    assert.equal(f.row().byte_size, changes.byteSize ?? f.input.byteSize)
    assert.equal(f.row().run_id, f.input.runId)
    assert.equal(f.closes(), 1)
  } finally { f.db.close() }
})

test('a fresh explicitly supplied digest can be recorded after metadata-only indexing', async () => {
  const f = fixture()
  try {
    await f.runtimeIndex(f.input)
    f.index({ ...f.input, sha256: 'c'.repeat(64) })
    assert.equal(f.row().sha256, 'c'.repeat(64))
  } finally { f.db.close() }
})

function scanFixture({ stat, readdir }) {
  const root = path.resolve('fixture-runtime')
  const scan = loadFunction('src/server/ai-pet-world-storage-catalog.ts', 'collectRuntimeFiles', {
    path, aiPetWorldRuntimeRoot: root, runtimeArtifactStat: stat, readdir,
  })
  return { root, scan }
}

for (const code of ['EACCES', 'EIO']) for (const stage of ['stat', 'readdir']) {
  test(`artifact scan preserves ${stage} ${code} instead of returning an empty listing`, async () => {
    const failure = Object.assign(new Error('fixture read failure'), { code })
    const f = scanFixture({
      stat: async () => { if (stage === 'stat') throw failure; return { isFile: () => false, isDirectory: () => true } },
      readdir: async () => { throw failure },
    })
    await assert.rejects(f.scan(f.root), e => e === failure)
  })
}

for (const stage of ['stat', 'readdir']) test(`artifact scan retains missing ${stage} compatibility`, async () => {
  const missing = Object.assign(new Error('missing'), { code: 'ENOENT' })
  const f = scanFixture({
    stat: async () => { if (stage === 'stat') throw missing; return { isFile: () => false, isDirectory: () => true } },
    readdir: async () => { throw missing },
  })
  assert.equal((await f.scan(f.root)).length, 0)
})

test('artifact scan retains a real empty directory', async () => {
  const f = scanFixture({ stat: async () => ({ isFile: () => false, isDirectory: () => true }), readdir: async () => [] })
  assert.equal((await f.scan(f.root)).length, 0)
})

test('artifact scan retains a regular file', async () => {
  const f = scanFixture({ stat: async () => ({ isFile: () => true }), readdir: async () => { throw new Error('must not read directory') } })
  const file = path.join(f.root, 'report.json')
  assert.deepEqual(Array.from(await f.scan(file)), [file])
})

test('artifact scan retains recursive directory traversal', async () => {
  const entry = (name, directory) => ({ name, isFile: () => !directory, isDirectory: () => directory, isSymbolicLink: () => false })
  const f = scanFixture({ stat: async () => ({ isFile: () => false, isDirectory: () => true }),
    readdir: async dir => dir === f.root ? [entry('child', true), entry('root.json', false)] : [entry('nested.json', false)] })
  assert.deepEqual(Array.from(await f.scan(f.root)), [path.join(f.root, 'child', 'nested.json'), path.join(f.root, 'root.json')])
})

test('artifact indexing propagates a scan failure and closes its database', async () => {
  const failure = new Error('fixture scan failure')
  let closes = 0, writes = 0
  const index = loadFunction('src/server/ai-pet-world-storage-catalog.ts', 'indexRuntimeArtifactPaths', {
    openCatalog: () => ({ prepare: () => ({ run: () => { writes++ } }), close: () => { closes++ } }),
    collectRuntimeFiles: async () => { throw failure },
  })
  await assert.rejects(index(['fixture']), e => e === failure)
  assert.equal(closes, 1)
  assert.equal(writes, 0)
})

function realScanFixture(t) {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'artifact-path-test-'))
  const root = path.join(parent, 'logical'), physical = path.join(parent, 'physical')
  const outside = path.join(parent, 'outside'), links = []
  fs.mkdirSync(physical); fs.mkdirSync(outside)
  const link = (target, name) => { fs.symlinkSync(target, name, 'junction'); links.push(name) }
  link(physical, root)
  t.after(() => {
    // Remove only our links before deleting this exact private fixture root.
    for (const item of links.reverse()) if (fs.existsSync(item)) fs.unlinkSync(item)
    assert.equal(path.dirname(parent), path.resolve(os.tmpdir()))
    assert(path.basename(parent).startsWith('artifact-path-test-'))
    fs.rmSync(parent, { recursive: true, force: true })
  })
  const sourceFile = 'src/server/ai-pet-world-storage-catalog.ts'
  const dependencies = { path, aiPetWorldRuntimeRoot: root, aiPetWorldPhysicalRuntimeRoot: physical,
    stat: fs.promises.stat, realpath: fs.promises.realpath, readdir: fs.promises.readdir }
  if (fs.readFileSync(sourceFile, 'utf8').includes('async function runtimeArtifactStat(')) {
    dependencies.runtimeArtifactStat = loadFunction(sourceFile, 'runtimeArtifactStat', dependencies)
  }
  return { root, physical, outside, link, dependencies,
    scan: loadFunction(sourceFile, 'collectRuntimeFiles', dependencies) }
}

test('artifact scan accepts the registered runtime junction', async t => {
  const f = realScanFixture(t)
  fs.writeFileSync(path.join(f.physical, 'ordinary.json'), '{}')
  assert.deepEqual(Array.from(await f.scan(f.root)), [path.join(f.root, 'ordinary.json')])
})

test('artifact scan accepts a legitimate name beginning with two dots', async t => {
  const f = realScanFixture(t), file = path.join(f.root, '..record.json')
  fs.writeFileSync(file, '{}')
  assert.deepEqual(Array.from(await f.scan(file)), [file])
})

for (const target of ['directory', 'descendant', 'recursive']) {
  test(`artifact scan rejects an unregistered junction: ${target}`, async t => {
    const f = realScanFixture(t), redirect = path.join(f.physical, 'redirect')
    fs.writeFileSync(path.join(f.outside, 'external.json'), '{}')
    f.link(f.outside, redirect)
    const input = target === 'recursive' ? f.root : path.join(f.root, 'redirect', ...(target === 'descendant' ? ['external.json'] : []))
    await assert.rejects(f.scan(input), /runtime_artifact_path_redirected/)
  })
}

test('artifact scan rejects a runtime root pointing at an unregistered location', async t => {
  const f = realScanFixture(t)
  fs.unlinkSync(f.root); fs.symlinkSync(f.outside, f.root, 'junction')
  await assert.rejects(f.scan(f.root), /runtime_artifact_path_redirected/)
})

test('artifact indexing rechecks a file redirected after discovery before writing metadata', async t => {
  const f = realScanFixture(t), redirect = path.join(f.physical, 'redirect')
  fs.writeFileSync(path.join(f.outside, 'external.json'), '{}')
  f.link(f.outside, redirect)
  let writes = 0, closes = 0
  const index = loadFunction('src/server/ai-pet-world-storage-catalog.ts', 'indexRuntimeArtifactPaths', {
    ...f.dependencies, artifactType: () => 'record',
    openCatalog: () => ({ prepare: () => ({ run: () => { writes++ } }), close: () => { closes++ } }),
    collectRuntimeFiles: async () => [path.join(f.root, 'redirect', 'external.json')],
  })
  await assert.rejects(index(['fixture']), /runtime_artifact_path_redirected/)
  assert.equal(writes, 0)
  assert.equal(closes, 1)
})
