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

  const requiredViewTokens = [
    "FormalPixelSvgView",
    "FormalPixelRenderModel",
    "buildFormalPixelSvg",
    "data-formal-pixel-svg-view",
  ]
  requiredViewTokens.forEach((token) => {
    assert(viewSource.includes(token), `FormalPixelSvgView is missing token: ${token}`)
  })

  const forbiddenViewTokens = [
    "readWorldRuntimeForView",
    "writeWorldRuntimeSaveRecord",
    "runAndPersistOneRuntimeTick",
    "buildWorldViewModelForPixelWorld",
    "pixel-visual-lab",
    "procedural-renderer",
    "scene-composer-gateway",
  ]
  const forbiddenViewHits = forbiddenViewTokens.filter((token) => viewSource.includes(token))
  assert(forbiddenViewHits.length === 0, `FormalPixelSvgView contains forbidden token: ${forbiddenViewHits.join(", ")}`)

  const requiredWorldPageTokens = [
    "readWorldRuntimeForView",
    "buildWorldViewModelForPixelWorld",
    "buildFormalPixelRenderModel",
    "FormalPixelSvgView",
    "<FormalPixelSvgView model={formalPixelRenderModel} />",
  ]
  requiredWorldPageTokens.forEach((token) => {
    assert(worldPageSource.includes(token), `Formal /world is missing mounted renderer token: ${token}`)
  })

  const forbiddenWorldPageTokens = [
    "writeWorldRuntimeSaveRecord",
    "runAndPersistOneRuntimeTick",
    "runTraceLifecycleTick",
    "pixel-visual-lab",
    "procedural-renderer",
    "scene-composer-gateway",
    "buildSceneSvg",
    "createPet",
    "pet_default",
  ]
  const forbiddenWorldHits = forbiddenWorldPageTokens.filter((token) => worldPageSource.includes(token))
  assert(forbiddenWorldHits.length === 0, `Formal /world contains forbidden token: ${forbiddenWorldHits.join(", ")}`)

  assert(cssSource.includes("image-rendering: pixelated"), "FormalPixelSvgView CSS is missing pixelated rendering.")
  assert(pixelWorldSource.includes("data-surface-state=\"cleared\""), "Legacy PixelWorldView should remain inert and cleared.")
  assert(!pixelWorldSource.includes("FormalPixelSvgView"), "Legacy PixelWorldView should not mount FormalPixelSvgView directly.")

  console.log("FORMAL PIXEL SVG VIEW BOUNDARY SMOKE")
  console.log("FormalPixelSvgView exists: ok")
  console.log("FormalPixelSvgView model boundary: ok")
  console.log("Runtime boundary: ok")
  console.log("Formal /world mounted renderer: ok")
  console.log("Legacy PixelWorldView remains inert: ok")
  console.log("Result: PASS")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
