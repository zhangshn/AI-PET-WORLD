import { createHash } from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import {
  appendAiPainterProgramEvent,
  formatShanghai,
  writeImmutableProgramRun,
} from "./lib/ai-painter-program-event-store.mjs"

const ROOT = process.cwd()
const MODEL_ROOT = ".runtime/ai-painter/project-owned-complete-world-conditional-denoiser-v7"
const OUTPUT_ROOT = ".runtime/ai-painter/training-token-ledgers"
const DEFAULT_CONFIG = "ml/ai-painter/config/complete-world-ai-assisted-cold-start-v7.json"
const manifests = fs.readdirSync(resolve(MODEL_ROOT), { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && entry.name.startsWith("ai-assisted-conditional-denoiser-v7-"))
  .map((entry) => ({
    runId: entry.name,
    manifestPath: `${MODEL_ROOT}/${entry.name}/manifest.json`,
  }))
  .filter((item) => fs.existsSync(resolve(item.manifestPath)))

const createdAtUtc = new Date().toISOString()
const runId = `ai-assisted-training-token-ledger-build-${createdAtUtc.replace(/[:.]/g, "-")}`
appendAiPainterProgramEvent({
  action: "build_ai_assisted_training_token_ledgers",
  runId,
  kind: "token_ledger_build_started",
  status: "running",
  title: "Local AI training token ledger build started",
  titleZh: "本地AI训练Token账本构建已开始",
  currentStep: "derive_per_run_training_accounting",
  evidencePath: DEFAULT_CONFIG,
  finalGameMapSuccess: false,
  canEnterWorld: false,
})

const results = []
for (const item of manifests) {
  const manifest = readJson(item.manifestPath)
  const configPath = manifest.configPath ?? DEFAULT_CONFIG
  const config = readJson(configPath)
  const accounting = manifest.trainingTokenAccounting ?? buildAccounting(manifest, config)
  const ledger = {
    schemaVersion: "ai-assisted-training-token-ledger-v1",
    status: "recorded",
    createdAtUtc,
    createdAtAsiaShanghai: formatShanghai(createdAtUtc),
    runId: item.runId,
    manifestPath: item.manifestPath,
    manifestSha256: sha256(item.manifestPath),
    checkpointPath: manifest.checkpointPath ?? null,
    checkpointSha256: manifest.checkpointSha256 ?? null,
    accountingSource: manifest.trainingTokenAccounting
      ? "training_manifest_exact_loop_accounting"
      : "derived_from_program_saved_manifest_and_locked_training_algorithm",
    immutableHistoricalManifestModified: false,
    trainingTokenAccounting: accounting,
  }
  const ledgerPath = `${OUTPUT_ROOT}/${item.runId}/ledger.json`
  if (fs.existsSync(resolve(ledgerPath))) {
    const existing = readJson(ledgerPath)
    if (existing.manifestSha256 !== ledger.manifestSha256) {
      throw new Error(`existing token ledger manifest hash mismatch: ${item.runId}`)
    }
    results.push({ runId: item.runId, ledgerPath, ledgerSha256: sha256(ledgerPath), created: false })
    continue
  }
  const stored = writeImmutableProgramRun({
    root: OUTPUT_ROOT,
    runId: item.runId,
    fileName: "ledger.json",
    record: ledger,
    latest: {
      sourceRunId: item.runId,
      latentSpatialTokens: accounting.runTotals.latentSpatialTokens,
      externalApiTokens: accounting.externalApi.totalTokens,
    },
  })
  results.push({ runId: item.runId, ledgerPath: stored.runPath, ledgerSha256: sha256(stored.runPath), created: true })
}

const report = {
  schemaVersion: "ai-assisted-training-token-ledger-build-report-v1",
  status: "completed",
  createdAtUtc,
  createdAtAsiaShanghai: formatShanghai(createdAtUtc),
  terminology: {
    localTrainingToken: "latent_spatial_position_processed_by_one_denoiser_sample_forward_pass",
    isNlpToken: false,
    externalAgentConversationTokensAvailableToLocalProgram: false,
  },
  runCount: results.length,
  createdLedgerCount: results.filter((item) => item.created).length,
  preservedLedgerCount: results.filter((item) => !item.created).length,
  results,
}
const storedReport = writeImmutableProgramRun({
  root: `${OUTPUT_ROOT}-builds`,
  runId,
  fileName: "build-report.json",
  record: report,
  latest: { runCount: results.length },
})
appendAiPainterProgramEvent({
  action: "build_ai_assisted_training_token_ledgers",
  runId,
  kind: "token_ledger_build_completed",
  status: "success",
  title: "Local AI training token ledgers recorded",
  titleZh: "本地AI训练Token账本已记录",
  detail: `runCount=${results.length}; external API tokens are not conflated with local latent tokens`,
  detailZh: `已记录${results.length}次训练；外部API Token与本地潜空间Token严格分开。`,
  currentStep: "local_ai_training_accounting_active",
  evidencePath: storedReport.runPath,
  nextAction: "continue_local_capability_migration",
  nextActionZh: "继续按能力迁移注册表把执行能力转入本地AI。",
  finalGameMapSuccess: false,
  canEnterWorld: false,
})

console.log(JSON.stringify({
  ok: true,
  status: report.status,
  reportPath: storedReport.runPath,
  reportSha256: sha256(storedReport.runPath),
  runCount: results.length,
  createdLedgerCount: report.createdLedgerCount,
}, null, 2))

function buildAccounting(manifest, config) {
  const training = config.training
  const splits = manifest.actualLoadedSplitCounts
    ?? manifest.datasetBindingEvidence?.actualSplitCounts
    ?? Object.fromEntries(Object.entries(manifest.splitMetrics ?? {}).map(([key, row]) => [key, row.sampleCount ?? 0]))
  const stage = manifest.resolutionStage
  const batchSize = Number(training.batchSize)
  const width = Number(stage.width)
  const height = Number(stage.height)
  const downsample = Number(config.latentDownsampleFactor)
  const latentWidth = Math.floor(width / downsample)
  const latentHeight = Math.floor(height / downsample)
  const latentSpatialPositions = latentWidth * latentHeight
  const latentChannels = Number(config.latentChannels)
  const conditionChannels = Number(config.conditionChannels)
  const epochCount = Array.isArray(manifest.metrics) ? manifest.metrics.length : 0
  const smokeTest = manifest.trainingStage === "conditional_denoiser_smoke_test"
  const trainSamplesPerEpoch = smokeTest ? Math.min(Number(splits.train ?? 0), batchSize) : Number(splits.train ?? 0)
  const optimizerStepsPerEpoch = Math.ceil(trainSamplesPerEpoch / batchSize)
  const fixedTimestepCount = training.fixedValidationTimesteps.length
  const validationSamples = Number(splits.validation ?? 0)
  const fixedValidationSamplePasses = validationSamples * fixedTimestepCount
  const rolloutSeeds = Number(training.checkpointRolloutSeedsPerSample ?? 2)
  const rolloutSteps = Number(config.inferenceSteps)
  const rolloutTrajectories = validationSamples * rolloutSeeds
  const rolloutSamplePasses = rolloutTrajectories * rolloutSteps
  const perEpochSamplePasses = trainSamplesPerEpoch + fixedValidationSamplePasses + rolloutSamplePasses
  const finalEvaluationSamples = Object.entries(splits)
    .filter(([split]) => split !== training.strictHeldOutInferenceSplit)
    .reduce((sum, [, count]) => sum + Number(count), 0)
  const finalEvaluationSamplePasses = finalEvaluationSamples * fixedTimestepCount
  const evidenceSamplePasses = ["validation", "challenge", "regression"]
    .filter((split) => split !== training.strictHeldOutInferenceSplit)
    .reduce((sum, split) => sum + Number(splits[split] ?? 0), 0)
  const totalSamplePasses = perEpochSamplePasses * epochCount + finalEvaluationSamplePasses + evidenceSamplePasses
  const decodedRgbFramesPerEpoch = trainSamplesPerEpoch + fixedValidationSamplePasses + rolloutTrajectories
  const decodedRgbFrames = decodedRgbFramesPerEpoch * epochCount + finalEvaluationSamplePasses + evidenceSamplePasses
  const tokenValues = (samplePasses) => ({
    denoiserSampleForwardPasses: samplePasses,
    latentSpatialTokens: samplePasses * latentSpatialPositions,
    latentChannelValues: samplePasses * latentSpatialPositions * latentChannels,
    conditionScalarValues: samplePasses * width * height * conditionChannels,
  })
  return {
    schemaVersion: "ai-assisted-local-training-token-accounting-v1",
    source: "derived_from_program_saved_manifest_and_locked_training_algorithm",
    terminology: {
      localTrainingTokenUnit: "one_latent_spatial_position_processed_by_one_denoiser_sample_forward_pass",
      isNlpToken: false,
      tokenizerUsed: false,
      noteZh: "本地V7是图像扩散模型，不使用文本Tokenizer；本账本中的Token是项目自定义的潜空间计算单位，不是API计费Token。",
    },
    externalApi: {
      providerCalls: 0,
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      costCny: 0,
      measurementStatus: "not_applicable_local_pytorch_training",
      externalAgentConversationTokensAvailableToLocalProgram: false,
    },
    geometry: {
      imageWidth: width,
      imageHeight: height,
      imagePixelsPerSample: width * height,
      latentWidth,
      latentHeight,
      latentSpatialPositionsPerSample: latentSpatialPositions,
      latentChannels,
      conditionChannels,
      latentDownsampleFactor: downsample,
    },
    perEpoch: {
      trainingSamplePresentations: trainSamplesPerEpoch,
      optimizerSteps: optimizerStepsPerEpoch,
      fixedValidationSamplePasses,
      rolloutTrajectories,
      rolloutDenoiserSteps: rolloutSamplePasses,
      decodedRgbFrames: decodedRgbFramesPerEpoch,
      ...tokenValues(perEpochSamplePasses),
    },
    postEpochEvaluation: {
      fixedGridSamplePasses: finalEvaluationSamplePasses,
      conditionEvidenceSamplePasses: evidenceSamplePasses,
      latentNormalizationEncoderSamples: manifest.parentDenoiserCheckpointPath ? 0 : Number(splits.train ?? 0),
      ...tokenValues(finalEvaluationSamplePasses + evidenceSamplePasses),
    },
    runTotals: {
      epochCount,
      trainingSamplePresentations: trainSamplesPerEpoch * epochCount,
      optimizerSteps: optimizerStepsPerEpoch * epochCount,
      fixedValidationSamplePasses: fixedValidationSamplePasses * epochCount,
      rolloutTrajectories: rolloutTrajectories * epochCount,
      rolloutDenoiserSteps: rolloutSamplePasses * epochCount,
      decodedRgbFrames,
      decodedRgbPixelPredictions: decodedRgbFrames * width * height,
      ...tokenValues(totalSamplePasses),
    },
    scope: {
      included: [
        "denoiser_training_forward_passes",
        "fixed_grid_validation_forward_passes",
        "checkpoint_rollout_denoiser_steps",
        "post_epoch_split_evaluation",
        "condition_evidence_forward_passes",
      ],
      excluded: [
        "cpu_data_loading",
        "loss_scalar_arithmetic",
        "optimizer_internal_floating_point_operations",
        "external_agent_chat_tokens_not_exposed_to_local_program",
      ],
    },
  }
}

function resolve(value) {
  const absolute = path.resolve(ROOT, value)
  if (!(absolute === ROOT || absolute.startsWith(`${ROOT}${path.sep}`))) throw new Error(`path escapes project root: ${value}`)
  return absolute
}

function readJson(value) {
  return JSON.parse(fs.readFileSync(resolve(value), "utf8").replace(/^\uFEFF/, ""))
}

function sha256(value) {
  return createHash("sha256").update(fs.readFileSync(resolve(value))).digest("hex")
}
