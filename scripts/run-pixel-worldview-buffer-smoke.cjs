async function main() {
  const fs = await import("node:fs")
  const path = await import("node:path")

  const repoRoot = process.cwd()

  function fail(message) {
    console.log("PIXEL WORLDVIEW BUFFER SMOKE")
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
  const typesSource = readFile(path.join(contractDir, "pixel-worldview-buffer-types.ts"), "PixelWorldView buffer types")
  const builderSource = readFile(path.join(contractDir, "pixel-worldview-buffer-builder.ts"), "PixelWorldView buffer builder")
  const validatorSource = readFile(
    path.join(contractDir, "pixel-worldview-buffer-validator.ts"),
    "PixelWorldView buffer validator"
  )
  const demoSource = readFile(path.join(contractDir, "pixel-worldview-buffer-demo.ts"), "PixelWorldView buffer demo")
  const indexSource = readFile(path.join(contractDir, "index.ts"), "PixelWorldView index")
  const packageSource = readFile(path.join(repoRoot, "package.json"), "package.json")
  const combined = [typesSource, builderSource, validatorSource, demoSource, indexSource, packageSource].join("\n")

  const requiredTokens = [
    "PixelWorldPixelBufferFrame",
    "PixelWorldBufferCell",
    "PixelWorldBufferLayer",
    "PixelWorldBufferBuildResult",
    "buildPixelWorldPixelBufferFrame",
    "validatePixelWorldPixelBufferFrame",
    "createMinimalPixelWorldPixelBufferResult",
    "buffer_cell_",
    "pixel_world_buffer_",
    "object_marker",
    "actor_marker",
    "overlay_marker",
    "colorHint",
    "cellCount",
    "visibleCount",
    "hiddenCount",
  ]

  requiredTokens.forEach((token) => {
    assert(combined.includes(token), `Missing required token: ${token}`)
  })

  assert(indexSource.includes("./pixel-worldview-buffer-types"), "PixelWorldView buffer types public export is missing.")
  assert(indexSource.includes("./pixel-worldview-buffer-builder"), "PixelWorldView buffer builder public export is missing.")
  assert(indexSource.includes("./pixel-worldview-buffer-validator"), "PixelWorldView buffer validator public export is missing.")
  assert(indexSource.includes("./pixel-worldview-buffer-demo"), "PixelWorldView buffer demo public export is missing.")
  assert(packageSource.includes("smoke:pixel-worldview-buffer"), "Package smoke script is missing.")

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
  assert(forbiddenHits.length === 0, `PixelWorldView buffer contains forbidden dependencies: ${forbiddenHits.join(", ")}`)

  console.log("PIXEL WORLDVIEW BUFFER SMOKE")
  console.log("PixelWorldView buffer types exist: ok")
  console.log("PixelWorldView buffer builder exists: ok")
  console.log("PixelWorldView buffer validator exists: ok")
  console.log("PixelWorldView buffer demo exists: ok")
  console.log("PixelWorldView buffer public exports exist: ok")
  console.log("Runtime boundary: ok")
  console.log("No SVG or canvas renderer dependency: ok")
  console.log("No default pet generation: ok")
  console.log("Result: PASS")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
