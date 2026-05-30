async function main() {
  const fs = await import("node:fs")
  const path = await import("node:path")

  const repoRoot = process.cwd()
  const viewPath = path.join(repoRoot, "src", "app", "world", "components", "formal-pixel-svg-view", "formal-pixel-svg-view.tsx")
  const cssPath = path.join(repoRoot, "src", "app", "world", "components", "formal-pixel-svg-view", "formal-pixel-svg-view.module.css")
  const pixelWorldViewPath = path.join(repoRoot, "src", "app", "world", "components", "pixel-world-view", "pixel-world-view.tsx")
  const worldPagePath = path.join(repoRoot, "src", "app", "world", "world-live-runtime-page.tsx")

  function fail(message) {
    console.log("FORMAL PIXEL SVG VIEW BOUNDARY SMOKE")
    console.log(message)
    console.log("Result: FAIL")
    process.exit(1)
  }

  function assert(condition, message) {
    if (!condition) fail(message)
  }

  function read(filePath, label) {
    if (!fs.existsSync(filePath)) fail(`${label} is missing.`)
    return fs.readFileSync(filePath, "utf8")
  }

  const viewSource = read(viewPath, "formal pixel svg view")
  const cssSource = read(cssPath, "formal pixel svg view css")
  const pixelWorldSource = read(pixelWorldViewPath, "pixel world view")
  const worldPageSource = read(worldPagePath, "world page")

  const requiredTokens = [
    "FormalPixelSvgView",
    "FormalPixelRenderModel",
    "buildFormalPixelSvg",
    "data-formal-pixel-svg-view",
  ]
  requiredTokens.forEach((token) => {
    assert(viewSource.includes(token), `FormalPixelSvgView is missing token: ${token}`)
  })

  const forbiddenTokens = [
    "readWorldRuntimeForView",
    "writeWorldRuntimeSaveRecord",
    "runAndPersistOneRuntimeTick",
    "buildWorldViewModelForPixelWorld",
    "pixel-visual-lab",
    "procedural-renderer",
    "scene-composer-gateway",
  ]
  const forbiddenHits = forbiddenTokens.filter((token) => viewSource.includes(token))
  assert(forbiddenHits.length === 0, `FormalPixelSvgView contains forbidden token: ${forbiddenHits.join(", ")}`)

  assert(cssSource.includes("image-rendering: pixelated"), "FormalPixelSvgView CSS is missing pixelated rendering.")
  assert(pixelWorldSource.includes("data-surface-state=\"cleared\""), "PixelWorldView is no longer cleared.")
  assert(!pixelWorldSource.includes("FormalPixelSvgView"), "PixelWorldView should not mount FormalPixelSvgView yet.")
  assert(!worldPageSource.includes("FormalPixelSvgView"), "Formal /world should not mount FormalPixelSvgView yet.")

  console.log("FORMAL PIXEL SVG VIEW BOUNDARY SMOKE")
  console.log("FormalPixelSvgView exists: ok")
  console.log("FormalPixelSvgView model boundary: ok")
  console.log("Runtime boundary: ok")
  console.log("PixelWorldView remains cleared: ok")
  console.log("Formal /world not mounted yet: ok")
  console.log("Result: PASS")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
