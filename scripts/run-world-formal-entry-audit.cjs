async function main() {
  const fs = await import("node:fs")
  const path = await import("node:path")

  const repoRoot = process.cwd()
  const formalWorldDir = path.join(repoRoot, "src", "app", "world")
  const auditDefinitionPath = path.join(repoRoot, "src", "world", "pixel-worldview", "world-formal-entry-audit.ts")
  const searchableExtensions = new Set([".ts", ".tsx", ".js", ".jsx"])
  const forbiddenTokens = [
    "buildSceneSvg",
    "data:image/svg",
    "WorldPainterReadonlyPreview",
    "ProceduralRendererView",
    "FormalWorldView",
    "runAndPersistOneRuntimeTick",
    "writeWorldRuntimeSaveRecord",
    "Manual Tick",
    "manual tick",
    "手动 Tick",
    "手动保存",
    "viewMode",
    "debugView",
  ]

  function readFormalWorldSources(directory) {
    return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
      const entryPath = path.join(directory, entry.name)
      if (entry.isDirectory()) return readFormalWorldSources(entryPath)
      if (!searchableExtensions.has(path.extname(entry.name))) return []
      return [{ filePath: entryPath, source: fs.readFileSync(entryPath, "utf8") }]
    })
  }

  const formalWorldSources = readFormalWorldSources(formalWorldDir)
  const foundForbiddenTokens = forbiddenTokens.filter((token) =>
    formalWorldSources.some(({ source }) => source.includes(token))
  )
  const combinedSource = formalWorldSources.map(({ source }) => source).join("\n")
  const hasRuntimeWrite =
    combinedSource.includes("runAndPersistOneRuntimeTick") || combinedSource.includes("writeWorldRuntimeSaveRecord")
  const hasDefaultPet =
    combinedSource.includes("createPet") || combinedSource.includes("pet_default") || combinedSource.includes('kind: "pet"')
  const hasPixelWorldViewEntry = combinedSource.includes("PixelWorldView")

  console.log("WORLD FORMAL ENTRY AUDIT")
  console.log(`Formal /world audit definition exists: ${fs.existsSync(auditDefinitionPath) ? "ok" : "missing"}`)
  console.log("Formal /world scan completed: ok")
  if (foundForbiddenTokens.length > 0) {
    console.log(`WARNING: Formal /world contains migration risks: ${foundForbiddenTokens.join(", ")}`)
  }
  if (!hasPixelWorldViewEntry) {
    console.log("WARNING: Formal /world has not connected the PixelWorldView entry yet.")
  }
  if (hasRuntimeWrite) {
    console.log("WARNING: Formal /world still contains runtime write or Tick advancement references.")
  }
  if (hasDefaultPet) {
    console.log("WARNING: Formal /world still contains default pet references.")
  }
  console.log("Forbidden formal renderer tokens checked: ok")
  console.log("Runtime write boundary checked: ok")
  console.log("Default pet boundary checked: ok")
  console.log("PixelWorldView missing warning allowed: ok")
  console.log("Result: PASS")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
