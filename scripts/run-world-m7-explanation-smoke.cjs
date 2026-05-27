async function main() {
  const crypto = await import("node:crypto")
  const fs = await import("node:fs")
  const moduleApi = await import("node:module")
  const path = await import("node:path")
  const ts = await import("typescript")
  const repoRoot = process.cwd()
  const localRequire = moduleApi.createRequire(__filename)
  const savePath = path.join(repoRoot, ".runtime", "world-state", "default-world.json")
  const viewModelGatewayPath = path.join(repoRoot, "src", "world", "world-view-model", "world-view-model-gateway.ts")
  const butlerExplanationPath = path.join(repoRoot, "src", "world", "world-view-model", "butler-explanation-mapper.ts")
  const pPhoneMapperPath = path.join(repoRoot, "src", "world", "world-view-model", "p-phone-view-mapper.ts")
  const pixelViewPath = path.join(repoRoot, "src", "app", "world", "components", "pixel-world-view", "pixel-world-view.tsx")

  function fail(message) {
    console.log("M7 EXPLANATION SMOKE")
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

  function assertStaticExplanationContract() {
    const gatewaySource = fs.readFileSync(viewModelGatewayPath, "utf8")
    const explanationSource = fs.readFileSync(butlerExplanationPath, "utf8")
    const pPhoneSource = fs.readFileSync(pPhoneMapperPath, "utf8")
    const pixelViewSource = fs.readFileSync(pixelViewPath, "utf8")
    const combinedSource = [gatewaySource, explanationSource, pPhoneSource, pixelViewSource].join("\n")

    const requiredTokens = [
      "buildButlerExplanationView",
      "lastButlerRuntimeIntent",
      "lastButlerWorldRuleValidation",
      "traceMemorySeedField",
      "m7_butler_trace_closure",
      "not_pet_trace",
      "HomeMapState",
      "P-Phone",
      "model.butlerExplanation.title",
      "model.pPhone.latestMessageTitle",
    ]

    requiredTokens.forEach((token) =>
      assert(combinedSource.includes(token), `M7 explanation path is missing required token: ${token}.`)
    )

    const forbiddenTokens = [
      "JSON.stringify",
      "finalScore",
      "riskPenalty",
      "rawScore",
      "debugScore",
      "runAndPersistOneRuntimeTick",
      "writeWorldRuntimeSaveRecord",
      "runTraceLifecycleTick",
      "buildSceneSvg",
      "scene-composer-gateway",
      "pet_default",
      "createPet",
    ]
    const forbiddenHits = forbiddenTokens.filter((token) => combinedSource.includes(token))

    assert(
      forbiddenHits.length === 0,
      `M7 explanation path exposes forbidden/debug/write tokens: ${forbiddenHits.join(", ")}`
    )
  }

  function assertM7RuntimeFacts(record) {
    assert(record.lastButlerRuntimeDecision, "Runtime record is missing lastButlerRuntimeDecision.")
    assert(record.lastButlerRuntimeIntent, "Runtime record is missing lastButlerRuntimeIntent.")
    assert(record.lastButlerWorldRuleValidation, "Runtime record is missing lastButlerWorldRuleValidation.")
    assert(record.traceField, "Runtime record is missing TraceField.")
    assert(record.traceMemorySeedField, "Runtime record is missing TraceMemorySeedField.")
    assert(
      record.recentEvents.some((event) => event.tags.includes("m7_butler_trace_closure")),
      "Runtime record has no M7 trace closure event."
    )
  }

  function findCurrentButlerTrace(record) {
    const intent = record.lastButlerRuntimeIntent
    const validation = record.lastButlerWorldRuleValidation

    return record.traceField.traces.find(
      (trace) =>
        trace.sourceKind === "butler_behavior" &&
        trace.updatedAtTick === record.tick &&
        trace.tags.includes("m7_butler_trace_closure") &&
        trace.tags.includes("not_pet_trace") &&
        trace.derivedFrom.includes(intent.id) &&
        trace.derivedFrom.includes(validation.id)
    )
  }

  if (!fs.existsSync(savePath)) fail("Runtime save file not found.")
  if (!fs.existsSync(viewModelGatewayPath)) fail("WorldViewModel gateway is missing.")
  if (!fs.existsSync(butlerExplanationPath)) fail("Butler explanation mapper is missing.")
  if (!fs.existsSync(pPhoneMapperPath)) fail("P-Phone mapper is missing.")
  if (!fs.existsSync(pixelViewPath)) fail("PixelWorldView is missing.")

  installTypeScriptRequireHook()
  assertStaticExplanationContract()

  const beforeRaw = fs.readFileSync(savePath, "utf8")
  const beforeHash = crypto.createHash("sha256").update(beforeRaw).digest("hex")
  const record = parseJson(beforeRaw, "Runtime save file is not valid JSON.")
  assertM7RuntimeFacts(record)

  const currentButlerTrace = findCurrentButlerTrace(record)
  assert(currentButlerTrace, "No current M7 butler behavior trace is available for explanation.")

  const { buildWorldViewModelForPixelWorld } = localRequire(viewModelGatewayPath)
  const model = buildWorldViewModelForPixelWorld({ saveRecord: record, isPersisted: true })

  const combinedText = [
    model.butlerExplanation.title,
    model.butlerExplanation.body,
    model.pPhone.latestMessageTitle,
    model.pPhone.latestMessageBody,
  ].join("\n")

  assert(model.tags.includes("m7_butler_trace_closure_explanation"), "WorldViewModel is missing M7 explanation tag.")
  assert(combinedText.includes("管家"), "M7 explanation does not mention butler naturally.")
  assert(combinedText.includes("痕迹"), "M7 explanation does not mention traces naturally.")
  assert(
    combinedText.includes("HomeMapState") || combinedText.includes("家园事实") || combinedText.includes("家园结构"),
    "M7 explanation does not explain HomeMapState / world fact boundary."
  )
  assert(
    combinedText.includes("记忆种子") || combinedText.includes("记忆"),
    "M7 explanation does not explain memory seed continuity."
  )
  assert(
    model.pPhone.latestMessageBody.includes("世界规则验证") || model.pPhone.latestMessageBody.includes("SafeApply"),
    "P-Phone does not explain validation / SafeApply boundary."
  )
  assert(!combinedText.includes("finalScore"), "M7 explanation exposes finalScore.")
  assert(!combinedText.includes("riskPenalty"), "M7 explanation exposes riskPenalty.")
  assert(!combinedText.includes("JSON"), "M7 explanation exposes serialized debug data.")

  const afterRaw = fs.readFileSync(savePath, "utf8")
  const afterHash = crypto.createHash("sha256").update(afterRaw).digest("hex")
  const afterRecord = parseJson(afterRaw, "Runtime save after M7 explanation smoke is not valid JSON.")

  assert(afterRecord.tick === record.tick, "M7 explanation smoke changed runtime tick.")
  assert(afterHash === beforeHash, "M7 explanation smoke changed runtime save hash.")

  console.log("M7 EXPLANATION SMOKE")
  console.log(`Runtime tick: ${record.tick}`)
  console.log(`Intent: ${record.lastButlerRuntimeIntent.kind}`)
  console.log(`Motivation: ${record.lastButlerRuntimeIntent.motivation}`)
  console.log(`Trace: ${currentButlerTrace.id}`)
  console.log(`Butler title: ${model.butlerExplanation.title}`)
  console.log(`P-Phone title: ${model.pPhone.latestMessageTitle}`)
  console.log("M7 explanation reads persisted intent / validation / trace / memory seed: ok")
  console.log("No raw debug score display: ok")
  console.log("Explanation read-only: ok")
  console.log("Result: PASS")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
