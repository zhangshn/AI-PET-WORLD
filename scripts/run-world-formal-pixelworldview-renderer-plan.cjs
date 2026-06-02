async function main() {
  const fs = await import("node:fs")
  const path = await import("node:path")

  const repoRoot = process.cwd()
  const planPath = path.join(
    repoRoot,
    "src",
    "world",
    "pixel-worldview",
    "world-formal-pixelworldview-renderer-plan.ts"
  )

  function fail(message) {
    console.log("WORLD FORMAL PIXELWORLDVIEW RENDERER PLAN")
    console.log(message)
    console.log("Result: FAIL")
    process.exit(1)
  }

  function assert(condition, message) {
    if (!condition) fail(message)
  }

  assert(fs.existsSync(planPath), "Formal PixelWorldView renderer plan is missing.")
  const planSource = fs.readFileSync(planPath, "utf8")

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
    "no_svg",
    "no_canvas_dom",
    "no_css_geometry",
    "runtime_readonly",
    "no_default_pet",
    "buffer_is_source_of_truth",
    "WORLD-FORMAL-PIXELWORLDVIEW-RENDERER-CONTRACT-00",
  ]
  requiredTokens.forEach((token) => {
    assert(planSource.includes(token), `Missing renderer plan token: ${token}`)
  })

  console.log("WORLD FORMAL PIXELWORLDVIEW RENDERER PLAN")
  console.log("Formal PixelWorldView renderer plan exists: ok")
  console.log("Formal renderer safe chain exists: ok")
  console.log("Formal renderer milestones exist: ok")
  console.log("Formal renderer safety rules exist: ok")
  console.log("Formal renderer next action exists: ok")
  console.log("Result: PASS")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
