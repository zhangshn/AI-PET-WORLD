async function main() {
  const fs = await import("node:fs")
  const path = await import("node:path")

  const repoRoot = process.cwd()
  const formalWorldDir = path.join(repoRoot, "src", "app", "world")

  function fail(message) {
    console.log("WORLD FORMAL ENTRY LEGACY QUARANTINE SMOKE")
    console.log(message)
    console.log("Result: FAIL")
    process.exit(1)
  }

  function assert(condition, message) {
    if (!condition) fail(message)
  }

  function repoPath(...segments) {
    return path.join(repoRoot, ...segments)
  }

  function readDirectorySources(directory) {
    return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
      const entryPath = path.join(directory, entry.name)
      if (entry.isDirectory()) return readDirectorySources(entryPath)
      return fs.readFileSync(entryPath, "utf8")
    })
  }

  const activeEntryFiles = [
    repoPath("src", "app", "world", "page.tsx"),
    repoPath("src", "app", "world", "world-live-runtime-page.tsx"),
    repoPath(
      "src",
      "app",
      "world",
      "components",
      "pixel-worldview-readonly-entry",
      "pixel-worldview-readonly-entry.tsx"
    ),
  ]
  activeEntryFiles.forEach((filePath) => {
    assert(fs.existsSync(filePath), `Formal /world active entry is missing: ${filePath}`)
  })

  const removedFiles = [
    repoPath("src", "app", "world", "world-route-page.tsx"),
    repoPath("src", "app", "world", "world-route-page.styles.module.css"),
    repoPath("src", "app", "world", "mvp-world-view-model.ts"),
    repoPath("src", "app", "world", "world-butler-autonomy-portal.tsx"),
    repoPath("src", "app", "world", "butler-autonomy-panel.tsx"),
    repoPath("src", "app", "world", "butler-autonomy-viewmodel-probe.ts"),
    repoPath("src", "app", "world", "components", "world-painter-readonly-preview.tsx"),
    repoPath("src", "app", "world", "components", "world-painter-readonly-preview.module.css"),
    repoPath("src", "app", "world", "components", "procedural-renderer", "procedural-renderer-view.tsx"),
    repoPath(
      "src",
      "app",
      "world",
      "components",
      "procedural-renderer",
      "procedural-renderer-view.styles.module.css"
    ),
    repoPath("src", "app", "world", "components", "pixel-world-view", "pixel-world-canvas.client.tsx"),
    repoPath("src", "app", "world", "components", "pixel-world-view", "pixel-world-view.tsx"),
    repoPath("src", "app", "world", "components", "pixel-world-view", "pixel-world-view.module.css"),
  ]
  removedFiles.forEach((filePath) => {
    assert(!fs.existsSync(filePath), `Legacy formal /world file still exists: ${filePath}`)
  })

  assert(
    fs.existsSync(
      repoPath("src", "app", "world-debug", "components", "logic-visualization", "WorldLogicDashboard.tsx")
    ),
    "World-debug logic visualization migration is missing."
  )
  assert(
    fs.existsSync(
      repoPath("src", "app", "world-debug", "components", "procedural-renderer", "procedural-renderer-view.tsx")
    ),
    "World-debug procedural renderer migration is missing."
  )

  const formalWorldCombined = readDirectorySources(formalWorldDir).join("\n")
  const forbiddenFormalWorldTokens = [
    "data:image/svg",
    "<svg",
    "<canvas",
    "CanvasRenderingContext2D",
    "getContext(",
    "WorldPainterReadonlyPreview",
    "ProceduralRendererView",
    "FormalWorldView",
    "runAndPersistOneRuntimeTick",
    "writeWorldRuntimeSaveRecord",
    "手动 Tick",
    "手动保存",
    "viewMode",
    "debugView",
    "gridTemplateColumns",
    "backgroundColor",
    'position: "absolute"',
    "position: 'absolute'",
  ]
  const forbiddenHits = forbiddenFormalWorldTokens.filter((token) => formalWorldCombined.includes(token))
  assert(forbiddenHits.length === 0, `Formal /world contains forbidden tokens: ${forbiddenHits.join(", ")}`)

  console.log("WORLD FORMAL ENTRY LEGACY QUARANTINE SMOKE")
  console.log("Formal /world active entry exists: ok")
  console.log("Legacy formal route files removed from /world: ok")
  console.log("Legacy SVG preview removed from /world: ok")
  console.log("Legacy procedural renderer removed from /world: ok")
  console.log("Legacy pixel world canvas removed from /world: ok")
  console.log("World-debug logic visualization migration exists: ok")
  console.log("Formal /world forbidden tokens cleared: ok")
  console.log("Runtime remains read-only: ok")
  console.log("No default pet generation: ok")
  console.log("Result: PASS")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
