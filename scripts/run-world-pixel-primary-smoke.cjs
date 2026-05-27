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
    "pixel-world",
    "pixel-world-view-model.ts"
  )
  const pixelViewPath = path.join(
    repoRoot,
    "src",
    "app",
    "world",
    "components",
    "pixel-world-view",
    "pixel-world-view.tsx"
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
  if (!fs.existsSync(viewModelPath)) fail("Pixel world view model file is missing.")
  if (!fs.existsSync(pixelViewPath)) fail("PixelWorldView component is missing.")
  if (!fs.existsSync(pixelViewStylePath)) fail("PixelWorldView CSS module is missing.")

  const beforeRaw = fs.readFileSync(savePath, "utf8")
  const beforeHash = crypto.createHash("sha256").update(beforeRaw).digest("hex")
  const record = parseJson(beforeRaw, "Runtime save file is not valid JSON.")
  const pageSource = fs.readFileSync(pagePath, "utf8")
  const viewModelSource = fs.readFileSync(viewModelPath, "utf8")
  const pixelViewSource = fs.readFileSync(pixelViewPath, "utf8")
  const runtimeSmokeSource = fs.readFileSync(runtimeSmokePath, "utf8")

  const requiredPageTokens = [
    "readWorldRuntimeForView",
    "buildPixelWorldViewModelFromRuntime",
    "PixelWorldView",
  ]
  const forbiddenPageTokens = [
    "buildSceneSvg",
    "WorldPainterReadonlyPreview",
    "data:image/svg+xml",
    "FormalWorldView",
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
    "canvas",
  ]
  const requiredPixelViewTokens = [
    "tile layer",
    "trace layer",
    "object layer",
    "sprite layer",
    "atmosphere layer",
    "p-phone",
    "butler explanation",
  ]
  const requiredViewModelTokens = [
    "buildSpaceGridFromHomeMapState",
    "buildTraceFieldFromWorld",
    "composeScene",
    "no_world_fact_generation",
    "butler_sprite_position",
  ]

  requiredPageTokens.forEach((token) =>
    assert(pageSource.includes(token), `/world page is missing ${token}.`)
  )
  forbiddenPageTokens.forEach((token) =>
    assert(!pageSource.includes(token), `/world page still contains ${token}.`)
  )
  forbiddenPixelViewTokens.forEach((token) =>
    assert(!pixelViewSource.includes(token), `PixelWorldView still contains ${token}.`)
  )
  requiredPixelViewTokens.forEach((token) =>
    assert(
      pixelViewSource.includes(token),
      `PixelWorldView is missing required surface token: ${token}.`
    )
  )
  requiredViewModelTokens.forEach((token) =>
    assert(
      viewModelSource.includes(token),
      `Pixel world view model is missing required token: ${token}.`
    )
  )
  assert(
    runtimeSmokeSource.includes("World read boundary: ok"),
    "Runtime smoke no longer reports read-boundary validation."
  )

  installTypeScriptRequireHook()
  const { buildPixelWorldViewModelFromRuntime } = localRequire(viewModelPath)
  const model = buildPixelWorldViewModelFromRuntime({
    saveRecord: record,
    isPersisted: true,
  })

  assert(model.tiles.length > 0, "PixelWorldViewModel has no tiles.")
  assert(model.traceOverlays.length > 0, "PixelWorldViewModel has no trace layer overlays.")
  assert(model.objects.length > 0, "PixelWorldViewModel has no object layer objects.")
  assert(
    model.sprites.some((sprite) => sprite.kind === "butler" && sprite.visible),
    "PixelWorldViewModel has no visible butler sprite."
  )
  assert(
    !model.sprites.some((sprite) => sprite.kind === "pet" && sprite.visible) ||
      record.homeMapState.placements.some(
        (placement) =>
          placement.layer === "actor" &&
          (placement.tags.includes("pet") ||
            placement.id.toLowerCase().includes("pet") ||
            placement.label.toLowerCase().includes("pet"))
      ),
    "PixelWorldViewModel generated a visible pet without existing pet facts."
  )

  const afterRaw = fs.readFileSync(savePath, "utf8")
  const afterHash = crypto.createHash("sha256").update(afterRaw).digest("hex")
  const afterRecord = parseJson(afterRaw, "Runtime save after pixel primary smoke is not valid JSON.")

  assert(afterRecord.tick === record.tick, "Pixel primary smoke changed runtime tick.")
  assert(afterHash === beforeHash, "Pixel primary smoke changed runtime save hash.")

  console.log("WORLD PIXEL PRIMARY SMOKE")
  console.log(`Runtime tick: ${record.tick}`)
  console.log(`Tiles: ${model.tiles.length}`)
  console.log(`Trace overlays: ${model.traceOverlays.length}`)
  console.log(`Objects: ${model.objects.length}`)
  console.log("PixelWorldView primary surface: ok")
  console.log("SVG renderer removed from /world: ok")
  console.log("Runtime read boundary: ok")
  console.log("Butler sprite visible: ok")
  console.log("Result: PASS")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
