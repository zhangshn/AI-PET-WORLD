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
  const runtimeGatewayPath = path.join(
    repoRoot,
    "src",
    "world",
    "runtime",
    "world-runtime-gateway.ts"
  )
  const traceTickPath = path.join(
    repoRoot,
    "src",
    "world",
    "trace",
    "trace-tick.ts"
  )
  const traceBuilderPath = path.join(
    repoRoot,
    "src",
    "world",
    "trace",
    "trace-field-builder.ts"
  )
  const runtimeSmokePath = path.join(
    repoRoot,
    "scripts",
    "run-world-runtime-smoke.cjs"
  )

  function fail(message) {
    console.log("WORLD TRACE TICK SMOKE")
    console.log("This smoke intentionally writes the local runtime save by running explicit runtime ticks.")
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

  function hashJson(value) {
    return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex")
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

  function assertTraceField(traceField, label) {
    assert(traceField, `${label} traceField is missing.`)
    assert(Array.isArray(traceField.traces), `${label} traceField.traces is invalid.`)
    assert(traceField.traces.length > 0, `${label} traceField has no traces.`)
    assert(traceField.summary, `${label} traceField.summary is missing.`)
    assert(
      typeof traceField.summary.totalTraces === "number",
      `${label} summary.totalTraces is invalid.`
    )

    const malformedTrace = traceField.traces.find(
      (trace) =>
        typeof trace.id !== "string" ||
        typeof trace.updatedAtTick !== "number" ||
        typeof trace.lastReinforcedTick !== "number" ||
        !trace.target ||
        !trace.scope ||
        !trace.effects ||
        !trace.visualHints ||
        !trace.audit
    )
    assert(!malformedTrace, `${label} malformed trace: ${malformedTrace?.id}`)
  }

  function assertNoForbiddenStaticTokens() {
    const combinedSource = [
      fs.readFileSync(traceTickPath, "utf8"),
      fs.readFileSync(traceBuilderPath, "utf8"),
    ].join("\n")
    const forbiddenPatterns = [
      "writeWorldRuntimeSaveRecord",
      "runAndPersistOneRuntimeTick",
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
      `Trace tick layer contains forbidden tokens: ${hits.join(", ")}`
    )
  }

  function assertTraceEffectsDidNotMutateWorldFacts(before, after) {
    assert(
      hashJson(before.homeMapState.resources) ===
        hashJson(after.homeMapState.resources),
      "Trace effects appear to have changed HomeMapState.resources during observe/wait ticks."
    )
    assert(
      hashJson(before.homeMapState.zones) === hashJson(after.homeMapState.zones),
      "Trace effects appear to have changed HomeMapState.zones."
    )
    assert(
      hashJson(before.homeMapState.placements) ===
        hashJson(after.homeMapState.placements),
      "Trace effects appear to have changed HomeMapState.placements."
    )
  }

  function assertReadBoundaryStillPresent() {
    const runtimeSmokeSource = fs.readFileSync(runtimeSmokePath, "utf8")

    assert(
      runtimeSmokeSource.includes("World read boundary: ok"),
      "Runtime smoke no longer reports world read-boundary validation."
    )
  }

  if (!fs.existsSync(savePath)) {
    fail("Runtime save file not found.")
  }

  installTypeScriptRequireHook()
  assertNoForbiddenStaticTokens()
  assertReadBoundaryStillPresent()

  const { runAndPersistOneRuntimeTick, readWorldRuntimeForView } =
    localRequire(runtimeGatewayPath)
  const beforeRecord = parseJson(
    fs.readFileSync(savePath, "utf8"),
    "Runtime save file is not valid JSON."
  )
  const firstResult = await runAndPersistOneRuntimeTick({
    now: Date.now(),
  })
  assert(firstResult.persisted, "First explicit runtime tick was not persisted.")

  const firstRecord = parseJson(
    fs.readFileSync(savePath, "utf8"),
    "Runtime save after first tick is not valid JSON."
  )
  assert(
    firstRecord.tick === beforeRecord.tick + 1,
    `First tick did not increment from ${beforeRecord.tick} to ${beforeRecord.tick + 1}.`
  )
  assertTraceField(firstRecord.traceField, "First tick")

  const firstTraceIds = new Set(firstRecord.traceField.traces.map((trace) => trace.id))
  const secondResult = await runAndPersistOneRuntimeTick({
    now: Date.now() + 1000,
  })
  assert(secondResult.persisted, "Second explicit runtime tick was not persisted.")

  const secondRecord = parseJson(
    fs.readFileSync(savePath, "utf8"),
    "Runtime save after second tick is not valid JSON."
  )
  assert(
    secondRecord.tick === firstRecord.tick + 1,
    `Second tick did not increment from ${firstRecord.tick} to ${firstRecord.tick + 1}.`
  )
  assertTraceField(secondRecord.traceField, "Second tick")

  const retainedTrace = secondRecord.traceField.traces.find((trace) =>
    firstTraceIds.has(trace.id)
  )
  assert(retainedTrace, "No trace id survived across consecutive ticks.")
  assert(
    retainedTrace.updatedAtTick >= firstRecord.tick + 1,
    "Retained trace updatedAtTick did not advance."
  )
  assert(
    retainedTrace.lastReinforcedTick === undefined ||
      retainedTrace.lastReinforcedTick <= secondRecord.tick,
    "Retained trace lastReinforcedTick is ahead of runtime tick."
  )

  const lifecyclePhases = new Set(
    secondRecord.traceField.traces.map((trace) => trace.lifecyclePhase)
  )
  assert(
    [
      "generated",
      "accumulating",
      "strengthened",
      "decaying",
      "covered",
      "repaired",
      "transformed",
      "deposited",
    ].some((phase) => lifecyclePhases.has(phase)),
    "TraceField has no recognized lifecycle phase."
  )

  assertTraceEffectsDidNotMutateWorldFacts(firstRecord, secondRecord)

  const beforeReadViewRaw = fs.readFileSync(savePath, "utf8")
  const beforeReadViewHash = crypto
    .createHash("sha256")
    .update(beforeReadViewRaw)
    .digest("hex")
  const beforeReadViewTick = secondRecord.tick
  const viewResult = await readWorldRuntimeForView()
  const afterReadViewRaw = fs.readFileSync(savePath, "utf8")
  const afterReadViewHash = crypto
    .createHash("sha256")
    .update(afterReadViewRaw)
    .digest("hex")
  const afterReadViewRecord = parseJson(
    afterReadViewRaw,
    "Runtime save after readWorldRuntimeForView is not valid JSON."
  )

  assert(viewResult.saveRecord.traceField, "Read-only view did not expose persisted traceField.")
  assert(
    afterReadViewRecord.tick === beforeReadViewTick,
    "readWorldRuntimeForView changed runtime tick."
  )
  assert(
    afterReadViewHash === beforeReadViewHash,
    "readWorldRuntimeForView changed runtime save hash."
  )

  console.log("WORLD TRACE TICK SMOKE")
  console.log("This smoke intentionally writes the local runtime save by running explicit runtime ticks.")
  console.log(`Tick before: ${beforeRecord.tick}`)
  console.log(`Tick after first explicit tick: ${firstRecord.tick}`)
  console.log(`Tick after second explicit tick: ${secondRecord.tick}`)
  console.log(`Trace count after first tick: ${firstRecord.traceField.traces.length}`)
  console.log(`Trace count after second tick: ${secondRecord.traceField.traces.length}`)
  console.log(`Retained trace id: ${retainedTrace.id}`)
  console.log(`Lifecycle phases: ${Array.from(lifecyclePhases).join(", ")}`)
  console.log("TraceField persisted by explicit runtime tick: ok")
  console.log("Trace effects did not mutate HomeMapState facts: ok")
  console.log("readWorldRuntimeForView read-only: ok")
  console.log("World read boundary: ok")
  console.log("Result: PASS")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
