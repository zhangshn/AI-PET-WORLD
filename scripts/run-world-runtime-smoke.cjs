const forbiddenTokens = [
  "\u5b75\u5316\u5668",
  "\u80da\u80ce",
  "\u5b75\u5316",
  "\u5019\u9009\u5ba0\u7269",
  "\u9886\u517b\u5019\u9009",
  "\u9886\u517b\u4e2d\u5fc3\u5019\u9009",
  "\u5c0f\u9547\u9886\u517b\u89c2\u5bdf\u5019\u9009",
  "\u4f34\u751f\u751f\u547d",
  "\u751f\u547d\u4e8b\u4ef6",
  "\u9ed8\u8ba4\u5ba0\u7269",
  "\u521d\u59cb\u5ba0\u7269",
  "\u5f00\u5c40\u5ba0\u7269",
  "incubator",
  "embryo",
  "hatching",
  "pet_arrival",
  "pet_bed",
  "pet_rest",
  "LifeEvent",
  "CompanionDecision",
  "adoptionCandidate",
  "AdoptionCandidate",
  "townAdoptionCandidates",
  "candidateLabel",
  "candidateReason",
]

async function main() {
  const fs = await import("node:fs")
  const path = await import("node:path")
  const repoRoot = process.cwd()
  const savePath = path.join(
    repoRoot,
    ".runtime",
    "world-state",
    "default-world.json"
  )
  const displayPath = path.relative(repoRoot, savePath).replaceAll(path.sep, "/")

  function fail(message) {
    console.log("LIVE WORLD RUNTIME SMOKE")
    console.log(`Save file: ${displayPath}`)
    console.log(message)
    console.log("Result: FAIL")
    process.exit(1)
  }

  function assert(condition, message) {
    if (!condition) {
      fail(message)
    }
  }

  if (!fs.existsSync(savePath)) {
    fail(
      "Runtime save file not found. Open /world once or run dev and refresh /world to create it."
    )
  }

  const raw = fs.readFileSync(savePath, "utf8")
  let record

  try {
    record = JSON.parse(raw)
  } catch (error) {
    fail(`Runtime save file is not valid JSON: ${error.message}`)
  }

  const homeMapState = record.homeMapState
  const events = Array.isArray(record.recentEvents) ? record.recentEvents : []
  const latestEvent = events[events.length - 1]
  const mapDiffs = Array.isArray(homeMapState?.mapDiffs)
    ? homeMapState.mapDiffs
    : []
  const resourcePoolTransactions = Array.isArray(
    homeMapState?.resources?.resourcePoolState?.transactions
  )
    ? homeMapState.resources.resourcePoolState.transactions
    : []
  const recentTransactions = Array.isArray(homeMapState?.resources?.recentTransactions)
    ? homeMapState.resources.recentTransactions
    : []
  const forbiddenHits = forbiddenTokens.filter((token) => raw.includes(token))
  const duplicateMapDiffIds = findDuplicates(mapDiffs.map((diff) => diff.id))
  const duplicatePoolTransactionIds = findDuplicates(
    resourcePoolTransactions.map((transaction) => transaction.transactionId)
  )
  const duplicateRecentTransactionIds = findDuplicates(
    recentTransactions.map((transaction) => transaction.transactionId)
  )

  assert(
    record.version === "v2.6-runtime-00",
    `Unexpected runtime version: ${record.version}`
  )
  assert(typeof record.tick === "number", "Runtime tick is not a number.")
  assert(homeMapState, "HomeMapState is missing.")
  assert(typeof homeMapState.worldId === "string", "HomeMapState worldId is missing.")
  assert(events.length > 0, "recentEvents is empty.")
  assert(
    events.some((event) => event && event.tick === record.tick),
    "recentEvents does not contain an event for the current tick."
  )
  assert(
    forbiddenHits.length === 0,
    `Forbidden tokens found: ${forbiddenHits.join(", ")}`
  )
  assert(
    duplicateMapDiffIds.length === 0,
    `Duplicate MapDiff ids found: ${duplicateMapDiffIds.join(", ")}`
  )
  assert(
    duplicatePoolTransactionIds.length === 0,
    `Duplicate resourcePoolState transaction ids found: ${duplicatePoolTransactionIds.join(", ")}`
  )
  assert(
    duplicateRecentTransactionIds.length === 0,
    `Duplicate recentTransactions transaction ids found: ${duplicateRecentTransactionIds.join(", ")}`
  )

  if (record.recentActionSignatures !== undefined) {
    assert(
      Array.isArray(record.recentActionSignatures),
      "recentActionSignatures exists but is not an array."
    )
  }

  if (record.lastRuntimeAction !== undefined && record.lastRuntimeAction !== null) {
    assert(
      typeof record.lastRuntimeAction.actionSignature === "string" &&
        record.lastRuntimeAction.actionSignature.length > 0,
      "lastRuntimeAction.actionSignature is missing."
    )
    assert(
      typeof record.lastRuntimeAction.tick === "number",
      "lastRuntimeAction.tick is missing."
    )
  }

  console.log("LIVE WORLD RUNTIME SMOKE")
  console.log(`Save file: ${displayPath}`)
  console.log(`Current tick: ${record.tick}`)
  console.log("HomeMapState: ok")
  console.log(`Recent events: ${events.length}`)
  console.log(`Latest event title: ${latestEvent?.title ?? "none"}`)
  console.log("Forbidden tokens: ok")
  console.log("MapDiff ids: ok")
  console.log("Resource transaction ids: ok")
  console.log("Runtime action continuity: ok")
  console.log("Result: PASS")
}

function findDuplicates(values) {
  const seen = new Set()
  const duplicates = new Set()

  values.forEach((value) => {
    if (typeof value !== "string") return
    if (seen.has(value)) duplicates.add(value)
    seen.add(value)
  })

  return Array.from(duplicates)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
