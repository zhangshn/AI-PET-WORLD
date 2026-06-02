async function main() {
  const fs = await import("node:fs")
  const path = await import("node:path")

  const repoRoot = process.cwd()

  function fail(message) {
    console.log("WORLD FORMAL ENTRY CLEANUP PLAN SMOKE")
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
    "Formal entry cleanup plan definition"
  )
  const cleanupPlanScriptSource = readFile(
    path.join(repoRoot, "scripts", "run-world-formal-entry-cleanup-plan.cjs"),
    "Formal entry cleanup plan script"
  )
  const packageSource = readFile(path.join(repoRoot, "package.json"), "package.json")
  const indexSource = readFile(path.join(repoRoot, "src", "world", "pixel-worldview", "index.ts"), "PixelWorldView index")
  const combined = [cleanupPlanSource, cleanupPlanScriptSource, packageSource, indexSource].join("\n")

  const requiredTokens = [
    "WorldFormalEntryCleanupPlan",
    "WorldFormalEntryCleanupStep",
    "WORLD_FORMAL_ENTRY_CLEANUP_PLAN_ID",
    "WORLD_FORMAL_ENTRY_CLEANUP_TARGETS",
    "createWorldFormalEntryCleanupPlan",
    "move_svg_preview_to_debug",
    "move_procedural_renderer_to_debug",
    "move_formal_geometry_to_debug",
    "move_manual_tick_to_debug",
    "move_manual_save_to_debug",
    "remove_view_mode_switch_from_formal_world",
    "reduce_card_dashboard_surface",
    "prepare_pixel_worldview_readonly_entry",
    "WORLD FORMAL ENTRY CLEANUP PLAN",
    "Formal entry cleanup plan exists",
    "PixelWorldView readonly entry planned",
  ]

  requiredTokens.forEach((token) => {
    assert(combined.includes(token), `Missing required token: ${token}`)
  })

  assert(indexSource.includes("./world-formal-entry-cleanup-plan"), "Formal entry cleanup plan public export is missing.")
  assert(packageSource.includes("plan:world-formal-entry-cleanup"), "Package formal entry cleanup plan script is missing.")
  assert(
    packageSource.includes("smoke:world-formal-entry-cleanup-plan"),
    "Package formal entry cleanup plan smoke script is missing."
  )

  const forbiddenCalls = [
    "runAndPersistOneRuntimeTick(",
    "writeWorldRuntimeSaveRecord(",
    "createPet(",
    "buildSceneSvg(",
    "WorldPainterReadonlyPreview(",
    "ProceduralRendererView(",
    "FormalWorldView(",
  ]
  const forbiddenHits = forbiddenCalls.filter((token) => combined.includes(token))
  assert(forbiddenHits.length === 0, `Formal entry cleanup plan contains forbidden calls: ${forbiddenHits.join(", ")}`)

  console.log("WORLD FORMAL ENTRY CLEANUP PLAN SMOKE")
  console.log("Formal entry cleanup plan definition exists: ok")
  console.log("Formal entry cleanup plan script exists: ok")
  console.log("Formal entry cleanup steps defined: ok")
  console.log("Formal entry cleanup public export exists: ok")
  console.log("Runtime boundary: ok")
  console.log("No renderer dependency call: ok")
  console.log("No default pet generation: ok")
  console.log("Result: PASS")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
