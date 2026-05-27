async function main() {
  const crypto = await import("node:crypto")
  const fs = await import("node:fs")
  const path = await import("node:path")
  const repoRoot = process.cwd()
  const savePath = path.join(repoRoot, ".runtime", "world-state", "default-world.json")
  const pagePath = path.join(repoRoot, "src", "app", "world", "world-live-runtime-page.tsx")
  const traceSummaryPath = path.join(repoRoot, "src", "app", "world", "components", "formal-trace-surface-summary.tsx")
  const butlerBiasPath = path.join(repoRoot, "src", "app", "world", "components", "butler-memory-bias-surface.tsx")
  const naturalExplanationPath = path.join(repoRoot, "src", "app", "world", "components", "butler-natural-explanation.tsx")
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
  const traceSummarySource = fs.readFileSync(traceSummaryPath, "utf8")
  const butlerBiasSource = fs.readFileSync(butlerBiasPath, "utf8")
  const naturalExplanationSource = fs.readFileSync(naturalExplanationPath, "utf8")
  const runtimeSmokeSource = fs.readFileSync(runtimeSmokePath, "utf8")
  const combinedSurfaceSource = [
    pageSource,
    traceSummarySource,
    butlerBiasSource,
    naturalExplanationSource,
  ].join("\n")

  const requiredChineseCopy = [
    "当前家园",
    "世界状态",
    "管家观察",
    "世界痕迹",
    "管家判断",
    "资源状态",
    "只读",
  ]
  const missingChineseCopy = requiredChineseCopy.filter(
    (copy) => !combinedSurfaceSource.includes(copy)
  )
  assert(
    missingChineseCopy.length === 0,
    `Missing Chinese surface copy: ${missingChineseCopy.join(", ")}`
  )

  const staleEnglishCopy = [
    "Current world",
    "World traces",
    "Butler reasoning",
    "Resource state",
    "Current saved world",
    "World surface signals",
    "Current posture",
    "Memory bias",
    "Observed traces",
    "Main signs",
  ]
  const staleHits = staleEnglishCopy.filter((copy) =>
    combinedSurfaceSource.includes(copy)
  )
  assert(staleHits.length === 0, `Stale English surface copy remains: ${staleHits.join(", ")}`)

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
  console.log("Chinese surface copy: ok")
  console.log("No stale English surface copy: ok")
  console.log("No raw/runtime display tokens: ok")
  console.log("Surface read-only: ok")
  console.log("World read boundary: ok")
  console.log("Result: PASS")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
