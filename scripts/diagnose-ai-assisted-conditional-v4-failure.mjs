import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import {
  appendAiPainterProgramEvent,
  formatShanghai,
  projectPath,
  writeImmutableProgramRun,
} from "./lib/ai-painter-program-event-store.mjs"

const ROOT = process.cwd()
const VALIDATION_POINTER = ".runtime/ai-painter/ai-assisted-conditional-inference-validation/latest.json"
const OUTPUT_ROOT = ".runtime/ai-painter/ai-assisted-conditional-repair-diagnostics"
const OWNER_COMMAND_REF = "owner-authorized-v4-diagnosis-and-repair-record-20260721"
const REQUIRED_ISSUES = [
  "condition_terrain_water_unexpected_signal",
  "condition_terrain_path_ground_coverage_mismatch",
  "professional_multiscale_texture_noise_overload",
  "professional_quiet_region_missing",
]
const SOURCE_PATHS = [
  "ml/ai-painter/config/complete-world-ai-assisted-cold-start-v4.json",
  "ml/ai-painter/src/ai_painter/complete_world/model.py",
  "ml/ai-painter/src/ai_painter/complete_world/dataset.py",
  "ml/ai-painter/src/ai_painter/complete_world/diffusion.py",
  "ml/ai-painter/scripts/train_ai_assisted_conditional_denoiser.py",
  "ml/ai-painter/scripts/infer_ai_assisted_conditional_validation.py",
  "scripts/review-ai-assisted-conditional-inference-validation.mjs",
]

const createdAtUtc = new Date().toISOString()
const runId = `ai-assisted-conditional-v4-diagnosis-${createdAtUtc.replace(/[:.]/g, "-")}`
const validation = readJson(VALIDATION_POINTER)
assert(validation?.runId?.startsWith("ai-assisted-conditional-inference-validation-v4-"), "latest validation is not V4")
assert(validation.status === "machine_rejected", "latest V4 validation is not machine rejected")
assert(validation.machineReviewPath, "V4 machine review path is missing")
assert(fileHashMatches(validation.machineReviewPath, validation.machineReviewSha256), "V4 machine review hash failed")
assert(fileHashMatches(validation.outputImagePath, validation.outputImageSha256), "V4 validation image hash failed")

const review = readJson(validation.machineReviewPath)
const issueCodes = (review.issues ?? []).map((issue) => issue.code)
assert(REQUIRED_ISSUES.every((code) => issueCodes.includes(code)), "V4 machine review does not contain the locked four failures")

