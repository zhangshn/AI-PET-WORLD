async function main() {
  const crypto = await import("node:crypto")
  const fs = await import("node:fs")
  const moduleApi = await import("node:module")
  const path = await import("node:path")
  const ts = await import("typescript")
  const repoRoot = process.cwd()
  const localRequire = moduleApi.createRequire(__filename)
  const savePath = path.join(repoRoot, ".runtime", "world-state", "default-world.json")
  const runtimeGatewayPath = path.join(repoRoot, "src", "world", "runtime", "world-runtime-gateway.ts")
  const runtimeRunnerPath = path.join(repoRoot, "src", "world", "runtime", "world-runtime-tick-runner.ts")
  const intentPath = path.join(repoRoot, "src", "world", "runtime", "butler-runtime-intent.ts")
  const traceClosurePath = path.join(repoRoot, "src", "world", "runtime", "butler-runtime-trace-closure.ts")

  function fail(message) {
    console.log("BUTLER TRACE CLOSURE SMOKE")
    console.log("This smoke intentionally writes the local runtime save by running one explicit runtime tick.")
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

    moduleConstructor._resolveFilename = function resolveFilename(request, parent, isMain, options) {
      if (request.startsWith("@/")) {
        return originalResolveFilename.call(this, path.join(repoRoot, "src", request.slice(2)), parent, isMain, options)
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

  function assertStaticRuntimeContract() {
    const runnerSource = fs.readFileSync(runtimeRunnerPath, "utf8")
    const intentSource = fs.readFileSync(intentPath, "utf8")
    const traceClosureSource = fs.readFileSync(traceClosurePath, "utf8")
    const combinedSource = [runnerSource, intentSource, traceClosureSource].join("\n")

    const requiredTokens = [
      "buildButlerRuntimeIntent",
      "validateButlerRuntimeIntent",
      "applyButlerRuntimeTraceClosure",
      "lastButlerRuntimeIntent",
      "lastButlerWorldRuleValidation",
      "m7_butler_trace_closure",
      "world_rule_validation_passed",
      "trace_write_requires_validation",
      "memory_seed_requires_trace_quality",
      "not_pet_trace",
    ]

    requiredTokens.forEach((token) =>
      assert(combinedSource.includes(token), `M7 runtime chain is missing required token: ${token}.`)
    )

    const forbiddenTraceClosureTokens = [
      "writeWorldRuntimeSaveRecord",
      "runAndPersistOneRuntimeTick",
      "buildSceneSvg",
      "scene-composer-gateway",
      "roadGraph",
      "pathGraph",
      "createPet",
      "pet_default",
    ]
    const traceClosureHits = forbiddenTraceClosureTokens.filter((token) => traceClosureSource.includes(token))

    assert(
      traceClosureHits.length === 0,
      `Butler trace closure contains forbidden tokens: ${traceClosureHits.join(", ")}`
    )
  }

  function assertIntentShape(record) {
    const intent = record.lastButlerRuntimeIntent
    assert(intent, "lastButlerRuntimeIntent was not persisted.")
    assert(intent.tags.includes("butler_runtime_intent"), "Intent is missing butler_runtime_intent tag.")
    assert(intent.tags.includes("m7_butler_trace_closure"), "Intent is missing M7 tag.")
    assert(typeof intent.kind === "string", "Intent kind is invalid.")
    assert(typeof intent.motivation === "string", "Intent motivation is invalid.")
    assert(Array.isArray(intent.requestedTraceTypes), "Intent requestedTraceTypes is invalid.")
    assert(intent.requestedTraceTypes.length > 0, "Intent did not request trace types.")
    assert(intent.target, "Intent target is missing.")

    return intent
  }

  function assertValidationShape(record, intent) {
    const validation = record.lastButlerWorldRuleValidation
    assert(validation, "lastButlerWorldRuleValidation was not persisted.")
    assert(validation.intentId === intent.id, "Validation does not point to persisted intent.")
    assert(validation.tags.includes("butler_world_rule_validation"), "Validation is missing butler_world_rule_validation tag.")
    assert(validation.tags.includes("m7_butler_trace_closure"), "Validation is missing M7 tag.")
    assert(validation.tags.includes("trace_write_requires_validation"), "Validation does not guard trace writing.")
    assert(validation.tags.includes("event_write_requires_validation"), "Validation does not guard event writing.")
    assert(validation.tags.includes("memory_seed_requires_trace_quality"), "Validation does not guard memory seed quality.")
    assert(
      validation.ok === (validation.blockingWarnings.length === 0),
      "Validation ok flag does not match blocking warnings."
    )

    return validation
  }

  function assertButlerTrace(record, intent, validation) {
    assert(record.traceField, "TraceField missing after explicit runtime tick.")
    const butlerTraces = record.traceField.traces.filter(
      (trace) =>
        trace.sourceKind === "butler_behavior" &&
        trace.tags.includes("m7_butler_trace_closure") &&
        trace.tags.includes("not_pet_trace")
    )

    assert(butlerTraces.length > 0, "No M7 butler_behavior trace was persisted.")

    const matchingTrace = butlerTraces.find(
      (trace) =>
        trace.updatedAtTick === record.tick &&
        trace.derivedFrom.includes(intent.id) &&
        trace.derivedFrom.includes(validation.id)
    )

    assert(
      matchingTrace,
      `No current-tick butler trace derived from persisted intent and validation. Butler trace ids: ${butlerTraces
        .map((trace) => trace.id)
        .join(", ")}`
    )
    assert(matchingTrace.audit.tags.includes("world_rule_validation_passed"), "Matched butler trace audit does not include validation pass.")
    assert(matchingTrace.type === intent.requestedTraceTypes[0], "Matched butler trace type does not match primary requested trace.")

    return matchingTrace
  }

  function assertNoUnsafeHomeMapWrite(beforeRecord, afterRecord, intent) {
    const beforeHomeMapHash = hashJson(beforeRecord.homeMapState)
    const afterHomeMapHash = hashJson(afterRecord.homeMapState)

    if (intent.kind === "observation" || intent.kind === "resource_wait") {
      assert(
        beforeHomeMapHash === afterHomeMapHash,
        `${intent.kind} intent changed HomeMapState even though it must only write Trace/Event/MemorySeed.`
      )
      return
    }

    assert(
      afterRecord.lastButlerWorldRuleValidation.safeApplyRequired,
      `${intent.kind} intent did not preserve SafeApply requirement.`
    )
  }

  function assertNoDefaultPet(record) {
    const petPlacements = record.homeMapState.placements.filter(
      (placement) =>
        placement.layer === "actor" &&
        (placement.tags.includes("pet") || placement.id.toLowerCase().includes("pet") || placement.label.toLowerCase().includes("pet") || placement.label.includes("宠物"))
    )
    const petTraces = record.traceField.traces.filter(
      (trace) => trace.sourceKind === "pet_behavior" || trace.tags.includes("pet_default")
    )

    assert(petPlacements.length === 0, "M7 created a default pet actor placement.")
    assert(petTraces.length === 0, "M7 created pet traces.")
  }

  if (!fs.existsSync(savePath)) fail("Runtime save file not found.")
  if (!fs.existsSync(runtimeGatewayPath)) fail("Runtime gateway is missing.")
  if (!fs.existsSync(runtimeRunnerPath)) fail("Runtime tick runner is missing.")
  if (!fs.existsSync(intentPath)) fail("Butler runtime intent module is missing.")
  if (!fs.existsSync(traceClosurePath)) fail("Butler runtime trace closure module is missing.")

  installTypeScriptRequireHook()
  assertStaticRuntimeContract()

  const { runAndPersistOneRuntimeTick, readWorldRuntimeForView } = localRequire(runtimeGatewayPath)
  const beforeRecord = parseJson(fs.readFileSync(savePath, "utf8"), "Runtime save before M7 smoke is not valid JSON.")
  const beforeTick = beforeRecord.tick
  const result = await runAndPersistOneRuntimeTick({ now: Date.now() })

  assert(result.persisted, "Explicit runtime tick was not persisted.")
  assert(result.tags.includes("m7_butler_trace_closure"), "Runtime tick result is missing M7 tag.")
  assert(
    result.nextSaveRecord.lastButlerRuntimeIntent,
    "Tick result did not expose lastButlerRuntimeIntent."
  )
  assert(
    result.nextSaveRecord.lastButlerWorldRuleValidation,
    "Tick result did not expose lastButlerWorldRuleValidation."
  )

  const afterRecord = parseJson(fs.readFileSync(savePath, "utf8"), "Runtime save after M7 smoke is not valid JSON.")
  assert(afterRecord.tick === beforeTick + 1, "M7 smoke did not advance exactly one explicit runtime tick.")

  const intent = assertIntentShape(afterRecord)
  const validation = assertValidationShape(afterRecord, intent)
  const matchedTrace = assertButlerTrace(afterRecord, intent, validation)

  assertNoUnsafeHomeMapWrite(beforeRecord, afterRecord, intent)
  assertNoDefaultPet(afterRecord)
  assert(
    afterRecord.recentEvents.some(
      (event) =>
        event.tick === afterRecord.tick &&
        event.tags.includes("m7_butler_trace_closure") &&
        event.tags.includes("no_pet_fact_created")
    ),
    "Recent events do not include M7 closure / no_pet_fact_created tags."
  )
  assert(
    afterRecord.traceMemorySeedField &&
      afterRecord.traceMemorySeedField.tags.includes("trace_memory_seed_field"),
    "TraceMemorySeedField missing after M7 closure."
  )

  const beforeReadViewRaw = fs.readFileSync(savePath, "utf8")
  const beforeReadViewHash = crypto.createHash("sha256").update(beforeReadViewRaw).digest("hex")
  const viewResult = await readWorldRuntimeForView()
  const afterReadViewRaw = fs.readFileSync(savePath, "utf8")
  const afterReadViewHash = crypto.createHash("sha256").update(afterReadViewRaw).digest("hex")
  const afterReadViewRecord = parseJson(afterReadViewRaw, "Runtime save after read-only check is not valid JSON.")

  assert(viewResult.saveRecord.lastButlerRuntimeIntent, "Read-only view did not expose persisted M7 intent.")
  assert(afterReadViewRecord.tick === afterRecord.tick, "readWorldRuntimeForView changed runtime tick.")
  assert(afterReadViewHash === beforeReadViewHash, "readWorldRuntimeForView changed runtime hash.")

  console.log("BUTLER TRACE CLOSURE SMOKE")
  console.log("This smoke intentionally writes the local runtime save by running one explicit runtime tick.")
  console.log(`Tick before: ${beforeTick}`)
  console.log(`Tick after: ${afterRecord.tick}`)
  console.log(`Intent: ${intent.kind}`)
  console.log(`Motivation: ${intent.motivation}`)
  console.log(`Validation: ${validation.ok ? "ok" : "blocked"}`)
  console.log(`Butler trace: ${matchedTrace.id}`)
  console.log(`Butler trace type: ${matchedTrace.type}`)
  console.log(`Trace count: ${afterRecord.traceField.traces.length}`)
  console.log(`Memory seeds: ${afterRecord.traceMemorySeedField.summary.totalSeeds}`)
  console.log("Butler intent persisted: ok")
  console.log("World rule validation persisted: ok")
  console.log("Butler behavior trace persisted: ok")
  console.log("No unsafe HomeMapState write: ok")
  console.log("No default pet fact: ok")
  console.log("readWorldRuntimeForView read-only: ok")
  console.log("Result: PASS")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
