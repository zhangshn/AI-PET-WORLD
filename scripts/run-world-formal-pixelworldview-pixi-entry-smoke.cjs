async function main() {
  const fs = await import("node:fs")
  const path = await import("node:path")

  const repoRoot = process.cwd()

  function fail(message) {
    console.log("WORLD FORMAL PIXELWORLDVIEW PIXI ENTRY SMOKE")
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

  const formalWorldDir = path.join(repoRoot, "src", "app", "world")
  const rendererSource = readFile(
    path.join(
      formalWorldDir,
      "components",
      "formal-pixi-pixel-world-renderer",
      "formal-pixi-pixel-world-renderer.client.tsx"
    ),
    "Formal Pixi PixelWorld renderer"
  )
  const rendererStyles = readFile(
    path.join(
      formalWorldDir,
      "components",
      "formal-pixi-pixel-world-renderer",
      "formal-pixi-pixel-world-renderer.module.css"
    ),
    "Formal Pixi PixelWorld renderer styles"
  )
  const readonlyEntrySource = readFile(
    path.join(
      formalWorldDir,
      "components",
      "pixel-worldview-readonly-entry",
      "pixel-worldview-readonly-entry.tsx"
    ),
    "PixelWorldView readonly entry"
  )
  const packageSource = readFile(path.join(repoRoot, "package.json"), "package.json")
  const formalWorldCombined = readDirectorySources(formalWorldDir).join("\n")
  const combined = [rendererSource, rendererStyles, readonlyEntrySource, packageSource].join("\n")

  const requiredTokens = [
    "pixi.js",
    "Application",
    "Container",
    "Graphics",
    "FormalPixiPixelWorldRendererClient",
    "PixelWorldPixelBufferFrame",
    "app.init",
    "app.canvas",
    "appendChild",
    "graphics.rect",
    "fill",
    "parseColorHintToNumber",
    "clampOpacity",
    "正式 PixiJS PixelWorldView Renderer",
    "PixelWorldView 正式像素世界",
    "只消费 PixelWorldPixelBufferFrame",
    "不推进 Tick",
    "不写入 runtime",
    "不生成默认宠物",
    "image-rendering: pixelated",
  ]
  requiredTokens.forEach((token) => {
    assert(combined.includes(token), `Missing formal Pixi entry token: ${token}`)
  })

  assert(
    packageSource.includes("smoke:world-formal-pixelworldview-pixi-entry"),
    "Formal Pixi entry smoke package script is missing."
  )

  const forbiddenFormalWorldTokens = [
    "data:image/svg",
    "<svg",
    "<canvas",
    "CanvasRenderingContext2D",
    "getContext(",
    "dangerouslySetInnerHTML",
    "backgroundColor",
    "gridTemplateColumns",
    'position: "absolute"',
    "position: 'absolute'",
    "position:absolute",
    "buildSceneSvg",
    "buildFormalPixelSvg",
    "buildFormalPixelRenderModel",
    "WorldPainterReadonlyPreview",
    "ProceduralRendererView",
    "FormalWorldView",
    "runAndPersistOneRuntimeTick",
    "writeWorldRuntimeSaveRecord",
    "createPet",
  ]
  const forbiddenHits = forbiddenFormalWorldTokens.filter((token) => formalWorldCombined.includes(token))
  assert(forbiddenHits.length === 0, `Formal /world contains forbidden tokens: ${forbiddenHits.join(", ")}`)

  console.log("WORLD FORMAL PIXELWORLDVIEW PIXI ENTRY SMOKE")
  console.log("Formal Pixi PixelWorld renderer exists: ok")
  console.log("Formal Pixi PixelWorld renderer uses PixiJS: ok")
  console.log("Formal Pixi PixelWorld renderer consumes PixelBufferFrame: ok")
  console.log("Formal /world mounts Pixi renderer: ok")
  console.log("Runtime remains read-only: ok")
  console.log("No SVG formal entry dependency: ok")
  console.log("No hand-written canvas context usage: ok")
  console.log("No CSS geometry formal world preview: ok")
  console.log("No default pet generation: ok")
  console.log("Result: PASS")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