const sourceEvidence = SOURCE_PATHS.map((value) => ({
  path: value,
  sha256: sha256File(value),
}))
const diagnosis = {
  schemaVersion: "ai-assisted-conditional-v4-diagnosis-and-repair-record-v1",
  status: "diagnosis_completed_repair_implementation_authorized",
  runId,
  createdAtUtc,
  createdAtAsiaShanghai: formatShanghai(createdAtUtc),
  ownerCommandRef: OWNER_COMMAND_REF,
  sourceValidation: {
    runId: validation.runId,
    conditionLabel: validation.conditionLabel,
    sourceSplit: validation.sourceSplit,
    manifestPath: validation.manifestPath ?? VALIDATION_POINTER,
    machineReviewPath: validation.machineReviewPath,
    machineReviewSha256: validation.machineReviewSha256,
    imagePath: validation.outputImagePath,
    imageSha256: validation.outputImageSha256,
    checkpointPath: validation.modelCheckpointPath,
    checkpointSha256: validation.modelCheckpointSha256,
  },
  lockedFailureCodes: REQUIRED_ISSUES,
  findings: [
    {
      id: "v4-condition-output-binding-shortcut",
      severity: "P0",
      failureCodes: REQUIRED_ISSUES.slice(0, 2),
      title: "V4 condition reconstruction is not bound to the predicted clean latent",
      titleZh: "V4 条件重建没有绑定到最终预测的干净潜变量",
      rootCause: "The V4 condition head reads the final U-Net feature map that already contains direct condition features. It can reconstruct the 23 channels without proving that predicted_clean or decoded RGB obeys them.",
      rootCauseZh: "V4 条件头直接读取已混入条件特征的 U-Net 末端特征，因此可以绕过 predicted_clean 和最终 RGB 完成条件重建，不能证明出图遵守无水与道路覆盖条件。",
      evidence: [
        "model.py: condition_reconstruction(up0)",
        "training: condition reconstruction loss is computed from the internal feature head",
        "inference: condition reconstruction head is not used during sampling",
      ],
      repair: "V5 predicts all 23 channels from predicted_clean through a latent condition probe and uses channel-balanced discrete loss so empty water and sparse paths both contribute.",
      repairZh: "V5 改为从 predicted_clean 经潜变量条件探针预测全部 23 通道，并采用逐通道正负平衡离散损失，使空水体和稀疏道路都具有有效约束。",
    },
    {
      id: "v4-checkpoint-objective-misses-complete-sampling-quality",
      severity: "P0",
      failureCodes: REQUIRED_ISSUES.slice(2),
      title: "V4 checkpoint selection measures one-step restoration but not complete sampling hierarchy",
      titleZh: "V4 checkpoint 只衡量单步复原，没有衡量完整采样后的视觉层级",
      rootCause: "The best checkpoint is selected from teacher-forced one-step losses. It does not score multiscale texture energy or quiet-region preservation on the predicted output path.",
      rootCauseZh: "最佳 checkpoint 由带真实干净潜变量的一步复原损失选择，未对预测输出路径的多尺度纹理能量和安静区域保持能力评分。",
      evidence: [
        "bestCheckpointMetric=fixed_grid_composite_condition_quality_score_v4",
        "professional_multiscale_texture_noise_overload",
        "professional_quiet_region_missing",
      ],
      repair: "V5 adds multiscale latent gradient/laplacian hierarchy and target-derived quiet-region excess losses to training and checkpoint selection.",
      repairZh: "V5 在训练和 checkpoint 选择中加入多尺度潜变量梯度/拉普拉斯层级损失，以及由目标潜变量派生的安静区域超量损失。",
    },
    {
      id: "v4-validation-split-is-not-strict-held-out",
      severity: "P1",
      failureCodes: [],
      title: "complete-map-v2-005 participates in checkpoint selection as validation data",
      titleZh: "complete-map-v2-005 作为 validation 数据参与了 checkpoint 选择",
      rootCause: "The sample is excluded from optimizer batches but is repeatedly evaluated while selecting the best epoch, so it is not a strict final held-out sample.",
      rootCauseZh: "该样本没有进入优化批次，但每轮都会参与最佳 epoch 选择，因此不是严格意义上的最终未见样本。",
      evidence: [
        `sourceSplit=${validation.sourceSplit}`,
        "trainer selects best checkpoint with loaders['validation']",
      ],
      repair: "V5 keeps validation for checkpoint selection and reserves challenge for final held-out inference only.",
      repairZh: "V5 继续用 validation 选择 checkpoint，但最终未见结构推理只能使用从未参与选择的 challenge 分区。",
    },
    {
      id: "v4-random-timestep-coverage",
      severity: "P1",
      failureCodes: REQUIRED_ISSUES,
      title: "Random timestep sampling does not guarantee per-epoch high-noise coverage",
      titleZh: "随机时间步不能保证每轮覆盖高噪声区间",
      rootCause: "With sixteen training samples and batch size one, uniform random timesteps can leave important diffusion ranges underrepresented in an epoch.",
      rootCauseZh: "训练集仅 16 张且 batch size 为 1，均匀随机时间步可能让关键扩散区间在单轮中覆盖不足。",
      evidence: ["train split sampleCount=16", "torch.randint timestep selection"],
      repair: "V5 uses deterministic stratified timestep coverage with epoch rotation while preserving the 1000-step diffusion contract.",
      repairZh: "V5 使用按轮次轮换的确定性分层时间步覆盖，同时保持 1000 步扩散合同不变。",
    },
  ],
  repairBoundary: {
    newVersion: "V5",
    preserveV4Evidence: true,
    preserveWorldFacts: true,
    preserveConditionChannelCount: 23,
    preserveConditionIdentityAndOrder: true,
    preserveReviewThresholds: true,
    gpuTrainingStarted: false,
    imageInferenceStarted: false,
    formalInferenceEligible: false,
    runtimeFrameEligible: false,
    canEnterWorld: false,
  },
  implementationPlan: [
    "add predicted-clean latent condition probe",
    "add channel-balanced discrete condition loss",
    "add multiscale latent gradient and laplacian hierarchy losses",
    "add quiet-region excess loss",
    "add deterministic stratified timestep schedule",
    "reserve challenge split for strict held-out inference",
    "run static and CPU forward/backward regression only",
  ],
  sourceEvidence,
  automaticStorage: true,
}

const written = writeImmutableProgramRun({
  root: OUTPUT_ROOT,
  runId,
  fileName: "diagnosis.json",
  record: diagnosis,
  latest: {
    sourceValidationRunId: validation.runId,
    issueCodes: REQUIRED_ISSUES,
    repairVersion: "V5",
    gpuTrainingStarted: false,
    imageInferenceStarted: false,
  },
})
appendAiPainterProgramEvent({
  action: "diagnose_ai_assisted_conditional_v4_failure",
  runId,
  kind: "review_diagnosis",
  status: "success",
  title: "V4 held-out validation diagnosis and repair boundary recorded",
  titleZh: "V4 未见结构验证诊断与修复边界已记录",
  detail: `issues=${REQUIRED_ISSUES.join(",")}; repairVersion=V5; gpuTrainingStarted=false; imageInferenceStarted=false`,
  detailZh: `问题码=${REQUIRED_ISSUES.join("，")}；修复版本=V5；GPU训练已启动=false；图像推理已启动=false`,
  script: "scripts/diagnose-ai-assisted-conditional-v4-failure.mjs",
  currentStep: "v4_failure_diagnosis_and_v5_repair",
  finalGameMapSuccess: false,
  canEnterWorld: false,
  archiveId: runId,
  evidencePath: written.runPath,
})

console.log(JSON.stringify({
  status: diagnosis.status,
  runId,
  diagnosisPath: written.runPath,
  issueCodes: REQUIRED_ISSUES,
  repairVersion: "V5",
  gpuTrainingStarted: false,
  imageInferenceStarted: false,
}, null, 2))

function readJson(value) {
  return JSON.parse(fs.readFileSync(path.resolve(ROOT, value), "utf8"))
}

function sha256File(value) {
  return crypto.createHash("sha256").update(fs.readFileSync(path.resolve(ROOT, value))).digest("hex")
}

function fileHashMatches(value, expected) {
  return Boolean(value && expected && fs.existsSync(path.resolve(ROOT, value)) && sha256File(value) === expected)
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}
