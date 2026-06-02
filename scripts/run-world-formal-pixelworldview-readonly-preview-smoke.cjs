async function main() {
  const fs = await import("node:fs")
  const path = await import("node:path")

  const repoRoot = process.cwd()

  function fail(message) {
    console.log("WORLD FORMAL PIXELWORLDVIEW READONLY PREVIEW SMOKE")
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
  const packageSource = readFile(path.join(repoRoot, "package.json"), "package.json")
  const formalWorldCombined = readDirectorySources(formalWorldDir).join("\n")
  const combined = [livePageSource, readonlyEntrySource, sourceAdapterSource, packageSource].join("\n")

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
    "World Runtime Projection",
    "PixelWorldView Model",
    "Render Plan",
    "Renderer Frame",
    "Pixel Buffer",
    "Safety",
    "P-Phone",
    "Butler Explanation",
    "不推进 Tick",
    "不写入 runtime",
    "不生成默认宠物",
    "非正式渲染器预览",
    "后续将接入真正 PixelWorldView renderer",
  ]
  requiredTokens.forEach((token) => {
    assert(combined.includes(token), `Missing required token: ${token}`)
  })

  assert(
    packageSource.includes("smoke:world-formal-pixelworldview-readonly-preview"),
    "Package readonly preview smoke script is missing."
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
    "backgroundColor",
    "gridTemplateColumns",
    'position: "absolute"',
    "position: 'absolute'",
  ]
  const forbiddenHits = forbiddenFormalWorldTokens.filter((token) => formalWorldCombined.includes(token))
  assert(forbiddenHits.length === 0, `Formal /world contains forbidden tokens: ${forbiddenHits.join(", ")}`)

  console.log("WORLD FORMAL PIXELWORLDVIEW READONLY PREVIEW SMOKE")
  console.log("Formal /world readonly PixelWorldView entry exists: ok")
  console.log("Formal /world shows World Runtime Projection: ok")
  console.log("Formal /world shows PixelWorldView model summary: ok")
  console.log("Formal /world shows RenderPlan summary: ok")
  console.log("Formal /world shows RendererFrame summary: ok")
  console.log("Formal /world shows PixelBuffer summary: ok")
  console.log("Formal /world shows safety flags: ok")
  console.log("Runtime remains read-only: ok")
  console.log("No SVG or canvas formal entry dependency: ok")
  console.log("No CSS geometry formal world preview: ok")
  console.log("No default pet generation: ok")
  console.log("Result: PASS")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
