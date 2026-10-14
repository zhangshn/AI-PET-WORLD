import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'

// Execute actual Gateway and route logic with an explicitly closed import
// table. The store, model and builder are private doubles; no production I/O.
export function loadGatewayCpu({ reads = [], writeResult, auditOk = true, operatorOk = true } = {}) {
  const calls = { reads: [], writes: [], builds: [], ticks: [] }
  const pending = [...reads]
  const store = {
    async readWorldRuntimeSaveRecord(input) {
      calls.reads.push(input)
      assert.ok(pending.length, 'unexpected fixture read')
      return pending.shift()
    },
    async writeWorldRuntimeSaveRecord(input) {
      calls.writes.push(input)
      return writeResult ?? { ok: true, path: 'fixture-only', message: 'fixture write', warnings: [], tags: [] }
    },
  }
  const doubles = {
    'node:crypto': { randomUUID: () => 'private-created-world' },
    '@/world/butler/butler-personality-adapter': {
      buildButlerRuntimeProfileFromLifeCore: () => ({ profile: {}, input: {} }),
    },
    '@/world/creation/world-creation-runtime': {
      buildWorldCreationRuntime(input) {
        calls.builds.push(input)
        return { ownerId: 'private-owner', worldId: input.worldInstanceId, worldSalt: 'private-seed',
          butlerProfile: {}, butlerConstructionStyle: {}, butlerMappingMode: 'self', styleSource: 'fixture', now: input.serverCreatedAt ?? input.createWorldInput.createdAt }
      },
    },
    '@/world/runtime-core/initial-runtime-world-builder': {
      buildInitialRuntimeWorld: ({ worldId, ownerId }) => ({ homeMapState: { worldId, ownerId } }),
    },
    './butler-runtime-audit-summary': { buildButlerRuntimeAuditSummary() { throw new Error('unexpected audit summary in fixture') } },
    './world-runtime-store-adapter': store,
    './world-runtime-audit': { auditWorldRuntimeTick() { throw new Error('unexpected audit invocation') } },
    './world-runtime-tick-runner': {
      runOneRuntimeTick(input) {
        calls.ticks.push(input)
        return { previousSaveRecord: input.saveRecord, nextSaveRecord: { ...input.saveRecord, tick: input.saveRecord.tick + 1 },
          runtimeTick: null, persisted: false, audit: { ok: auditOk, warnings: [], tags: [] }, messages: [], tags: [] }
      },
    },
  }
  function compile(relative, imports) {
    const source = fs.readFileSync(new URL(relative, import.meta.url), 'utf8')
    const compiled = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, reportDiagnostics: true,
    })
    assert.deepEqual(compiled.diagnostics, [])
    const exports = {}
    new Function('require', 'exports', compiled.outputText)((id) => {
      assert.ok(Object.hasOwn(imports, id), `unexpected dependency: ${id}`)
      return imports[id]
    }, exports)
    return exports
  }
  const gateway = compile('../../../src/world/runtime/world-runtime-gateway.ts', doubles)
  const route = compile('../../../src/app/api/world/tick/route.ts', {
    'next/server': { NextResponse: { json: (body, options) => Response.json(body, options) } },
    '@/world/runtime/world-runtime-gateway': gateway,
    '@/world/runtime/world-runtime-store-adapter': store,
    '@/server/ai-console-control/operator-session': {
      verifyLocalOperatorMutation: () => operatorOk
        ? { ok: true, session: { actorIdentity: 'private-operator' } }
        : { ok: false, status: 403, errorCode: 'fixture_denied' },
    },
  })
  return { ...gateway, ...route, calls }
}

export function privateRead(status = 'found', record = privateRecord()) {
  return { status, record: status === 'found' ? record : null, path: 'fixture-only',
    message: `fixture_${status}`, warnings: [], tags: [`fixture_${status}`] }
}

export function privateRecord() {
  return { worldId: 'private-world', ownerId: 'private-owner', tick: 7, tags: [], homeMapState: {} }
}
