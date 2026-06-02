async function main() {
  const fs = await import("node:fs")
  const path = await import("node:path")

  const repoRoot = process.cwd()

  function fail(message) {
    console.log("WORLD FORMAL PIXELWORLDVIEW RENDERER SHELL SMOKE")
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

  const shellSource = readFile(
    path.join(repoRoot, "src", "world", "pixel-worldview", "world-formal-pixelworldview-renderer-shell.ts"),
    "Formal PixelWorldView renderer shell"
  )
  const validatorSource = readFile(
    path.join(
      repoRoot,
      "src",
      "world",
      "pixel-worldview",
      "world-formal-pixelworldview-renderer-shell-validator.ts"
    ),
    "Formal PixelWorldView renderer shell validator"
  )
  const demoSource = readFile(
    path.join(repoRoot, "src", "world", "pixel-worldview", "world-formal-pixelworldview-renderer-shell-demo.ts"),
    "Formal PixelWorldView renderer shell demo"
  )
  const shellScriptSource = readFile(
    path.join(repoRoot, "scripts", "run-world-formal-pixelworldview-renderer-shell.cjs"),
    "Formal PixelWorldView renderer shell script"
  )
  const readonlyEntrySource = readFile(
    path.join(
      repoRoot,
      "src",
      "app",
      "world",
      "components",
      "pixel-worldview-readonly-entry",
      "pixel-worldview-readonly-entry.tsx"
    ),
    "PixelWorldView readonly entry"
  )
  const packageSource = readFile(path.join(repoRoot, "package.json"), "package.json")
  const indexSource = readFile(path.join(repoRoot, "src", "world", "pixel-worldview", "index.ts"), "PixelWorldView index")
  const formalWorldCombined = readDirectorySources(path.join(repoRoot, "src", "app", "world")).join("\n")
  const combined = [
    shellSource,
    validatorSource,
    demoSource,
    shellScriptSource,
    readonlyEntrySource,
    packageSource,
    indexSource,
  ].join("\n")

  const requiredTokens = [
    "WorldFormalPixelWorldRendererShellState",
    "WorldFormalPixelWorldRendererShellLayerState",
    "WorldFormalPixelWorldRendererShellSafetyState",
    "WORLD_FORMAL_PIXELWORLDVIEW_RENDERER_SHELL_ID",
    "buildWorldFormalPixelWorldRendererShellState",
    "validateWorldFormalPixelWorldRendererShellState",
    "createMinimalWorldFormalPixelWorldRendererShellState",
    "Formal Renderer Shell",
    "renderer contract ready",
    "readonly shell",
    "不绘制世界",
    "不读取 runtime",
    "不生成默认宠物",
    "不使用 SVG",
    "不使用 canvas",
    "不使用 CSS 几何模拟世界",
    "runtimeReadonly",
    "noDefaultPet",
    "noSvg",
    "noCanvasDom",
    "noCssGeometry",
    "noDebugPanelImport",
    "Formal PixelWorldView renderer shell exists",
    "Formal renderer shell safety exists",
  ]
  requiredTokens.forEach((token) => {
    assert(combined.includes(token), `Missing renderer shell smoke token: ${token}`)
  })

  const requiredExports = [
    "./world-formal-pixelworldview-renderer-shell",
    "./world-formal-pixelworldview-renderer-shell-validator",
    "./world-formal-pixelworldview-renderer-shell-demo",
  ]
  requiredExports.forEach((token) => {
    assert(indexSource.includes(token), `Formal renderer shell public export is missing: ${token}`)
  })
  assert(
    packageSource.includes("shell:world-formal-pixelworldview-renderer"),
    "Formal PixelWorldView renderer shell package script is missing."
  )
  assert(
    packageSource.includes("smoke:world-formal-pixelworldview-renderer-shell"),
    "Formal PixelWorldView renderer shell smoke package script is missing."
  )

  const forbiddenCallTokens = [
    "runAndPersistOneRuntimeTick(",
    "writeWorldRuntimeSaveRecord(",
    "createPet(",
    "buildSceneSvg(",
    "buildFormalPixelSvg(",
    "buildFormalPixelRenderModel(",
    "WorldPainterReadonlyPreview(",
    "ProceduralRendererView(",
    "FormalWorldView(",
    "getContext(",
    "dangerouslySetInnerHTML(",
  ]
  const forbiddenHits = forbiddenCallTokens.filter((token) => combined.includes(token))
  assert(forbiddenHits.length === 0, `Renderer shell contains forbidden calls: ${forbiddenHits.join(", ")}`)

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
    "runAndPersistOneRuntimeTick",
    "writeWorldRuntimeSaveRecord",
    "createPet",
  ]
  const forbiddenFormalWorldHits = forbiddenFormalWorldTokens.filter((token) => formalWorldCombined.includes(token))
  assert(
    forbiddenFormalWorldHits.length === 0,
    `Formal /world contains forbidden tokens: ${forbiddenFormalWorldHits.join(", ")}`
  )

  console.log("WORLD FORMAL PIXELWORLDVIEW RENDERER SHELL SMOKE")
  console.log("Formal PixelWorldView renderer shell definition exists: ok")
  console.log("Formal PixelWorldView renderer shell validator exists: ok")
  console.log("Formal PixelWorldView renderer shell demo exists: ok")
  console.log("Formal PixelWorldView renderer shell script exists: ok")
  console.log("Formal /world displays renderer shell readiness: ok")
  console.log("Formal renderer shell public export exists: ok")
  console.log("Runtime boundary: ok")
  console.log("No renderer dependency call: ok")
  console.log("No CSS geometry formal world preview: ok")
  console.log("No default pet generation: ok")
  console.log("Result: PASS")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
