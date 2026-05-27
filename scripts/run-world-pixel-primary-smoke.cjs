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
  const viewModelPath = path.join(
    repoRoot,
    "src",
    "world",
    "world-view-model",
    "world-view-model-gateway.ts"
  )
  const viewModelDir = path.join(repoRoot, "src", "world", "world-view-model")
  const pixelViewPath = path.join(
    repoRoot,
    "src",
    "app",
    "world",
    "components",
    "pixel-world-view",
    "pixel-world-view.tsx"
  )
  const pixelCanvasPath = path.join(
    repoRoot,
    "src",
    "app",
    "world",
    "components",
    "pixel-world-view",
    "pixel-world-canvas.client.tsx"
  )
  const pixelViewStylePath = path.join(
    repoRoot,
    "src",
    "app",
    "world",
    "components",
    "pixel-world-view",
    "pixel-world-view.module.css"
  )
  const runtimeSmokePath = path.join(repoRoot, "scripts", "run-world-runtime-smoke.cjs")

  function fail(message) {
    console.log("WORLD PIXEL PRIMARY SMOKE")
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

  if (!fs.existsSync(savePath)) fail("Runtime save file not found.")
  if (!fs.existsSync(viewModelPath)) fail("WorldViewModel gateway file is missing.")
  if (!fs.existsSync(pixelViewPath)) fail("PixelWorldView component is missing.")
  if (!fs.existsSync(pixelCanvasPath)) fail("PixelWorld canvas component is missing.")
  if (!fs.existsSync(pixelViewStylePath)) fail("PixelWorldView CSS module is missing.")

  const beforeRaw = fs.readFileSync(savePath, "utf8")
  const beforeHash = crypto.createHash("sha256").update(beforeRaw).digest("hex")
  const record = parseJson(beforeRaw, "Runtime save file is not valid JSON.")
  const pageSource = fs.readFileSync(pagePath, "utf8")
  const viewModelSources = fs
    .readdirSync(viewModelDir)
    .filter((fileName) => fileName.endsWith(".ts"))
    .map((fileName) => fs.readFileSync(path.join(viewModelDir, fileName), "utf8"))
    .join("\n")
  const pixelViewSource = fs.readFileSync(pixelViewPath, "utf8")
  const pixelCanvasSource = fs.readFileSync(pixelCanvasPath, "utf8")
  const runtimeSmokeSource = fs.readFileSync(runtimeSmokePath, "utf8")

  const requiredPageTokens = [
    "readWorldRuntimeForView",
    "buildWorldViewModelForPixelWorld",
    "PixelWorldView",
  ]
  const forbiddenPageTokens = [
    "buildSceneSvg",
    "WorldPainterReadonlyPreview",
    "data:image/svg+xml",
    "FormalWorldView",
    "formalWorldPanel",
    "ProceduralRendererView",
    "runAndPersistOneRuntimeTick",
    "writeWorldRuntimeSaveRecord",
    "handleManualTick",
    "handleManualSave",
    "Audit Trail",
    "SummaryCard",
    "styles.heroPanel",
    "styles.summaryGrid",
    "styles.viewModePanel",
  ]
  const forbiddenPixelViewTokens = [
    "<svg",
    "data:image/svg+xml",
    "next/image",
    "buildSceneSvg",
  ]
  const forbiddenFormalPathTokens = [
    "scene-composer-gateway",
    "adaptHomeMapStateToSceneComposerFact",
    "world-painter-adapter",
    "buildSceneSvg",
    "data:image/svg+xml",
    "WorldPainterReadonlyPreview",
    "FormalWorldView",
    "formalWorldPanel",
    "movementChannel",
    "roadGraph",
    "pathGraph",
  ]
  const requiredCanvasTokens = [
    "<canvas",
    "drawTileLayer",
    "drawTraceLayer",
    "drawObjectLayer",
    "drawSpriteLayer",
    "drawAtmosphereLayer",
  ]
  const requiredViewModelTokens = [
    "buildSpaceGridFromHomeMapState",
    "buildTraceFieldFromWorld",
    "no_world_fact_generation",
    "buildWorldViewActors",
  ]

  requiredPageTokens.forEach((token) =>
    assert(pageSource.includes(token), `/world page is missing ${token}.`)
  )
  forbiddenPageTokens.forEach((token) =>
    assert(!pageSource.includes(token), `/world page still contains ${token}.`)
  )
  forbiddenPixelViewTokens.forEach((token) =>
    assert(
      !pixelViewSource.includes(token) && !pixelCanvasSource.includes(token),
      `PixelWorldView source still contains ${token}.`
    )
  )
  requiredCanvasTokens.forEach((token) =>
    assert(
      pixelCanvasSource.includes(token),
      `PixelWorld canvas source is missing ${token}.`
    )
  )
  requiredViewModelTokens.forEach((token) =>
    assert(
      viewModelSources.includes(token),
      `WorldViewModel gateway is missing required token: ${token}.`
    )
  )
  forbiddenFormalPathTokens.forEach((token) =>
    assert(
      !pageSource.includes(token) &&
        !viewModelSources.includes(token) &&
        !pixelViewSource.includes(token) &&
        !pixelCanvasSource.includes(token),
      `Formal pixel path contains forbidden token: ${token}.`
    )
  )
  assert(
    runtimeSmokeSource.includes("World read boundary: ok"),
    "Runtime smoke no longer reports read-boundary validation."
  )

  installTypeScriptRequireHook()
  const { buildWorldViewModelForPixelWorld } = localRequire(viewModelPath)
  const model = buildWorldViewModelForPixelWorld({
    saveRecord: record,
    isPersisted: true,
  })

  assert(Array.isArray(model.tiles) && model.tiles.length > 0, "WorldViewModel has no tiles.")
  assert(Array.isArray(model.objects) && model.objects.length > 0, "WorldViewModel has no objects.")
  assert(Array.isArray(model.traces) && model.traces.length > 0, "WorldViewModel has no traces.")
  assert(Array.isArray(model.actors) && model.actors.length > 0, "WorldViewModel has no actors.")
  assert(
    model.actors.some((actor) => actor.kind === "butler" && actor.visible),
    "WorldViewModel has no visible butler actor."
  )
  assert(
    !model.actors.some((actor) => actor.kind === "pet" && actor.visible) ||
      record.homeMapState.placements.some(
        (placement) =>
          placement.layer === "actor" &&
          (placement.tags.includes("pet") ||
            placement.id.toLowerCase().includes("pet") ||
            placement.label.toLowerCase().includes("pet"))
      ),
    "WorldViewModel generated a visible pet without existing pet facts."
  )

  const afterRaw = fs.readFileSync(savePath, "utf8")
  const afterHash = crypto.createHash("sha256").update(afterRaw).digest("hex")
  const afterRecord = parseJson(afterRaw, "Runtime save after pixel primary smoke is not valid JSON.")

  assert(afterRecord.tick === record.tick, "Pixel primary smoke changed runtime tick.")
  assert(afterHash === beforeHash, "Pixel primary smoke changed runtime save hash.")

  console.log("WORLD PIXEL PRIMARY SMOKE")
  console.log(`Runtime tick: ${record.tick}`)
  console.log(`Tiles: ${model.tiles.length}`)
  console.log(`Objects: ${model.objects.length}`)
  console.log(`Traces: ${model.traces.length}`)
  console.log(`Actors: ${model.actors.length}`)
  console.log("PixelWorldView primary surface: ok")
  console.log("Canvas pixel renderer: ok")
  console.log("SVG renderer removed from /world: ok")
  console.log("Runtime read boundary: ok")
  console.log("Butler actor visible: ok")
  console.log("Result: PASS")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
