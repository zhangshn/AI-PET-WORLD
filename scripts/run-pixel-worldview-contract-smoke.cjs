async function main() {
  const fs = await import("node:fs")
  const path = await import("node:path")

  const repoRoot = process.cwd()

  function fail(message) {
    console.log("PIXEL WORLDVIEW CONTRACT SMOKE")
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
  assert(fs.existsSync(contractDir), "PixelWorldView contract directory is missing.")

  const typesSource = readFile(path.join(contractDir, "pixel-worldview-types.ts"), "PixelWorldView model types")
  const modelSource = readFile(path.join(contractDir, "pixel-worldview-model.ts"), "PixelWorldView empty model factory")
  const validatorSource = readFile(path.join(contractDir, "pixel-worldview-validator.ts"), "PixelWorldView validator")
  const indexSource = readFile(path.join(contractDir, "index.ts"), "PixelWorldView index")
  const packageSource = readFile(path.join(repoRoot, "package.json"), "package.json")
  const combined = [typesSource, modelSource, validatorSource, indexSource].join("\n")

  const requiredTokens = [
    "PixelWorldViewModel",
    "PixelWorldTile",
    "PixelWorldTrace",
    "PixelWorldObject",
    "PixelWorldActor",
    "PixelWorldAtmosphere",
    "PixelWorldOverlay",
    "createEmptyPixelWorldViewModel",
    "validatePixelWorldViewModel",
    "overlay_p_phone",
  ]

  requiredTokens.forEach((token) => {
    assert(combined.includes(token), `Missing required token: ${token}`)
  })

  assert(packageSource.includes("smoke:pixel-worldview-contract"), "Package smoke script is missing.")

  const forbiddenTokens = [
    "buildSceneSvg",
    "data:image/svg",
    "WorldPainterReadonlyPreview",
    "ProceduralRendererView",
    "FormalWorldView",
    "runAndPersistOneRuntimeTick",
    "writeWorldRuntimeSaveRecord",
    "createPet",
    "pet_default",
    "roadGraph",
    "pathGraph",
  ]
  const forbiddenHits = forbiddenTokens.filter((token) => combined.includes(token))
  assert(forbiddenHits.length === 0, `PixelWorldView contract contains forbidden dependencies: ${forbiddenHits.join(", ")}`)

  console.log("PIXEL WORLDVIEW CONTRACT SMOKE")
  console.log("PixelWorldView contract directory exists: ok")
  console.log("PixelWorldView model types exist: ok")
  console.log("PixelWorldView empty model factory exists: ok")
  console.log("PixelWorldView validator exists: ok")
  console.log("Package smoke script exists: ok")
  console.log("Runtime boundary: ok")
  console.log("No SVG formal renderer dependency: ok")
  console.log("No default pet generation: ok")
  console.log("Result: PASS")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
