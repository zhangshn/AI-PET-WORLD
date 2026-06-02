async function main() {
  const fs = await import("node:fs")
  const path = await import("node:path")

  const repoRoot = process.cwd()

  function fail(message) {
    console.log("PIXEL WORLDVIEW RENDERER BOUNDARY SMOKE")
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
  const typesSource = readFile(path.join(contractDir, "pixel-worldview-renderer-types.ts"), "PixelWorldView renderer types")
  const boundarySource = readFile(
    path.join(contractDir, "pixel-worldview-renderer-boundary.ts"),
    "PixelWorldView renderer boundary"
  )
  const validatorSource = readFile(
    path.join(contractDir, "pixel-worldview-renderer-validator.ts"),
    "PixelWorldView renderer validator"
  )
  const demoSource = readFile(path.join(contractDir, "pixel-worldview-renderer-demo.ts"), "PixelWorldView renderer demo")
  const indexSource = readFile(path.join(contractDir, "index.ts"), "PixelWorldView index")
  const packageSource = readFile(path.join(repoRoot, "package.json"), "package.json")
  const combined = [typesSource, boundarySource, validatorSource, demoSource, indexSource, packageSource].join("\n")

  const requiredTokens = [
    "PixelWorldRendererFrame",
    "PixelWorldRendererFrameLayer",
    "PixelWorldRendererSafety",
    "PixelWorldRendererResult",
    "buildPixelWorldRendererFrame",
    "validatePixelWorldRendererFrame",
    "createMinimalPixelWorldRendererResult",
    "headless_plan",
    "debug_headless",
    "allowSvg: false",
    "allowCanvasDom: false",
    "allowCssGeometry: false",
    "allowRuntimeWrite: false",
    "allowDefaultPet: false",
    "sourcePlanCommandCount",
    "visibleCount",
    "hiddenCount",
  ]

  requiredTokens.forEach((token) => {
    assert(combined.includes(token), `Missing required token: ${token}`)
  })

  assert(indexSource.includes("./pixel-worldview-renderer-types"), "PixelWorldView renderer types public export is missing.")
  assert(indexSource.includes("./pixel-worldview-renderer-boundary"), "PixelWorldView renderer boundary public export is missing.")
  assert(indexSource.includes("./pixel-worldview-renderer-validator"), "PixelWorldView renderer validator public export is missing.")
  assert(indexSource.includes("./pixel-worldview-renderer-demo"), "PixelWorldView renderer demo public export is missing.")
  assert(packageSource.includes("smoke:pixel-worldview-renderer-boundary"), "Package smoke script is missing.")

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
    'kind: "pet"',
    "data:image/svg",
    "<svg",
    "<canvas",
    "CanvasRenderingContext2D",
    "getContext(",
  ]
  const forbiddenHits = forbiddenTokens.filter((token) => combined.includes(token))
  assert(forbiddenHits.length === 0, `PixelWorldView renderer boundary contains forbidden dependencies: ${forbiddenHits.join(", ")}`)

  console.log("PIXEL WORLDVIEW RENDERER BOUNDARY SMOKE")
  console.log("PixelWorldView renderer types exist: ok")
  console.log("PixelWorldView renderer boundary exists: ok")
  console.log("PixelWorldView renderer validator exists: ok")
  console.log("PixelWorldView renderer demo exists: ok")
  console.log("PixelWorldView renderer public exports exist: ok")
  console.log("Runtime boundary: ok")
  console.log("No SVG or canvas renderer dependency: ok")
  console.log("No default pet generation: ok")
  console.log("Result: PASS")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
