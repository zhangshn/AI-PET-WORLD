import fs from "node:fs"
import path from "node:path"
import { randomUUID } from "node:crypto"

import sharp from "sharp"
import { enrichTrainingProcessLedgerEvent } from "./lib/ai-painter-training-ledger-event-analysis.mjs"
import { refreshGameMapAutoVisualJudgeLearning } from "./lib/game-map-auto-visual-judge-learning.mjs"

const latestRuntimeFramePath = path.resolve(
  process.argv[2] ?? ".runtime/game-map-runtime-frame/latest-runtime-frame.json",
)
const formalVisualJudgePath = path.resolve(
  process.argv[3] ??
    ".runtime/game-map-runtime-compositor/world-d0znz8/0/game-map-composite-game-map-frame-home-map-structure-world-d0znz8-0-natural-home-0-formal-visual-judge.json",
)
const ledgerDir = path.resolve(".runtime/ai-painter/training-process-ledger")
const ledgerPath = path.join(ledgerDir, "events.jsonl")
const latestLedgerPath = path.join(ledgerDir, "latest.json")
const diagnosisRoot = path.resolve(".runtime/game-map-review-diagnostics")

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"))
}

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

async function measureHumanReviewGap(imagePath) {
  const { data, info } = await sharp(imagePath, { failOn: "error" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const total = info.width * info.height
  let grayPatchPixels = 0
  let grassVisualPixels = 0
  let pathVisualPixels = 0
  let waterVisualPixels = 0

  for (let index = 0; index < total; index += 1) {
    const offset = index * info.channels
    const red = data[offset] ?? 0
    const green = data[offset + 1] ?? 0
    const blue = data[offset + 2] ?? 0
    const luma = red * 0.299 + green * 0.587 + blue * 0.114
    const maxChannel = Math.max(red, green, blue)
    const minChannel = Math.min(red, green, blue)
    const saturation = maxChannel - minChannel

    if (luma > 55 && luma < 145 && saturation < 34 && red > 70 && green > 70 && blue > 68) {
      grayPatchPixels += 1
    }
    if (green > red * 1.08 && green > blue * 1.02 && luma > 48 && luma < 170) {
      grassVisualPixels += 1
    }
    if (red > 95 && green > 75 && blue < 85 && red > blue * 1.35 && green > blue * 1.15) {
      pathVisualPixels += 1
    }
    if (
      blue > 70 &&
      green > 75 &&
      green >= red * 1.05 &&
      blue >= red * 1.08 &&
      !(green > red * 1.35 && green > blue * 1.05)
    ) {
      waterVisualPixels += 1
    }
  }

  return {
    width: info.width,
    height: info.height,
    grayPatchRatio: round(grayPatchPixels / total),
    grassVisualRatio: round(grassVisualPixels / total),
    pathVisualRatio: round(pathVisualPixels / total),
    waterVisualRatio: round(waterVisualPixels / total),
  }
}

function round(value) {
  return Math.round(value * 10000) / 10000
}

function inferCompositeImagePathFromFormalReport(filePath) {
  if (typeof filePath !== "string" || !filePath.endsWith("-formal-visual-judge.json")) {
    return null
  }
  return filePath.replace(/-formal-visual-judge\.json$/, "-composite-output.png")
}

async function main() {
  const runtimeRecord = readJson(latestRuntimeFramePath)
  const formalReport = readJson(formalVisualJudgePath)
  const runtimeFrame = runtimeRecord.runtimeFrame
  const compositeOutput = runtimeFrame?.composition?.compositeOutput
  const fallbackImagePath = inferCompositeImagePathFromFormalReport(formalVisualJudgePath)
  const imagePath = compositeOutput?.imageUrl
    ? path.resolve(compositeOutput.imageUrl)
    : fallbackImagePath && fs.existsSync(fallbackImagePath)
      ? path.resolve(fallbackImagePath)
      : null
  const imageSha256 = compositeOutput?.imageSha256 ?? formalReport.outputSha256 ?? null

  if (!runtimeFrame || !imagePath || !imageSha256) {
    throw new Error("current_runtime_frame_or_composite_evidence_missing")
  }

  const timestamp = new Date().toISOString()
  const runId = `review-diagnosis-current-game-map-runtime-frame-${timestamp.replace(/[:.]/g, "-")}`
  const measured = await measureHumanReviewGap(imagePath)
  const grassGateBypass =
    formalReport.metrics?.grassVisualRatio < 0.55 &&
    formalReport.metrics?.grassPaletteDensity < 18

  const diagnosis = {
    schemaVersion: "game-map-runtime-frame-review-diagnosis-v1",
    createdAt: timestamp,
    status: "review_gap_recorded",
    runtimeFrameId: runtimeFrame.runtimeFrameId,
    recordId: runtimeRecord.recordId,
    worldId: runtimeFrame.worldId,
    tick: runtimeFrame.tick,
    imageUrl: imagePath,
    imageSha256,
    formalVisualJudge: {
      status: formalReport.status,
      passed: formalReport.passed,
      metrics: formalReport.metrics,
      issues: formalReport.issues ?? [],
    },
    humanReviewDecision: {
      status: "rejected",
      reason: "Owner judged the image as not professional game quality.",
      reasonZh: "项目所有者判断该图未达到专业游戏画面质量。",
    },
    measuredReviewGap: measured,
    rootCauses: [
      {
        code: "gray_patch_artifact_not_checked",
        detail:
          "The generated frame contains a high ratio of low-saturation gray-green terrain patches, but FormalVisualJudge did not have a direct failure gate for this artifact.",
        detailZh:
          "生成画面包含大量低饱和灰绿色地表补丁，但 FormalVisualJudge 没有针对这种伪装材质问题设置直接失败门槛。",
        measuredRatio: measured.grayPatchRatio,
      },
      {
        code: "grass_palette_gate_bypassed_by_ratio_threshold",
        detail:
          "Grass palette density was low, but grassVisualRatio stayed just below the 0.55 gate threshold, so the grass density failure did not trigger.",
        detailZh:
          "草地调色密度很低，但 grassVisualRatio 刚好低于 0.55 触发线，因此草地密度失败条件没有生效。",
        grassVisualRatio: formalReport.metrics?.grassVisualRatio,
        grassPaletteDensity: formalReport.metrics?.grassPaletteDensity,
        bypassed: grassGateBypass,
      },
      {
        code: "compositor_gray_moss_workaround",
        detail:
          "Runtime compositor post-processing used gray moss terrain patches to reduce grass classification pressure, which passed metrics but failed human art direction.",
        detailZh:
          "Runtime Compositor 后处理使用灰色苔斑降低草地分类压力，虽然通过机器指标，但没有通过人工美术方向。",
      },
    ],
    requiredFixes: [
      "Add a FormalVisualJudge gate for large low-saturation gray terrain patch artifacts.",
      "Remove or heavily constrain gray moss fallback in Runtime Compositor.",
      "Make owner rejected machine-pass frames negative review evidence for the next repair cycle.",
      "Record every future modification, judgment, and review as a durable ledger event plus a JSON evidence record.",
    ],
    requiredFixesZh: [
      "给 FormalVisualJudge 增加大面积低饱和灰色地表补丁失败门槛。",
      "移除或严格限制 Runtime Compositor 中的灰色苔斑兜底逻辑。",
      "把项目所有者拒绝的机器通过图作为下一轮修复的负向审核证据。",
      "未来每一次修改、判断、审核都必须写入持久 ledger 事件和 JSON 证据记录。",
    ],
    tags: [
      "review_gap_diagnosis",
      formalReport.passed ? "machine_pass_owner_rejected" : "machine_failed_before_owner_review",
      "gray_patch_artifact",
      "formal_visual_judge_gap",
      "requires_judge_and_compositor_repair",
    ],
  }

  const diagnosisDir = path.join(diagnosisRoot, runId)
  fs.mkdirSync(diagnosisDir, { recursive: true })
  const diagnosisPath = path.join(diagnosisDir, "review-diagnosis.json")
  fs.writeFileSync(diagnosisPath, JSON.stringify(diagnosis, null, 2) + "\n", "utf8")

  const event = enrichTrainingProcessLedgerEvent({
    id: randomUUID(),
    timestamp,
    action: "diagnose_game_map_runtime_frame_review_gap",
    runId,
    kind: "review_diagnosis",
    status: "failed",
    title: formalReport.passed
      ? "FormalVisualJudge passed a RuntimeFrame rejected by owner review"
      : "FormalVisualJudge blocked the current RuntimeFrame before owner review",
    titleZh: formalReport.passed
      ? "FormalVisualJudge 放行了被项目所有者拒绝的 RuntimeFrame"
      : "FormalVisualJudge 在人工验收前阻断了当前 RuntimeFrame",
    detail:
      "The review gap was recorded with root causes, metrics, image reference, required fixes, and durable evidence path.",
    detailZh:
      "本次审核差距已记录根因、指标、图片引用、必需修复项和持久证据路径。",
    script: "scripts/write-game-map-runtime-frame-review-diagnosis.mjs",
    currentStep: "owner_review_failure_root_cause_analysis",
    error: "formal_visual_judge_gap_gray_patch_artifact_not_checked",
    errorZh: "FormalVisualJudge 漏判：未检查灰色补丁伪装材质问题",
    resourceSessionId: imageSha256,
    archiveId: runtimeFrame.runtimeFrameId,
    evidencePath: diagnosisPath,
  })

  fs.mkdirSync(ledgerDir, { recursive: true })
  fs.appendFileSync(ledgerPath, JSON.stringify(event) + "\n", "utf8")
  const events = readLedgerEvents()
  const latestLedger = {
    schemaVersion: "ai-painter-training-process-ledger-v1",
    updatedAt: events.at(-1)?.timestamp ?? null,
    events: events.slice(-80).reverse(),
    summary: buildLedgerSummary(events),
  }
  fs.writeFileSync(latestLedgerPath, JSON.stringify(latestLedger, null, 2) + "\n", "utf8")
  refreshAutoVisualJudgeLearning(event)

  console.log(
    JSON.stringify(
      {
        ok: true,
        status: "review_gap_diagnosis_recorded",
        diagnosisPath,
        ledgerPath,
        grayPatchRatio: measured.grayPatchRatio,
        grassGateBypass,
      },
      null,
      2,
    ),
  )
}

function refreshAutoVisualJudgeLearning(event) {
  try {
    refreshGameMapAutoVisualJudgeLearning({
      trigger: "review_diagnosis_ledger_event",
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
  await main()
} catch (error) {
  console.error(
    JSON.stringify(
      {
        ok: false,
        status: "review_gap_diagnosis_record_failed",
        error: error instanceof Error ? error.message : String(error),
        latestRuntimeFramePath,
        formalVisualJudgePath,
      },
      null,
      2,
    ),
  )
  process.exit(1)
}
