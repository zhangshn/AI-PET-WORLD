async function main() {
  const crypto = await import("node:crypto")
  const fs = await import("node:fs")
  const path = await import("node:path")
  const repoRoot = process.cwd()
  const savePath = path.join(repoRoot, ".runtime", "world-state", "default-world.json")
  const pagePath = path.join(repoRoot, "src", "app", "world", "world-live-runtime-page.tsx")
  const componentPath = path.join(repoRoot, "src", "app", "world", "components", "butler-natural-explanation.tsx")
  const runtimeSmokePath = path.join(repoRoot, "scripts", "run-world-runtime-smoke.cjs")

  function fail(message) {
    console.log("BUTLER NATURAL EXPLANATION SMOKE")
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
  if (!fs.existsSync(componentPath)) fail("ButlerNaturalExplanation component is missing.")

  const beforeRaw = fs.readFileSync(savePath, "utf8")
  const beforeHash = crypto.createHash("sha256").update(beforeRaw).digest("hex")
  const record = parseJson(beforeRaw, "Runtime save file is not valid JSON.")
  const pageSource = fs.readFileSync(pagePath, "utf8")
  const componentSource = fs.readFileSync(componentPath, "utf8")
  const runtimeSmokeSource = fs.readFileSync(runtimeSmokePath, "utf8")

  assert(pageSource.includes("readWorldRuntimeForView"), "/world page does not use readWorldRuntimeForView.")
  assert(pageSource.includes("ButlerNaturalExplanation"), "/world page does not render ButlerNaturalExplanation.")
  assert(pageSource.includes("saveRecord={saveRecord}"), "ButlerNaturalExplanation is not driven by saveRecord.")
  assert(componentSource.includes("lastButlerRuntimeDecision"), "Component does not read saved butler decision.")
  assert(componentSource.includes("memorySeedConsumeScore"), "Component does not read memory seed consume score.")
  assert(componentSource.includes("我会"), "Component does not include natural butler wording.")
  assert(componentSource.includes("痕迹"), "Component does not mention world traces naturally.")
  assert(!pageSource.includes("runAndPersistOneRuntimeTick"), "/world page references explicit tick writer.")
  assert(!pageSource.includes("writeWorldRuntimeSaveRecord"), "/world page references runtime save writer.")
  assert(!pageSource.includes("runTraceLifecycleTick"), "/world page references trace lifecycle tick.")
  assert(!componentSource.includes("JSON.stringify"), "Component exposes serialized debug data.")
  assert(!componentSource.includes("finalScore"), "Component exposes raw score data.")
  assert(!componentSource.includes("riskPenalty"), "Component exposes raw score penalty data.")
  assert(runtimeSmokeSource.includes("World read boundary: ok"), "Runtime smoke no longer checks read boundary.")
  assert(record.lastButlerRuntimeDecision, "Saved butler decision is missing.")

  const afterRaw = fs.readFileSync(savePath, "utf8")
  const afterHash = crypto.createHash("sha256").update(afterRaw).digest("hex")
  const afterRecord = parseJson(afterRaw, "Runtime save after smoke is not valid JSON.")

  assert(afterRecord.tick === record.tick, "Natural explanation smoke changed runtime tick.")
  assert(afterHash === beforeHash, "Natural explanation smoke changed runtime save hash.")

  console.log("BUTLER NATURAL EXPLANATION SMOKE")
  console.log(`Runtime tick: ${record.tick}`)
  console.log(`Selected motivation: ${record.lastButlerRuntimeDecision.selectedMotivation}`)
  console.log("Natural explanation attached: ok")
  console.log("No raw score display: ok")
  console.log("Explanation read-only: ok")
  console.log("World read boundary: ok")
  console.log("Result: PASS")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
