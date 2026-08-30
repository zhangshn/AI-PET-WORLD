import { refreshGameMapAutoVisualJudgeLearning } from "./lib/game-map-auto-visual-judge-learning.mjs"
import { enrichTrainingProcessLedgerEvent } from "./lib/ai-painter-training-ledger-event-analysis.mjs"
import { appendAiPainterProgramEvent } from "./lib/ai-painter-program-event-store.mjs"
import { randomUUID } from "node:crypto"

function appendLearningLedgerEvent(learningRecord) {
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
  appendAiPainterProgramEvent(event)
}

const record = refreshGameMapAutoVisualJudgeLearning({ trigger: "manual_or_script_command" })
appendLearningLedgerEvent(record)
console.log(JSON.stringify(record, null, 2))
