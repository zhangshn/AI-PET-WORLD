import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'

// Compile only this pure logic slice in memory. Runtime, storage and services
// cannot be loaded; unrelated space/trace and construction use private doubles.
export function loadRuntimeContinuityCpu({ constructionTick } = {}) {
  const cache = new Map()
  const allowed = new Set([
    'world-runtime-tick-runner',
    'world-runtime-action-signature',
    'butler-runtime-motivation-selector',
    'world-runtime-continuity-audit',
    'butler-runtime-intent',
    'world-runtime-audit',
    'world-runtime-forbidden-token-policy',
  ])
  const doubles = {
    '@/world/runtime-core/world-runtime-construction-tick': {
      runWorldRuntimeConstructionTick(input) {
        assert.equal(input.persistenceMode, 'proposal_only')
        assert.equal(input.painterMode, 'signal_only')
        assert.ok(constructionTick, 'Unexpected construction execution in private fixture')
        return constructionTick(input)
      },
    },
    '@/world/space': {
      buildSpaceGridFromHomeMapState: () => ({ traceInfluenceSummary: { totalInfluencedCells: 0 } }),
    },
    '@/world/trace': {
      buildTraceFieldFromWorld: () => ({ traces: [] }),
      runTraceLifecycleTick: ({ derivedTraceField }) => ({
        nextTraceField: derivedTraceField, messages: [], warnings: [], tags: [],
      }),
      buildTraceMemorySeedFieldFromTraceField: () => ({ seeds: [], summary: { totalSeeds: 0 } }),
    },
    './butler-runtime-trace-closure': {
      applyButlerRuntimeTraceClosure: ({ traceField }) => ({
        nextTraceField: traceField, createdTrace: null, warnings: [], messages: [], tags: [],
      }),
    },
  }
  function load(name) {
    assert.ok(allowed.has(name), `Unexpected runtime module: ${name}`)
    if (cache.has(name)) return cache.get(name)
    const source = fs.readFileSync(new URL(`../../../src/world/runtime/${name}.ts`, import.meta.url), 'utf8')
    const compiled = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
      reportDiagnostics: true,
    })
    assert.deepEqual(compiled.diagnostics, [], `Compile diagnostics: ${name}`)
    const exports = {}
    cache.set(name, exports)
    new Function('require', 'exports', compiled.outputText)((id) => {
      if (Object.hasOwn(doubles, id)) return doubles[id]
      if (id === './world-runtime-forbidden-tokens.json') {
        return JSON.parse(fs.readFileSync(new URL('../../../src/world/runtime/world-runtime-forbidden-tokens.json', import.meta.url), 'utf8'))
      }
      assert.match(id, /^\.\/[a-z-]+$/, `Unexpected runtime import: ${id}`)
      return load(id.slice(2))
    }, exports)
    return exports
  }
  return {
    ...load('world-runtime-action-signature'),
    ...load('butler-runtime-motivation-selector'),
    ...load('world-runtime-continuity-audit'),
    ...load('world-runtime-tick-runner'),
  }
}

export function makePrivateRuntimeSave(overrides = {}) {
  return {
    version: 'v2.6-runtime-00', worldId: 'private-world-06-07', ownerId: 'private-owner', tick: 0,
    savedAt: '2026-01-01T00:00:00.000Z', butlerProfile: {}, butlerRuntimeProfile: {},
    butlerBirthInput: {}, butlerMappingMode: 'private-fixture', butlerConstructionStyle: {},
    worldCreationStyleSource: {},
    homeMapState: {
      worldId: 'private-world-06-07', ownerId: 'private-owner', seed: 'private-seed',
      mapSize: { columns: 1, rows: 1, tileSize: 1 }, zones: [], placements: [],
      constructionPlans: [], mapDiffs: [],
      resources: { materialReadiness: 0, careReadiness: 0, groundHealth: 0, recentTransactions: [] },
      createdAt: 0, updatedAt: 0, tags: [],
    },
    recentEvents: [], recentActionSignatures: [], recentMotivationTypes: [], tags: [],
    ...overrides,
  }
}

export function makePrivateConstructionTick(input, { project = 'private-plan', stage = 'foundation', diffs = [] } = {}) {
  return {
    nextHomeMapState: input.homeMapState,
    constructionResult: {
      fullPipelineAudit: { acceptedDiffIds: diffs.map((diff) => diff.id) },
      runtimeCycleResult: { runtimeCommitResult: {
        selectedPlan: { id: project, currentStage: stage, targetZoneType: 'initial_care' },
        safeApplyResult: {}, executionResult: { mapDiffs: diffs, resourceTransactions: [] },
      } },
    },
    audit: { warnings: [] }, messages: [],
  }
}
