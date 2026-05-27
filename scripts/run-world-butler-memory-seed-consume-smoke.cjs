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
  const selectorPath = path.join(
    repoRoot,
    "src",
    "world",
    "runtime",
    "butler-runtime-motivation-selector.ts"
  )
  const schemaPath = path.join(
    repoRoot,
    "src",
    "world",
    "runtime",
    "butler-runtime-motivation-schema.ts"
  )
  const runtimeSmokePath = path.join(
    repoRoot,
    "scripts",
    "run-world-runtime-smoke.cjs"
  )

  function fail(message) {
    console.log("BUTLER MEMORY SEED CONSUME SMOKE")
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

  function assertSourceBoundaries() {
    const selectorSource = fs.readFileSync(selectorPath, "utf8")
    const schemaSource = fs.readFileSync(schemaPath, "utf8")
    const forbiddenPatterns = [
      "writeWorldRuntimeSaveRecord",
      "runAndPersistOneRuntimeTick",
      "runOneRuntimeTick",
      "MapDiff",
      "safeApply",
      "ButlerMemory",
      "PetMemory",
      "WorldLearning",
      "movementChannel",
      "movement_channel",
      "roadGraph",
      "pathGraph",
      "buildRoad",
      "buildRoute",
    ]
    const hits = forbiddenPatterns.filter((pattern) =>
      selectorSource.includes(pattern)
    )

    assert(
      hits.length === 0,
      `Selector contains forbidden architecture tokens: ${hits.join(", ")}`
    )
    assert(
      selectorSource.includes("traceMemorySeedField") &&
        selectorSource.includes("seedField?.seeds"),
      "Selector does not consume traceMemorySeedField.seeds."
    )
    assert(
      selectorSource.includes("trace_memory_seed_consumed_as_bias"),
      "Selector does not tag memory seed consumption as bias."
    )
    assert(
      selectorSource.includes("trace_seed_not_formal_memory"),
      "Selector does not tag seeds as non-formal memory."
    )
    assert(
      schemaSource.includes("memorySeedConsumeScore") &&
        schemaSource.includes("memorySeedFocusKinds"),
      "Motivation schema does not expose memory seed consume context."
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
  assertSourceBoundaries()
  assertReadBoundaryStillPresent()

  const beforeRaw = fs.readFileSync(savePath, "utf8")
  const beforeHash = crypto.createHash("sha256").update(beforeRaw).digest("hex")
  const record = parseJson(beforeRaw, "Runtime save file is not valid JSON.")
  const seedCount = record.traceMemorySeedField?.seeds?.length ?? 0

  assert(seedCount > 0, "No memory seeds are available to consume.")

  const { selectButlerRuntimeMotivation } = localRequire(selectorPath)
  const decision = selectButlerRuntimeMotivation({
    saveRecord: record,
    nextTick: record.tick + 1,
    now: Date.now(),
  })

  assert(decision.traceContext, "Decision traceContext is missing.")
  assert(
    decision.traceContext.memorySeedCount === seedCount,
    "Decision traceContext did not read persisted seed count."
  )
  assert(
    decision.traceContext.memorySeedConsumeScore > 0,
    "Memory seed consume score was not derived."
  )
  assert(
    decision.traceContext.memorySeedWeight > 0,
    "Memory seed weight was not derived."
  )
  assert(
    Array.isArray(decision.traceContext.memorySeedFocusKinds),
    "Memory seed focus kinds missing."
  )
  assert(
    decision.tags.includes("trace_memory_seed_consumed_as_bias") ||
      decision.scores.some((score) =>
        score.tags.includes("trace_memory_seed_consumed_as_bias")
      ),
    "Decision does not mark memory seeds as consumed bias."
  )
  assert(
    decision.tags.includes("trace_seed_not_formal_memory") ||
      decision.scores.some((score) =>
        score.tags.includes("trace_seed_not_formal_memory")
      ),
    "Decision does not mark seeds as non-formal memory."
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
  }
  const lowResourceDecision = selectButlerRuntimeMotivation({
    saveRecord: lowResourceRecord,
    nextTick: record.tick + 2,
    now: Date.now() + 1,
  })

  assert(
    lowResourceDecision.selectedMotivation !== "continue_construction",
    "Memory seed bias forced construction during resource shortage."
  )

  const afterRaw = fs.readFileSync(savePath, "utf8")
  const afterHash = crypto.createHash("sha256").update(afterRaw).digest("hex")
  const afterRecord = parseJson(
    afterRaw,
    "Runtime save after memory seed consume selector is not valid JSON."
  )

  assert(afterRecord.tick === record.tick, "Selector changed runtime tick.")
  assert(afterHash === beforeHash, "Selector changed runtime save hash.")

  console.log("BUTLER MEMORY SEED CONSUME SMOKE")
  console.log(`Current tick: ${record.tick}`)
  console.log(`Memory seeds consumed: ${seedCount}`)
  console.log(`Memory seed weight: ${decision.traceContext.memorySeedWeight}`)
  console.log(`Memory seed consume score: ${decision.traceContext.memorySeedConsumeScore}`)
  console.log(`Selected motivation: ${decision.selectedMotivation}`)
  console.log(`Low-resource synthetic motivation: ${lowResourceDecision.selectedMotivation}`)
  console.log("Memory seed consumed as bias: ok")
  console.log("Memory seed did not become formal memory: ok")
  console.log("Selector read-only: ok")
  console.log("World read boundary: ok")
  console.log("Result: PASS")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
