async function main() {
  const fs = await import("node:fs")
  const path = await import("node:path")

  const repoRoot = process.cwd()

  function fail(message) {
    console.log("WORLD FORMAL PIXELWORLDVIEW RENDERER PLAN SMOKE")
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

  const planSource = readFile(
    path.join(repoRoot, "src", "world", "pixel-worldview", "world-formal-pixelworldview-renderer-plan.ts"),
    "Formal PixelWorldView renderer plan"
  )
  const planScriptSource = readFile(
    path.join(repoRoot, "scripts", "run-world-formal-pixelworldview-renderer-plan.cjs"),
    "Formal PixelWorldView renderer plan script"
  )
  const packageSource = readFile(path.join(repoRoot, "package.json"), "package.json")
  const indexSource = readFile(path.join(repoRoot, "src", "world", "pixel-worldview", "index.ts"), "PixelWorldView index")
  const combined = [planSource, planScriptSource, packageSource, indexSource].join("\n")

  const requiredTokens = [
    "WorldFormalPixelWorldRendererPlan",
    "WorldFormalPixelWorldRendererMilestone",
    "WorldFormalPixelWorldRendererSafetyRule",
    "WORLD_FORMAL_PIXELWORLDVIEW_RENDERER_PLAN_ID",
    "WORLD_FORMAL_PIXELWORLDVIEW_RENDERER_SAFE_CHAIN",
    "createWorldFormalPixelWorldRendererPlan",
    "formal_renderer_contract",
    "formal_renderer_readonly_shell",
    "future_pixi_renderer_adapter",
    "formal_world_renderer_swap",
    "buffer_is_source_of_truth",
    "Runtime Readonly",
    "PixelWorldPixelBufferFrame",
    "Formal PixelWorldView Renderer",
    "WORLD FORMAL PIXELWORLDVIEW RENDERER PLAN",
    "Formal renderer safe chain exists",
  ]
  requiredTokens.forEach((token) => {
    assert(combined.includes(token), `Missing renderer plan smoke token: ${token}`)
  })

  assert(
    indexSource.includes("./world-formal-pixelworldview-renderer-plan"),
    "Formal PixelWorldView renderer plan public export is missing."
  )
  assert(
    packageSource.includes("plan:world-formal-pixelworldview-renderer"),
    "Formal PixelWorldView renderer plan package script is missing."
  )
  assert(
    packageSource.includes("smoke:world-formal-pixelworldview-renderer-plan"),
    "Formal PixelWorldView renderer plan smoke package script is missing."
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
  ]
  const forbiddenHits = forbiddenCallTokens.filter((token) => combined.includes(token))
  assert(forbiddenHits.length === 0, `Renderer plan contains forbidden calls: ${forbiddenHits.join(", ")}`)

  console.log("WORLD FORMAL PIXELWORLDVIEW RENDERER PLAN SMOKE")
  console.log("Formal PixelWorldView renderer plan definition exists: ok")
  console.log("Formal PixelWorldView renderer plan script exists: ok")
  console.log("Formal renderer safe chain defined: ok")
  console.log("Formal renderer milestones defined: ok")
  console.log("Formal renderer safety rules defined: ok")
  console.log("Formal renderer public export exists: ok")
  console.log("Runtime boundary: ok")
  console.log("No renderer dependency call: ok")
  console.log("No default pet generation: ok")
  console.log("Result: PASS")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
