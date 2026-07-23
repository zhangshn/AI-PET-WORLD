import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import {
  appendAiPainterProgramEvent,
  formatShanghai,
  writeImmutableProgramRun,
} from "./lib/ai-painter-program-event-store.mjs"

const ROOT = process.cwd()
const POINTER = ".runtime/ai-painter/ai-assisted-conditional-inference-validation/latest.json"
const REQUIRED_ISSUES = [
  "condition_terrain_path_ground_coverage_mismatch",
  "professional_multiscale_texture_noise_overload",
]
const SOURCES = [
  "ml/ai-painter/config/complete-world-ai-assisted-cold-start-v5.json",
  "ml/ai-painter/config/complete-world-ai-assisted-cold-start-v6.json",
  "ml/ai-painter/src/ai_painter/complete_world/model.py",
  "ml/ai-painter/scripts/train_ai_assisted_conditional_denoiser.py",
  "ml/ai-painter/scripts/infer_ai_assisted_conditional_validation.py",
  "scripts/review-ai-assisted-conditional-inference-validation.mjs",
]
const createdAtUtc = new Date().toISOString()
const runId = `ai-assisted-conditional-v5-diagnosis-${createdAtUtc.replace(/[:.]/g, "-")}`
const validation = readJson(POINTER)
assert(validation?.runId?.startsWith("ai-assisted-conditional-inference-validation-v5-"), "latest validation is not V5")
assert(validation.status === "machine_rejected", "latest V5 validation is not machine rejected")
assert(fileHashMatches(validation.machineReviewPath, validation.machineReviewSha256), "V5 machine review hash failed")
assert(fileHashMatches(validation.outputImagePath, validation.outputImageSha256), "V5 validation image hash failed")
const review = readJson(validation.machineReviewPath)
const issueCodes = (review.issues ?? []).map((issue) => issue.code)
assert(REQUIRED_ISSUES.every((code) => issueCodes.includes(code)), "V5 review does not contain the locked failures")

