import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {spawnSync} from 'node:child_process'
import {parse} from '@babel/parser'
import test from 'node:test'
import {loadLoopRuntime} from '../lib/world-evolution-runtime-loader.mjs'
import {loadLoopRuntime as testLoader} from './helpers/world-evolution-loop-loader.mjs'
import {inspectCapabilityScopeAdmission as shared} from '../lib/ai-painter-capability-scope-admission.mjs'
import {inspectCapabilityScopeAdmission as compatibility} from '../lib/ai-painter-autonomous-package-decision-core-v3.mjs'

const root = path.resolve(import.meta.dirname, '../..')
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json')))

test('registry recovery uses readonly validation and preserves the transaction entry exports', async () => {
  const reader = await import('../lib/ai-painter-owned-worker-recovery-input.mjs')
  const transaction = await import('../lib/ai-painter-owned-worker-reboot-recovery-v1.mjs')
  for (const name of ['loadRecoveryProfile','verifyHistoricalInputs','queryNativeHost','verifyKernelInterruptionHost','kernelInterruptionTerminalIdentity'])
    assert.equal(reader[name],transaction[name])
  for (const name of ['quarantineRecovery','registerTrainingKernelInterruption','saveRecoveryAudit'])
    assert.equal(Object.hasOwn(reader,name),false)
  const imports = parse(fs.readFileSync(path.join(root,'scripts/lib/ai-painter-owned-worker-recovery-input.mjs'),'utf8'),{sourceType:'module'}).program.body
    .filter(n=>n.type==='ImportDeclaration').map(n=>n.source.value)
  assert.equal(imports.some(s=>s.includes('current-execution-registry')||s.includes('reboot-recovery-v1')),false)
  const registrySource = fs.readFileSync(path.join(root,'src/server/ai-painter-current-execution-registry.mjs'),'utf8')
  assert.doesNotMatch(registrySource,/import\(['"].*owned-worker-reboot-recovery-v1\.mjs['"]\)/)
  assert.match(registrySource,/import\(['"].*owned-worker-recovery-input\.mjs['"]\)/)
})

test('review and successor libraries depend on shared contracts instead of executing CLI modules', async () => {
  const sharedSmoke = await import('../lib/ai-painter-stage4-v2-controlled-smoke-common-v1.mjs')
  const legacySmoke = await import('../run-ai-painter-stage4-v2-controlled-smoke.mjs')
  for (const name of ['FORMAL_PLAN_ACTION','FORMAL_PLAN_TASK','FAILURE_ACTION','FAILURE_TASK','validateOuterFinalizationChain'])
    assert.equal(sharedSmoke[name],legacySmoke[name])
  const sharedHeartbeat = await import('../lib/training-heartbeat-publication.mjs')
  const legacyExperiment = await import('../run-ai-painter-learning-capacity-experiment.mjs')
  assert.equal(sharedHeartbeat.replaceHeartbeatFile,legacyExperiment.replaceHeartbeatFile)
  for (const name of ['plan-ai-painter-stage4-v2-formal-stage0-to-stage2','adjudicate-ai-painter-stage4-v2-controlled-smoke-failure-boundary']) {
    const imports = parse(fs.readFileSync(path.join(root,'scripts',name+'.mjs'),'utf8'),{sourceType:'module'}).program.body
      .filter(n=>n.type==='ImportDeclaration').map(n=>n.source.value)
    assert.equal(imports.includes('./run-ai-painter-stage4-v2-controlled-smoke.mjs'),false)
    assert.ok(imports.includes('./lib/ai-painter-stage4-v2-controlled-smoke-common-v1.mjs'))
  }
  for (const name of ['ai-painter-replay-retention-review-v1','ai-painter-replay-retention-review-recovery-v1']) {
    const source = fs.readFileSync(path.join(root,'scripts/lib',name+'.mjs'),'utf8')
    assert.doesNotMatch(source,/import\(['"]\.\.\/run-ai-painter-learning-capacity-experiment\.mjs['"]\)/)
    assert.match(source,/import\(['"]\.\/training-heartbeat-publication\.mjs['"]\)/)
  }
})

test('world runtime loader is shared and never reuses another checkout runtime', async () => {
  assert.equal(loadLoopRuntime, testLoader)
  const runtime = await loadLoopRuntime(root)
  assert.equal(typeof runtime.store.createProductionWorldRuntimeStore, 'function')
  assert.equal(await loadLoopRuntime(root), runtime)
  const missingRoot = path.join(root, '.runtime', 'missing-loader-fixture-' + process.pid)
  assert.equal(fs.existsSync(missingRoot), false)
  await assert.rejects(loadLoopRuntime(missingRoot), /Cannot find module|ENOENT/)
  assert.equal(await loadLoopRuntime(root), runtime)
})

test('world runtime consumers do not import the test helper implementation', () => {
  for (const name of ['natural-world-evolution-loop', 'world-initialized-evolution', 'world-environment-scheduled-run']) {
    const code = fs.readFileSync(path.join(root, 'scripts/lib', name + '.mjs'), 'utf8')
    assert.doesNotMatch(code, /tests\/helpers\/world-evolution-loop-loader/)
    assert.match(code, /scripts\/lib\/world-evolution-runtime-loader\.mjs/)
  }
})

test('capability admission compatibility is the same implementation and rejects accessors', () => {
  assert.equal(shared, compatibility)
  let calls = 0
  assert.throws(() => shared({get projectRoot() {calls++; return root}}), /accessors rejected/)
  assert.equal(calls, 0)
  assert.throws(() => shared({projectRoot:root, productionAdmitted:true}), /unknown preflight option/)
})

test('weather static dependency graph is acyclic and shared admission imports only builtins', () => {
  const done = new Set(), visiting = new Set()
  function visit(file) {
    assert.ok(!visiting.has(file), `static dependency cycle: ${file}`)
    if (done.has(file)) return
    visiting.add(file)
    const imports = parse(fs.readFileSync(file, 'utf8'), {sourceType:'module'}).program.body
      .filter(n => n.type === 'ImportDeclaration' || n.type === 'ExportNamedDeclaration' && n.source)
      .map(n => n.source.value)
    if (file.endsWith('ai-painter-capability-scope-admission.mjs')) assert.ok(imports.every(s => s.startsWith('node:')))
    for (const specifier of imports) if (specifier.startsWith('.')) {
      const dependency = path.resolve(path.dirname(file), specifier)
      if (dependency.endsWith('.mjs')) visit(dependency)
    }
    visiting.delete(file); done.add(file)
  }
  visit(path.join(root, 'scripts/lib/ai-painter-autonomous-package-decision-core-v3.mjs'))
  assert.ok(done.size > 5)
})

test('historical current-named inference commands fail before invoking an old writer', () => {
  for (const name of ['run:current-world-visual-inference', 'run:current-world-bootstrap-inference', 'run:current-world-foundation-bootstrap-inference']) {
    assert.equal(pkg.scripts[name], `node scripts/reject-legacy-world-entrypoint.mjs ${name}`)
    const result = spawnSync(process.execPath, ['scripts/reject-legacy-world-entrypoint.mjs', name], {cwd:root, encoding:'utf8', timeout:5000})
    assert.equal(result.status, 2)
    const report = JSON.parse(result.stderr)
    assert.equal(report.status, 'historical_entrypoint_not_dispatchable')
    assert.equal(report.modelStarted, false)
  }
})

test('runtime parsers remain in production lockfile and default listeners stay local', () => {
  const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json')))
  for (const name of ['@babel/parser','acorn']) assert.equal(pkg.dependencies[name], lock.packages[`node_modules/${name}`].version)
  for (const name of ['@babel/parser','acorn','@babel/types','@babel/helper-string-parser','@babel/helper-validator-identifier']) {
    assert.notEqual(lock.packages[`node_modules/${name}`].dev, true, `${name} omitted by production install`)
  }
  for (const name of ['dev','start']) assert.match(pkg.scripts[name], /--hostname 127\.0\.0\.1(?: |$)/)
})

test('guide review parent verification cannot dispatch review, failure capture or palette execution', async () => {
  const parent = await import('../lib/ai-painter-guide-source-review-parent.mjs')
  const review = await import('../lib/ai-painter-guide-source-review.mjs')
  assert.equal(parent.verifyGuideReviewParent, review.verifyGuideReviewParent)
  const verifier = fs.readFileSync(path.join(root, parent.GUIDE_PARENT_VERIFIER), 'utf8')
  const imports = parse(verifier, { sourceType: 'module' }).program.body.filter(n => n.type === 'ImportDeclaration').map(n => n.source.value)
  for (const file of ['ai-painter-guide-source-review.mjs', 'ai-painter-guide-source-failure.mjs', 'ai-painter-guide-palette-proposal.mjs']) {
    assert.equal(imports.some(p => p.endsWith('/'+file)), false)
  }
  assert.doesNotMatch(verifier, /\bimport\s*\(/u)
  for (const file of ['ai-painter-guide-source-failure.mjs', 'ai-painter-guide-palette-proposal.mjs']) {
    const code = fs.readFileSync(path.join(root, 'scripts/lib', file), 'utf8')
    assert.match(code, /from\s*["']\.\/ai-painter-guide-source-review-parent\.mjs["']/u)
    assert.doesNotMatch(code, /from\s*["']\.\/ai-painter-guide-source-review\.mjs["']/u)
  }
})
