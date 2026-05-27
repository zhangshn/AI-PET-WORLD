async function main() {
  const crypto = await import("node:crypto")
  const fs = await import("node:fs")
  const path = await import("node:path")
  const repoRoot = process.cwd()
  const savePath = path.join(repoRoot, ".runtime", "world-state", "default-world.json")
  const pagePath = path.join(repoRoot, "src", "app", "world", "world-live-runtime-page.tsx")
  const painterPath = path.join(repoRoot, "src", "app", "world", "components", "world-painter-readonly-preview.tsx")
  const runtimeSmokePath = path.join(repoRoot, "scripts", "run-world-runtime-smoke.cjs")

  function fail(message) {
    console.log("WORLD PIXEL PRIMARY SMOKE")
    console.log(message)
    console.log("Result: FAIL")
    process.exit(1)
  }

  function assert(condition, message) {
    if (!condition) fail(message)
  }

  function parseJson(raw, message) {
    try {
      return JSON.parse(raw)
    } catch (error) {
      fail(`${message} ${error.message}`)
    }
  }

  if (!fs.existsSync(savePath)) fail("Runtime save file not found.")
  if (!fs.existsSync(painterPath)) fail("WorldPainterReadonlyPreview is missing.")

  const beforeRaw = fs.readFileSync(savePath, "utf8")
  const beforeHash = crypto.createHash("sha256").update(beforeRaw).digest("hex")
  const record = parseJson(beforeRaw, "Runtime save file is not valid JSON.")
  const pageSource = fs.readFileSync(pagePath, "utf8")
  const painterSource = fs.readFileSync(painterPath, "utf8")
  const runtimeSmokeSource = fs.readFileSync(runtimeSmokePath, "utf8")

  const heroIndex = pageSource.indexOf("styles.heroPanel")
  const pixelIndex = pageSource.indexOf("WorldPainterReadonlyPreview")
  const naturalIndex = pageSource.indexOf("ButlerNaturalExplanation")
  const traceSummaryIndex = pageSource.indexOf("FormalTraceSurfaceSummary")

  assert(heroIndex >= 0, "Hero panel is missing.")
  assert(pixelIndex > heroIndex, "Pixel world should appear immediately after hero.")
  assert(naturalIndex > pixelIndex, "Butler explanation should follow the primary pixel world.")
  assert(traceSummaryIndex > naturalIndex, "Trace detail panels should remain below the primary world and explanation.")
  assert(!pageSource.includes("FormalWorldView"), "/world still references FormalWorldView as a main surface.")
  assert(!pageSource.includes("styles.formalWorldPanel"), "/world still renders formalWorldPanel as primary surface.")
  assert(pageSource.includes("adaptHomeMapStateToSceneComposerFact"), "/world does not adapt HomeMapState into pixel scene facts.")
  assert(pageSource.includes("buildSceneSvg"), "/world does not build the pixel scene from scene facts.")
  assert(pageSource.includes("readWorldRuntimeForView"), "/world page no longer uses readWorldRuntimeForView.")
  assert(painterSource.includes("WorldPainterFactAdapterResult"), "Pixel painter is not fact-adapter bound.")
  assert(painterSource.includes("It does not create placements"), "Pixel painter no longer states no world fact creation.")

  const forbiddenTokens = [
    "runAndPersistOneRuntimeTick",
    "writeWorldRuntimeSaveRecord",
    "runTraceLifecycleTick",
    "traceField.traces",
    "finalScore",
    "riskPenalty",
    "auditTags",
    "rawTrace",
  ]
  const forbiddenHits = forbiddenTokens.filter((token) => pageSource.includes(token))
  assert(
    forbiddenHits.length === 0,
    `World pixel primary page contains forbidden raw/runtime tokens: ${forbiddenHits.join(", ")}`
  )
  assert(
    runtimeSmokeSource.includes("World read boundary: ok"),
    "Runtime smoke no longer reports read-boundary validation."
  )

  const afterRaw = fs.readFileSync(savePath, "utf8")
  const afterHash = crypto.createHash("sha256").update(afterRaw).digest("hex")
  const afterRecord = parseJson(afterRaw, "Runtime save after pixel primary smoke is not valid JSON.")

  assert(afterRecord.tick === record.tick, "Pixel primary smoke changed runtime tick.")
  assert(afterHash === beforeHash, "Pixel primary smoke changed runtime save hash.")

  console.log("WORLD PIXEL PRIMARY SMOKE")
  console.log(`Runtime tick: ${record.tick}`)
  console.log("Fact-bound pixel world primary: ok")
  console.log("FormalWorldView not used as main surface: ok")
  console.log("Pixel surface read-only: ok")
  console.log("World read boundary: ok")
  console.log("Result: PASS")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
