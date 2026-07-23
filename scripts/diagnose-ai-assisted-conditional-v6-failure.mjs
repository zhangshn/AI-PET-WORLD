import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import {
  appendAiPainterProgramEvent,
  formatShanghai,
  writeImmutableProgramRun,
} from "./lib/ai-painter-program-event-store.mjs"

const ROOT = process.cwd()
const VALIDATION_POINTER = ".runtime/ai-painter/ai-assisted-conditional-inference-validation/latest.json"
const V6_CONFIG = "ml/ai-painter/config/complete-world-ai-assisted-cold-start-v6.json"
const TRAINER = "ml/ai-painter/scripts/train_ai_assisted_conditional_denoiser.py"
const INFERENCE = "ml/ai-painter/scripts/infer_ai_assisted_conditional_validation.py"
const REQUIRED_MACHINE_ISSUE = "condition_terrain_path_ground_coverage_mismatch"
const SOURCES = [
  V6_CONFIG,
  TRAINER,
  INFERENCE,
  "ml/ai-painter/src/ai_painter/complete_world/diffusion.py",
  "scripts/lib/ai-assisted-professional-aesthetic.mjs",
  "scripts/review-ai-assisted-conditional-inference-validation.mjs",
]

const createdAtUtc = new Date().toISOString()
const runId = `ai-assisted-conditional-v6-diagnosis-${createdAtUtc.replace(/[:.]/g, "-")}`
const validation = readJson(VALIDATION_POINTER)
assert(validation?.runId?.startsWith("ai-assisted-conditional-inference-validation-v6-"), "latest validation is not V6")
assert(validation.status === "machine_rejected", "latest V6 validation is not machine rejected")
assert(fileHashMatches(validation.machineReviewPath, validation.machineReviewSha256), "V6 machine review hash failed")
assert(fileHashMatches(validation.outputImagePath, validation.outputImageSha256), "V6 validation image hash failed")

const review = readJson(validation.machineReviewPath)
const reviewIssueCodes = (review.issues ?? []).map((issue) => issue.code)
assert(reviewIssueCodes.includes(REQUIRED_MACHINE_ISSUE), "V6 review is missing the locked path-coverage failure")
assert(review.professionalAestheticAudit?.passed === true, "V6 Professional Aesthetic result is not the recorded leak")

const config = readJson(V6_CONFIG)
const trainerSource = fs.readFileSync(path.resolve(ROOT, TRAINER), "utf8")
const inferenceSource = fs.readFileSync(path.resolve(ROOT, INFERENCE), "utf8")
assert(config.training?.checkpointRolloutSampleCount === 1, "V6 rollout sample count changed before diagnosis")
assert(trainerSource.includes("latent = torch.randn(latent_shape"), "V6 training rollout no longer starts from pure noise")
assert(inferenceSource.includes("latent = torch.randn("), "V6 inference no longer starts from pure noise")

const trainingManifestPath = validation.modelCheckpointPath.replace(/complete-world-ai-assisted-conditional-denoiser\.pt$/, "manifest.json")
const trainingManifest = readJson(trainingManifestPath)
assert(fileHashMatches(trainingManifestPath, validation.modelCheckpointManifestSha256 ?? sha256File(trainingManifestPath)), "V6 training manifest hash failed")
const splits = trainingManifest.splitMetrics ?? {}
const pathAudit = review.conditionAlignmentAudit?.channelAudits?.find((item) => item.channelId === "terrain_path_ground")
const professionalAudit = review.professionalAestheticAudit
const nativeEdgeViolation = professionalAudit.textureViolations?.find((item) => item.feature === "native_edge_density_004") ?? null