const diagnosis = {
  schemaVersion: "ai-assisted-conditional-v5-diagnosis-and-v6-repair-v1",
  status: "diagnosis_completed_v6_repair_implementation_authorized",
  runId,
  createdAtUtc,
  createdAtAsiaShanghai: formatShanghai(createdAtUtc),
  ownerCommandRef: "owner-authorized-v5-diagnosis-and-repair-20260721",
  sourceValidation: {
    runId: validation.runId,
    conditionLabel: validation.conditionLabel,
    sourceSplit: validation.sourceSplit,
    machineReviewPath: validation.machineReviewPath,
    machineReviewSha256: validation.machineReviewSha256,
    imagePath: validation.outputImagePath,
    imageSha256: validation.outputImageSha256,
    checkpointPath: validation.modelCheckpointPath,
    checkpointSha256: validation.modelCheckpointSha256,
  },
  lockedFailureCodes: REQUIRED_ISSUES,
  measuredFailure: {
    expectedPathCoverage: review.audits?.conditionAdherence?.channels?.terrain_path_ground?.expectedNonZeroRatio ?? null,
    actualPathSignalCoverage: review.audits?.conditionAdherence?.channels?.terrain_path_ground?.actualVisualSignalRatio ?? null,
    pathCoverageRatio: review.audits?.conditionAdherence?.channels?.terrain_path_ground?.coverageRatio ?? null,
    edgeDensity: review.metrics?.edgeDensity ?? null,
  },
  findings: [
    {
      id: "v5-latent-probe-shortcut",
      severity: "P0",
      title: "Latent condition recovery does not prove decoded RGB adherence",
      titleZh: "潜变量可恢复条件不等于解码 RGB 遵守条件",
      rootCause: "The V5 probe can recover sparse masks from predicted_clean while the frozen decoder still produces excessive path-like texture outside the path region.",
      rootCauseZh: "V5 探针可以从 predicted_clean 恢复稀疏掩码，但冻结解码器仍可能在道路范围外生成过量类道路纹理。",
      repair: "V6 supervises decoded RGB globally and independently inside path, water, shoreline, object-footprint and focal masks.",
      repairZh: "V6 同时约束全局解码 RGB，并对道路、水体、岸线、物体占地和焦点区域分别归一化监督。",
    },
    {
      id: "v5-one-step-checkpoint-selection-gap",
      severity: "P0",
      title: "One-step latent checkpoint selection misses complete-sampling RGB failure",
      titleZh: "单步潜变量 checkpoint 选择漏掉完整采样 RGB 失败",
      rootCause: "V5 selects epochs from teacher-forced one-step latent metrics and never scores the deterministic full sampling trajectory.",
      rootCauseZh: "V5 仅依据带真实目标的一步潜变量指标选择 epoch，没有评价确定性完整采样轨迹。",
      repair: "V6 adds fixed-seed deterministic full-rollout RGB quality to checkpoint selection using validation samples only.",
      repairZh: "V6 仅使用 validation 样本，把固定 seed 的确定性完整采样 RGB 质量纳入 checkpoint 选择。",
    },
    {
      id: "v5-challenge-read-during-training-reporting",
      severity: "P1",
      title: "Challenge was evaluated after training before the authorized held-out inference",
      titleZh: "Challenge 在获授权未见结构推理前被训练报告读取",
      rootCause: "V5 excluded challenge from optimizer and checkpoint selection, but the trainer still calculated final split metrics and condition evidence for it.",
      rootCauseZh: "V5 未把 challenge 用于优化或 checkpoint 选择，但训练报告仍计算了它的分区指标和条件证据。",
      repair: "V6 records challenge identity and count only; pixels and condition tensors remain unread until separately authorized inference.",
      repairZh: "V6 只记录 challenge 身份和数量；在单独授权推理前不读取其像素和条件张量。",
    },
  ],
  repairBoundary: {
    newVersion: "V6",
    preserveV5Evidence: true,
    preserveWorldFacts: true,
    preserveConditionChannelCount: 23,
    preserveReviewThresholds: true,
    gpuTrainingStarted: false,
    imageInferenceStarted: false,
    formalInferenceEligible: false,
    runtimeFrameEligible: false,
    canEnterWorld: false,
  },
  sourceEvidence: SOURCES.map((value) => ({ path: value, sha256: sha256File(value) })),
  automaticStorage: true,
}
const written = writeImmutableProgramRun({
  root: ".runtime/ai-painter/ai-assisted-conditional-repair-diagnostics-v5",
  runId,
  fileName: "diagnosis.json",
  record: diagnosis,
  latest: { sourceValidationRunId: validation.runId, repairVersion: "V6", gpuTrainingStarted: false, imageInferenceStarted: false },
})
appendAiPainterProgramEvent({
  action: "diagnose_ai_assisted_conditional_v5_failure",
  runId,
  kind: "review_diagnosis",
  status: "success",
  title: "V5 held-out failure diagnosis and V6 repair boundary recorded",
  titleZh: "V5 未见结构失败诊断与 V6 修复边界已记录",
  detail: `issues=${REQUIRED_ISSUES.join(",")}; gpuTrainingStarted=false; imageInferenceStarted=false`,
  detailZh: `问题码=${REQUIRED_ISSUES.join("，")}；GPU训练已启动=false；图像推理已启动=false`,
  script: "scripts/diagnose-ai-assisted-conditional-v5-failure.mjs",
  currentStep: "v5_failure_diagnosis_and_v6_repair",
  finalGameMapSuccess: false,
  canEnterWorld: false,
  archiveId: runId,
  evidencePath: written.runPath,
})
console.log(JSON.stringify({ status: diagnosis.status, runId, diagnosisPath: written.runPath, repairVersion: "V6" }, null, 2))

function readJson(value) { return JSON.parse(fs.readFileSync(path.resolve(ROOT, value), "utf8")) }
function sha256File(value) { return crypto.createHash("sha256").update(fs.readFileSync(path.resolve(ROOT, value))).digest("hex") }
function fileHashMatches(value, expected) { return Boolean(value && expected && fs.existsSync(path.resolve(ROOT, value)) && sha256File(value) === expected) }
function assert(condition, message) { if (!condition) throw new Error(message) }
