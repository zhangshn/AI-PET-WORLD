async function main() {
  const fs = await import("node:fs")
  const path = await import("node:path")

  const repoRoot = process.cwd()

  function fail(message) {
    console.log("PIXEL WORLDVIEW RENDER PLAN SMOKE")
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

  const contractDir = path.join(repoRoot, "src", "world", "pixel-worldview")
  const typesSource = readFile(path.join(contractDir, "pixel-worldview-render-types.ts"), "PixelWorldView render types")
  const plannerSource = readFile(path.join(contractDir, "pixel-worldview-render-planner.ts"), "PixelWorldView render planner")
  const validatorSource = readFile(path.join(contractDir, "pixel-worldview-render-validator.ts"), "PixelWorldView render validator")
  const indexSource = readFile(path.join(contractDir, "index.ts"), "PixelWorldView index")
  const combined = [typesSource, plannerSource, validatorSource, indexSource].join("\n")

  const requiredTokens = [
    "PixelWorldRenderPlan",
    "PixelWorldRenderCommand",
    "PixelWorldRenderLayerSummary",
    "buildPixelWorldRenderPlan",
    "validatePixelWorldRenderPlan",
    "fill_tile",
    "draw_trace_patch",
    "place_object_recipe",
    "draw_actor_marker",
    "apply_atmosphere_tint",
    "draw_overlay_label",
    "layerSummaries",
    "render_tile_",
    "render_trace_",
    "render_object_",
    "render_actor_",
    "render_atmosphere_",
    "render_overlay_",
  ]

  requiredTokens.forEach((token) => {
    assert(combined.includes(token), `Missing required token: ${token}`)
  })

  assert(indexSource.includes("./pixel-worldview-render-types"), "PixelWorldView render types public export is missing.")
  assert(indexSource.includes("./pixel-worldview-render-planner"), "PixelWorldView render planner public export is missing.")
  assert(indexSource.includes("./pixel-worldview-render-validator"), "PixelWorldView render validator public export is missing.")

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
    "data:image/svg",
    "<svg",
    "<canvas",
    "CanvasRenderingContext2D",
    "getContext(",
  ]
  const forbiddenHits = forbiddenTokens.filter((token) => combined.includes(token))
  assert(forbiddenHits.length === 0, `PixelWorldView render plan contains forbidden dependencies: ${forbiddenHits.join(", ")}`)

  console.log("PIXEL WORLDVIEW RENDER PLAN SMOKE")
  console.log("PixelWorldView render types exist: ok")
  console.log("PixelWorldView render planner exists: ok")
  console.log("PixelWorldView render validator exists: ok")
  console.log("PixelWorldView render public exports exist: ok")
  console.log("Runtime boundary: ok")
  console.log("No SVG or canvas renderer dependency: ok")
  console.log("No default pet generation: ok")
  console.log("Result: PASS")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
