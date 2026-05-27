async function main() {
  const crypto = await import("node:crypto")
  const fs = await import("node:fs")
  const path = await import("node:path")
  const repoRoot = process.cwd()
  const savePath = path.join(repoRoot, ".runtime", "world-state", "default-world.json")
  const pagePath = path.join(repoRoot, "src", "app", "world", "world-live-runtime-page.tsx")
  const pixelViewPath = path.join(
    repoRoot,
    "src",
    "app",
    "world",
    "components",
    "pixel-world-view",
    "pixel-world-view.tsx"
  )
  const runtimeSmokePath = path.join(repoRoot, "scripts", "run-world-runtime-smoke.cjs")

  function fail(message) {
    console.log("WORLD SURFACE COPY CN SMOKE")
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
  const pixelViewSource = fs.readFileSync(pixelViewPath, "utf8")
  const runtimeSmokeSource = fs.readFileSync(runtimeSmokePath, "utf8")
  const combinedSurfaceSource = [pageSource, pixelViewSource].join("\n")

  const requiredChineseCopy = [
    "像素主世界",
    "世界记录",
    "管家",
    "新记录",
  ]
  const missingChineseCopy = requiredChineseCopy.filter(
    (copy) => !combinedSurfaceSource.includes(copy)
  )
  assert(
    missingChineseCopy.length === 0,
    `Missing Chinese surface copy: ${missingChineseCopy.join(", ")}`
  )

  const staleEnglishCopy = [
    "Hero",
    "SummaryCard",
    "Audit Trail",
    "MVP",
    "WorldPainterReadonlyPreview",
    "FormalWorldView",
    "ProceduralRendererView",
  ]
  const staleHits = staleEnglishCopy.filter((copy) =>
    combinedSurfaceSource.includes(copy)
  )
  assert(staleHits.length === 0, `Stale/debug surface copy remains: ${staleHits.join(", ")}`)

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
    "sourceReliability",
    "evidenceLevel",
    "movementCostDelta",
  ]
  const forbiddenHits = forbiddenTokens.filter((token) =>
    combinedSurfaceSource.includes(token)
  )
  assert(
    forbiddenHits.length === 0,
    `Chinese surface contains forbidden raw/runtime tokens: ${forbiddenHits.join(", ")}`
  )
  assert(
    pageSource.includes("readWorldRuntimeForView"),
    "/world page no longer uses readWorldRuntimeForView."
  )
  assert(
    runtimeSmokeSource.includes("World read boundary: ok"),
    "Runtime smoke no longer reports read-boundary validation."
  )

  const afterRaw = fs.readFileSync(savePath, "utf8")
  const afterHash = crypto.createHash("sha256").update(afterRaw).digest("hex")
  const afterRecord = parseJson(afterRaw, "Runtime save after Chinese copy smoke is not valid JSON.")

  assert(afterRecord.tick === record.tick, "Chinese surface copy smoke changed runtime tick.")
  assert(afterHash === beforeHash, "Chinese surface copy smoke changed runtime save hash.")

  console.log("WORLD SURFACE COPY CN SMOKE")
  console.log(`Runtime tick: ${record.tick}`)
  console.log("Chinese pixel surface copy: ok")
  console.log("No debug surface copy: ok")
  console.log("No raw/runtime display tokens: ok")
  console.log("Surface read-only: ok")
  console.log("World read boundary: ok")
  console.log("Result: PASS")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
