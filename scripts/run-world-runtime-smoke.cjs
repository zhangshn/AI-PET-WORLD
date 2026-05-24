const forbiddenTokens = [
  "孵化器",
  "胚胎",
  "孵化",
  "候选宠物",
  "领养候选",
  "领养中心候选",
  "小镇领养观察候选",
  "伴生生命",
  "生命事件",
  "默认宠物",
  "初始宠物",
  "开局宠物",
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

  const forbiddenHits = forbiddenTokens.filter((token) => raw.includes(token))
  const events = Array.isArray(record.recentEvents) ? record.recentEvents : []
  const latestEvent = events[events.length - 1]

  assert(
    record.version === "v2.6-runtime-00",
    `Unexpected runtime version: ${record.version}`
  )
  assert(typeof record.tick === "number", "Runtime tick is not a number.")
  assert(record.homeMapState, "HomeMapState is missing.")
  assert(
    typeof record.homeMapState.worldId === "string",
    "HomeMapState worldId is missing."
  )
  assert(events.length > 0, "recentEvents is empty.")
  assert(
    events.some((event) => event && event.tick === record.tick),
    "recentEvents does not contain an event for the current tick."
  )
  assert(
    forbiddenHits.length === 0,
    `Forbidden tokens found: ${forbiddenHits.join(", ")}`
  )

  console.log("LIVE WORLD RUNTIME SMOKE")
  console.log(`Save file: ${displayPath}`)
  console.log(`Current tick: ${record.tick}`)
  console.log("HomeMapState: ok")
  console.log(`Recent events: ${events.length}`)
  console.log(`Latest event title: ${latestEvent?.title ?? "none"}`)
  console.log("Forbidden tokens: ok")
  console.log("Result: PASS")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
