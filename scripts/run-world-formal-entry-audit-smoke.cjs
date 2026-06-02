async function main() {
  const fs = await import("node:fs")
  const path = await import("node:path")

  const repoRoot = process.cwd()

  function fail(message) {
    console.log("WORLD FORMAL ENTRY AUDIT SMOKE")
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

  const auditDefinitionSource = readFile(
    path.join(repoRoot, "src", "world", "pixel-worldview", "world-formal-entry-audit.ts"),
    "Formal entry audit definition"
  )
  const auditScriptSource = readFile(
    path.join(repoRoot, "scripts", "run-world-formal-entry-audit.cjs"),
    "Formal entry audit script"
  )
  const packageSource = readFile(path.join(repoRoot, "package.json"), "package.json")
  const combined = [auditDefinitionSource, auditScriptSource, packageSource].join("\n")

  const requiredTokens = [
    "WorldFormalEntryAuditReport",
    "WorldFormalEntryAuditItem",
    "WORLD_FORMAL_ENTRY_FORBIDDEN_TOKENS",
    "WORLD_FORMAL_ENTRY_EXPECTED_CHAIN",
    "createWorldFormalEntryAuditReport",
    "formal_entry_forbidden_tokens",
    "formal_entry_missing_pixel_worldview",
    "formal_entry_runtime_write",
    "formal_entry_default_pet",
    "WORLD FORMAL ENTRY AUDIT",
    "Formal /world audit definition exists",
    "PixelWorldView missing warning allowed",
  ]

  requiredTokens.forEach((token) => {
    assert(combined.includes(token), `Missing required token: ${token}`)
  })

  assert(packageSource.includes("audit:world-formal-entry"), "Package formal entry audit script is missing.")
  assert(packageSource.includes("smoke:world-formal-entry-audit"), "Package formal entry audit smoke script is missing.")

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
  assert(forbiddenHits.length === 0, `Formal entry audit contains forbidden calls: ${forbiddenHits.join(", ")}`)

  console.log("WORLD FORMAL ENTRY AUDIT SMOKE")
  console.log("Formal entry audit definition exists: ok")
  console.log("Formal entry audit script exists: ok")
  console.log("Formal entry forbidden tokens defined: ok")
  console.log("Formal entry expected chain defined: ok")
  console.log("Formal entry report factory exists: ok")
  console.log("Runtime boundary: ok")
  console.log("No renderer dependency call: ok")
  console.log("No default pet generation: ok")
  console.log("Result: PASS")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
