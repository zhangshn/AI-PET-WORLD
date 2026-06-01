async function main() {
  const fs = await import("node:fs")
  const path = await import("node:path")

  const repoRoot = process.cwd()

  function fail(message) {
    console.log("PIXEL WORLDVIEW MAPPER SMOKE")
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
  const sourceSource = readFile(path.join(contractDir, "pixel-worldview-source.ts"), "PixelWorldView source snapshot types")
  const mapperSource = readFile(path.join(contractDir, "pixel-worldview-mapper.ts"), "PixelWorldView mapper")
  const modelSource = readFile(path.join(contractDir, "pixel-worldview-model.ts"), "PixelWorldView empty model factory")
  const indexSource = readFile(path.join(contractDir, "index.ts"), "PixelWorldView index")
  const combined = [sourceSource, mapperSource, modelSource, indexSource].join("\n")

  const requiredTokens = [
    "PixelWorldSourceSnapshot",
    "PixelWorldSourceTile",
    "PixelWorldSourceTrace",
    "PixelWorldSourceObject",
    "PixelWorldSourceActor",
    "mapPixelWorldViewModelFromSnapshot",
    "createEmptyPixelWorldViewModel",
    "tile_",
    "trace_",
    "object_",
    "actor_",
    "overlay_p_phone",
  ]

  requiredTokens.forEach((token) => {
    assert(combined.includes(token), `Missing required token: ${token}`)
  })

  assert(indexSource.includes("./pixel-worldview-source"), "PixelWorldView source snapshot public export is missing.")
  assert(indexSource.includes("./pixel-worldview-mapper"), "PixelWorldView mapper public export is missing.")

  const forbiddenTokens = [
    "WorldRuntimeSaveRecord",
    "HomeMapState",
    "TraceField",
    "ButlerState",
    "readWorldRuntimeForView",
    "writeWorldRuntimeSaveRecord",
    "runAndPersistOneRuntimeTick",
    "createPet",
    "pet_default",
    "buildSceneSvg",
    "data:image/svg",
    "WorldPainterReadonlyPreview",
    "ProceduralRendererView",
    "FormalWorldView",
    "roadGraph",
    "pathGraph",
  ]
  const forbiddenHits = forbiddenTokens.filter((token) => combined.includes(token))
  assert(forbiddenHits.length === 0, `PixelWorldView mapper contains forbidden dependencies: ${forbiddenHits.join(", ")}`)

  console.log("PIXEL WORLDVIEW MAPPER SMOKE")
  console.log("PixelWorldView source snapshot types exist: ok")
  console.log("PixelWorldView mapper exists: ok")
  console.log("PixelWorldView mapper public export exists: ok")
  console.log("Runtime boundary: ok")
  console.log("No default pet generation: ok")
  console.log("No SVG formal renderer dependency: ok")
  console.log("Result: PASS")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
