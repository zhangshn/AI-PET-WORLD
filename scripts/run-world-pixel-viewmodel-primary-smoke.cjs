async function main() {
  const crypto = await import("node:crypto")
  const fs = await import("node:fs")
  const moduleApi = await import("node:module")
  const path = await import("node:path")
  const ts = await import("typescript")
  const repoRoot = process.cwd()
  const localRequire = moduleApi.createRequire(__filename)
  const packageJsonPath = path.join(repoRoot, "package.json")
  const savePath = path.join(repoRoot, ".runtime", "world-state", "default-world.json")
  const pagePath = path.join(repoRoot, "src", "app", "world", "world-live-runtime-page.tsx")
  const viewModelGatewayPath = path.join(
    repoRoot,
    "src",
    "world",
    "world-view-model",
    "world-view-model-gateway.ts"
  )
  const viewModelDir = path.join(repoRoot, "src", "world", "world-view-model")
  const viewModelSchemaPath = path.join(
    repoRoot,
    "src",
    "world",
    "world-view-model",
    "world-view-model-schema.ts"
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
  const pixelCanvasPath = path.join(
    repoRoot,
    "src",
    "app",
    "world",
    "components",
    "pixel-world-view",
    "pixel-world-canvas.client.tsx"
  )

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
  if (!fs.existsSync(viewModelGatewayPath)) fail("WorldViewModel gateway is missing.")
  if (!fs.existsSync(viewModelSchemaPath)) fail("WorldViewModel schema is missing.")
  if (!fs.existsSync(pixelViewPath)) fail("PixelWorldView component is missing.")
  if (!fs.existsSync(pixelCanvasPath)) fail("PixelWorld canvas component is missing.")

  const packageJson = parseJson(fs.readFileSync(packageJsonPath, "utf8"), "package.json is invalid.")
  const beforeRaw = fs.readFileSync(savePath, "utf8")
  const beforeHash = crypto.createHash("sha256").update(beforeRaw).digest("hex")
  const record = parseJson(beforeRaw, "Runtime save file is not valid JSON.")
  const pageSource = fs.readFileSync(pagePath, "utf8")
  const viewModelSchemaSource = fs.readFileSync(viewModelSchemaPath, "utf8")
  const viewModelSources = fs
    .readdirSync(viewModelDir)
    .filter((fileName) => fileName.endsWith(".ts"))
    .map((fileName) => fs.readFileSync(path.join(viewModelDir, fileName), "utf8"))
    .join("\n")
  const pixelViewSource = fs.readFileSync(pixelViewPath, "utf8")
  const pixelCanvasSource = fs.readFileSync(pixelCanvasPath, "utf8")
  const combinedPixelSource = `${pixelViewSource}\n${pixelCanvasSource}`
  const forbiddenTokens = [
    "buildSceneSvg",
    "WorldPainterReadonlyPreview",
    "FormalWorldView",
    "formalWorldPanel",
    "data:image/svg+xml",
    "scene-composer-gateway",
    "adaptHomeMapStateToSceneComposerFact",
    "world-painter-adapter",
    "movementChannel",
    "roadGraph",
    "pathGraph",
    "openai",
    "llm",
  ]

  assert(
    packageJson.scripts?.["smoke:world-pixel-viewmodel-primary"] ===
      "node scripts/run-world-pixel-viewmodel-primary-smoke.cjs",
    "package.json does not contain smoke:world-pixel-viewmodel-primary."
  )
  assert(
    !packageJson.scripts?.["smoke:formal-trace-layer"],
    "package.json restored smoke:formal-trace-layer."
  )
  assert(
    !packageJson.scripts?.["smoke:world-surface-hierarchy"],
    "package.json restored smoke:world-surface-hierarchy."
  )
  assert(pageSource.includes("readWorldRuntimeForView"), "/world no longer uses readWorldRuntimeForView.")
  assert(
    pageSource.includes("buildWorldViewModelForPixelWorld"),
    "/world does not use buildWorldViewModelForPixelWorld."
  )
  assert(pageSource.includes("PixelWorldView"), "/world does not render PixelWorldView.")
  forbiddenTokens.slice(0, 5).forEach((token) =>
    assert(!pageSource.includes(token), `/world page contains forbidden token ${token}.`)
  )
  assert(!combinedPixelSource.includes("<svg"), "PixelWorldView contains SVG markup.")
  assert(!combinedPixelSource.includes("data:image/svg+xml"), "PixelWorldView contains SVG data uri.")
  assert(!combinedPixelSource.includes("buildSceneSvg"), "PixelWorldView references buildSceneSvg.")
  assert(pixelCanvasSource.includes("<canvas"), "PixelWorldView does not use canvas.")
  assert(viewModelSchemaSource.includes("tiles:"), "WorldViewModel schema missing tiles.")
  assert(viewModelSchemaSource.includes("objects:"), "WorldViewModel schema missing objects.")
  assert(viewModelSchemaSource.includes("traces:"), "WorldViewModel schema missing traces.")
  assert(viewModelSchemaSource.includes("actors:"), "WorldViewModel schema missing actors.")
  forbiddenTokens.slice(5).forEach((token) =>
    assert(
      !combinedPixelSource.includes(token) && !viewModelSources.includes(token),
      `Pixel ViewModel path contains forbidden token ${token}.`
    )
  )

  installTypeScriptRequireHook()
  const { buildWorldViewModelForPixelWorld } = localRequire(viewModelGatewayPath)
  const model = buildWorldViewModelForPixelWorld({
    saveRecord: record,
    isPersisted: true,
  })

  assert(model.tiles.length > 0, "WorldViewModel output has no tiles.")
  assert(model.objects.length > 0, "WorldViewModel output has no objects.")
  assert(model.traces.length > 0, "WorldViewModel output has no traces.")
  assert(model.actors.length > 0, "WorldViewModel output has no actors.")
  assert(
    model.actors.some((actor) => actor.kind === "butler" && actor.visible),
    "WorldViewModel output has no visible butler actor."
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
    "WorldViewModel generated visible pet without pet facts."
  )

  const afterRaw = fs.readFileSync(savePath, "utf8")
  const afterHash = crypto.createHash("sha256").update(afterRaw).digest("hex")
  const afterRecord = parseJson(afterRaw, "Runtime save after pixel viewmodel smoke is not valid JSON.")

  assert(afterRecord.tick === record.tick, "Pixel ViewModel smoke changed runtime tick.")
  assert(afterHash === beforeHash, "Pixel ViewModel smoke changed runtime hash.")

  console.log("WORLD PIXEL VIEWMODEL PRIMARY SMOKE")
  console.log(`Runtime tick: ${record.tick}`)
  console.log(`Tiles: ${model.tiles.length}`)
  console.log(`Objects: ${model.objects.length}`)
  console.log(`Traces: ${model.traces.length}`)
  console.log(`Actors: ${model.actors.length}`)
  console.log("WorldViewModel shape: ok")
  console.log("Canvas PixelWorldView: ok")
  console.log("Runtime read boundary: ok")
  console.log("No default pet fact: ok")
  console.log("Result: PASS")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
