async function main() {
  const crypto = await import("node:crypto")
  const fs = await import("node:fs")
  const moduleApi = await import("node:module")
  const path = await import("node:path")
  const ts = await import("typescript")

  const repoRoot = process.cwd()
  const localRequire = moduleApi.createRequire(__filename)
  const packagePath = path.join(repoRoot, "package.json")
  const savePath = path.join(repoRoot, ".runtime", "world-state", "default-world.json")
  const moduleProgressPath = path.join(repoRoot, "docs", "v2_6", "AI_PET_WORLD_V2_6_MODULE_PROGRESS.md")
  const handoffPath = path.join(repoRoot, "docs", "v2_6", "AI_PET_WORLD_V2_6_HANDOFF_M11_MVP_CLOSEOUT.md")
  const businessPrinciplesPath = path.join(repoRoot, "docs", "v2_6", "AI_PET_WORLD_V2_6_CURRENT_BUSINESS_PRINCIPLES.md")
  const worldPagePath = path.join(repoRoot, "src", "app", "world", "world-live-runtime-page.tsx")
  const pixelViewPath = path.join(
    repoRoot,
    "src",
    "app",
    "world",
    "components",
    "pixel-worldview-readonly-entry",
    "pixel-worldview-readonly-entry.tsx"
  )
  const viewModelGatewayPath = path.join(repoRoot, "src", "world", "world-view-model", "world-view-model-gateway.ts")
  const actorMapperPath = path.join(repoRoot, "src", "world", "world-view-model", "world-actor-mapper.ts")
  const pPhoneMapperPath = path.join(repoRoot, "src", "world", "world-view-model", "p-phone-view-mapper.ts")

  function fail(message) {
    console.log("M11 CORE RESOURCE CLOSEOUT SMOKE")
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

  function readRequiredFile(filePath, label) {
    if (!fs.existsSync(filePath)) fail(`${label} is missing.`)
    return fs.readFileSync(filePath, "utf8")
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

  function assertPackageScripts() {
    const packageJson = parseJson(readRequiredFile(packagePath, "package.json"), "package.json is not valid JSON.")
    const scripts = packageJson.scripts ?? {}
    const requiredScripts = [
      "smoke:m11-formal-surface",
      "smoke:m11-core-resource-validation",
      "smoke:m11-create-world-flow",
      "smoke:m11-actor-input-boundary",
      "smoke:m11-p-phone-input-boundary",
      "smoke:m11-ui-auto-generation-input-boundary",
      "smoke:m11-core-resource-closeout",
      "smoke:m7-closeout",
      "smoke:m7-explanation",
      "smoke:m7-audit-summary",
      "smoke:butler-trace-closure",
      "smoke:world-pixel-viewmodel-primary",
    ]

    requiredScripts.forEach((scriptName) =>
      assert(typeof scripts[scriptName] === "string", `package.json is missing required smoke script: ${scriptName}.`)
    )
  }

  function assertDocsCloseoutState() {
    const moduleProgress = readRequiredFile(moduleProgressPath, "MODULE_PROGRESS.md")
    const handoff = readRequiredFile(handoffPath, "HANDOFF_M11_MVP_CLOSEOUT.md")
    const principles = readRequiredFile(businessPrinciplesPath, "CURRENT_BUSINESS_PRINCIPLES.md")
    const docs = `${moduleProgress}\n${handoff}\n${principles}`

    const requiredTokens = [
      "M11 Actor 表现输入边界验算 | 100% | 完成",
      "M11 P-Phone 数据入口边界验算 | 100% | 完成",
      "M11 UI 自动生成输入边界验算 | 100% | 完成",
      "M11 核心资源库 / 验算库 closeout | 100% | 完成",
      "M11 正式画图算法重整 | 进行中 | 进行中",
      "核心资源库 / 验算库 closeout 已完成",
      "正式画图算法重整",
      "AI 世界",
      "AI 管家",
      "P-Phone 通信入口",
      "宠物不是默认资产",
      "未来 `/world` 是端游式像素主世界",
    ]

    requiredTokens.forEach((token) =>
      assert(docs.includes(token), `M11 docs are missing required closeout token: ${token}.`)
    )

    const forbiddenDocPhrases = [
      "M11 核心资源库 / 验算库 | 94% | 进行中",
      "UI 自动生成输入边界验算\n→ 核心资源库 / 验算库 closeout",
      "P-Phone 数据入口边界验算\n→ UI 自动生成输入边界验算",
      "create-world smoke npm 注册",
      "node scripts/run-world-m11-create-world-flow-smoke.cjs",
    ]
    const forbiddenHits = forbiddenDocPhrases.filter((phrase) => docs.includes(phrase))

    assert(forbiddenHits.length === 0, `M11 docs still contain stale closeout phrases: ${forbiddenHits.join(", ")}`)
  }

  function assertStaticSourceBoundary() {
    const worldPageSource = readRequiredFile(worldPagePath, "world-live-runtime-page.tsx")
    const pixelViewSource = readRequiredFile(pixelViewPath, "pixel-worldview-readonly-entry.tsx")
    const viewModelSource = readRequiredFile(viewModelGatewayPath, "world-view-model-gateway.ts")
    const actorMapperSource = readRequiredFile(actorMapperPath, "world-actor-mapper.ts")
    const pPhoneSource = readRequiredFile(pPhoneMapperPath, "p-phone-view-mapper.ts")
    const formalUiSource = `${worldPageSource}\n${pixelViewSource}`

    assert(worldPageSource.includes("readWorldRuntimeForView"), "Formal /world page no longer reads runtime through readWorldRuntimeForView.")
    assert(worldPageSource.includes("buildWorldViewModelForPixelWorld"), "Formal /world page no longer builds WorldViewModel.")
    assert(worldPageSource.includes("<PixelWorldViewReadonlyEntry worldViewModel={worldViewModel} />"), "Formal /world page no longer passes WorldViewModel into the readonly PixelWorldView entry.")
    assert(pixelViewSource.includes("<FormalPixiPixelWorldRendererClient buffer={bufferResult.buffer} />"), "PixelWorldView no longer mounts the formal PixiJS renderer.")
    assert(viewModelSource.includes("ui_auto_generation_input_boundary"), "WorldViewModel is missing UI auto-generation boundary tag.")
    assert(viewModelSource.includes("formal_ui_reads_world_view_model_only"), "WorldViewModel is missing formal UI read boundary tag.")
    assert(actorMapperSource.includes("FORMAL_PET_ENTRY_TAGS"), "Actor mapper is missing formal pet entry boundary.")
    assert(pPhoneSource.includes("正式写入边界"), "P-Phone mapper is missing user-facing write boundary copy.")

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
      "当前记录",
      "管家说明",
      "pet_default",
      "createPet",
    ]
    const forbiddenFormalUiHits = forbiddenFormalUiTokens.filter((token) => formalUiSource.includes(token))

    assert(
      forbiddenFormalUiHits.length === 0,
      `Formal UI violates closeout boundary: ${forbiddenFormalUiHits.join(", ")}`
    )
  }

  function assertRuntimeAndModelBoundary(record, model) {
    const visibleButlers = model.actors.filter((actor) => actor.kind === "butler" && actor.visible)
    const visiblePets = model.actors.filter((actor) => actor.kind === "pet" && actor.visible)
    const worldFactObjects = model.objects.filter((object) => object.source === "world_fact")
    const derivedObjects = model.objects.filter((object) => object.source === "derived_visual_only")

    const requiredTags = [
      "world_view_model",
      "pixel_world_primary",
      "world_pixel_rule_mapper_00",
      "ui_auto_generation_input_boundary",
      "formal_ui_reads_world_view_model_only",
      "ui_does_not_generate_world_facts",
      "runtime_read_only_projection",
      "no_world_fact_generation",
      "no_scene_composer_gateway_in_world_view_model",
      "no_default_pet_actor",
    ]

    requiredTags.forEach((tag) =>
      assert(model.tags.includes(tag), `WorldViewModel is missing closeout tag: ${tag}.`)
    )

    assert(model.tick === record.tick, "WorldViewModel tick does not match runtime save tick.")
    assert(model.canvas.width === record.homeMapState.mapSize.columns * record.homeMapState.mapSize.tileSize, "WorldViewModel canvas width does not match HomeMapState.")
    assert(model.canvas.height === record.homeMapState.mapSize.rows * record.homeMapState.mapSize.tileSize, "WorldViewModel canvas height does not match HomeMapState.")
    assert(model.tiles.length === model.canvas.columns * model.canvas.rows, "WorldViewModel tile count does not match canvas grid.")
    assert(worldFactObjects.length > 0, "WorldViewModel has no world fact objects.")
    assert(derivedObjects.length > 0, "WorldViewModel has no derived visual-only objects.")
    assert(derivedObjects.every((object) => object.tags.includes("no_runtime_write")), "Derived visual-only objects are missing no_runtime_write tags.")
    assert(visibleButlers.length === 1, `Expected exactly one visible butler actor, got ${visibleButlers.length}.`)
    assert(visiblePets.length === 0, `Expected zero visible pet actors, got ${visiblePets.length}.`)
    assert(model.pPhone.latestMessageTitle.length > 0, "WorldViewModel P-Phone title is empty.")
    assert(model.butlerExplanation.title.length > 0, "WorldViewModel butler explanation title is empty.")
  }

  assertPackageScripts()
  assertDocsCloseoutState()
  assertStaticSourceBoundary()
  installTypeScriptRequireHook()

  const beforeRaw = readRequiredFile(savePath, "Runtime save file")
  const beforeHash = hashText(beforeRaw)
  const record = parseJson(beforeRaw, "Runtime save is not valid JSON.")
  const beforeTick = record.tick
  const beforePlacementCount = record.homeMapState.placements.length

  const { buildWorldViewModelForPixelWorld } = localRequire(viewModelGatewayPath)
  const model = buildWorldViewModelForPixelWorld({
    saveRecord: record,
    isPersisted: true,
  })

  assertRuntimeAndModelBoundary(record, model)

  const afterRaw = readRequiredFile(savePath, "Runtime save file after closeout smoke")
  const afterHash = hashText(afterRaw)
  const afterRecord = parseJson(afterRaw, "Runtime save after closeout smoke is not valid JSON.")

  assert(afterRecord.tick === beforeTick, "Closeout smoke changed runtime tick.")
  assert(afterRecord.homeMapState.placements.length === beforePlacementCount, "Closeout smoke changed HomeMapState placements.")
  assert(afterHash === beforeHash, "Closeout smoke changed runtime save hash.")

  console.log("M11 CORE RESOURCE CLOSEOUT SMOKE")
  console.log(`Runtime tick: ${record.tick}`)
  console.log(`Canvas: ${model.canvas.width}x${model.canvas.height}`)
  console.log(`Tiles: ${model.tiles.length}`)
  console.log(`Objects: ${model.objects.length}`)
  console.log(`Actors: ${model.actors.length}`)
  console.log("Package smoke registration: ok")
  console.log("M11 docs closeout state: ok")
  console.log("WorldViewModel closeout boundary: ok")
  console.log("Formal UI closeout boundary: ok")
  console.log("No default pet actor: ok")
  console.log("Closeout projection read-only: ok")
  console.log("Result: PASS")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
