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
  assert(!pageSource.includes("buildSceneSvg"), "/world still references buildSceneSvg.")
  assert(!pageSource.includes("WorldPainterReadonlyPreview"), "/world still references WorldPainterReadonlyPreview.")
  assert(!pageSource.includes("pixel-scene-composer"), "/world imports the debug composer page.")
  assert(modelSources.includes("composeScene"), "WorldViewModel does not use Scene Composer rules.")
  assert(modelSources.includes("buildDefaultSceneComposerFact"), "WorldViewModel does not build formal SceneComposerFact.")
  assert(!modelSources.includes("buildSceneSvg"), "WorldViewModel must not use Scene Composer SVG renderer.")
  assert(!modelSources.includes("data:image/svg+xml"), "WorldViewModel must not output SVG data URIs.")
  assert(!modelSources.includes("WorldPainterReadonlyPreview"), "WorldViewModel still imports world painter preview.")
  assert(!modelSources.includes("world-painter-adapter"), "WorldViewModel still imports world painter adapter.")
  assert(schemaSource.includes("WorldViewObjectSource"), "WorldViewObject has no source provenance.")
  assert(modelSources.includes("scene_composer_rules_primary"), "WorldViewModel is not tagged as Scene Composer rules primary.")
  assert(modelSources.includes("derived_visual_only"), "WorldViewModel has no derived visual-only rule assets.")
  assert(modelSources.includes("not_world_fact"), "Derived visuals are not marked as non-facts.")
  assert(modelSources.includes("no_runtime_write"), "Derived visuals are not marked as read-only projection.")

  installTypeScriptRequireHook()
  const { buildWorldViewModelForPixelWorld } = localRequire(viewModelGatewayPath)
  const model = buildWorldViewModelForPixelWorld({ saveRecord: record, isPersisted: true })
  const derivedVisualObjects = model.objects.filter((object) => object.source === "derived_visual_only")
  const factObjects = model.objects.filter((object) => object.source === "world_fact")

  assert(model.canvas.width === 768, "WorldViewModel canvas width is not Scene Composer width 768.")
  assert(model.canvas.height === 432, "WorldViewModel canvas height is not Scene Composer height 432.")
  assert(model.tiles.length > 0, "WorldViewModel output has no tiles.")
  assert(model.objects.length > 0, "WorldViewModel output has no objects.")
  assert(derivedVisualObjects.length > 0, "WorldViewModel output has no derived visual-only objects.")
  assert(model.objects.some((object) => object.kind === "tree"), "WorldViewModel output has no Scene Composer trees.")
  assert(model.objects.some((object) => object.kind === "bush"), "WorldViewModel output has no Scene Composer bush or grass tuft visuals.")
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
  console.log(`Objects: ${model.objects.length}`)
  console.log(`World fact objects: ${factObjects.length}`)
  console.log(`Derived visual-only objects: ${derivedVisualObjects.length}`)
  console.log(`Trees: ${model.objects.filter((object) => object.kind === "tree").length}`)
  console.log(`Traces: ${model.traces.length}`)
  console.log(`Actors: ${model.actors.length}`)
  console.log("Scene Composer rules projection: ok")
  console.log("No SVG renderer in /world: ok")
  console.log("Runtime read boundary: ok")
  console.log("No default pet fact: ok")
  console.log("Result: PASS")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
