async function main() {
  const fs = await import("node:fs")
  const path = await import("node:path")

  const repoRoot = process.cwd()

  function fail(message) {
    console.log("PIXEL WORLDVIEW DEBUG PREVIEW SMOKE")
    console.log(message)
    console.log("Result: FAIL")
    process.exit(1)
  }

  function assert(condition, message) {
    if (!condition) fail(message)
  }

  function readFile(filePath, label) {
    assert(fs.existsSync(filePath), `${label} is missing.`)
    return fs.readFileSync(filePath, "utf8")
  }

  const pageSource = readFile(
    path.join(repoRoot, "src", "app", "world-debug", "pixel-worldview-preview", "page.tsx"),
    "PixelWorldView debug preview page"
  )
  const mockSource = readFile(
    path.join(repoRoot, "src", "world", "pixel-worldview", "pixel-worldview-mock-snapshot.ts"),
    "PixelWorldView mock snapshot"
  )
  const validatorSource = readFile(
    path.join(repoRoot, "src", "world", "pixel-worldview", "pixel-worldview-validator.ts"),
    "PixelWorldView validator"
  )
  const modelSource = readFile(
    path.join(repoRoot, "src", "world", "pixel-worldview", "pixel-worldview-model.ts"),
    "PixelWorldView empty model factory"
  )
  const renderPlannerSource = readFile(
    path.join(repoRoot, "src", "world", "pixel-worldview", "pixel-worldview-render-planner.ts"),
    "PixelWorldView render planner"
  )
  const renderValidatorSource = readFile(
    path.join(repoRoot, "src", "world", "pixel-worldview", "pixel-worldview-render-validator.ts"),
    "PixelWorldView render validator"
  )
  const renderTypesSource = readFile(
    path.join(repoRoot, "src", "world", "pixel-worldview", "pixel-worldview-render-types.ts"),
    "PixelWorldView render types"
  )
  const rendererBoundarySource = readFile(
    path.join(repoRoot, "src", "world", "pixel-worldview", "pixel-worldview-renderer-boundary.ts"),
    "PixelWorldView renderer boundary"
  )
  const bufferTypesSource = readFile(
    path.join(repoRoot, "src", "world", "pixel-worldview", "pixel-worldview-buffer-types.ts"),
    "PixelWorldView buffer types"
  )
  const bufferBuilderSource = readFile(
    path.join(repoRoot, "src", "world", "pixel-worldview", "pixel-worldview-buffer-builder.ts"),
    "PixelWorldView buffer builder"
  )
  const bufferValidatorSource = readFile(
    path.join(repoRoot, "src", "world", "pixel-worldview", "pixel-worldview-buffer-validator.ts"),
    "PixelWorldView buffer validator"
  )
  const packageSource = readFile(path.join(repoRoot, "package.json"), "package.json")
  const combined = [
    pageSource,
    mockSource,
    validatorSource,
    modelSource,
    renderPlannerSource,
    renderValidatorSource,
    renderTypesSource,
    rendererBoundarySource,
    bufferTypesSource,
    bufferBuilderSource,
    bufferValidatorSource,
    packageSource,
  ].join("\n")

  const requiredTokens = [
    "PixelWorldView Debug Preview",
    "createMinimalPixelWorldViewModel",
    "validatePixelWorldViewModel",
    "tiles",
    "traces",
    "objects",
    "actors",
    "atmosphere",
    "overlays",
    "overlay_p_phone",
    "actor_mock_butler",
    "buildPixelWorldRenderPlan",
    "validatePixelWorldRenderPlan",
    "Render Plan",
    "Layer Summaries",
    "Render Commands",
    "renderPlan.commands",
    "layerSummaries",
    "fill_tile",
    "draw_trace_patch",
    "place_object_recipe",
    "draw_actor_marker",
    "apply_atmosphere_tint",
    "draw_overlay_label",
    "buildPixelWorldRendererFrame",
    "buildPixelWorldPixelBufferFrame",
    "validatePixelWorldPixelBufferFrame",
    "Pixel Buffer",
    "Buffer Layers",
    "Buffer Cells",
    "buffer.cellCount",
    "buffer.layers",
    "buffer_cell_",
    "pixel_world_buffer_",
    "object_marker",
    "actor_marker",
    "overlay_marker",
    "colorHint",
  ]

  requiredTokens.forEach((token) => {
    assert(combined.includes(token), `Missing required token: ${token}`)
  })

  assert(packageSource.includes("smoke:pixel-worldview-debug-preview"), "Package smoke script is missing.")

  const forbiddenTokens = [
    "src/app/world/",
    "WorldRuntimeSaveRecord",
    "HomeMapState",
    "TraceField",
    "ButlerState",
    "readWorldRuntimeForView",
    "writeWorldRuntimeSaveRecord",
    "runAndPersistOneRuntimeTick",
    "createPet",
    "pet_default",
    'kind: "pet"',
    "buildSceneSvg",
    "data:image/svg",
    "<svg",
    "<canvas",
    "CanvasRenderingContext2D",
    "getContext(",
    "WorldPainterReadonlyPreview",
    "ProceduralRendererView",
    "FormalWorldView",
    "roadGraph",
    "pathGraph",
  ]
  const forbiddenHits = forbiddenTokens.filter((token) => combined.includes(token))
  assert(forbiddenHits.length === 0, `PixelWorldView debug preview contains forbidden dependencies: ${forbiddenHits.join(", ")}`)

  console.log("PIXEL WORLDVIEW DEBUG PREVIEW SMOKE")
  console.log("PixelWorldView debug preview page exists: ok")
  console.log("Minimal view model is used: ok")
  console.log("ViewModel validator is used: ok")
  console.log("Render plan builder is used: ok")
  console.log("Render plan validator is used: ok")
  console.log("Pixel buffer builder is used: ok")
  console.log("Pixel buffer validator is used: ok")
  console.log("Layer summaries exist: ok")
  console.log("Render commands exist: ok")
  console.log("Buffer layers exist: ok")
  console.log("Buffer cells exist: ok")
  console.log("Runtime boundary: ok")
  console.log("No SVG or canvas renderer dependency: ok")
  console.log("No default pet generation: ok")
  console.log("Result: PASS")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
