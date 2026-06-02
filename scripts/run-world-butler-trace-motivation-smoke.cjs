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
  const motivationSelectorPath = path.join(
    repoRoot,
    "src",
    "world",
    "runtime",
    "butler-runtime-motivation-selector.ts"
  )
  const runtimeSmokePath = path.join(
    repoRoot,
    "scripts",
    "run-world-runtime-smoke.cjs"
  )

  function fail(message) {
    console.log("BUTLER TRACE MOTIVATION SMOKE")
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
    const selectorSource = fs.readFileSync(motivationSelectorPath, "utf8")
    const forbiddenPatterns = [
      "writeWorldRuntimeSaveRecord",
      "runAndPersistOneRuntimeTick",
      "runOneRuntimeTick",
      "MapDiff",
      "safeApply",
      "movementChannel",
      "movement_channel",
      "buildRoad",
      "buildRoute",
    ]
    const hits = forbiddenPatterns.filter((pattern) =>
      selectorSource.includes(pattern)
    )

    assert(
      hits.length === 0,
      `Motivation selector contains forbidden tokens: ${hits.join(", ")}`
    )
  }

  function assertReadBoundaryStillPresent() {
    const runtimeSmokeSource = fs.readFileSync(runtimeSmokePath, "utf8")

    assert(
      runtimeSmokeSource.includes("World read boundary: ok"),
      "Runtime smoke no longer reports world read-boundary validation."
    )
  }

  const motivationTypes = [
    "continue_construction",
    "maintain_home",
    "wait_for_resources",
    "observe_world",
  ]

  if (!fs.existsSync(savePath)) {
    fail("Runtime save file not found.")
  }

  installTypeScriptRequireHook()
  assertNoForbiddenArchitecture()
  assertReadBoundaryStillPresent()

  const beforeRaw = fs.readFileSync(savePath, "utf8")
  const beforeHash = crypto.createHash("sha256").update(beforeRaw).digest("hex")
  const record = parseJson(beforeRaw, "Runtime save file is not valid JSON.")

  if (!record.traceInfluenceSummary) {
    fail("traceInfluenceSummary is missing. Run npm run smoke:trace-influence first.")
  }

  if (!record.traceMemorySeedField) {
    fail("traceMemorySeedField is missing. Run npm run smoke:trace-influence first.")
  }

  const { selectButlerRuntimeMotivation } = localRequire(motivationSelectorPath)
  const decision = selectButlerRuntimeMotivation({
    saveRecord: record,
    nextTick: record.tick + 1,
    now: Date.now(),
  })

  assert(
    motivationTypes.includes(decision.selectedMotivation),
    `Invalid selectedMotivation: ${decision.selectedMotivation}`
  )
  assert(Array.isArray(decision.scores), "Decision scores are missing.")
  assert(
    decision.scores.every((score) => typeof score.traceContextScore === "number"),
    "A motivation score is missing traceContextScore."
  )
  assert(decision.traceContext, "Decision traceContext is missing.")
  assert(
    typeof decision.traceContext.tracePressure === "number",
    "traceContext.tracePressure is invalid."
  )
  assert(
    decision.tags.includes("trace_context_read") ||
      decision.scores.some((score) => score.tags.includes("trace_context_read")),
    "Decision does not show trace context was read."
  )
  assert(
    decision.tags.includes("trace_not_direct_action") ||
      decision.scores.some((score) => score.tags.includes("trace_not_direct_action")),
    "Decision does not mark trace as non-direct action."
  )
  assert(
    decision.tags.includes("safe_apply_still_required") ||
      decision.scores.some((score) => score.tags.includes("safe_apply_still_required")),
    "Decision does not preserve SafeApply requirement."
  )

  const lowResourceRecord = {
    ...record,
    homeMapState: {
      ...record.homeMapState,
      resources: {
        ...record.homeMapState.resources,
        materialReadiness: 0,
        careReadiness: 0,
        groundHealth: 20,
      },
    },
    traceInfluenceSummary: {
      ...record.traceInfluenceSummary,
      averageTraceInfluenceStrength: 100,
      highMaintenanceTraceCount: 999,
      familiarRegionCount: 99,
      highTraceMovementCostRegions: ["boundary"],
    },
  }
  const lowResourceDecision = selectButlerRuntimeMotivation({
    saveRecord: lowResourceRecord,
    nextTick: record.tick + 2,
    now: Date.now() + 1,
  })

  assert(
    lowResourceDecision.selectedMotivation !== "continue_construction",
    "Trace context forced continue_construction during resource shortage."
  )

  const afterRaw = fs.readFileSync(savePath, "utf8")
  const afterHash = crypto.createHash("sha256").update(afterRaw).digest("hex")
  const afterRecord = parseJson(
    afterRaw,
    "Runtime save after motivation selector is not valid JSON."
  )

  assert(afterRecord.tick === record.tick, "Motivation selector changed runtime tick.")
  assert(afterHash === beforeHash, "Motivation selector changed runtime save hash.")

  console.log("BUTLER TRACE MOTIVATION SMOKE")
  console.log(`Current tick: ${record.tick}`)
  console.log(`Selected motivation: ${decision.selectedMotivation}`)
  console.log(`Trace pressure: ${decision.traceContext.tracePressure}`)
  console.log(`Memory seeds: ${decision.traceContext.memorySeedCount}`)
  console.log(`Low-resource synthetic motivation: ${lowResourceDecision.selectedMotivation}`)
  console.log("Trace context read: ok")
  console.log("Trace did not directly create action: ok")
  console.log("Selector read-only: ok")
  console.log("World read boundary: ok")
  console.log("Result: PASS")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
