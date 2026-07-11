import { refreshGameMapAutoVisualJudgeLearning } from "./lib/game-map-auto-visual-judge-learning.mjs"
import { enrichTrainingProcessLedgerEvent } from "./lib/ai-painter-training-ledger-event-analysis.mjs"
import fs from "node:fs"
import path from "node:path"
import { randomUUID } from "node:crypto"

const ledgerDir = path.resolve(".runtime/ai-painter/training-process-ledger")
const ledgerPath = path.join(ledgerDir, "events.jsonl")
const latestLedgerPath = path.join(ledgerDir, "latest.json")

function readLedgerEvents() {
  if (!fs.existsSync(ledgerPath)) return []
  const raw = fs.readFileSync(ledgerPath, "utf8").trim()
  if (!raw) return []
  return raw
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line))
}

function buildLedgerSummary(events) {
  const summary = {
    total: events.length,
    running: 0,
    success: 0,
    failed: 0,
    error: 0,
    blocked: 0,
    info: 0,
    lastEvent: events.at(-1) ?? null,
  }
  for (const event of events) {
    if (Object.prototype.hasOwnProperty.call(summary, event.status)) {
      summary[event.status] += 1
    }
  }
  return summary
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8")
}

function appendLearningLedgerEvent(learningRecord) {
  fs.mkdirSync(ledgerDir, { recursive: true })
  const event = enrichTrainingProcessLedgerEvent({
    id: randomUUID(),
    timestamp: new Date().toISOString(),
    action: "learn_game_map_auto_visual_judge",
    runId: learningRecord.runId,
    kind: "auto_visual_judge_learning_updated",
    status: learningRecord.currentDecision.status === "blocked" ? "blocked" : "success",
    title: "Auto visual judge learning memory updated by program",
    titleZh: "程序自动更新视觉判断学习记忆",
    detail: `patterns=${learningRecord.learnedFailurePatterns.length} / decision=${learningRecord.currentDecision.status}`,
    detailZh: `学习失败模式=${learningRecord.learnedFailurePatterns.length} / 当前自动判断=${learningRecord.currentDecision.statusZh}`,
    script: "scripts/learn-game-map-auto-visual-judge.mjs",
    currentStep: "auto_visual_judge_learning",
    archiveId: learningRecord.historyPath,
    evidencePath: learningRecord.historyPath,
  })
  fs.appendFileSync(ledgerPath, `${JSON.stringify(event)}\n`, "utf8")
  const events = readLedgerEvents()
  writeJson(latestLedgerPath, {
    schemaVersion: "ai-painter-training-process-ledger-v1",
    updatedAt: events.at(-1)?.timestamp ?? null,
    events: events.slice(-120).reverse(),
    summary: buildLedgerSummary(events),
  })
}

const record = refreshGameMapAutoVisualJudgeLearning({ trigger: "manual_or_script_command" })
appendLearningLedgerEvent(record)
console.log(JSON.stringify(record, null, 2))