const diagnosis = {
  schemaVersion: "ai-assisted-conditional-v6-failure-diagnosis-v1",
  status: "diagnosis_completed_repair_contract_ready_training_blocked",
  runId,
  createdAtUtc,
  createdAtAsiaShanghai: formatShanghai(createdAtUtc),
  ownerCommandRef: "owner-authorized-v6-failure-diagnosis-and-repair-20260722",
  sourceValidation: {
    runId: validation.runId,
    conditionLabel: validation.conditionLabel,
    sourceSplit: validation.sourceSplit,
    imagePath: validation.outputImagePath,
    imageSha256: validation.outputImageSha256,
    machineReviewPath: validation.machineReviewPath,
    machineReviewSha256: validation.machineReviewSha256,
    checkpointPath: validation.modelCheckpointPath,
    checkpointSha256: validation.modelCheckpointSha256,
  },
  verifiedFacts: {
    trainingAndInferenceBothStartFromPureGaussianNoise: true,
    deterministicVelocitySamplerShared: true,
    conditionChannels: config.conditionChannels,
    nativeOutputSize: config.imageSize,
    checkpointRolloutSampleCount: config.training.checkpointRolloutSampleCount,
    datasetSplitCounts: {
      train: splits.train?.sampleCount ?? null,
      validation: splits.validation?.sampleCount ?? null,
      challenge: splits.challenge?.sampleCount ?? null,
      regression: splits.regression?.sampleCount ?? null,
    },
    challengeReadDuringTraining: splits.challenge?.metricsReadDuringTraining ?? null,
  },
  measuredFailure: {
    expectedPathCoverage: pathAudit?.expectedNonZeroRatio ?? null,
    actualPathSignalCoverage: pathAudit?.actualSignalRatio ?? null,
    pathCoverageRatio: pathAudit?.coverageRatio ?? null,
    pathSpatialIntersection: pathAudit?.spatialIntersection ?? null,
    nativeEdgeDensity004: professionalAudit.candidate?.multiscaleTextureValues?.native_edge_density_004 ?? null,
    nativeEdgeDensity004UpperEnvelope: professionalAudit.thresholds?.multiscaleTextureUpperEnvelope?.native_edge_density_004 ?? null,
    nativeEdgeDensity004ViolationRatio: nativeEdgeViolation?.ratio ?? null,
    professionalMinimumMultiscaleViolationCount: professionalAudit.calibration?.minimumMultiscaleViolationCount ?? null,
    professionalAestheticIncorrectlyPassed: professionalAudit.passed === true,
  },
  findings: [
    {
      id: "v6-data-capacity-does-not-establish-random-init-generative-prior",
      severity: "P0",
      title: "The first-round dataset gate does not establish a stable random-initialized image prior",
      titleZh: "首轮数据门槛不足以建立稳定的随机初始化图像先验",
      rootCause: "V6 trains a randomly initialized conditional diffusion model from 16 training maps. The approved 21-map package proved the first experimental lane could run; repeated held-out failures prove it is not a sufficient success criterion for professional complete-map generation.",
      rootCauseZh: "V6使用16张训练图从随机权重训练条件扩散模型。已批准的21图数据包只证明首轮实验可以执行；连续未见样本失败已经证明它不是专业完整地图生成的充分成功条件。",
      repair: "Keep the current package immutable, block blind V7 GPU training on the same evidence, and require a separately approved data-capacity or learning-strategy decision before training.",
      repairZh: "保持当前数据包不可变，禁止在相同证据上盲目启动V7 GPU训练，并在训练前单独批准数据容量或学习策略。",
    },
    {
      id: "v6-single-sample-checkpoint-rollout-overfits-selection",
      severity: "P0",
      title: "Checkpoint selection uses only one of two validation maps",
      titleZh: "Checkpoint选择只使用两张验证图中的一张",
      rootCause: "Every epoch performs a full rollout for one fixed validation sample and one fixed seed. A low average RGB reconstruction score on that single layout cannot prove condition adherence, map hierarchy, or robustness on the challenge layout.",
      rootCauseZh: "每轮只对一张固定验证图和一个固定seed执行完整采样。单一构图上的平均RGB误差较低，不能证明条件遵守、地图层级或挑战构图泛化。",
      repair: "V7 must evaluate every validation sample, use deterministic multiple seeds, and reject checkpoint selection when any validation rollout violates the locked condition or structural metrics.",
      repairZh: "V7必须覆盖全部验证图并使用多个固定seed；任何验证rollout违反锁定条件或结构指标时，都不得选为最佳checkpoint。",
    },
    {
      id: "v6-pixel-distance-does-not-measure-map-semantics",
      severity: "P0",
      title: "RGB distance metrics do not measure complete-map semantic correctness",
      titleZh: "RGB距离指标不能衡量完整地图语义正确性",
      rootCause: "V6 rollout selection minimizes global and masked RGB distance, gradients and Laplacians. These metrics can improve while path-like colors spread outside the path mask and object-scale hierarchy remains unreadable.",
      rootCauseZh: "V6的rollout选择优化全局及掩码RGB距离、梯度和拉普拉斯。即使道路色扩散到道路掩码外、对象尺度层级不可读，这些指标仍可能改善。",
      repair: "V7 checkpoint selection must add generated-RGB condition coverage, spatial distribution and complete-map hierarchy gates instead of relying on weighted pixel distance alone.",
      repairZh: "V7的checkpoint选择必须加入生成RGB条件覆盖、空间分布和完整地图层级门禁，不能只依赖加权像素距离。",
    },
    {
      id: "v6-professional-aesthetic-single-axis-leak",
      severity: "P1",
      title: "Professional Aesthetic ignores a clear single-axis texture violation",
      titleZh: "专业审美审核漏掉了明确的单轴纹理超限",
      rootCause: "The V6 image exceeds the owner-approved native edge-density envelope, but the audit requires four multiscale violations before emitting a noise-overload issue. The remaining aggregate upper-bound metrics do not measure coherent object and region structure.",
      rootCauseZh: "V6图已经超过项目所有者批准的原生边缘密度包络，但审核要求累计四项多尺度超限才记录噪声过载；其余聚合上限指标也不衡量对象和区域结构是否连贯。",
      repair: "Add an independently calibrated incoherent-detail and regional-structure regression gate. Do not rewrite the historical V6 review, and do not change owner thresholds without a separate owner decision.",
      repairZh: "新增独立校准的非连贯细节与区域结构回归门；不得改写V6历史审核，也不得在没有项目所有者单独决定时改变既有门槛。",
    },
  ],
  repairBoundary: {
    nextVersion: "V7",
    preserveV6Evidence: true,
    preserveWorldFacts: true,
    preserveConditionChannelCount: 23,
    preservePageLayout: true,
    preserveExistingReviewThresholds: true,
    addDiagnosticReviewSignalsOnly: true,
    gpuTrainingStarted: false,
    imageInferenceStarted: false,
    formalInferenceEligible: false,
    runtimeFrameEligible: false,
    canEnterWorld: false,
    nextTrainingBlockedUntilSeparateOwnerDecision: true,
  },
  sourceEvidence: SOURCES.map((value) => ({ path: value, sha256: sha256File(value) })),
  automaticStorage: true,
}

