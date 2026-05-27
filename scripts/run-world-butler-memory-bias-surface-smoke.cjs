async function main() {
  const crypto = await import("node:crypto")
  const fs = await import("node:fs")
  const path = await import("node:path")
  const repoRoot = process.cwd()
  const savePath = path.join(
    repoRoot,
    ".runtime",
    "world-state",
    "default-world.json"
  )
  const pagePath = path.join(repoRoot, "src", "app", "world", "world-live-runtime-page.tsx")
  const componentPath = path.join(
    repoRoot,
    "src",
    "app",
    "world",
    "components",
    "butler-memory-bias-surface.tsx"
  )
  const runtimeSmokePath = path.join(
    repoRoot,
    "scripts",
    "run-world-runtime-smoke.cjs"
  )

  function fail(message) {
    console.log("BUTLER MEMORY BIAS SURFACE SMOKE")
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
  if (!fs.existsSync(componentPath)) fail("ButlerMemoryBiasSurface component is missing.")

  const beforeRaw = fs.readFileSync(savePath, "utf8")
  const beforeHash = crypto.createHash("sha256").update(beforeRaw).digest("hex")
  const record = parseJson(beforeRaw, "Runtime save file is not valid JSON.")
  const pageSource = fs.readFileSync(pagePath, "utf8")
  const componentSource = fs.readFileSync(componentPath, "utf8")
  const runtimeSmokeSource = fs.readFileSync(runtimeSmokePath, "utf8")

  assert(
    pageSource.includes("readWorldRuntimeForView"),
    "/world page no longer reads through readWorldRuntimeForView."
  )
  assert(
    pageSource.includes("ButlerMemoryBiasSurface") &&
      pageSource.includes("saveRecord={saveRecord}"),
    "/world page does not render ButlerMemoryBiasSurface from saveRecord."
  )
  assert(
    componentSource.includes("lastButlerRuntimeDecision") &&
      componentSource.includes("memorySeedConsumeScore"),
    "ButlerMemoryBiasSurface does not read decision trace context."
  )
  assert(
    componentSource.includes("not direct orders") ||
      componentSource.includes("hints only"),
    "ButlerMemoryBiasSurface does not explain memory bias as non-direct action."
  )

  const forbiddenPageTokens = [
    "runAndPersistOneRuntimeTick",
    "writeWorldRuntimeSaveRecord",
    "runTraceLifecycleTick",
    "JSON.stringify",
    "traceField.traces",
  ]
  const pageHits = forbiddenPageTokens.filter((token) => pageSource.includes(token))
  assert(pageHits.length === 0, `/world page contains forbidden tokens: ${pageHits.join(", ")}`)

  const forbiddenComponentTokens = [
    "runAndPersistOneRuntimeTick",
    "writeWorldRuntimeSaveRecord",
    "runTraceLifecycleTick",
    "JSON.stringify",
    "finalScore",
    "baseScore",
    "resourceScore",
    "continuityScore",
    "traceContextScore",
    "riskPenalty",
    "auditTags",
    "rawTrace",
    "sourceReliability",
    "evidenceLevel",
    "movementCostDelta",
    "ButlerMemory",
    "PetMemory",
    "WorldLearning",
  ]
  const componentHits = forbiddenComponentTokens.filter((token) =>
    componentSource.includes(token)
  )
  assert(
    componentHits.length === 0,
    `ButlerMemoryBiasSurface exposes forbidden raw/debug tokens: ${componentHits.join(", ")}`
  )
  assert(
    runtimeSmokeSource.includes("World read boundary: ok"),
    "Runtime smoke no longer reports world read-boundary validation."
  )
  assert(
    (record.traceMemorySeedField?.seeds?.length ?? 0) > 0,
    "No trace memory seeds are available for surface summary."
  )

  const afterRaw = fs.readFileSync(savePath, "utf8")
  const afterHash = crypto.createHash("sha256").update(afterRaw).digest("hex")
  const afterRecord = parseJson(afterRaw, "Runtime save after surface smoke is not valid JSON.")

  assert(afterRecord.tick === record.tick, "Surface smoke changed runtime tick.")
  assert(afterHash === beforeHash, "Surface smoke changed runtime save hash.")

  console.log("BUTLER MEMORY BIAS SURFACE SMOKE")
  console.log(`Runtime tick: ${record.tick}`)
  console.log(`Memory seeds available: ${record.traceMemorySeedField.seeds.length}`)
  console.log("Butler memory bias surface attached: ok")
  console.log("No raw score/debug display tokens: ok")
  console.log("Surface read-only: ok")
  console.log("World read boundary: ok")
  console.log("Result: PASS")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
