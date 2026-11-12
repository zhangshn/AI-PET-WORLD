import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { ESLint } from 'eslint'
import { auditAiConsoleSourceBoundary } from '../lib/ai-console-source-boundary-audit.mjs'
import { createRequire } from 'node:module'
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import { readAiConsoleControlSource } from '../lib/ai-console-control-source-reader.mjs'

const root = process.cwd()

test('hydrology checker rejects statistics inconsistent with its source bands', () => {
  const filename = 'scripts/check-earth-geospatial-v7-slot-123-coarse-hydrology-main-channel-repair.mjs'
  const source = fs.readFileSync(path.join(root, filename), 'utf8')
  const ast = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS)
  const declarations = ast.statements.filter(ts.isVariableStatement).flatMap(node => [...node.declarationList.declarations])
  const check = declarations.find(node => node.name.getText(ast) === 'checks').initializer.properties
    .find(node => node.name?.getText(ast) === 'reportedSupportMeansMatchBoundBands')
  assert.ok(check, 'reported means must be checked against the bound source bands')
  const means = ['upperSupportMean', 'lowerSupportMean'].map(name => {
    const declaration = declarations.find(node => node.name.getText(ast) === name)
    assert.ok(declaration)
    return `const ${declaration.getText(ast)};`
  }).join('\n')
  const helpers = ['mean', 'round'].map(name => ast.statements.find(node =>
    ts.isFunctionDeclaration(node) && node.name?.text === name).getText(ast)).join('\n')
  // Only evaluate the checker boundary; never invoke its historical run or event writer.
  const evaluate = new Function('coarseProfile', 'mainChannel', `${helpers}\n${means}\nreturn (${check.initializer.getText(ast)});`)
  const profile = { coarseBands: [0.1, 0.2, 0.8, 0.5, 0.7, 0.2, 0.6, 0.8].map(anonymousSupportFraction => ({ anonymousSupportFraction })) }
  const channel = { selection: { upperQuantizedSupportMean: 0.15, lowerQuantizedSupportMean: 0.533333 } }
  assert.equal(evaluate(profile, channel), true)
  for (const key of ['upperQuantizedSupportMean', 'lowerQuantizedSupportMean']) {
    for (const wrong of [undefined, null, NaN, Infinity, -Infinity, '0.15', -0.1, 0.3]) {
      const candidate = structuredClone(channel)
      candidate.selection[key] = wrong
      assert.equal(evaluate(profile, candidate), false, `${key}: ${String(wrong)}`)
    }
    const missing = structuredClone(channel)
    delete missing.selection[key]
    assert.equal(evaluate(profile, missing), false)
  }
  const changedSource = structuredClone(profile)
  changedSource.coarseBands[0].anonymousSupportFraction = 0.9
  assert.equal(evaluate(changedSource, channel), false)
  const nonfiniteSource = structuredClone(profile), forged = structuredClone(channel)
  nonfiniteSource.coarseBands[0].anonymousSupportFraction = Infinity
  forged.selection.upperQuantizedSupportMean = Infinity
  assert.equal(evaluate(nonfiniteSource, forged), false)
})

test('post-review reads the bound manifest before validation and preserves read failures', () => {
  const filename = 'scripts/lib/ai-painter-two-map-post-review-v1.mjs'
  const source = fs.readFileSync(path.join(root, filename), 'utf8')
  const ast = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS)
  const run = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'runTwoMapPostReview')
  const declares = (node, name) => ts.isVariableStatement(node)
    && node.declarationList.declarations.some(declaration => declaration.name.getText(ast) === name)
  const start = run.body.statements.findIndex(node => declares(node, 'plan'))
  const end = run.body.statements.findIndex(node => declares(node, 'validation'))
  assert.ok(start >= 0 && end >= start)
  // Execute only the actual data-read boundary, without entering the worker or registry.
  const boundary = run.body.statements.slice(start, end + 1).map(node => node.getText(ast)).join('\n')
  const readInputs = new Function('source', 'read', `${boundary}\nreturn {plan, validation};`)
  const plan = { datasetManifest: 'manifest', validationSplit: 'validation' }
  const values = { plan, manifest: { version: 1 }, validation: { sampleIds: ['validation-only'] } }
  for (const failAt of [null, 'plan', 'manifest', 'validation']) {
    const calls = [], failure = new Error(`unreadable ${failAt}`)
    const read = binding => {
      calls.push(binding)
      if (binding === failAt) throw failure
      return values[binding]
    }
    if (failAt) assert.throws(() => readInputs({ sourcePlan: 'plan' }, read), error => error === failure)
    else assert.deepEqual(readInputs({ sourcePlan: 'plan' }, read), { plan, validation: ['validation-only'] })
    const expected = ['plan', 'manifest', 'validation']
    assert.deepEqual(calls, failAt ? expected.slice(0, expected.indexOf(failAt) + 1) : expected)
  }
})

