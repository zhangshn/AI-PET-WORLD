async function main() {
  const fs = await import("node:fs")
  const moduleApi = await import("node:module")
  const path = await import("node:path")
  const ts = await import("typescript")

  const repoRoot = process.cwd()
  const localRequire = moduleApi.createRequire(__filename)
  const savePath = path.join(repoRoot, ".runtime", "world-state", "default-world.json")
  const viewModelGatewayPath = path.join(repoRoot, "src", "world", "world-view-model", "world-view-model-gateway.ts")
  const formalRendererIndexPath = path.join(repoRoot, "src", "world", "formal-pixel-renderer", "index.ts")
  const formalSvgRendererPath = path.join(repoRoot, "src", "world", "formal-pixel-renderer", "formal-pixel-svg-renderer.ts")
  const formalTreeRecipePath = path.join(repoRoot, "src", "world", "formal-pixel-renderer", "formal-tree-recipe.ts")
  const formalGroundRecipePath = path.join(repoRoot, "src", "world", "formal-pixel-renderer", "formal-ground-recipe.ts")
  const sharedTreeRecipePath = path.join(repoRoot, "src", "world", "procedural-painter", "scene-composer", "scene-composer-tree-recipe.ts")

  function fail(message) {
    console.log("FORMAL PIXEL SVG RENDERER SMOKE")
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

  function assertStaticBoundary() {
    const source = readRequiredFile(formalSvgRendererPath, "formal-pixel-svg-renderer.ts")
    const treeRecipeSource = readRequiredFile(formalTreeRecipePath, "formal-tree-recipe.ts")
    const groundRecipeSource = readRequiredFile(formalGroundRecipePath, "formal-ground-recipe.ts")
    const sharedTreeRecipeSource = readRequiredFile(sharedTreeRecipePath, "scene-composer-tree-recipe.ts")
    const combinedSource = `${source}\n${treeRecipeSource}\n${groundRecipeSource}\n${sharedTreeRecipeSource}`
    const forbiddenTokens = [
      "readWorldRuntimeForView",
      "writeWorldRuntimeSaveRecord",
      "runAndPersistOneRuntimeTick",
      "runTraceLifecycleTick",
      "pixel-visual-lab",
      "procedural-renderer",
      "scene-composer-gateway",
      "PetSystem",
      "createPet",
      "pet_default",
    ]
    const forbiddenHits = forbiddenTokens.filter((token) => combinedSource.includes(token))

    assert(forbiddenHits.length === 0, `Formal SVG renderer contains forbidden token: ${forbiddenHits.join(", ")}`)
    assert(source.includes("buildFormalPixelSvg"), "Formal SVG renderer does not export buildFormalPixelSvg.")
    assert(source.includes("renderFormalTreeObject"), "Formal SVG renderer does not use formal tree recipe.")
    assert(source.includes("renderFormalGroundTile"), "Formal SVG renderer does not use formal ground recipe.")
    assert(treeRecipeSource.includes("formal_tree_recipe_v1"), "Formal tree recipe marker is missing.")
    assert(treeRecipeSource.includes("data-visual-scope=\"tree_only\""), "Formal tree recipe should be marked tree_only.")
    assert(treeRecipeSource.includes("data-tree-algorithm=\"scene_composer_tree_recipe\""), "Formal tree recipe should use scene composer tree recipe.")
    assert(treeRecipeSource.includes("renderSceneComposerTreeShadow"), "Formal tree recipe should keep scene composer tree shadow.")
    assert(treeRecipeSource.includes("renderSceneComposerTreeObject"), "Formal tree recipe should render scene composer tree object.")
    assert(sharedTreeRecipeSource.includes("renderSceneComposerTreeShadow"), "Shared scene composer tree recipe should expose tree shadow.")
    assert(sharedTreeRecipeSource.includes("renderSceneComposerTreeObject"), "Shared scene composer tree recipe should expose tree object.")
    assert(!treeRecipeSource.includes("renderFrontGrass"), "Formal tree recipe should not render front grass.")
    assert(!treeRecipeSource.includes("renderTreeGround"), "Formal tree recipe should not render tree ground.")
    assert(groundRecipeSource.includes("formal_ground_recipe_v1"), "Formal ground recipe marker is missing.")
    assert(source.includes("shape-rendering=\"crispEdges\""), "Formal SVG renderer is missing crisp pixel rendering.")
    assert(source.includes("data-formal-pixel-renderer=\"v0\""), "Formal SVG renderer is missing formal renderer marker.")
  }

  installTypeScriptRequireHook()
  assertStaticBoundary()

  const runtimeRecord = parseJson(readRequiredFile(savePath, "Runtime save"), "Runtime save is not valid JSON.")
  const { buildWorldViewModelForPixelWorld } = localRequire(viewModelGatewayPath)
  const { buildFormalPixelRenderModel, buildFormalPixelSvg } = localRequire(formalRendererIndexPath)
  const worldViewModel = buildWorldViewModelForPixelWorld({
    saveRecord: runtimeRecord,
    isPersisted: true,
  })
  const renderModel = buildFormalPixelRenderModel(worldViewModel)
  const svg = buildFormalPixelSvg(renderModel)

  assert(svg.startsWith("<svg"), "Formal SVG output does not start with <svg.")
  assert(svg.includes("data-formal-pixel-renderer=\"v0\""), "Formal SVG output is missing renderer marker.")
  assert(svg.includes("data-layer=\"tile\""), "Formal SVG output is missing tile layer.")
  assert(svg.includes("data-layer=\"trace\""), "Formal SVG output is missing trace layer.")
  assert(svg.includes("data-layer=\"object\""), "Formal SVG output is missing object layer.")
  assert(svg.includes("data-layer=\"actor\""), "Formal SVG output is missing actor layer.")
  assert(svg.includes("data-layer=\"atmosphere\""), "Formal SVG output is missing atmosphere layer.")
  assert(svg.includes("data-actor-kind=\"butler\""), "Formal SVG output is missing visible butler actor.")
  assert(!svg.includes("data-actor-kind=\"pet\""), "Formal SVG output should not contain a pet actor.")
  assert(svg.includes("data-object-kind=\"tree\""), "Formal SVG output is missing tree object rendering.")
  assert(svg.includes("data-formal-recipe=\"formal_tree_recipe_v1\""), "Formal SVG output does not use formal tree recipe.")
  assert(svg.includes("data-visual-scope=\"tree_only\""), "Formal SVG output does not mark trees as tree_only.")
  assert(svg.includes("data-tree-algorithm=\"scene_composer_tree_recipe\""), "Formal SVG output does not use scene composer tree recipe.")
  assert(svg.includes("data-formal-recipe=\"formal_ground_recipe_v1\""), "Formal SVG output does not use formal ground recipe.")

  console.log("FORMAL PIXEL SVG RENDERER SMOKE")
  console.log(`World: ${renderModel.worldId}`)
  console.log(`Tick: ${renderModel.tick}`)
  console.log(`SVG length: ${svg.length}`)
  console.log(`Tiles: ${renderModel.layers.tiles.items.length}`)
  console.log(`Objects: ${renderModel.layers.objects.items.length}`)
  console.log("SVG marker: ok")
  console.log("Five SVG groups: ok")
  console.log("Formal ground recipe: ok")
  console.log("Formal tree recipe: ok")
  console.log("Scene composer tree recipe: ok")
  console.log("Formal tree-only boundary: ok")
  console.log("Visible butler actor: ok")
  console.log("No pet actor SVG: ok")
  console.log("Static dependency boundary: ok")
  console.log("Result: PASS")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
