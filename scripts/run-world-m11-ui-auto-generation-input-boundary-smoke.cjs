async function main() {
  const crypto = await import("node:crypto")
  const fs = await import("node:fs")
  const moduleApi = await import("node:module")
  const path = await import("node:path")
  const ts = await import("typescript")

  const repoRoot = process.cwd()
  const localRequire = moduleApi.createRequire(__filename)
  const savePath = path.join(repoRoot, ".runtime", "world-state", "default-world.json")
  const worldPagePath = path.join(repoRoot, "src", "app", "world", "world-live-runtime-page.tsx")
  const pixelViewPath = path.join(repoRoot, "src", "app", "world", "components", "pixel-world-view", "pixel-world-view.tsx")
  const viewModelGatewayPath = path.join(repoRoot, "src", "world", "world-view-model", "world-view-model-gateway.ts")

  function fail(message) {
    console.log("M11 UI AUTO GENERATION INPUT BOUNDARY SMOKE")
    console.log(message)
    console.log("Result: FAIL")
    process.exit(1)
  }

  function assert(condition, message) {
    if (!condition) fail(message)
  }

  function hashText(raw) {
    return crypto.createHash("sha256").update(raw).digest("hex")
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

  function assertStaticUiBoundaryContract() {
    const worldPageSource = fs.readFileSync(worldPagePath, "utf8")
    const pixelViewSource = fs.readFileSync(pixelViewPath, "utf8")
    const viewModelSource = fs.readFileSync(viewModelGatewayPath, "utf8")
    const formalUiSource = `${worldPageSource}\n${pixelViewSource}`

    const requiredWorldPageTokens = [
      "readWorldRuntimeForView",
      "buildWorldViewModelForPixelWorld",
      "<PixelWorldView model={worldViewModel} />",
    ]

    requiredWorldPageTokens.forEach((token) =>
      assert(worldPageSource.includes(token), `Formal /world page is missing required UI boundary token: ${token}.`)
    )

    const requiredModelTags = [
      "ui_auto_generation_input_boundary",
      "formal_ui_reads_world_view_model_only",
      "ui_does_not_generate_world_facts",
      "runtime_read_only_projection",
      "no_world_fact_generation",
      "no_scene_composer_gateway_in_world_view_model",
    ]

    requiredModelTags.forEach((token) =>
      assert(viewModelSource.includes(token), `WorldViewModel is missing required UI boundary tag: ${token}.`)
    )

    assert(pixelViewSource.includes("data-surface-state=\"cleared\""), "PixelWorldView is no longer a cleared formal surface.")
    assert(pixelViewSource.includes("input: { model: WorldViewModel }"), "PixelWorldView no longer receives only WorldViewModel input.")

    const forbiddenFormalUiTokens = [
      "writeWorldRuntimeSaveRecord",
      "runAndPersistOneRuntimeTick",
      "runTraceLifecycleTick",
      "createRuntimeWorldFromCreateWorldInput",
      "buildSceneSvg",
      "scene-composer-gateway",
      "WorldPainterReadonlyPreview",
      "FormalWorldView",
      "ProceduralRendererView",
      "HomeMapState",
      "TraceField",
      "AuditSummary",
      "SafeApply",
      "JSON.stringify",
      "P-Phone",
      "当前记录",
      "管家说明",
      "pet_default",
      "createPet",
    ]
    const forbiddenFormalUiHits = forbiddenFormalUiTokens.filter((token) =>
      formalUiSource.includes(token)
    )

    assert(
      forbiddenFormalUiHits.length === 0,
      `Formal UI source violates input boundary: ${forbiddenFormalUiHits.join(", ")}`
    )
  }

  function assertModelBoundary(model) {
    const requiredTags = [
      "ui_auto_generation_input_boundary",
      "formal_ui_reads_world_view_model_only",
      "ui_does_not_generate_world_facts",
      "runtime_read_only_projection",
      "no_world_fact_generation",
      "no_scene_composer_gateway_in_world_view_model",
    ]

    requiredTags.forEach((tag) =>
      assert(model.tags.includes(tag), `WorldViewModel output is missing UI boundary tag: ${tag}.`)
    )

    assert(model.canvas.width > 0, "WorldViewModel canvas width is invalid.")
    assert(model.canvas.height > 0, "WorldViewModel canvas height is invalid.")
    assert(model.tiles.length === model.canvas.columns * model.canvas.rows, "WorldViewModel tiles do not match canvas grid.")
    assert(model.objects.every((object) => object.source === "world_fact" || object.source === "derived_visual_only"), "WorldViewModel objects contain invalid source values.")
    assert(model.objects.every((object) => object.source !== "derived_visual_only" || object.tags.includes("no_runtime_write")), "Derived visual-only objects are missing no_runtime_write tag.")
    assert(model.actors.some((actor) => actor.kind === "butler" && actor.visible), "WorldViewModel has no visible butler actor for future UI input.")
    assert(!model.actors.some((actor) => actor.kind === "pet" && actor.visible), "WorldViewModel exposes a default visible pet actor to future UI input.")
    assert(model.pPhone.latestMessageTitle.length > 0, "WorldViewModel pPhone title is empty.")
    assert(model.butlerExplanation.title.length > 0, "WorldViewModel butler explanation title is empty.")
  }

  if (!fs.existsSync(savePath)) fail("Runtime save file not found.")
  if (!fs.existsSync(worldPagePath)) fail("World live runtime page is missing.")
  if (!fs.existsSync(pixelViewPath)) fail("PixelWorldView is missing.")
  if (!fs.existsSync(viewModelGatewayPath)) fail("WorldViewModel gateway is missing.")

  assertStaticUiBoundaryContract()
  installTypeScriptRequireHook()

  const beforeRaw = fs.readFileSync(savePath, "utf8")
  const beforeHash = hashText(beforeRaw)
  const record = parseJson(beforeRaw, "Runtime save is not valid JSON.")
  const beforeTick = record.tick
  const beforePlacementCount = record.homeMapState.placements.length

  const { buildWorldViewModelForPixelWorld } = localRequire(viewModelGatewayPath)
  const model = buildWorldViewModelForPixelWorld({
    saveRecord: record,
    isPersisted: true,
  })

  assertModelBoundary(model)

  const afterRaw = fs.readFileSync(savePath, "utf8")
  const afterHash = hashText(afterRaw)
  const afterRecord = parseJson(afterRaw, "Runtime save after UI auto generation input boundary smoke is not valid JSON.")

  assert(afterRecord.tick === beforeTick, "UI input boundary smoke changed runtime tick.")
  assert(afterRecord.homeMapState.placements.length === beforePlacementCount, "UI input boundary smoke changed HomeMapState placements.")
  assert(afterHash === beforeHash, "UI input boundary smoke changed runtime save hash.")

  console.log("M11 UI AUTO GENERATION INPUT BOUNDARY SMOKE")
  console.log(`Runtime tick: ${record.tick}`)
  console.log(`Canvas: ${model.canvas.width}x${model.canvas.height}`)
  console.log(`Tiles: ${model.tiles.length}`)
  console.log(`Objects: ${model.objects.length}`)
  console.log(`Actors: ${model.actors.length}`)
  console.log("Formal UI reads WorldViewModel only: ok")
  console.log("Formal /world remains cleared: ok")
  console.log("No debug/card/runtime write source in formal UI: ok")
  console.log("UI input projection read-only: ok")
  console.log("Result: PASS")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
