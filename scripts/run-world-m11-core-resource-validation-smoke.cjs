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
  const viewModelDir = path.join(repoRoot, "src", "world", "world-view-model")
  const viewModelGatewayPath = path.join(viewModelDir, "world-view-model-gateway.ts")
  const viewModelSchemaPath = path.join(viewModelDir, "world-view-model-schema.ts")
  const runtimeSchemaPath = path.join(repoRoot, "src", "world", "runtime", "world-runtime-schema.ts")
  const homeMapSchemaPath = path.join(repoRoot, "src", "world", "map-state", "home-map-state-schema.ts")

  function fail(message) {
    console.log("M11 CORE RESOURCE VALIDATION SMOKE")
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

  function readDirectorySources(directory) {
    return fs
      .readdirSync(directory)
      .filter((fileName) => fileName.endsWith(".ts"))
      .map((fileName) => fs.readFileSync(path.join(directory, fileName), "utf8"))
      .join("\n")
  }

  function assertStaticValidationLibraryContract() {
    const worldPageSource = fs.readFileSync(worldPagePath, "utf8")
    const pixelViewSource = fs.readFileSync(pixelViewPath, "utf8")
    const viewModelSchemaSource = fs.readFileSync(viewModelSchemaPath, "utf8")
    const viewModelSources = readDirectorySources(viewModelDir)
    const runtimeSchemaSource = fs.readFileSync(runtimeSchemaPath, "utf8")
    const homeMapSchemaSource = fs.readFileSync(homeMapSchemaPath, "utf8")
    const formalSources = [worldPageSource, pixelViewSource, viewModelSources].join("\n")

    const requiredTokens = [
      "WorldRuntimeSaveRecord",
      "HomeMapState",
      "TraceField",
      "TraceMemorySeedField",
      "TraceInfluenceSummary",
      "WorldViewModel",
      "WorldViewObjectSource",
      "world_fact",
      "derived_visual_only",
      "not_world_fact",
      "no_runtime_write",
      "runtime_read_only_projection",
      "no_world_fact_generation",
      "no_default_pet_actor",
      "pet_actor_requires_existing_fact",
      "readWorldRuntimeForView",
      "buildWorldViewModelForPixelWorld",
      "data-surface-state=\"cleared\"",
    ]

    const combinedValidationSources = [
      runtimeSchemaSource,
      homeMapSchemaSource,
      viewModelSchemaSource,
      viewModelSources,
      worldPageSource,
      pixelViewSource,
    ].join("\n")

    requiredTokens.forEach((token) =>
      assert(combinedValidationSources.includes(token), `Core validation library is missing required token: ${token}.`)
    )

    const forbiddenFormalTokens = [
      "buildSceneSvg",
      "data:image/svg+xml",
      "WorldPainterReadonlyPreview",
      "FormalWorldView",
      "ProceduralRendererView",
      "scene-composer-gateway",
      "composeScene",
      "buildDefaultSceneComposerFact",
      "adaptHomeMapStateToSceneComposerFact",
      "roadGraph",
      "pathGraph",
      "pet_default",
      "createPet",
    ]

    const forbiddenHits = forbiddenFormalTokens.filter((token) => formalSources.includes(token))
    assert(forbiddenHits.length === 0, `Formal validation path contains forbidden token: ${forbiddenHits.join(", ")}`)
    assert(!pixelViewSource.includes("P-Phone"), "M11 core validation found old P-Phone card copy in formal /world surface.")
    assert(!pixelViewSource.includes("管家说明"), "M11 core validation found old butler explanation card copy in formal /world surface.")
    assert(!pixelViewSource.includes("当前记录"), "M11 core validation found old current record card copy in formal /world surface.")
  }

  function assertRuntimeRecord(record) {
    assert(record.version === "v2.6-runtime-00", "Runtime save version is not v2.6-runtime-00.")
    assert(typeof record.worldId === "string" && record.worldId.length > 0, "Runtime save has no worldId.")
    assert(typeof record.ownerId === "string" && record.ownerId.length > 0, "Runtime save has no ownerId.")
    assert(Number.isInteger(record.tick) && record.tick >= 0, "Runtime tick is invalid.")
    assert(record.homeMapState, "Runtime save has no HomeMapState.")
    assert(record.traceField, "Runtime save has no TraceField.")
    assert(record.traceMemorySeedField, "Runtime save has no TraceMemorySeedField.")
    assert(record.traceInfluenceSummary, "Runtime save has no TraceInfluenceSummary.")
    assert(Array.isArray(record.recentEvents), "Runtime recentEvents is not an array.")
    assert(Array.isArray(record.tags), "Runtime tags is not an array.")
  }

  function assertHomeMapState(record) {
    const homeMapState = record.homeMapState
    const mapSize = homeMapState.mapSize

    assert(homeMapState.worldId === record.worldId, "HomeMapState worldId does not match runtime worldId.")
    assert(homeMapState.ownerId === record.ownerId, "HomeMapState ownerId does not match runtime ownerId.")
    assert(Number.isInteger(mapSize.columns) && mapSize.columns > 0, "HomeMapState columns is invalid.")
    assert(Number.isInteger(mapSize.rows) && mapSize.rows > 0, "HomeMapState rows is invalid.")
    assert(Number.isInteger(mapSize.tileSize) && mapSize.tileSize > 0, "HomeMapState tileSize is invalid.")
    assert(Array.isArray(homeMapState.placements), "HomeMapState placements is not an array.")
    assert(Array.isArray(homeMapState.zones), "HomeMapState zones is not an array.")
    assert(Array.isArray(homeMapState.constructionPlans), "HomeMapState constructionPlans is not an array.")
    assert(Array.isArray(homeMapState.mapDiffs), "HomeMapState mapDiffs is not an array.")

    const petPlacements = homeMapState.placements.filter(
      (placement) =>
        placement.layer === "actor" &&
        (placement.tags.includes("pet") ||
          placement.id.toLowerCase().includes("pet") ||
          placement.label.toLowerCase().includes("pet") ||
          placement.label.includes("宠物"))
    )

    assert(petPlacements.length === 0, "Core validation found a default pet placement in HomeMapState.")
  }

  function assertWorldViewModel(record, model) {
    const expectedTileCount = record.homeMapState.mapSize.columns * record.homeMapState.mapSize.rows
    const expectedWidth = record.homeMapState.mapSize.columns * record.homeMapState.mapSize.tileSize
    const expectedHeight = record.homeMapState.mapSize.rows * record.homeMapState.mapSize.tileSize
    const factObjects = model.objects.filter((object) => object.source === "world_fact")
    const derivedObjects = model.objects.filter((object) => object.source === "derived_visual_only")
    const visiblePetActors = model.actors.filter((actor) => actor.kind === "pet" && actor.visible)

    assert(model.worldId === record.worldId, "WorldViewModel worldId does not match runtime record.")
    assert(model.ownerId === record.ownerId, "WorldViewModel ownerId does not match runtime record.")
    assert(model.tick === record.tick, "WorldViewModel tick does not match runtime record.")
    assert(model.canvas.width === expectedWidth, "WorldViewModel canvas width is not mapped from HomeMapState / SpaceGrid.")
    assert(model.canvas.height === expectedHeight, "WorldViewModel canvas height is not mapped from HomeMapState / SpaceGrid.")
    assert(model.canvas.columns === record.homeMapState.mapSize.columns, "WorldViewModel columns do not match HomeMapState.")
    assert(model.canvas.rows === record.homeMapState.mapSize.rows, "WorldViewModel rows do not match HomeMapState.")
    assert(model.canvas.tileSize === record.homeMapState.mapSize.tileSize, "WorldViewModel tileSize does not match HomeMapState.")
    assert(model.tiles.length === expectedTileCount, "WorldViewModel tile count does not match SpaceGrid size.")
    assert(model.objects.length > 0, "WorldViewModel has no objects.")
    assert(factObjects.length > 0, "WorldViewModel has no world_fact objects.")
    assert(derivedObjects.length > 0, "WorldViewModel has no derived_visual_only objects.")
    assert(
      derivedObjects.every((object) => object.tags.includes("not_world_fact") && object.tags.includes("no_runtime_write")),
      "derived_visual_only objects are not marked as not_world_fact / no_runtime_write."
    )
    assert(model.traces.length === record.traceField.traces.length, "WorldViewModel trace projection count does not match TraceField.")
    assert(model.actors.some((actor) => actor.kind === "butler" && actor.visible), "WorldViewModel has no visible butler actor.")
    assert(visiblePetActors.length === 0, "WorldViewModel generated a default visible pet actor.")
    assert(model.tags.includes("runtime_read_only_projection"), "WorldViewModel is missing runtime_read_only_projection tag.")
    assert(model.tags.includes("no_world_fact_generation"), "WorldViewModel is missing no_world_fact_generation tag.")
    assert(model.tags.includes("no_default_pet_actor"), "WorldViewModel is missing no_default_pet_actor tag.")
  }

  if (!fs.existsSync(savePath)) fail("Runtime save file not found.")
  if (!fs.existsSync(worldPagePath)) fail("World page is missing.")
  if (!fs.existsSync(pixelViewPath)) fail("PixelWorldView is missing.")
  if (!fs.existsSync(viewModelGatewayPath)) fail("WorldViewModel gateway is missing.")
  if (!fs.existsSync(viewModelSchemaPath)) fail("WorldViewModel schema is missing.")
  if (!fs.existsSync(runtimeSchemaPath)) fail("Runtime schema is missing.")
  if (!fs.existsSync(homeMapSchemaPath)) fail("HomeMapState schema is missing.")

  assertStaticValidationLibraryContract()
  installTypeScriptRequireHook()

  const beforeRaw = fs.readFileSync(savePath, "utf8")
  const beforeHash = hashText(beforeRaw)
  const record = parseJson(beforeRaw, "Runtime save is not valid JSON.")
  const beforeTick = record.tick
  const beforePlacementCount = record.homeMapState.placements.length

  assertRuntimeRecord(record)
  assertHomeMapState(record)

  const { buildWorldViewModelForPixelWorld } = localRequire(viewModelGatewayPath)
  const model = buildWorldViewModelForPixelWorld({ saveRecord: record, isPersisted: true })

  assertWorldViewModel(record, model)

  const afterRaw = fs.readFileSync(savePath, "utf8")
  const afterHash = hashText(afterRaw)
  const afterRecord = parseJson(afterRaw, "Runtime save after core validation smoke is not valid JSON.")

  assert(afterRecord.tick === beforeTick, "Core resource validation changed runtime tick.")
  assert(afterRecord.homeMapState.placements.length === beforePlacementCount, "Core resource validation changed HomeMapState placements.")
  assert(afterHash === beforeHash, "Core resource validation changed runtime save hash.")

  console.log("M11 CORE RESOURCE VALIDATION SMOKE")
  console.log(`Runtime tick: ${record.tick}`)
  console.log(`World: ${record.worldId}`)
  console.log(`Canvas: ${model.canvas.width}x${model.canvas.height}`)
  console.log(`Tiles: ${model.tiles.length}`)
  console.log(`World fact objects: ${model.objects.filter((object) => object.source === "world_fact").length}`)
  console.log(`Derived visual-only objects: ${model.objects.filter((object) => object.source === "derived_visual_only").length}`)
  console.log(`Traces: ${model.traces.length}`)
  console.log(`Actors: ${model.actors.length}`)
  console.log("Runtime save read-only: ok")
  console.log("HomeMapState fact source: ok")
  console.log("TraceField projection: ok")
  console.log("WorldViewModel validation: ok")
  console.log("No default pet fact: ok")
  console.log("Debug renderer isolation: ok")
  console.log("Result: PASS")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