const modules = new Map()
function load(relative) {
  const file = path.resolve(root, relative)
  if (modules.has(file)) return modules.get(file)
  const source = fs.readFileSync(file, 'utf8')
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const exports = {}
  modules.set(file, exports)
  new Function('require', 'exports', output)(specifier => {
    assert.ok(specifier.startsWith('@/') || specifier.startsWith('.'), 'pure definitions cannot load external runtime modules')
    const target = specifier.startsWith('@/') ? path.join(root, 'src', specifier.slice(2)) : path.resolve(path.dirname(file), specifier)
    assert.ok(target.startsWith(root + path.sep))
    return load(target + '.ts')
  }, exports)
  return exports
}

test('historical validation reader retains batch order, review fields and token scope through readonly inputs', async () => {
  const {createValidationHistoryReader} = load('src/server/ai-painter-training-validation-history.ts')
  const base = '.runtime/ai-painter/v7-repair-r1-strict-revalidations'
  const values = new Map([
    [base + '/old/validation-report.json', {batchId:'old',createdAtUtc:'2026-01-01T00:00:00Z',trajectories:[]}],
    [base + '/new/validation-report.json', {batchId:'new',createdAtUtc:'2026-01-02T00:00:00Z',status:'rejected',machineRejectedCount:1,
      validationTokenAccounting:{latentSpatialTokens:12,externalApi:{totalTokens:0}},
      trajectories:[{recordId:'record-a',runId:'run-a',machineReviewPath:'reviews/a.json',machineReviewSha256:'a'.repeat(64),
        validationTokenAccounting:{externalApiTokens:2,runTotals:{denoiserSampleForwardPasses:3,decodedRgbFrames:1}}}]}],
    ['reviews/a.json', {createdAtUtc:'2026-01-02T01:00:00Z',gates:[{gate:'object',passed:false,issueCodes:['shape']}],
      issues:[{code:'shape',nextFixTarget:'boundary'}]}],
  ])
  const reads = [], hashes = []
  const read = createValidationHistoryReader({
    listDirectories: async directory => {
      assert.equal(directory, base)
      return ['old','missing','new','plain-file'].map(name => ({name,isDirectory:()=>name!=='plain-file'}))
    },
    readJson: async file => {reads.push(file); return values.get(file) ?? null},
    sha256: async file => {hashes.push(file); return 'b'.repeat(64)},
  })
  const result = await read()
  assert.deepEqual(result.map(row=>row.batchId), ['new','old'])
  assert.equal(reads.some(file=>file.includes('plain-file')), false)
  assert.equal(hashes.length, 2)
  assert.equal(result[0].reportSha256, 'b'.repeat(64))
  assert.equal(result[0].validationTokenAccounting.latentSpatialTokens, 12)
  assert.equal(result[0].validationTokenAccounting.externalApiTokens, 0)
  const trajectory = result[0].trajectories[0]
  assert.equal(trajectory.runId, 'run-a')
  assert.equal(trajectory.machineReviewSha256, 'a'.repeat(64))
  assert.deepEqual(trajectory.gates, [{gate:'object',passed:false,issueCodes:['shape']}])
  assert.equal(trajectory.issues[0].nextTrainingTarget, 'boundary')
  assert.equal(trajectory.validationTokenAccounting.denoiserSampleForwardPasses, 3)
  assert.equal(trajectory.validationTokenAccounting.externalApiTokens, 2)
  assert.equal(result[0].formalInferenceEligible, false)
  assert.equal(result[0].canEnterWorld, false)
})

