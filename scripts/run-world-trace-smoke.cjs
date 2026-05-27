async function main() {
  const crypto = await import("node:crypto")
  const fs = await import("node:fs")
  const moduleApi = await import("node:module")
  const path = await import("node:path")
  const ts = await import("typescript")
  const repoRoot = process.cwd()
  const localRequire = moduleApi.createRequire(__filename)
  const savePath = path.join(
    repoRoot,
    ".runtime",
    "world-state",
    "default-world.json"
  )
  const spaceBuilderPath = path.join(
    repoRoot,
    "src",
    "world",
    "space",
    "space-grid-builder.ts"
  )
  const traceBuilderPath = path.join(
    repoRoot,
    "src",
    "world",
    "trace",
    "trace-field-builder.ts"
  )
  const traceSchemaPath = path.join(
    repoRoot,
    "src",
    "world",
    "trace",
    "trace-schema.ts"
  )
  const traceSummaryPath = path.join(
    repoRoot,
    "src",
    "world",
    "trace",
    "trace-summary.ts"
  )
  const runtimeSmokePath = path.join(
    repoRoot,
    "scripts",
    "run-world-runtime-smoke.cjs"
  )

  function fail(message) {
    console.log("WORLD TRACE SMOKE")
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

  function assertNoForbiddenTraceRuntimeCalls() {
    const traceBuilderSource = fs.readFileSync(traceBuilderPath, "utf8")
    const forbiddenTokens = [
      "runAndPersistOneRuntimeTick",
      "runOneRuntimeTick",
      "writeWorldRuntimeSaveRecord",
      "WorldRuntimeSaveRecord",
      "SafeApply",
    ]
    const hits = forbiddenTokens.filter((token) =>
      traceBuilderSource.includes(token)
    )

    assert(
      hits.length === 0,
      `Trace builder contains runtime write/tick tokens: ${hits.join(", ")}`
    )
  }

  function assertNoMovementMotherArchitecture() {
    const combinedSource = [
      fs.readFileSync(traceBuilderPath, "utf8"),
      fs.readFileSync(traceSchemaPath, "utf8"),
    ].join("\n")
    const forbiddenPatterns = [
      "movementChannel",
      "movement_channel",
      "routeGraph",
      "roadGraph",
      "pathGraph",
      "buildRoad",
      "buildRoute",
      "buildMovementChannel",
    ]
    const hits = forbiddenPatterns.filter((pattern) =>
      combinedSource.includes(pattern)
    )

    assert(
      hits.length === 0,
      `Trace layer contains movement mother architecture tokens: ${hits.join(", ")}`
    )
  }

  function assertReadBoundaryStillPresent() {
    const runtimeSmokeSource = fs.readFileSync(runtimeSmokePath, "utf8")

    assert(
      runtimeSmokeSource.includes("World read boundary: ok"),
      "Runtime smoke no longer reports world read-boundary validation."
    )
  }

  function assertTraceSummaryCoversTypes(traceField) {
    const summarySource = fs.readFileSync(traceSummaryPath, "utf8")
    const requiredTypes = [
      "spatial_use",
      "movement",
      "ecology_change",
      "behavior_activity",
      "construction_maintenance",
      "relationship_interaction",
      "emotion_attention",
      "time_passage",
      "event_impact",
    ]
    const requiredSummaryFields = [
      "spatialUseTraces",
      "movementTraces",
      "ecologyChangeTraces",
      "behaviorActivityTraces",
      "constructionMaintenanceTraces",
      "relationshipInteractionTraces",
      "emotionAttentionTraces",
      "timePassageTraces",
      "eventImpactTraces",
    ]

    requiredTypes.forEach((type) => {
      assert(summarySource.includes(`"${type}"`), `Summary misses type ${type}.`)
    })
    requiredSummaryFields.forEach((field) => {
      assert(
        Object.hasOwn(traceField.summary, field),
        `TraceField summary misses ${field}.`
      )
    })
  }

  if (!fs.existsSync(savePath)) {
    fail("Runtime save file not found.")
  }

  installTypeScriptRequireHook()

  const beforeRaw = fs.readFileSync(savePath, "utf8")
  const beforeHash = hash(beforeRaw)
  const beforeStat = fs.statSync(savePath)
  const record = parseJson(beforeRaw, "Runtime save file is not valid JSON.")
  const homeMapState = record.homeMapState

  assert(homeMapState, "HomeMapState is missing.")

  const { buildSpaceGridFromHomeMapState } = localRequire(spaceBuilderPath)
  const { buildTraceFieldFromWorld } = localRequire(traceBuilderPath)
  const spaceGrid = buildSpaceGridFromHomeMapState({ homeMapState })
  const traceField = buildTraceFieldFromWorld({ homeMapState, spaceGrid })

  assert(Array.isArray(traceField.traces), "TraceField.traces is not an array.")
  assert(traceField.traces.length > 0, "TraceField has no derived traces.")

  const malformedTrace = traceField.traces.find(
    (trace) =>
      typeof trace.id !== "string" ||
      typeof trace.type !== "string" ||
      typeof trace.sourceKind !== "string" ||
      typeof trace.lifecyclePhase !== "string" ||
      typeof trace.strength !== "number" ||
      !trace.area ||
      !trace.target ||
      !trace.scope ||
      !trace.effects ||
      !trace.visualHints ||
      typeof trace.confidence !== "number" ||
      !trace.audit
  )
  assert(!malformedTrace, `Malformed TraceFact found: ${malformedTrace?.id}`)

  assert(
    traceField.traces.every((trace) => Array.isArray(trace.relatedCellIds)),
    "A TraceFact is missing relatedCellIds."
  )
  assert(
    traceField.traces.every((trace) => Array.isArray(trace.relatedPlacementIds)),
    "A TraceFact is missing relatedPlacementIds."
  )
  assert(
    traceField.traces.every((trace) => Array.isArray(trace.scope.cellIds)),
    "A TraceFact is missing scope.cellIds."
  )
  assert(
    traceField.traces.every(
      (trace) =>
        typeof trace.visualHints.productSafeDescription === "string" &&
        trace.visualHints.productSafeDescription.length > 0
    ),
    "A TraceFact has incomplete visualHints."
  )
  assert(
    traceField.traces.every(
      (trace) =>
        Array.isArray(trace.derivedFrom) &&
        typeof trace.evidenceLevel === "string" &&
        typeof trace.sourceReliability === "string"
    ),
    "A TraceFact has incomplete audit/confidence metadata."
  )

  assertTraceSummaryCoversTypes(traceField)
  assertNoForbiddenTraceRuntimeCalls()
  assertNoMovementMotherArchitecture()
  assertReadBoundaryStillPresent()

  const afterRaw = fs.readFileSync(savePath, "utf8")
  const afterStat = fs.statSync(savePath)
  const afterRecord = parseJson(
    afterRaw,
    "Runtime save became invalid during TraceField build."
  )

  assert(
    afterRecord.tick === record.tick,
    `TraceField build changed tick from ${record.tick} to ${afterRecord.tick}.`
  )
  assert(
    hash(afterRaw) === beforeHash && afterStat.mtimeMs === beforeStat.mtimeMs,
    "TraceField build wrote to the runtime save file."
  )

  console.log("WORLD TRACE SMOKE")
  console.log(`World id: ${traceField.worldId}`)
  console.log(`Space cells: ${spaceGrid.cells.length}`)
  console.log(`Traces: ${traceField.traces.length}`)
  console.log(`Projected cells: ${traceField.projectedCellIds.length}`)
  console.log(`Current tick: ${record.tick}`)
  console.log("Trace target/scope: ok")
  console.log("Trace effects: ok")
  console.log("Trace visual hints: ok")
  console.log("Trace audit: ok")
  console.log("Read-only build: ok")
  console.log("World read boundary: ok")
  console.log("Result: PASS")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
