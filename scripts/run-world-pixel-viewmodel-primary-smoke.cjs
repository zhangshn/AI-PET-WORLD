async function main() {
  const crypto = await import("node:crypto")
  const fs = await import("node:fs")
  const moduleApi = await import("node:module")
  const path = await import("node:path")
  const ts = await import("typescript")
  const repoRoot = process.cwd()
  const localRequire = moduleApi.createRequire(__filename)
  const savePath = path.join(repoRoot, ".runtime", "world-state", "default-world.json")
  const pagePath = path.join(repoRoot, "src", "app", "world", "world-live-runtime-page.tsx")
  const viewModelGatewayPath = path.join(repoRoot, "src", "world", "world-view-model", "world-view-model-gateway.ts")
  const viewModelDir = path.join(repoRoot, "src", "world", "world-view-model")
  const viewModelSchemaPath = path.join(repoRoot, "src", "world", "world-view-model", "world-view-model-schema.ts")
  const pixelCanvasPath = path.join(repoRoot, "src", "app", "world", "components", "pixel-world-view", "pixel-world-canvas.client.tsx")

  function fail(message) {
    console.log("WORLD PIXEL VIEWMODEL PRIMARY SMOKE")
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

  if (!fs.existsSync(savePath)) fail("Runtime save file not found.")
  if (!fs.existsSync(viewModelGatewayPath)) fail("WorldViewModel gateway is missing.")
  if (!fs.existsSync(viewModelSchemaPath)) fail("WorldViewModel schema is missing.")
  if (!fs.existsSync(pixelCanvasPath)) fail("PixelWorld canvas component is missing.")

  const beforeRaw = fs.readFileSync(savePath, "utf8")
  const beforeHash = crypto.createHash("sha256").update(beforeRaw).digest("hex")
  const record = parseJson(beforeRaw, "Runtime save file is not valid JSON.")
  const placementCountBefore = record.homeMapState.placements.length
  const pageSource = fs.readFileSync(pagePath, "utf8")
  const schemaSource = fs.readFileSync(viewModelSchemaPath, "utf8")
  const canvasSource = fs.readFileSync(pixelCanvasPath, "utf8")
  const modelSources = fs
    .readdirSync(viewModelDir)
    .filter((fileName) => fileName.endsWith(".ts"))
    .map((fileName) => fs.readFileSync(path.join(viewModelDir, fileName), "utf8"))
    .join("\n")

  assert(pageSource.includes("readWorldRuntimeForView"), "/world no longer uses readWorldRuntimeForView.")
  assert(pageSource.includes("buildWorldViewModelForPixelWorld"), "/world does not build WorldViewModel.")
  assert(pageSource.includes("PixelWorldView"), "/world does not render PixelWorldView.")
  assert(canvasSource.includes("<canvas"), "PixelWorldView does not use canvas.")

  const forbiddenTokens = [
    "buildSceneSvg",
    "data:image/svg+xml",
    "WorldPainterReadonlyPreview",
    "FormalWorldView",
    "ProceduralRendererView",
    "scene-composer-gateway",
    "composeScene",
    "buildDefaultSceneComposerFact",
    "adaptHomeMapStateToSceneComposerFact",
    "world-painter-adapter",
    "scene_composer_rules_primary",
    "composer_scene_plan_to_world_view_model",
    "roadGraph",
    "pathGraph",
  ]

  forbiddenTokens.forEach((token) =>
    assert(
      !pageSource.includes(token) && !modelSources.includes(token) && !canvasSource.includes(token),
      `Formal WorldViewModel path still contains forbidden token: ${token}.`
    )
  )

  const requiredModelTokens = [
    "buildSpaceGridFromHomeMapState",
    "buildTraceFieldFromWorld",
    "buildWorldViewTilesFromSpaceGrid",
    "buildWorldViewObjectsFromHomeMapState",
    "mapTraceFieldToWorldViewTraces",
    "buildWorldViewActors",
    "buildWorldViewAtmosphere",
    "world_pixel_rule_mapper_00",
    "no_scene_composer_gateway_in_world_view_model",
    "no_world_fact_generation",
    "runtime_read_only_projection",
    "no_default_pet_actor",
    "pet_actor_requires_existing_fact",
  ]

  requiredModelTokens.forEach((token) =>
    assert(modelSources.includes(token), `WorldViewModel is missing required rule-mapper token: ${token}.`)
  )

  assert(schemaSource.includes("WorldViewObjectSource"), "WorldViewObject has no source provenance.")
  assert(modelSources.includes("derived_visual_only"), "WorldViewModel has no derived visual-only rule assets.")
  assert(modelSources.includes("not_world_fact"), "Derived visuals are not marked as non-facts.")
  assert(modelSources.includes("no_runtime_write"), "Derived visuals are not marked as read-only projection.")
  assert(canvasSource.includes("drawTileTraceSurface"), "Pixel canvas does not draw tile trace surfaces.")
  assert(canvasSource.includes("drawGroundTrace"), "Pixel canvas does not draw ground traces.")
  assert(canvasSource.includes("drawSurfaceTrace"), "Pixel canvas does not draw surface traces.")
  assert(canvasSource.includes("drawAttentionTrace"), "Pixel canvas does not draw attention traces.")

  installTypeScriptRequireHook()
  const { buildWorldViewModelForPixelWorld } = localRequire(viewModelGatewayPath)
  const model = buildWorldViewModelForPixelWorld({ saveRecord: record, isPersisted: true })
  const derivedVisualObjects = model.objects.filter((object) => object.source === "derived_visual_only")
  const factObjects = model.objects.filter((object) => object.source === "world_fact")
  const naturalTileKinds = new Set([
    "grass",
    "pressed_grass",
    "worn_grass",
    "exposed_soil",
    "ecology_transition",
    "recovery_growth",
    "soil",
  ])
  const naturalTiles = model.tiles.filter((tile) => naturalTileKinds.has(tile.kind))
  const tileKindCounts = model.tiles.reduce((counts, tile) => {
    counts[tile.kind] = (counts[tile.kind] ?? 0) + 1
    return counts
  }, {})

  assert(model.canvas.width === record.homeMapState.mapSize.columns * record.homeMapState.mapSize.tileSize, "WorldViewModel canvas width does not come from HomeMapState / SpaceGrid.")
  assert(model.canvas.height === record.homeMapState.mapSize.rows * record.homeMapState.mapSize.tileSize, "WorldViewModel canvas height does not come from HomeMapState / SpaceGrid.")
  assert(model.tiles.length === record.homeMapState.mapSize.columns * record.homeMapState.mapSize.rows, "WorldViewModel tiles are not generated from SpaceGrid cells.")
  assert(naturalTiles.length > 0, `WorldViewModel output has no natural ground tiles. Tile kinds: ${JSON.stringify(tileKindCounts)}`)
  assert(model.objects.length > 0, "WorldViewModel output has no objects.")
  assert(derivedVisualObjects.length > 0, "WorldViewModel output has no derived visual-only objects.")
  assert(
    derivedVisualObjects.every((object) => object.tags.includes("not_world_fact") && object.tags.includes("no_runtime_write")),
    "Derived visual objects are not clearly marked as non-facts."
  )
  assert(model.traces.length > 0, "WorldViewModel output has no runtime traces.")
  assert(model.actors.some((actor) => actor.kind === "butler" && actor.visible), "No visible butler actor.")
  assert(
    !model.actors.some((actor) => actor.kind === "pet" && actor.visible) ||
      record.homeMapState.placements.some(
        (placement) =>
          placement.layer === "actor" &&
          (placement.tags.includes("pet") || placement.id.toLowerCase().includes("pet") || placement.label.toLowerCase().includes("pet"))
      ),
    "WorldViewModel generated visible pet without pet facts."
  )

  const afterRaw = fs.readFileSync(savePath, "utf8")
  const afterHash = crypto.createHash("sha256").update(afterRaw).digest("hex")
  const afterRecord = parseJson(afterRaw, "Runtime save after pixel viewmodel smoke is not valid JSON.")

  assert(afterRecord.tick === record.tick, "Pixel ViewModel smoke changed runtime tick.")
  assert(afterHash === beforeHash, "Pixel ViewModel smoke changed runtime hash.")
  assert(afterRecord.homeMapState.placements.length === placementCountBefore, "Pixel ViewModel smoke changed HomeMapState placements.")

  console.log("WORLD PIXEL VIEWMODEL PRIMARY SMOKE")
  console.log(`Runtime tick: ${record.tick}`)
  console.log(`Canvas: ${model.canvas.width}x${model.canvas.height}`)
  console.log(`Tiles: ${model.tiles.length}`)
  console.log(`Tile kinds: ${JSON.stringify(tileKindCounts)}`)
  console.log(`Natural ground tiles: ${naturalTiles.length}`)
  console.log(`Objects: ${model.objects.length}`)
  console.log(`World fact objects: ${factObjects.length}`)
  console.log(`Derived visual-only objects: ${derivedVisualObjects.length}`)
  console.log(`Traces: ${model.traces.length}`)
  console.log(`Actors: ${model.actors.length}`)
  console.log("World pixel rule mapper: ok")
  console.log("No Scene Composer gateway in WorldViewModel: ok")
  console.log("No SVG renderer in /world: ok")
  console.log("Runtime read boundary: ok")
  console.log("No default pet fact: ok")
  console.log("Result: PASS")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
