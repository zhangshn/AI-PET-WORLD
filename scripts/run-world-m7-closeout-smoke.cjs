async function main() {
  const crypto = await import("node:crypto")
  const fs = await import("node:fs")
  const moduleApi = await import("node:module")
  const path = await import("node:path")
  const ts = await import("typescript")
  const repoRoot = process.cwd()
  const localRequire = moduleApi.createRequire(__filename)
  const savePath = path.join(repoRoot, ".runtime", "world-state", "default-world.json")
  const runtimeDir = path.join(repoRoot, "src", "world", "runtime")
  const viewModelDir = path.join(repoRoot, "src", "world", "world-view-model")
  const viewModelGatewayPath = path.join(viewModelDir, "world-view-model-gateway.ts")
  const worldPagePath = path.join(repoRoot, "src", "app", "world", "world-live-runtime-page.tsx")
  const pixelCanvasPath = path.join(repoRoot, "src", "app", "world", "components", "pixel-world-view", "pixel-world-canvas.client.tsx")

  function fail(message) {
    console.log("M7 CLOSEOUT SMOKE")
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

  function readDirectorySources(directory) {
    return fs
      .readdirSync(directory)
      .filter((fileName) => fileName.endsWith(".ts"))
      .map((fileName) => fs.readFileSync(path.join(directory, fileName), "utf8"))
      .join("\n")
  }

  function assertStaticCloseoutContract() {
    const runtimeSources = readDirectorySources(runtimeDir)
    const viewModelSources = readDirectorySources(viewModelDir)
    const pageSource = fs.readFileSync(worldPagePath, "utf8")
    const canvasSource = fs.readFileSync(pixelCanvasPath, "utf8")
    const combinedSource = [runtimeSources, viewModelSources, pageSource, canvasSource].join("\n")

    const requiredTokens = [
      "buildButlerRuntimeIntent",
      "validateButlerRuntimeIntent",
      "applyButlerRuntimeTraceClosure",
      "buildButlerRuntimeAuditSummary",
      "lastButlerRuntimeIntent",
      "lastButlerWorldRuleValidation",
      "lastButlerRuntimeAuditSummary",
      "butler_runtime_audit_summary_persisted",
      "m7_butler_trace_closure",
      "no_default_pet_fact",
      "safe_apply_boundary_recorded",
      "memory_seed_count_recorded",
      "buildButlerExplanationView",
      "buildPPhoneView",
      "buildWorldViewModelForPixelWorld",
      "PixelWorldView",
      "readWorldRuntimeForView",
    ]

    requiredTokens.forEach((token) =>
      assert(combinedSource.includes(token), `M7 closeout path is missing required token: ${token}.`)
    )

    const formalPathSource = [viewModelSources, pageSource, canvasSource].join("\n")
    const forbiddenFormalTokens = [
      "buildSceneSvg",
      "data:image/svg+xml",
      "WorldPainterReadonlyPreview",
      "FormalWorldView",
      "ProceduralRendererView",
      "scene-composer-gateway",
      "composeScene",
      "buildDefaultSceneComposerFact",
      "roadGraph",
      "pathGraph",
      "pet_default",
      "createPet",
      "finalScore",
      "riskPenalty",
      "debugScore",
      "rawScore",
      "JSON.stringify",
    ]
    const forbiddenHits = forbiddenFormalTokens.filter((token) => formalPathSource.includes(token))

    assert(
      forbiddenHits.length === 0,
      `Formal M7 /world path contains forbidden tokens: ${forbiddenHits.join(", ")}`
    )
  }

  function findCurrentButlerTrace(record) {
    const intent = record.lastButlerRuntimeIntent
    const validation = record.lastButlerWorldRuleValidation
    const summary = record.lastButlerRuntimeAuditSummary

    return record.traceField.traces.find(
      (trace) =>
        trace.id === summary.traceId &&
        trace.sourceKind === "butler_behavior" &&
        trace.updatedAtTick === record.tick &&
        trace.tags.includes("m7_butler_trace_closure") &&
        trace.tags.includes("not_pet_trace") &&
        trace.derivedFrom.includes(intent.id) &&
        trace.derivedFrom.includes(validation.id)
    )
  }

  function assertRuntimeCloseout(record) {
    const intent = record.lastButlerRuntimeIntent
    const validation = record.lastButlerWorldRuleValidation
    const summary = record.lastButlerRuntimeAuditSummary

    assert(intent, "Runtime record is missing lastButlerRuntimeIntent.")
    assert(validation, "Runtime record is missing lastButlerWorldRuleValidation.")
    assert(summary, "Runtime record is missing lastButlerRuntimeAuditSummary.")
    assert(record.traceField, "Runtime record is missing TraceField.")
    assert(record.traceMemorySeedField, "Runtime record is missing TraceMemorySeedField.")
    assert(record.traceInfluenceSummary, "Runtime record is missing TraceInfluenceSummary.")
    assert(summary.tick === record.tick, "Audit summary tick does not match runtime tick.")
    assert(summary.motivation === intent.motivation, "Audit summary motivation does not match intent.")
    assert(summary.intentKind === intent.kind, "Audit summary intent kind does not match intent.")
    assert(summary.validationStatus === (validation.ok ? "passed" : "blocked"), "Audit summary validation status does not match validation.")
    assert(summary.memorySeedCount === record.traceMemorySeedField.summary.totalSeeds, "Audit summary memory seed count does not match TraceMemorySeedField.")
    assert(summary.tags.includes("no_default_pet_fact"), "Audit summary does not guard no default pet fact.")
    assert(summary.tags.includes("safe_apply_boundary_recorded"), "Audit summary does not record SafeApply boundary.")
    assert(summary.tags.includes("memory_seed_count_recorded"), "Audit summary does not record memory seed count.")
    assert(summary.safeguards.some((item) => item.includes("宠物")), "Audit safeguards do not mention no default pet fact.")
    assert(summary.safeguards.some((item) => item.includes("SafeApply") || item.includes("HomeMapState")), "Audit safeguards do not mention SafeApply / HomeMapState.")

    if (summary.traceWriteStatus === "created") {
      const trace = findCurrentButlerTrace(record)
      assert(trace, "Audit summary trace pointer does not resolve to current butler trace.")
      assert(trace.type === summary.traceType, "Audit summary trace type does not match current butler trace.")
    }

    const petPlacements = record.homeMapState.placements.filter(
      (placement) =>
        placement.layer === "actor" &&
        (placement.tags.includes("pet") || placement.id.toLowerCase().includes("pet") || placement.label.toLowerCase().includes("pet") || placement.label.includes("宠物"))
    )
    const petTraces = record.traceField.traces.filter(
      (trace) => trace.sourceKind === "pet_behavior" || trace.tags.includes("pet_default")
    )

    assert(petPlacements.length === 0, "M7 closeout found default pet actor placement.")
    assert(petTraces.length === 0, "M7 closeout found pet traces.")

    return { intent, validation, summary }
  }

  if (!fs.existsSync(savePath)) fail("Runtime save file not found.")
  if (!fs.existsSync(viewModelGatewayPath)) fail("WorldViewModel gateway is missing.")
  if (!fs.existsSync(worldPagePath)) fail("World page is missing.")
  if (!fs.existsSync(pixelCanvasPath)) fail("Pixel canvas component is missing.")

  installTypeScriptRequireHook()
  assertStaticCloseoutContract()

  const beforeRaw = fs.readFileSync(savePath, "utf8")
  const beforeHash = crypto.createHash("sha256").update(beforeRaw).digest("hex")
  const record = parseJson(beforeRaw, "Runtime save file is not valid JSON.")
  const { intent, validation, summary } = assertRuntimeCloseout(record)

  const { buildWorldViewModelForPixelWorld } = localRequire(viewModelGatewayPath)
  const model = buildWorldViewModelForPixelWorld({ saveRecord: record, isPersisted: true })
  const explanationText = [
    model.butlerExplanation.title,
    model.butlerExplanation.body,
    model.pPhone.latestMessageTitle,
    model.pPhone.latestMessageBody,
  ].join("\n")

  assert(model.tags.includes("m7_butler_trace_closure_explanation"), "WorldViewModel missing M7 explanation tag.")
  assert(model.tags.includes("runtime_read_only_projection"), "WorldViewModel missing runtime read-only tag.")
  assert(model.actors.some((actor) => actor.kind === "butler" && actor.visible), "WorldViewModel has no visible butler actor.")
  assert(!model.actors.some((actor) => actor.kind === "pet" && actor.visible), "WorldViewModel generated a default visible pet actor.")
  assert(model.butlerExplanation.body.includes(summary.userFacingSummary), "Butler explanation does not read audit summary first.")
  assert(model.pPhone.latestMessageBody.includes(`当前可参考的记忆种子：${summary.memorySeedCount} 条。`), "P-Phone does not read audit summary memory seed count.")
  assert(explanationText.includes("管家"), "Closeout explanation does not mention butler.")
  assert(explanationText.includes("痕迹"), "Closeout explanation does not mention trace.")
  assert(explanationText.includes("HomeMapState") || explanationText.includes("家园事实") || explanationText.includes("家园结构"), "Closeout explanation does not mention HomeMapState/world fact boundary.")
  assert(!explanationText.includes("finalScore"), "Closeout explanation exposes finalScore.")
  assert(!explanationText.includes("riskPenalty"), "Closeout explanation exposes riskPenalty.")
  assert(!explanationText.includes("JSON"), "Closeout explanation exposes serialized debug data.")

  const afterRaw = fs.readFileSync(savePath, "utf8")
  const afterHash = crypto.createHash("sha256").update(afterRaw).digest("hex")
  const afterRecord = parseJson(afterRaw, "Runtime save after M7 closeout smoke is not valid JSON.")

  assert(afterRecord.tick === record.tick, "M7 closeout smoke changed runtime tick.")
  assert(afterHash === beforeHash, "M7 closeout smoke changed runtime save hash.")

  console.log("M7 CLOSEOUT SMOKE")
  console.log(`Runtime tick: ${record.tick}`)
  console.log(`Intent: ${intent.kind}`)
  console.log(`Motivation: ${intent.motivation}`)
  console.log(`Validation: ${validation.ok ? "passed" : "blocked"}`)
  console.log(`HomeMap write: ${summary.homeMapWriteStatus}`)
  console.log(`Trace write: ${summary.traceWriteStatus}`)
  console.log(`Trace: ${summary.traceId ?? "none"}`)
  console.log(`Memory seeds: ${summary.memorySeedCount}`)
  console.log("Runtime intent / validation / audit summary: ok")
  console.log("Trace closure pointer: ok")
  console.log("Audit-summary-first explanation: ok")
  console.log("No default pet fact: ok")
  console.log("Formal /world renderer guard: ok")
  console.log("Read-only closeout: ok")
  console.log("Result: PASS")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
