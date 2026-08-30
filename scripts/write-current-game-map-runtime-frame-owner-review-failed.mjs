import fs from "node:fs"
import path from "node:path"
import { randomUUID } from "node:crypto"
import { enrichTrainingProcessLedgerEvent } from "./lib/ai-painter-training-ledger-event-analysis.mjs"
import { appendAiPainterProgramEvent } from "./lib/ai-painter-program-event-store.mjs"
import { refreshGameMapAutoVisualJudgeLearning } from "./lib/game-map-auto-visual-judge-learning.mjs"

const latestRuntimeFramePath = path.resolve(
  process.argv[2] ?? ".runtime/game-map-runtime-frame/latest-runtime-frame.json",
)
const ledgerDir = path.resolve(".runtime/ai-painter/training-process-ledger")
const ledgerPath = path.join(ledgerDir, "events.jsonl")
const ownerReviewRoot = path.resolve(".runtime/game-map-owner-reviews")

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"))
}

function main() {
  const record = readJson(latestRuntimeFramePath)
  const runtimeFrame = record.runtimeFrame
  const compositeOutput = runtimeFrame?.composition?.compositeOutput

  if (!runtimeFrame || !compositeOutput?.imageSha256) {
    throw new Error("current_runtime_frame_or_composite_output_missing")
  }

  const timestamp = new Date().toISOString()
  const runId = `owner-review-current-game-map-runtime-frame-${timestamp.replace(/[:.]/g, "-")}`
  const event = enrichTrainingProcessLedgerEvent({
    id: randomUUID(),
    timestamp,
    action: "owner_review_game_map_runtime_frame",
    runId,
    kind: "step_failed",
    status: "failed",
    title: "Project owner rejected current /world RuntimeFrame visual quality",
    titleZh: "项目所有者拒绝当前 /world RuntimeFrame 画面质量",
    detail:
      "Current full RuntimeFrame is stored as a negative failure sample. It must not be treated as a final professional game map until a later runtime frame receives explicit owner approval.",
    detailZh:
      "当前完整 RuntimeFrame 已作为负向失败样本保存；在后续 RuntimeFrame 获得项目所有者明确通过前，不得把它当作最终专业游戏地图。",
    script: "scripts/write-current-game-map-runtime-frame-owner-review-failed.mjs",
    currentStep: "owner_final_acceptance_visual_check",
    error: "owner_review_failed_current_map_not_professional_game_standard",
    errorZh: "项目所有者人工审核失败：当前地图未达到专业游戏标准",
    resourceSessionId: compositeOutput.imageSha256,
    archiveId: runtimeFrame.runtimeFrameId,
  })

  appendAiPainterProgramEvent(event)
  refreshAutoVisualJudgeLearning(event)

  const reviewDir = path.join(ownerReviewRoot, runId)
  fs.mkdirSync(reviewDir, { recursive: true })
  const reviewRecord = {
    schemaVersion: "game-map-runtime-frame-owner-review-v1",
    status: "failed",
    ownerDecision: "rejected",
    createdAt: timestamp,
    runtimeFrameId: runtimeFrame.runtimeFrameId,
    worldId: runtimeFrame.worldId,
    tick: runtimeFrame.tick,
    imageUrl: compositeOutput.imageUrl,
    imageSha256: compositeOutput.imageSha256,
    reasonCodes: [
      "not_professional_game_standard",
      "training_texture_or_material_composite_look",
      "requires_continued_local_model_training",
    ],
    reasonCodesZh: [
      "未达到专业游戏标准",
      "画面仍像训练贴图或材料合成结果",
      "需要继续本地小模型训练和修复",
    ],
    ledgerEventId: event.id,
  }
  fs.writeFileSync(path.join(reviewDir, "owner-review.json"), JSON.stringify(reviewRecord, null, 2) + "\n", "utf8")

  console.log(
    JSON.stringify(
      {
        ok: true,
        status: "owner_review_failed_recorded",
        runtimeFrameId: runtimeFrame.runtimeFrameId,
        imageSha256: compositeOutput.imageSha256,
        ledgerPath,
        ownerReviewPath: path.join(reviewDir, "owner-review.json"),
      },
      null,
      2,
    ),
  )
}

function refreshAutoVisualJudgeLearning(event) {
  try {
    refreshGameMapAutoVisualJudgeLearning({
      trigger: "owner_review_ledger_event",
      triggerEventId: event.id,
    })
  } catch (error) {
    console.warn(
      `[auto-visual-judge-learning] refresh failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
    )
  }
}

try {
  main()
} catch (error) {
  console.error(
    JSON.stringify(
      {
        ok: false,
        status: "owner_review_failed_record_write_failed",
        error: error instanceof Error ? error.message : String(error),
        latestRuntimeFramePath,
      },
      null,
      2,
    ),
  )
  process.exit(1)
}
