async function main() {
  const crypto = await import("node:crypto")
  const fs = await import("node:fs")
  const path = await import("node:path")
  const repoRoot = process.cwd()
  const savePath = path.join(repoRoot, ".runtime", "world-state", "default-world.json")
  const pagePath = path.join(repoRoot, "src", "app", "world", "world-live-runtime-page.tsx")
  const runtimeSmokePath = path.join(repoRoot, "scripts", "run-world-runtime-smoke.cjs")

  function fail(message) {
    console.log("WORLD SURFACE HIERARCHY SMOKE")
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

  const beforeRaw = fs.readFileSync(savePath, "utf8")
  const beforeHash = crypto.createHash("sha256").update(beforeRaw).digest("hex")
  const record = parseJson(beforeRaw, "Runtime save file is not valid JSON.")
  const pageSource = fs.readFileSync(pagePath, "utf8")
  const runtimeSmokeSource = fs.readFileSync(runtimeSmokePath, "utf8")

  const heroIndex = pageSource.indexOf("styles.heroPanel")
  const formalIndex = pageSource.indexOf("styles.formalWorldPanel")
  const naturalIndex = pageSource.indexOf("ButlerNaturalExplanation")
  const traceSummaryIndex = pageSource.indexOf("FormalTraceSurfaceSummary")
  const biasIndex = pageSource.indexOf("ButlerMemoryBiasSurface")
  const boundaryIndex = pageSource.indexOf("运行边界")
  const painterIndex = pageSource.indexOf("WorldPainterReadonlyPreview")

  assert(heroIndex >= 0, "Hero panel is missing.")
  assert(formalIndex > heroIndex, "Formal world view should follow the hero.")
  assert(naturalIndex > formalIndex, "Butler natural explanation should follow the main world view.")
  assert(traceSummaryIndex > naturalIndex, "Trace details should sit below the natural explanation.")
  assert(biasIndex > traceSummaryIndex, "Butler bias detail should sit below trace detail.")
  assert(boundaryIndex > biasIndex, "Runtime boundary should sit below product understanding panels.")
  assert(painterIndex > boundaryIndex, "Readonly painter preview should be a lower-level reference panel.")
  assert(pageSource.includes("关键状态"), "Key status panel is missing.")
  assert(pageSource.includes("只读画面预览"), "Lower-level readonly preview label is missing.")
  assert(pageSource.includes("readWorldRuntimeForView"), "/world page no longer uses readWorldRuntimeForView.")

  const forbiddenTokens = [
    "runAndPersistOneRuntimeTick",
    "writeWorldRuntimeSaveRecord",
    "runTraceLifecycleTick",
    "JSON.stringify",
    "traceField.traces",
    "finalScore",
    "riskPenalty",
    "auditTags",
    "rawTrace",
  ]
  const forbiddenHits = forbiddenTokens.filter((token) => pageSource.includes(token))
  assert(
    forbiddenHits.length === 0,
    `World hierarchy page contains forbidden raw/runtime tokens: ${forbiddenHits.join(", ")}`
  )
  assert(
    runtimeSmokeSource.includes("World read boundary: ok"),
    "Runtime smoke no longer reports read-boundary validation."
  )

  const afterRaw = fs.readFileSync(savePath, "utf8")
  const afterHash = crypto.createHash("sha256").update(afterRaw).digest("hex")
  const afterRecord = parseJson(afterRaw, "Runtime save after hierarchy smoke is not valid JSON.")

  assert(afterRecord.tick === record.tick, "Hierarchy smoke changed runtime tick.")
  assert(afterHash === beforeHash, "Hierarchy smoke changed runtime save hash.")

  console.log("WORLD SURFACE HIERARCHY SMOKE")
  console.log(`Runtime tick: ${record.tick}`)
  console.log("Hierarchy order: ok")
  console.log("First-level world view and butler explanation: ok")
  console.log("Lower-level detail panels moved down: ok")
  console.log("Surface read-only: ok")
  console.log("World read boundary: ok")
  console.log("Result: PASS")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