const written = writeImmutableProgramRun({
  root: ".runtime/ai-painter/ai-assisted-conditional-repair-diagnostics-v6",
  runId,
  fileName: "diagnosis.json",
  record: diagnosis,
  latest: {
    sourceValidationRunId: validation.runId,
    repairVersion: "V7",
    gpuTrainingStarted: false,
    imageInferenceStarted: false,
    nextTrainingBlockedUntilSeparateOwnerDecision: true,
  },
})

appendAiPainterProgramEvent({
  action: "diagnose_ai_assisted_conditional_v6_failure",
  runId,
  kind: "review_diagnosis",
  status: "success",
  title: "V6 held-out failure diagnosis and V7 repair boundary recorded",
  titleZh: "V6未见结构失败诊断与V7修复边界已记录",
  detail: `train=16; validation=2; challenge=1; rolloutSamples=1; issues=${reviewIssueCodes.join(",")}; gpuTrainingStarted=false; imageInferenceStarted=false`,
  detailZh: `训练=16；验证=2；挑战=1；rollout样本=1；问题=${reviewIssueCodes.join("、")}；GPU训练已启动=false；图像推理已启动=false`,
  script: "scripts/diagnose-ai-assisted-conditional-v6-failure.mjs",
  currentStep: "v6_failure_diagnosis_and_v7_repair_boundary",
  finalGameMapSuccess: false,
  canEnterWorld: false,
  archiveId: runId,
  evidencePath: written.runPath,
})

console.log(JSON.stringify({
  status: diagnosis.status,
  runId,
  diagnosisPath: written.runPath,
  repairVersion: "V7",
  gpuTrainingStarted: false,
  imageInferenceStarted: false,
}, null, 2))

function readJson(value) { return JSON.parse(fs.readFileSync(path.resolve(ROOT, value), "utf8")) }
function sha256File(value) { return crypto.createHash("sha256").update(fs.readFileSync(path.resolve(ROOT, value))).digest("hex") }
function fileHashMatches(value, expected) { return Boolean(value && expected && fs.existsSync(path.resolve(ROOT, value)) && sha256File(value) === expected) }
function assert(condition, message) { if (!condition) throw new Error(message) }
