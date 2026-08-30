import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { appendAiPainterProgramEvent } from "./lib/ai-painter-program-event-store.mjs"

const ROOT = process.cwd()
const SOURCE_PATH = path.join(ROOT, ".runtime", "ai-painter", "auto-visual-judge-learning", "latest.json")
const OUTPUT_ROOT = path.join(ROOT, ".runtime", "ai-painter", "visual-learning-feedback-consumption")
const createdAt = new Date().toISOString()
const consumptionId = `visual-learning-feedback-${createdAt.replace(/[:.]/g, "-")}`

const sourceBytes = fs.readFileSync(SOURCE_PATH)
const source = JSON.parse(sourceBytes.toString("utf8"))
assert(source.schemaVersion === "game-map-auto-visual-judge-learning-v1", "invalid learning source schema")
assert(source.createdByProgram === true && source.manualEdited === false, "learning source must be program-created")
assert(Array.isArray(source.learnedFailurePatterns), "learning source has no learned failure patterns")
assert(Array.isArray(source.nextAutonomousJudgeInputs), "learning source has no next judge inputs")

const patternByCode = new Map(source.learnedFailurePatterns.map((pattern) => [pattern.code, pattern]))
const generationConstraints = source.nextAutonomousJudgeInputs.slice(0, 24).map((input) => {
  const pattern = patternByCode.get(input.code)
  return {
    code: input.code,
    targetArea: input.targetArea,
    occurrenceCount: input.occurrenceCount,
    action: input.action,
    blocksWorld: pattern?.blocksWorld === true,
    requiresJudgeUpgrade: pattern?.requiresJudgeUpgrade === true,
    evidencePaths: (input.evidencePaths ?? []).slice(0, 5),
  }
})

const record = {
  schemaVersion: "game-map-visual-learning-feedback-consumption-v1",
  consumptionId,
  createdAt,
  createdAtAsiaShanghai: formatShanghai(createdAt),
  createdByProgram: true,
  manualEdited: false,
  status: source.currentDecision?.status === "blocked" ? "constraints_consumed_world_blocked" : "constraints_consumed",
  source: {
    learningRunId: source.runId,
    learningCreatedAt: source.createdAt,
    learningPath: projectPath(SOURCE_PATH),
    learningSha256: crypto.createHash("sha256").update(sourceBytes).digest("hex"),
    trigger: source.trigger,
  },
  decision: {
    status: source.currentDecision?.status ?? "unknown",
    canEnterWorld: source.currentDecision?.canEnterWorld === true,
    confidence: source.currentDecision?.confidence ?? null,
    blockerCodes: source.currentDecision?.blockerCodes ?? [],
  },
  generationConstraints,
  judgeUpgradeConstraints: generationConstraints.filter((constraint) => constraint.requiresJudgeUpgrade),
  trainingRouting: generationConstraints.map((constraint) => ({
    failureCode: constraint.code,
    targetArea: constraint.targetArea,
    route: constraint.targetArea === "whole_frame" ? "complete_map_negative" : `${constraint.targetArea}_negative`,
    sourceEvidenceCount: constraint.evidencePaths.length,
  })),
  consumptionContract: {
    consumedBy: ["world_visual_generation_task_package", "future_complete_world_visual_inference", "future_professional_visual_judge"],
    mayChangeWorldFacts: false,
    mayApproveFinalMap: false,
    ownerReviewStillRequired: true,
    automaticStorage: true,
  },
}

const runDir = path.join(OUTPUT_ROOT, consumptionId)
const recordPath = path.join(runDir, "consumed-feedback.json")
fs.mkdirSync(runDir, { recursive: true })
writeJson(recordPath, record)
writeJson(path.join(OUTPUT_ROOT, "latest.json"), {
  schemaVersion: "game-map-visual-learning-feedback-consumption-latest-v1",
  consumptionId,
  createdAt,
  status: record.status,
  sourceLearningRunId: source.runId,
  constraintCount: generationConstraints.length,
  recordPath: projectPath(recordPath),
})
appendLedger(record, recordPath)

console.log(JSON.stringify({
  ok: true,
  consumptionId,
  status: record.status,
  constraintCount: generationConstraints.length,
  judgeUpgradeConstraintCount: record.judgeUpgradeConstraints.length,
  recordPath: projectPath(recordPath),
}, null, 2))

function appendLedger(value, recordPath) {
  const event = {
    schemaVersion: "ai-painter-training-process-ledger-event-v1",
    timestamp: value.createdAt,
    timestampAsiaShanghai: value.createdAtAsiaShanghai,
    status: value.decision.status === "blocked" ? "blocked" : "success",
    kind: "visual_learning_feedback_consumed",
    action: "consume_game_map_visual_learning_feedback",
    title: "Program consumed visual review learning feedback",
    titleZh: "程序消费视觉审核学习反馈",
    summary: `constraints=${value.generationConstraints.length}; decision=${value.decision.status}; canEnterWorld=${value.decision.canEnterWorld}`,
    summaryZh: `约束=${value.generationConstraints.length}; 判断=${value.decision.status}; 可进入世界=${value.decision.canEnterWorld}`,
    finalGameMapSuccess: false,
    canEnterWorld: false,
    archiveId: value.consumptionId,
    script: "scripts/consume-game-map-visual-learning-feedback.mjs",
    evidence: [projectPath(recordPath), value.source.learningPath],
  }
  appendAiPainterProgramEvent(event)
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8")
}

function projectPath(filePath) {
  const relative = path.relative(ROOT, path.resolve(filePath))
  return relative.startsWith("..") || path.isAbsolute(relative) ? path.resolve(filePath) : relative.replace(/\\/g, "/")
}

function formatShanghai(iso) {
  return `${new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(new Date(iso)).replace(" ", "T")}+08:00`
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}
