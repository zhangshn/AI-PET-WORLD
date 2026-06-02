async function main() {
  const fs = await import("node:fs")
  const path = await import("node:path")

  const repoRoot = process.cwd()

  function fail(message) {
    console.log("WORLD FORMAL ENTRY CLEANUP PLAN")
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

  const cleanupPlanSource = readFile(
    path.join(repoRoot, "src", "world", "pixel-worldview", "world-formal-entry-cleanup-plan.ts"),
    "Formal entry cleanup plan"
  )
  readFile(
    path.join(repoRoot, "src", "world", "pixel-worldview", "world-formal-entry-audit.ts"),
    "Formal entry audit definition"
  )

  const requiredTokens = [
    "WorldFormalEntryCleanupPlan",
    "WorldFormalEntryCleanupStep",
    "createWorldFormalEntryCleanupPlan",
    "move_svg_preview_to_debug",
    "move_procedural_renderer_to_debug",
    "move_formal_geometry_to_debug",
    "move_manual_tick_to_debug",
    "move_manual_save_to_debug",
    "remove_view_mode_switch_from_formal_world",
    "reduce_card_dashboard_surface",
    "prepare_pixel_worldview_readonly_entry",
    "world_formal_entry_cleanup_plan",
  ]

  requiredTokens.forEach((token) => {
    assert(cleanupPlanSource.includes(token), `Missing required token: ${token}`)
  })

  console.log("WORLD FORMAL ENTRY CLEANUP PLAN")
  console.log("Formal entry cleanup plan exists: ok")
  console.log("Formal entry cleanup steps exist: ok")
  console.log("SVG preview migration planned: ok")
  console.log("Procedural renderer migration planned: ok")
  console.log("Formal geometry migration planned: ok")
  console.log("Manual Tick migration planned: ok")
  console.log("Manual save migration planned: ok")
  console.log("View mode cleanup planned: ok")
  console.log("PixelWorldView readonly entry planned: ok")
  console.log("Result: PASS")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
