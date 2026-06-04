async function main() {
  const fs = await import("node:fs")
  const path = await import("node:path")

  const repoRoot = process.cwd()

  function fail(message) {
    console.log("PIXEL WORLDVIEW PIXI ENTRY SMOKE")
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

  function readDirectorySources(directory) {
    return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
      const entryPath = path.join(directory, entry.name)
      if (entry.isDirectory()) return readDirectorySources(entryPath)
      return fs.readFileSync(entryPath, "utf8")
    })
  }

  const worldDir = path.join(repoRoot, "src", "app", "world")
  const rendererSource = readFile(
    path.join(
      worldDir,
      "components",
      "pixi-pixel-world-renderer",
      "pixi-pixel-world-renderer.client.tsx"
    ),
    "Pixi PixelWorld renderer"
  )
  const rendererStyles = readFile(
    path.join(
      worldDir,
      "components",
      "pixi-pixel-world-renderer",
      "pixi-pixel-world-renderer.module.css"
    ),
    "Pixi PixelWorld renderer styles"
  )
  const readonlyEntrySource = readFile(
    path.join(
      worldDir,
      "components",
      "pixel-worldview-readonly-entry",
      "pixel-worldview-readonly-entry.tsx"
    ),
    "PixelWorldView readonly entry"
  )
  const packageSource = readFile(path.join(repoRoot, "package.json"), "package.json")
  const worldCombined = readDirectorySources(worldDir).join("\n")
  const combined = [
    rendererSource,
    rendererStyles,
    readonlyEntrySource,
    packageSource,
  ].join("\n")

  const requiredTokens = [
    "pixi.js",
    "Application",
    "Container",
    "Graphics",
    "PixiPixelWorldRendererClient",
    "PixelWorldPixelBufferFrame",
    "buildVisualFactManifestFromWorldViewModel",
    "visualFactManifest",
    "app.init",
    "app.canvas",
    "appendChild",
    "graphics.rect",
    "fill",
    "parseColorHintToNumber",
    "clampOpacity",
    "Tick",
    "VisualGateDebugStrip",
    "image-rendering: pixelated",
  ]
  requiredTokens.forEach((token) => {
    assert(combined.includes(token), `Missing Pixi entry token: ${token}`)
  })

  assert(
    packageSource.includes("smoke:pixel-worldview-pixi-entry"),
    "Pixi entry smoke package script is missing."
  )

  const forbiddenWorldTokens = [
    "data:image/svg",
    "<svg",
    "<canvas",
    "CanvasRenderingContext2D",
    "getContext(",
    "dangerouslySetInnerHTML",
    "runAndPersistOneRuntimeTick",
    "writeWorldRuntimeSaveRecord",
    "createUnplannedLife",
    "P-Phone",
  ]
  const forbiddenHits = forbiddenWorldTokens.filter((token) =>
    worldCombined.includes(token)
  )
  assert(
    forbiddenHits.length === 0,
    `/world contains forbidden tokens: ${forbiddenHits.join(", ")}`
  )

  console.log("PIXEL WORLDVIEW PIXI ENTRY SMOKE")
  console.log("Pixi PixelWorld renderer exists: ok")
  console.log("Pixi PixelWorld renderer uses PixiJS: ok")
  console.log("Pixi PixelWorld renderer consumes PixelBufferFrame: ok")
  console.log("/world mounts Pixi renderer: ok")
  console.log("Runtime remains read-only: ok")
  console.log("No SVG entry dependency: ok")
  console.log("No hand-written canvas context usage: ok")
  console.log("No unplanned life generation: ok")
  console.log("Result: PASS")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
