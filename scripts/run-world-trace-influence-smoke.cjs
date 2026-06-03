async function main() {
  const crypto = await import("node:crypto")
  const fs = await import("node:fs")
  const moduleApi = await import("node:module")
  const path = await import("node:path")
  const ts = await import("typescript")
  const repoRoot = process.cwd()
  const localRequire = moduleApi.createRequire(__filename)
  const savePath = resolveRuntimeSavePath({
    fs,
    latestIndexPath: path.join(
      repoRoot,
      "data",
      "world-runtime",
      "latest-world.json"
    ),
  })
  const spaceBuilderPath = path.join(
    repoRoot,
    "src",
    "world",
    "space",
    "space-grid-builder.ts"
  )
  const spaceInfluencePath = path.join(
    repoRoot,
    "src",
    "world",
    "space",
    "space-trace-influence.ts"
  )
  const traceMemorySeedPath = path.join(
    repoRoot,
    "src",
    "world",
    "trace",
    "trace-memory-seed.ts"
  )
  const runtimeGatewayPath = path.join(
    repoRoot,
    "src",
    "world",
    "runtime",
    "world-runtime-gateway.ts"
  )

  function fail(message) {
    console.log("WORLD TRACE INFLUENCE SMOKE")
    console.log(message)
    console.log("Result: FAIL")
    process.exit(1)
  }

  function assert(condition, message) {
    if (!condition) fail(message)
  }

  function parseJson(raw, message) {
    try {
      return JSON.parse(raw)
    } catch (error) {
      fail(`${message} ${error.message}`)
    }
  }

  function hash(raw) {
    return crypto.createHash("sha256").update(raw).digest("hex")
  }

  function installTypeScriptRequireHook() {
    const moduleConstructor = moduleApi.default
    const originalResolveFilename = moduleConstructor._resolveFilename

    moduleConstructor._resolveFilename = function resolveFilename(
      request,
      parent,
      isMain,
      options
    ) {
      if (request.startsWith("@/")) {
        return originalResolveFilename.call(
          this,
          path.join(repoRoot, "src", request.slice(2)),
          parent,
          isMain,
          options
        )
      }

      return originalResolveFilename.call(this, request, parent, isMain, options)
    }

    localRequire.extensions[".ts"] = function compileTypescript(module, filename) {
      const source = fs.readFileSync(filename, "utf8")
      const output = ts.transpileModule(source, {
        compilerOptions: {
          esModuleInterop: true,
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
        },
        fileName: filename,
      }).outputText

      module._compile(output, filename)
    }
  }

  function assertNoForbiddenArchitecture() {
    const combinedSource = [
      fs.readFileSync(spaceInfluencePath, "utf8"),
      fs.readFileSync(traceMemorySeedPath, "utf8"),
    ].join("\n")
    const forbiddenPatterns = [
      "movementChannel",
      "movement_channel",
      "routeGraph",
      "buildRoad",
      "buildRoute",
      "buildMovementChannel",
      "writeWorldRuntimeSaveRecord",
      "runAndPersistOneRuntimeTick",
    ]
    const hits = forbiddenPatterns.filter((pattern) =>
      combinedSource.includes(pattern)
    )

    assert(
      hits.length === 0,
      `Trace influence source contains forbidden tokens: ${hits.join(", ")}`
    )
  }

  function countSeedEligibleTraces(traceField) {
    const stablePhases = new Set([
      "accumulating",
      "strengthened",
      "repaired",
      "transformed",
      "deposited",
    ])

    return traceField.traces.filter(
      (trace) =>
        trace.strength >= 55 &&
        stablePhases.has(trace.lifecyclePhase) &&
        trace.confidence >= 45 &&
        Array.isArray(trace.relatedCellIds) &&
        trace.relatedCellIds.length > 0 &&
        (trace.evidenceLevel !== "low" || trace.age >= 3)
    ).length
  }

  if (!savePath || !fs.existsSync(savePath)) {
    fail("Runtime save file not found.")
  }

  installTypeScriptRequireHook()
  assertNoForbiddenArchitecture()

  const beforeRaw = fs.readFileSync(savePath, "utf8")
  const beforeHash = hash(beforeRaw)
  const beforeRecord = parseJson(beforeRaw, "Runtime save file is not valid JSON.")

  if (!beforeRecord.traceField) {
    fail("Runtime save has no traceField. Run npm run smoke:trace-tick first.")
  }

  const { buildSpaceGridFromHomeMapState } = localRequire(spaceBuilderPath)
  const { buildTraceMemorySeedFieldFromTraceField } =
    localRequire(traceMemorySeedPath)
  const { runAndPersistOneRuntimeTick, readWorldRuntimeForView } =
    localRequire(runtimeGatewayPath)
  const spaceGrid = buildSpaceGridFromHomeMapState({
    homeMapState: beforeRecord.homeMapState,
    traceField: beforeRecord.traceField,
  })
  const influencedCells = spaceGrid.cells.filter(
    (cell) => cell.traceInfluenceStrength > 0
  )
  const traceEffectCells = spaceGrid.cells.filter((cell) =>
    cell.movementCostFactors.some((factor) => factor.source === "trace_effect")
  )
  const blockedCells = spaceGrid.cells.filter(
    (cell) =>
      cell.passability === "blocked" ||
      cell.regionKind === "boundary" ||
      cell.regionKind === "unopened"
  )
  const memorySeedField = buildTraceMemorySeedFieldFromTraceField({
    traceField: beforeRecord.traceField,
    currentTick: beforeRecord.tick,
  })
  const eligibleSeedCount = countSeedEligibleTraces(beforeRecord.traceField)

  assert(spaceGrid.traceInfluenceSummary, "SpaceGrid has no traceInfluenceSummary.")
  assert(influencedCells.length > 0, "No cells received trace influence.")
  assert(traceEffectCells.length > 0, "No movementCostFactors include trace_effect.")
  assert(
    blockedCells.every((cell) => !cell.passable),
    "Trace influence made a hard-rule blocked/boundary/unopened cell passable."
  )
  assert(memorySeedField.summary, "TraceMemorySeedField summary is missing.")
  assert(
    eligibleSeedCount === 0 || memorySeedField.seeds.length > 0,
    "Eligible traces exist but no memory seed was derived."
  )

  const afterReadOnlyRaw = fs.readFileSync(savePath, "utf8")
  const afterReadOnlyRecord = parseJson(
    afterReadOnlyRaw,
    "Runtime save became invalid during read-only influence build."
  )

  assert(
    afterReadOnlyRecord.tick === beforeRecord.tick,
    "Read-only trace influence build changed runtime tick."
  )
  assert(
    hash(afterReadOnlyRaw) === beforeHash,
    "Read-only trace influence build changed runtime save hash."
  )

  const tickResult = await runAndPersistOneRuntimeTick({
    now: Date.now(),
  })
  assert(tickResult.persisted, "Explicit runtime tick did not persist.")

  const afterTickRaw = fs.readFileSync(savePath, "utf8")
  const afterTickRecord = parseJson(
    afterTickRaw,
    "Runtime save after explicit tick is not valid JSON."
  )
  assert(
    afterTickRecord.tick === beforeRecord.tick + 1,
    "Explicit runtime tick did not increment tick by one."
  )
  assert(
    afterTickRecord.traceMemorySeedField &&
      afterTickRecord.traceMemorySeedField.summary,
    "Explicit tick did not persist traceMemorySeedField."
  )
  assert(
    afterTickRecord.traceInfluenceSummary &&
      typeof afterTickRecord.traceInfluenceSummary.totalInfluencedCells ===
        "number",
    "Explicit tick did not persist traceInfluenceSummary."
  )

  const beforeViewRaw = fs.readFileSync(savePath, "utf8")
  const beforeViewHash = hash(beforeViewRaw)
  const beforeViewTick = afterTickRecord.tick
  await readWorldRuntimeForView()
  const afterViewRaw = fs.readFileSync(savePath, "utf8")
  const afterViewRecord = parseJson(
    afterViewRaw,
    "Runtime save after readWorldRuntimeForView is not valid JSON."
  )

  assert(afterViewRecord.tick === beforeViewTick, "View read changed runtime tick.")
  assert(hash(afterViewRaw) === beforeViewHash, "View read changed runtime hash.")

  console.log("WORLD TRACE INFLUENCE SMOKE")
  console.log(`Tick before explicit tick: ${beforeRecord.tick}`)
  console.log(`Tick after explicit tick: ${afterTickRecord.tick}`)
  console.log(`Trace-influenced cells: ${influencedCells.length}`)
  console.log(`Trace effect movement cells: ${traceEffectCells.length}`)
  console.log(`Memory seeds derived read-only: ${memorySeedField.seeds.length}`)
  console.log(
    `Memory seeds persisted after tick: ${afterTickRecord.traceMemorySeedField.summary.totalSeeds}`
  )
  console.log(
    `Influenced cells persisted after tick: ${afterTickRecord.traceInfluenceSummary.totalInfluencedCells}`
  )
  console.log("Read-only influence build: ok")
  console.log("Explicit tick persistence: ok")
  console.log("readWorldRuntimeForView read-only: ok")
  console.log("Result: PASS")
}

function resolveRuntimeSavePath(input) {
  if (!input.fs.existsSync(input.latestIndexPath)) return null

  try {
    const index = JSON.parse(input.fs.readFileSync(input.latestIndexPath, "utf8"))

    return typeof index.path === "string" ? index.path : null
  } catch {
    return null
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
