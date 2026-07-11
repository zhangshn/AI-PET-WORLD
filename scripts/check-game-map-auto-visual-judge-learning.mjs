import fs from "node:fs"
import path from "node:path"

const latestPath = path.resolve(".runtime/ai-painter/auto-visual-judge-learning/latest.json")

function fail(message) {
  console.error(`[check-game-map-auto-visual-judge-learning] ${message}`)
  process.exit(1)
}

if (!fs.existsSync(latestPath)) {
  fail("latest auto visual judge learning record is missing")
}

const record = JSON.parse(fs.readFileSync(latestPath, "utf8"))

if (record.schemaVersion !== "game-map-auto-visual-judge-learning-v1") {
  fail("invalid schemaVersion")
}
if (record.createdByProgram !== true || record.manualEdited !== false) {
  fail("learning record must be program-created and not manually edited")
}
if (!record.currentDecision || typeof record.currentDecision.status !== "string") {
  fail("currentDecision is missing")
}
if (!Array.isArray(record.learnedFailurePatterns)) {
  fail("learnedFailurePatterns must be an array")
}
if (!record.evidenceSummary || record.evidenceSummary.ledgerEventCount < 1) {
  fail("evidenceSummary must include ledger events")
}
if (!record.historyPath || !fs.existsSync(path.resolve(record.historyPath))) {
  fail("historyPath must point to a retained learning record")
}

console.log(
  JSON.stringify(
    {
      ok: true,
      status: "game_map_auto_visual_judge_learning_check_passed",
      currentDecision: record.currentDecision.status,
      learnedFailurePatternCount: record.learnedFailurePatterns.length,
      latestPath,
    },
    null,
    2,
  ),
)
