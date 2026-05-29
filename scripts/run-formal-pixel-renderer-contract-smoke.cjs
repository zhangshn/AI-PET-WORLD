async function main() {
  const fs = await import("node:fs")
  const moduleApi = await import("node:module")
  const path = await import("node:path")
  const ts = await import("typescript")

  const repoRoot = process.cwd()
  const localRequire = moduleApi.createRequire(__filename)
  const savePath = path.join(repoRoot, ".runtime", "world-state", "default-world.json")
  const viewModelGatewayPath = path.join(repoRoot, "src", "world", "world-view-model", "world-view-model-gateway.ts")
  const formalRendererGatewayPath = path.join(repoRoot, "src", "world", "formal-pixel-renderer", "formal-pixel-renderer-gateway.ts")
  const formalRendererDir = path.join(repoRoot, "src", "world", "formal-pixel-renderer")

  function fail(message) {
    console.log("FORMAL PIXEL RENDERER CONTRACT SMOKE")
    console.log(message)
    console.log("Result: FAIL")
    process.exit(1)
  }

  function assert(condition, message) {
    if (!condition) fail(message)
  }

  function readRequiredFile(filePath, label) {
    if (!fs.existsSync(filePath)) fail(`${label} is missing.`)
    return fs.readFileSync(filePath, "utf8")
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

  function assertStaticContract() {
    const files = [
      "formal-pixel-renderer-schema.ts",
      "formal-pixel-renderer-gateway.ts",
      "tile-layer-renderer.ts",
      "trace-layer-renderer.ts",
      "object-layer-renderer.ts",
      "actor-layer-renderer.ts",
      "atmosphere-layer-renderer.ts",
      "formal-pixel-renderer-audit.ts",
      "index.ts",
    ]
    const combinedSource = files
      .map((fileName) => readRequiredFile(path.join(formalRendererDir, fileName), fileName))
      .join("\n")

    const requiredTokens = [
      "buildFormalPixelRenderModel",
      "buildFormalTileLayer",
      "buildFormalTraceLayer",
      "buildFormalObjectLayer",
      "buildFormalActorLayer",
      "buildFormalAtmosphereLayer",
      "buildFormalPixelRendererAudit",
      "FormalPixelRenderModel",
      "source_world_view_model_only",
      "no_runtime_write",
      "no_world_fact_write",
      "no_tick_advance",
      "no_debug_visual_lab",
      "no_procedural_renderer",
      "no_default_pet_generation",
    ]

    requiredTokens.forEach((token) => {
      assert(combinedSource.includes(token), `Formal renderer source is missing token: ${token}`)
    })

    const forbiddenTokens = [
      "readWorldRuntimeForView",
      "writeWorldRuntimeSaveRecord",
      "runAndPersistOneRuntimeTick",
      "runTraceLifecycleTick",
      "pixel-visual-lab",
      "procedural-renderer",
      "scene-composer-gateway",
      "createPet",
      "PetSystem",
      "pet_default",
    ]
    const forbiddenHits = forbiddenTokens.filter((token) => combinedSource.includes(token))

    assert(
      forbiddenHits.length === 0,
      `Formal renderer source contains forbidden dependency token: ${forbiddenHits.join(", ")}`
    )
  }

  function assertRenderModelContract(renderModel, worldViewModel) {
    const layers = renderModel.layers
    const visibleButlers = layers.actors.items.filter((actor) => actor.kind === "butler" && actor.visible)
    const visiblePets = layers.actors.items.filter((actor) => actor.kind === "pet" && actor.visible)

    assert(renderModel.worldId === worldViewModel.worldId, "Render model worldId does not match WorldViewModel.")
    assert(renderModel.ownerId === worldViewModel.ownerId, "Render model ownerId does not match WorldViewModel.")
    assert(renderModel.tick === worldViewModel.tick, "Render model tick does not match WorldViewModel.")
    assert(renderModel.canvas.width === worldViewModel.canvas.width, "Render model canvas width does not match WorldViewModel.")
    assert(renderModel.canvas.height === worldViewModel.canvas.height, "Render model canvas height does not match WorldViewModel.")
    assert(layers.tiles.kind === "tile", "Tile layer kind is invalid.")
    assert(layers.traces.kind === "trace", "Trace layer kind is invalid.")
    assert(layers.objects.kind === "object", "Object layer kind is invalid.")
    assert(layers.actors.kind === "actor", "Actor layer kind is invalid.")
    assert(layers.atmosphere.kind === "atmosphere", "Atmosphere layer kind is invalid.")
    assert(layers.tiles.items.length === worldViewModel.tiles.length, "Tile item count does not match WorldViewModel tiles.")
    assert(layers.traces.items.length === worldViewModel.traces.length, "Trace item count does not match WorldViewModel traces.")
    assert(layers.objects.items.length === worldViewModel.objects.length, "Object item count does not match WorldViewModel objects.")
    assert(layers.actors.items.length === worldViewModel.actors.length, "Actor item count does not match WorldViewModel actors.")
    assert(layers.atmosphere.items.length === 1, "Atmosphere layer should contain one primary atmosphere item.")
    assert(visibleButlers.length === 1, `Expected one visible butler actor, got ${visibleButlers.length}.`)
    assert(visiblePets.length === 0, `Expected zero visible pet actors, got ${visiblePets.length}.`)
    assert(renderModel.audit.source === "world_view_model", "Audit source should be world_view_model.")
    assert(renderModel.audit.readOnly === true, "Audit readOnly should be true.")
    assert(renderModel.audit.runtimeWrite === false, "Audit runtimeWrite should be false.")
    assert(renderModel.audit.worldFactWrite === false, "Audit worldFactWrite should be false.")
    assert(renderModel.audit.tickAdvance === false, "Audit tickAdvance should be false.")
    assert(renderModel.audit.debugVisualLabUsed === false, "Audit debugVisualLabUsed should be false.")
    assert(renderModel.audit.proceduralRendererUsed === false, "Audit proceduralRendererUsed should be false.")
    assert(renderModel.audit.defaultPetGenerated === false, "Audit defaultPetGenerated should be false.")

    const requiredTags = [
      "formal_pixel_render_model",
      "source_world_view_model_only",
      "formal_pixel_renderer_v0",
      "read_only_render_projection",
      "no_runtime_write",
      "no_world_fact_write",
      "no_tick_advance",
      "no_debug_visual_lab",
      "no_procedural_renderer",
      "no_default_pet_generation",
    ]
    requiredTags.forEach((tag) => {
      assert(renderModel.tags.includes(tag), `Render model is missing tag: ${tag}`)
    })
  }

  assertStaticContract()
  installTypeScriptRequireHook()

  const runtimeRecord = parseJson(readRequiredFile(savePath, "Runtime save"), "Runtime save is not valid JSON.")
  const { buildWorldViewModelForPixelWorld } = localRequire(viewModelGatewayPath)
  const { buildFormalPixelRenderModel } = localRequire(formalRendererGatewayPath)
  const worldViewModel = buildWorldViewModelForPixelWorld({
    saveRecord: runtimeRecord,
    isPersisted: true,
  })
  const renderModel = buildFormalPixelRenderModel(worldViewModel)

  assertRenderModelContract(renderModel, worldViewModel)

  console.log("FORMAL PIXEL RENDERER CONTRACT SMOKE")
  console.log(`World: ${renderModel.worldId}`)
  console.log(`Tick: ${renderModel.tick}`)
  console.log(`Tiles: ${renderModel.layers.tiles.items.length}`)
  console.log(`Traces: ${renderModel.layers.traces.items.length}`)
  console.log(`Objects: ${renderModel.layers.objects.items.length}`)
  console.log(`Actors: ${renderModel.layers.actors.items.length}`)
  console.log(`Atmosphere items: ${renderModel.layers.atmosphere.items.length}`)
  console.log("Static dependency boundary: ok")
  console.log("Five formal layers: ok")
  console.log("No default pet actor: ok")
  console.log("Audit boundary: ok")
  console.log("Result: PASS")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
