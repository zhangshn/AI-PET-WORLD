async function main() {
  const fs = await import("node:fs")
  const path = await import("node:path")

  const repoRoot = process.cwd()

  function fail(message) {
    console.log("PIXEL WORLDVIEW BUFFER PALETTE SMOKE")
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
  const paletteSource = readFile(path.join(contractDir, "pixel-worldview-buffer-palette.ts"), "PixelWorldView buffer palette")
  const builderSource = readFile(path.join(contractDir, "pixel-worldview-buffer-builder.ts"), "PixelWorldView buffer builder")
  const validatorSource = readFile(
    path.join(contractDir, "pixel-worldview-buffer-validator.ts"),
    "PixelWorldView buffer validator"
  )
  const indexSource = readFile(path.join(contractDir, "index.ts"), "PixelWorldView index")
  const packageSource = readFile(path.join(repoRoot, "package.json"), "package.json")
  const combined = [paletteSource, builderSource, validatorSource, indexSource, packageSource].join("\n")

  const requiredTokens = [
    "PixelWorldBufferColorToken",
    "PixelWorldBufferPaletteEntry",
    "PIXEL_WORLD_BUFFER_PALETTE",
    "resolvePixelWorldBufferColorHint",
    "grass_tile",
    "pressed_trace",
    "natural_object",
    "actor_marker",
    "atmosphere_tint",
    "overlay_label",
    "fallback",
    "colorHint",
    '"#5f8f4e"',
    '"#8a6a3f"',
    '"#4f6f3f"',
    '"#d6b26f"',
    '"#8fb6ff"',
    '"#ffffff"',
    '"#ff00ff"',
  ]

  requiredTokens.forEach((token) => {
    assert(combined.includes(token), `Missing required token: ${token}`)
  })

  assert(builderSource.includes("resolvePixelWorldBufferColorHint"), "PixelWorldView buffer builder does not use palette resolver.")
  assert(validatorSource.includes('cell.colorHint.startsWith("#")'), "PixelWorldView buffer validator does not check color hints.")
  assert(indexSource.includes("./pixel-worldview-buffer-palette"), "PixelWorldView buffer palette public export is missing.")
  assert(packageSource.includes("smoke:pixel-worldview-buffer-palette"), "Package smoke script is missing.")

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
  assert(forbiddenHits.length === 0, `PixelWorldView buffer palette contains forbidden dependencies: ${forbiddenHits.join(", ")}`)

  console.log("PIXEL WORLDVIEW BUFFER PALETTE SMOKE")
  console.log("PixelWorldView buffer palette exists: ok")
  console.log("PixelWorldView buffer palette resolver exists: ok")
  console.log("PixelWorldView buffer builder uses palette resolver: ok")
  console.log("PixelWorldView buffer validator checks color hints: ok")
  console.log("PixelWorldView buffer palette public export exists: ok")
  console.log("Runtime boundary: ok")
  console.log("No SVG or canvas renderer dependency: ok")
  console.log("No default pet generation: ok")
  console.log("Result: PASS")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