test('historical validation reader preserves unavailable-history fallback and remains outside current identity selection', async () => {
  const {createValidationHistoryReader} = load('src/server/ai-painter-training-validation-history.ts')
  const unavailable = createValidationHistoryReader({
    listDirectories: async () => {throw Error('directory unavailable')},
    readJson: async () => {throw Error('unexpected read')},
    sha256: async () => {throw Error('unexpected hash')},
  })
  assert.deepEqual(await unavailable(), [])
  const main = fs.readFileSync('src/server/ai-painter-current-training.ts', 'utf8')
  assert.match(main, /const readStrictValidationBatches = createValidationHistoryReader\(/u)
  assert.doesNotMatch(main, /function readStrictValidationBatches\(/u)
  const historySource = fs.readFileSync('src/server/ai-painter-training-validation-history.ts', 'utf8')
  assert.doesNotMatch(historySource, /current-execution-registry|advanceCurrentExecution|writeFile|node:child_process/u)
})

test('legacy personality entry and the current gateway share one function', () => {
  const legacy = load('src/ai/consciousness-core/consciousness/consciousness-builder.ts')
  const current = load('src/ai/consciousness-core/consciousness/ziwei-consciousness-builder.ts')
  assert.strictEqual(legacy.buildZiweiConsciousnessKernel, current.buildZiweiConsciousnessKernel)
  assert.deepEqual(Object.keys(legacy), ['buildZiweiConsciousnessKernel'])
})

test('page compatibility exports preserve shared catalog values and function identities', () => {
  for (const name of ['ai-console-catalog', 'ai-console-workspace-catalog', 'ai-console-training-time', 'ai-console-training-summary-model']) {
    const old = load(`src/app/ai-console/${name}.ts`)
    const current = load(`src/shared/ai-console/${name}.ts`)
    assert.deepEqual(Object.keys(old).sort(), Object.keys(current).sort())
    for (const key of Object.keys(current)) assert.strictEqual(old[key], current[key], key)
  }
  assert.equal(load('src/shared/ai-console/ai-console-catalog.ts').aiConsoleModules.length, 10)
  assert.equal(load('src/shared/ai-console/ai-console-workspace-catalog.ts').aiConsoleWorkspaceDefinitions.length, 52)
})

test('ESLint rejects server/API catalog imports from pages and shared imports from pages', async () => {
  const eslint = new ESLint()
  for (const [filePath, specifier] of [
    ['src/server/ai-console/boundary-fixture.ts', '@/app/ai-console/ai-console-catalog'],
    ['src/app/api/ai-console/boundary-fixture.ts', '@/app/ai-console/ai-console-workspace-catalog'],
    ['src/server/ai-console/boundary-fixture.ts', '../../app/ai-console/ai-console-catalog'],
    ['src/server/ai-console/boundary-fixture.ts', '../../app/ai-console/ai-console-training-summary-model'],
    ['src/shared/ai-console/boundary-fixture.ts', '@/app/ai-console/ai-console-live-observability'],
  ]) {
    const [result] = await eslint.lintText(`import { value } from '${specifier}'; export { value };`, { filePath })
    assert.ok(result.messages.some(m => m.ruleId === 'no-restricted-imports'), `${filePath}: ${specifier}`)
  }
  const [allowed] = await eslint.lintText("import { aiConsoleModules } from '@/shared/ai-console/ai-console-catalog'; export { aiConsoleModules };", {
    filePath: 'src/server/ai-console/boundary-fixture.ts',
  })
  assert.equal(allowed.errorCount, 0)
})

test('unused application declarations are errors while used exports remain valid', async () => {
  const eslint = new ESLint()
  for (const filePath of ['src/server/quality-fixture.ts', 'src/world/quality-fixture.ts', 'src/ai/quality-fixture.ts', 'src/app/quality-fixture.ts']) {
    for (const source of [
      'const abandoned = 1; export const retained = 2;',
      "import { readFileSync } from 'node:fs'; export const retained = 2;",
      'function abandoned() { return 1; } export const retained = 2;',
    ]) {
      const [result] = await eslint.lintText(source, { filePath })
      assert(result.messages.some(message => message.ruleId === '@typescript-eslint/no-unused-vars' && message.severity === 2), filePath)
      assert(result.errorCount > 0)
    }
    const [used] = await eslint.lintText('const retained = 2; export function read() { return retained; }', { filePath })
    assert.equal(used.errorCount, 0, filePath)
  }
})

const observationReaders = [
  'src/app/ai-console/ai-console-experiment-time.tsx',
  'src/app/ai-console/ai-console-current-execution-status.tsx',
  'src/app/ai-console/ai-console-current-execution-store.ts',
  'src/shared/ai-console/ai-console-training-summary-model.ts',
  ...['bound-training-presentation', 'single-map-training-history', 'training-history-store',
    'training-history-independent-review', 'training-history-completion-observation',
    'training-history-system-interruption', 'training-history-managed-detail', 'training-history-dry-lifecycle', 'training-preview-history-v1', 'training-observation-contract',
    'training-history-evidence-index'].map(name => `src/server/ai-console/${name}.mjs`),
]

test('documented observation checks remain inspectable without whole-file exemptions', () => {
  for (const file of observationReaders) {
    const source = fs.readFileSync(file, 'utf8')
    const result = auditAiConsoleSourceBoundary(file, source)
    assert.deepEqual(result.failures, [], file)
    assert.ok(result.permissions.length > 0, file)
    for (const [code, expected] of [
      ["fetch('/api/ai-painter/tasks')", 'legacy_page_api'],
      ["import('/ai-painter-progress/page')", 'legacy_page_route'],
      ["import legacy from '@/app/ai-painter-progress/page'", 'legacy_page_import'],
      ["readFile('.runtime/ai-painter/')", 'legacy_runtime_source'],
      ["readdir('.runtime/ai-painter/new-unregistered-root')", 'legacy_runtime_source'],
      ["fetch('/current-training')", 'legacy_page_entry'],
      ["fetch('/api/' + 'ai-painter/tasks')", 'legacy_page_api'],
      [String.raw`fetch('/api/\x61i-painter/tasks')`, 'legacy_page_api'],
    ]) {
      const injected = auditAiConsoleSourceBoundary(file, source + '\n' + code)
      assert.ok(injected.failures.includes(expected), `${file}: ${code}`)
    }
  }
})

test('observation namespaces are allowed only in their registered validation roles', () => {
  const file = 'src/server/ai-console/training-observation-contract.mjs'
  const valid = "pkg.outputRoot.startsWith('.runtime/ai-painter/')"
  assert.deepEqual(auditAiConsoleSourceBoundary(file, valid).failures, [])
  for (const code of [
    "pkg.outputRoot.startsWith('.runtime/ai-painter/arbitrary/')",
    "unregistered.startsWith('.runtime/ai-painter/')",
    "fetch('.runtime/ai-painter/')",
    "const root = '.runtime/ai-painter/'",
  ]) assert.ok(auditAiConsoleSourceBoundary(file, code).failures.includes('legacy_runtime_source'), code)
  assert.ok(auditAiConsoleSourceBoundary('src/server/ai-console/unregistered.ts', valid)
    .failures.includes('legacy_runtime_source'))
})

test('historical compatibility descriptors reject new paths and active calls', () => {
  const file = 'src/server/ai-console/training-preview-history-v1.mjs'
  const source = fs.readFileSync(file, 'utf8')
  const original = "root: '.runtime/ai-painter/decode1-entry-weight-quality-same-call-v1-executions/'"
  assert.ok(source.includes(original))
  for (const replacement of [
    "root: '.runtime/ai-painter/unregistered-executions/'",
    "root: readFile('.runtime/ai-painter/decode1-entry-weight-quality-same-call-v1-executions/')",
  ]) assert.ok(auditAiConsoleSourceBoundary(file, source.replace(original, replacement))
    .failures.includes('legacy_runtime_source'))
  const indexFile = 'src/server/ai-console/training-history-evidence-index.mjs'
  const indexSource = fs.readFileSync(indexFile, 'utf8')
  assert.ok(auditAiConsoleSourceBoundary(indexFile, indexSource.replace("'cold/runs'", "'cold/other'"))
    .failures.includes('legacy_runtime_source'))
})

test('syntax failures cannot silently pass the source boundary check', () => {
  assert.ok(auditAiConsoleSourceBoundary('src/server/ai-console/broken.mjs', 'const = ;')
    .failures.includes('source_parse_error'))
})

test('control facade preserves seven component identities and server rendering', () => {
  const require = createRequire(import.meta.url), cache = new Map()
  function loadControl(file) {
    file = path.resolve(file)
    if (cache.has(file)) return cache.get(file)
    const exports = {}
    cache.set(file, exports)
    const source = fs.readFileSync(file, 'utf8')
    const output = ts.transpileModule(source, { compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
    } }).outputText
    new Function('require', 'exports', output)(id => {
      if (id === 'react' || id === 'react/jsx-runtime') return require(id)
      if (id === './ai-console-workspace.module.css') return { default: new Proxy({}, { get: (_, key) => String(key) }) }
      assert.match(id, /^\.\/ai-console-control-[a-z-]+$/u)
      return loadControl(path.join(path.dirname(file), id + '.tsx'))
    }, exports)
    return exports
  }
  const folder = 'src/app/ai-console/', facadePath = folder + 'ai-console-control-surface.tsx'
  const facade = loadControl(facadePath)
  const controls = {
    AiConsoleRegistryVerificationControl: 'registry', AiConsoleTaskRegistryControl: 'tasks',
    AiConsoleCapabilityLifecycleControl: 'capabilities', AiConsoleTrainingDesignControl: 'training',
    AiConsoleReviewAdjudicationControl: 'reviews', AiConsoleRuntimeReleaseControl: 'runtime', AiConsoleWorldControl: 'world',
  }
  assert.deepEqual(Object.keys(facade).sort(), Object.keys(controls).sort())
  for (const [name, module] of Object.entries(controls)) {
    const implementation = loadControl(folder + `ai-console-control-${module}.tsx`)
    assert.strictEqual(facade[name], implementation[name])
    for (const mode of module === 'runtime' ? ['activation', 'runtime'] : [undefined]) {
      const markup = renderToStaticMarkup(createElement(facade[name], mode ? { mode } : {}))
      assert.ok(markup.includes('<section'), `${name}: missing control surface`)
      assert.ok(markup.includes('disabled'), `${name}: uninitialized controls must remain disabled`)
    }
  }
  const source = readAiConsoleControlSource(facadePath)
  for (const marker of ['x-ai-console-csrf', 'verify_primary_registry', 'freeze_visual_updates', 'transactionRecordSha256']) {
    assert.ok(source.includes(marker), `source checks must inspect implementations: ${marker}`)
  }
})

test('history adapter facade keeps public identities and split modules form an acyclic graph', async () => {
  const folder = 'src/server/ai-console/'
  const facade = await import('../../src/server/ai-console/training-history-detail-adapters.mjs')
  const owners = {
    readCompletionTrainingObservation: 'completion-observation', readBoundIndependentTrainingReview: 'independent-review',
    legacyRunKind: 'legacy-detail', adaptManagedTrainingDetail: 'managed-detail',
    DRY_RECOVERY_CANDIDATE_SCHEMA: 'dry-lifecycle', readDryRecoveryCandidate: 'dry-lifecycle',
  }
  assert.deepEqual(Object.keys(facade).sort(), [...Object.keys(owners), 'adaptLegacyTrainingDetail'].sort())
  for (const [name, owner] of Object.entries(owners)) {
    const implementation = await import(`../../src/server/ai-console/training-history-${owner}.mjs`)
    assert.strictEqual(facade[name], implementation[name], name)
  }
  const modules = ['detail-adapters', 'completion-observation', 'independent-review', 'managed-detail',
    'legacy-detail', 'system-interruption', 'dry-lifecycle', 'stage0-lifecycle', 'spatial-affine']
    .map(name => `training-history-${name}.mjs`)
  const graph = new Map(modules.map(name => {
    const parsed = ts.createSourceFile(name, fs.readFileSync(folder + name, 'utf8'), ts.ScriptTarget.Latest, true)
    const edges = parsed.statements.filter(n => ts.isImportDeclaration(n) || ts.isExportDeclaration(n))
      .map(n => n.moduleSpecifier?.text?.replace(/^\.\//u, '')).filter(value => modules.includes(value))
    return [name, edges]
  }))
  const active = new Set(), complete = new Set()
  function visit(name) {
    assert.ok(!active.has(name), `history adapter import cycle at ${name}`)
    if (complete.has(name)) return
    active.add(name); graph.get(name).forEach(visit); active.delete(name); complete.add(name)
  }
  graph.forEach((_, name) => visit(name))
  assert.equal(complete.size, modules.length)
})
