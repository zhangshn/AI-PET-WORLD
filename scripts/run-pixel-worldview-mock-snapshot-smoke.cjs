async function main() {
  const fs = await import("node:fs")
  const path = await import("node:path")

  const repoRoot = process.cwd()

  function fail(message) {
    console.log("PIXEL WORLDVIEW MOCK SNAPSHOT SMOKE")
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
  const mockSource = readFile(path.join(contractDir, "pixel-worldview-mock-snapshot.ts"), "PixelWorldView mock snapshot")
  const indexSource = readFile(path.join(contractDir, "index.ts"), "PixelWorldView index")
  const combined = [mockSource, indexSource].join("\n")

  const requiredTokens = [
    "createMinimalPixelWorldSourceSnapshot",
    "createMinimalPixelWorldViewModel",
    "mapPixelWorldViewModelFromSnapshot",
    "mock_pixel_world",
    "natural_tree_object_recipe",
    "natural_grass_tile_recipe",
    "natural_stone_object_recipe",
    "natural_insect_signal_recipe",
    "actor_mock_butler",
    "atmosphere_mock_time_light",
  ]

  requiredTokens.forEach((token) => {
    assert(combined.includes(token), `Missing required token: ${token}`)
  })

  assert(indexSource.includes("./pixel-worldview-mock-snapshot"), "PixelWorldView mock snapshot public export is missing.")

  const forbiddenTokens = [
    "src/app/world/",
    'kind: "pet"',
    "pet_default",
    "createPet",
    "WorldRuntimeSaveRecord",
    "HomeMapState",
    "TraceField",
    "ButlerState",
    "readWorldRuntimeForView",
    "writeWorldRuntimeSaveRecord",
    "runAndPersistOneRuntimeTick",
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
  assert(forbiddenHits.length === 0, `PixelWorldView mock snapshot contains forbidden dependencies: ${forbiddenHits.join(", ")}`)

  console.log("PIXEL WORLDVIEW MOCK SNAPSHOT SMOKE")
  console.log("PixelWorldView mock snapshot exists: ok")
  console.log("Minimal source snapshot factory exists: ok")
  console.log("Minimal view model factory exists: ok")
  console.log("Natural object recipe ids exist: ok")
  console.log("Mock butler exists without default pet: ok")
  console.log("Runtime boundary: ok")
  console.log("No SVG formal renderer dependency: ok")
  console.log("Result: PASS")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
