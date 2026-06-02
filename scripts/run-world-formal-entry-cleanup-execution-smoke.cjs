async function main() {
  const fs = await import("node:fs")
  const path = await import("node:path")

  const repoRoot = process.cwd()

  function fail(message) {
    console.log("WORLD FORMAL ENTRY CLEANUP EXECUTION SMOKE")
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
      return [{ filePath: entryPath, source: fs.readFileSync(entryPath, "utf8") }]
    })
  }

  const formalWorldDir = path.join(repoRoot, "src", "app", "world")
  const livePageSource = readFile(path.join(formalWorldDir, "world-live-runtime-page.tsx"), "Formal /world live page")
  const readonlyEntrySource = readFile(
    path.join(
      formalWorldDir,
      "components",
      "pixel-worldview-readonly-entry",
      "pixel-worldview-readonly-entry.tsx"
    ),
    "PixelWorldView readonly entry"
  )
  const sourceAdapterSource = readFile(
    path.join(repoRoot, "src", "world", "pixel-worldview", "world-view-model-to-pixel-worldview-source.ts"),
    "PixelWorldView source adapter"
  )
  const indexSource = readFile(path.join(repoRoot, "src", "world", "pixel-worldview", "index.ts"), "PixelWorldView index")
  const packageSource = readFile(path.join(repoRoot, "package.json"), "package.json")
  const formalWorldSources = readDirectorySources(formalWorldDir)
  const formalWorldCombined = formalWorldSources.map(({ source }) => source).join("\n")
  const combined = [livePageSource, readonlyEntrySource, sourceAdapterSource, indexSource, packageSource].join("\n")

  const removedFiles = [
    path.join(formalWorldDir, "components", "formal-pixel-svg-view", "formal-pixel-svg-view.tsx"),
    path.join(formalWorldDir, "components", "formal-pixel-svg-view", "formal-pixel-svg-view.module.css"),
  ]
  removedFiles.forEach((filePath) => {
    assert(!fs.existsSync(filePath), `Legacy formal SVG file still exists: ${filePath}`)
  })

  const requiredTokens = [
    "PixelWorldViewReadonlyEntry",
    "mapWorldViewModelToPixelWorldSourceSnapshot",
    "mapPixelWorldViewModelFromSnapshot",
    "buildPixelWorldRenderPlan",
    "buildPixelWorldRendererFrame",
    "buildPixelWorldPixelBufferFrame",
    "validatePixelWorldViewModel",
    "validatePixelWorldRenderPlan",
    "validatePixelWorldRendererFrame",
    "validatePixelWorldPixelBufferFrame",
    "PixelWorldView 正式只读入口",
    "不推进 Tick",
    "不写入 runtime",
    "不生成默认宠物",
  ]
  requiredTokens.forEach((token) => {
    assert(combined.includes(token), `Missing required token: ${token}`)
  })

  assert(
    indexSource.includes("./world-view-model-to-pixel-worldview-source"),
    "PixelWorldView source adapter public export is missing."
  )
  assert(
    packageSource.includes("smoke:world-formal-entry-cleanup-execution"),
    "Package cleanup execution smoke script is missing."
  )

  const forbiddenFormalWorldTokens = [
    "FormalPixelSvgView",
    "buildFormalPixelRenderModel",
    "buildFormalPixelSvg",
    "data:image/svg",
    "<svg",
    "<canvas",
    "CanvasRenderingContext2D",
    "getContext(",
    "dangerouslySetInnerHTML",
    "WorldPainterReadonlyPreview",
    "ProceduralRendererView",
    "FormalWorldView",
    "runAndPersistOneRuntimeTick",
    "writeWorldRuntimeSaveRecord",
    "手动 Tick",
    "手动保存",
    "viewMode",
    "debugView",
  ]
  const forbiddenHits = forbiddenFormalWorldTokens.filter((token) => formalWorldCombined.includes(token))
  assert(forbiddenHits.length === 0, `Formal /world contains forbidden tokens: ${forbiddenHits.join(", ")}`)

  console.log("WORLD FORMAL ENTRY CLEANUP EXECUTION SMOKE")
  console.log("Formal /world uses PixelWorldView readonly entry: ok")
  console.log("Formal SVG component removed from /world: ok")
  console.log("Formal renderer import removed from /world: ok")
  console.log("PixelWorldView source adapter exists: ok")
  console.log("Runtime remains read-only: ok")
  console.log("No SVG or canvas formal entry dependency: ok")
  console.log("No manual Tick or save in formal entry: ok")
  console.log("No default pet generation: ok")
  console.log("Result: PASS")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
