import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { adjudicateModelTrainingRootConvergence } from "./lib/ai-painter-stage4-model-training-paradigm-root-convergence.mjs"
import { appendAiPainterProgramEvent, formatShanghai, writeJsonAtomic } from "./lib/ai-painter-program-event-store.mjs"
import { indexArtifact } from "./lib/ai-pet-world-storage-catalog.mjs"
import { logicalProjectPath } from "./lib/ai-pet-world-storage.mjs"

const ROOT = process.cwd()
const ACTIONS = Object.freeze(["verify_bound_evidence", "compare_exited_stage4_candidates", "audit_condition_to_final_rgb_model_capacity_autoencoder_and_rollout_chain", "compare_single_sample_smoke_to_multisample_stage0", "audit_resource_and_resolution_evidence", "execute_cpu_positive_negative_contract_regression", "atomically_consume_one_cpu_readonly_authorization", "write_analysis_decision_contract_or_owner_request_and_terminal", "synchronize_unique_plan_capsule_event_ledger_and_sqlite"])
const DENIALS = Object.freeze(["modify_data", "add_same_kind_loss", "select_free_hyperparameters", "read_or_load_checkpoint_weights", "start_gpu", "start_smoke", "start_stage0", "start_stage1", "start_stage2", "start_training"])
const arg = (name) => { const index = process.argv.indexOf(name); return index < 0 ? null : process.argv[index + 1] }
const projectFile = (value) => {
  assert.equal(path.isAbsolute(value), false, `absolute_path_rejected:${value}`)
  const result = path.resolve(ROOT, value)
  assert.equal(result.startsWith(`${ROOT}${path.sep}`), true, `project_path_required:${value}`)
  return result
}
const relative = (value) => path.relative(ROOT, value).replace(/\\/g, "/")
const shaFile = (value) => crypto.createHash("sha256").update(fs.readFileSync(value)).digest("hex")
const bind = (value) => ({ path: relative(value), sha256: shaFile(value) })
const readJson = (value) => JSON.parse(fs.readFileSync(value, "utf8"))
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const writeTextAtomic = (value, text) => {
  const temp = `${value}.${process.pid}.${Date.now()}.tmp`
  fs.writeFileSync(temp, text, "utf8")
  fs.renameSync(temp, value)
}

const authorizationArg = arg("--authorization")
const authorizationSha = arg("--authorization-sha256")
const consumptionArg = arg("--consumption")
assert.ok(authorizationArg && authorizationSha && consumptionArg, "authorization_arguments_required")
const authorizationPath = projectFile(authorizationArg)
const consumptionPath = projectFile(consumptionArg)
assert.equal(shaFile(authorizationPath), authorizationSha, "authorization_sha256_mismatch")
const authorization = readJson(authorizationPath)
assert.equal(authorization.schemaVersion, "owner-authorized-stage4-model-training-paradigm-root-convergence-v1")
assert.equal(authorization.status, "resolved_owner_authorized_not_consumed")
assert.equal(authorization.requestId, authorization.commandRef)
assert.equal(authorization.scope, "one_cpu_readonly_stage4_model_architecture_and_training_paradigm_root_convergence")
assert.equal(authorization.ownerSelection, "retain_original_64_and_authorize_new_model_or_training_paradigm_design")
assert.equal(same(authorization.allowedActions, ACTIONS), true, "allowed_actions_not_exact")
assert.equal(DENIALS.every((value) => authorization.deniedActions.includes(value)), true, "denied_actions_incomplete")
assert.equal(authorization.oneTimeConsumption, true)
assert.equal(authorization.dataModificationAuthorized, false)
assert.equal(authorization.checkpointWeightsReadAuthorized, false)
assert.equal(authorization.gpuAuthorized, false)
assert.equal(authorization.trainingAuthorized, false)
for (const [name, evidence] of Object.entries(authorization.sourceEvidence)) {
  const target = projectFile(evidence.path)
  assert.equal(fs.existsSync(target), true, `${name}_missing`)
  assert.equal(shaFile(target), evidence.sha256, `${name}_sha256_mismatch`)
}
const programs = {
  runner: projectFile("scripts/run-stage4-model-training-paradigm-root-convergence.mjs"),
  checker: projectFile("scripts/check-stage4-model-training-paradigm-root-convergence.mjs"),
  decisionLibrary: projectFile("scripts/lib/ai-painter-stage4-model-training-paradigm-root-convergence.mjs"),
}
assert.deepEqual(authorization.programLineage, Object.fromEntries(Object.entries(programs).map(([name, value]) => [name, bind(value)])), "program_lineage_mismatch")
const output = projectFile(authorization.outputNamespace)
assert.equal(fs.existsSync(output), false, "output_namespace_must_not_exist")
assert.equal(fs.existsSync(consumptionPath), false, "authorization_already_consumed")

const cpu = spawnSync(process.execPath, [programs.checker], { cwd: ROOT, encoding: "utf8" })
assert.equal(cpu.status, 0, `cpu_contract_failed:${cpu.stderr}`)
const cpuReport = JSON.parse(cpu.stdout)
assert.equal(cpuReport.status, "passed")

fs.mkdirSync(path.dirname(consumptionPath), { recursive: true })
const consumedAtUtc = new Date().toISOString()
const consumption = { schemaVersion: "stage4-model-training-paradigm-root-convergence-consumption-v1", status: "cpu_readonly_root_convergence_authorization_atomically_consumed", requestId: authorization.requestId, commandRef: authorization.commandRef, scope: authorization.scope, authorization: bind(authorizationPath), oneTimeConsumption: true, consumedAtUtc, consumedAtAsiaShanghai: formatShanghai(consumedAtUtc) }
const fd = fs.openSync(consumptionPath, "wx")
try { fs.writeFileSync(fd, `${JSON.stringify(consumption, null, 2)}\n`, "utf8"); fs.fsyncSync(fd) } finally { fs.closeSync(fd) }
fs.mkdirSync(path.dirname(output), { recursive: true })
fs.mkdirSync(output, { recursive: false })

const correctionDecision = readJson(projectFile(authorization.sourceEvidence.correctionDecision.path))
const smokeTerminal = readJson(projectFile(authorization.sourceEvidence.smokeQualificationTerminal.path))
const smokeReport = readJson(projectFile(authorization.sourceEvidence.smokeQualificationReport.path))
const stage0Terminal = readJson(projectFile(authorization.sourceEvidence.stage0Terminal.path))
const manifest = readJson(projectFile(authorization.sourceEvidence.stage0Manifest.path))
const config = readJson(projectFile(authorization.sourceEvidence.activeConfig.path))
const causalDecision = readJson(projectFile(authorization.sourceEvidence.currentCausalDecision.path))
const modelText = fs.readFileSync(projectFile(authorization.sourceEvidence.modelSource.path), "utf8")
const trainerText = fs.readFileSync(projectFile(authorization.sourceEvidence.trainerSource.path), "utf8")

assert.equal(correctionDecision.originalContractSatisfied, true)
assert.equal(correctionDecision.dataDefectProven, false)
assert.equal(smokeTerminal.stage0EntryPermitted, true)
assert.equal(smokeReport.decision.fixedPreviewReproduced, true)
assert.equal(stage0Terminal.status, "semantic_mixture_stage4_formal_stage_failed_closed")
assert.equal(stage0Terminal.stage, 0)
assert.equal(stage0Terminal.machineReview.passCount, 0)
assert.equal(manifest.trainingTokenAccounting.runTotals.epochCount, 40)
assert.equal(manifest.trainingTokenAccounting.runTotals.optimizerSteps, 5760)
assert.equal(manifest.actualLoadedConditionalSampleCount, 64)
assert.deepEqual(manifest.actualLoadedSplitCounts, { train: 48, validation: 8, challenge: 4, regression: 4 })
assert.equal(manifest.modelStateHashEvidence.weightsChanged, true)
assert.equal(causalDecision.selectedCause, "A")
assert.equal(causalDecision.evidence.contractsActive, true)
assert.equal(causalDecision.evidence.completeEpochSelectionAndSharedReplayCorrect, true)
assert.equal(causalDecision.evidence.validationCheckpointIdentityCorrect, true)
assert.equal(Object.values(causalDecision.evidence.optimizationTrends).every(Boolean), true)
assert.equal(config.conditionChannels, 23)
assert.equal(config.latentChannels, 12)
assert.equal(config.latentDownsampleFactor, 4)
assert.equal(config.training.batchSize, 1)
assert.equal(config.training.stage4FullRolloutFinalVisibleConsistency.rolloutSteps, 50)
assert.equal(config.training.stage4FullRolloutFinalVisibleConsistency.gradientTailSteps, 5)
assert.match(modelText, /predicted_velocity = base_velocity \+ torch\.stack/)
assert.match(modelText, /return predicted_velocity/)
assert.match(modelText, /class ProjectOwnedAutoencoder/)
assert.match(trainerText, /stage4FullRolloutFinalVisibleConsistencyLossTensor/)

const history = [
  { id: "v8", mechanism: "shared_decoded_alignment_readout", terminal: authorization.sourceEvidence.v8Terminal, analysis: authorization.sourceEvidence.v8Analysis },
  { id: "v9", mechanism: "independent_object_projection_and_alignment", terminal: authorization.sourceEvidence.v9Terminal, analysis: authorization.sourceEvidence.v9Analysis },
  { id: "structure_fact_first", mechanism: "dual_stage_structure_fact_injection", terminal: authorization.sourceEvidence.structureTerminal, analysis: authorization.sourceEvidence.structureAnalysis },
  { id: "condition_preserving_semantic_renderer", mechanism: "typed_semantic_paths_with_gated_fusion", terminal: authorization.sourceEvidence.rendererTerminal, analysis: authorization.sourceEvidence.rendererAnalysis },
  { id: "fact_conditioned_semantic_mixture", mechanism: "typed_fact_conditioned_additive_experts", terminal: authorization.sourceEvidence.mixtureTerminal, analysis: authorization.sourceEvidence.mixtureAnalysis },
].map((item) => ({ ...item, failedVisualQualification: true, materialMechanismChanged: true }))

const input = {
  original64: { contractSatisfied: true, dataDefectProven: false },
  ownerSelection: authorization.ownerSelection,
  history,
  smoke: { singleSampleQualified: true, fixedPreviewReproduced: smokeReport.decision.fixedPreviewReproduced },
  stage0: {
    epochs: manifest.trainingTokenAccounting.runTotals.epochCount,
    optimizerSteps: manifest.trainingTokenAccounting.runTotals.optimizerSteps,
    sampleCount: manifest.actualLoadedConditionalSampleCount,
    splitCounts: manifest.actualLoadedSplitCounts,
    weightsChanged: manifest.modelStateHashEvidence.weightsChanged,
    machineReviewPassCount: stage0Terminal.machineReview.passCount,
    failedObjectClasses: causalDecision.evidence.terminalFailedClasses,
    objectivesActiveAndImproving: Object.values(causalDecision.evidence.optimizationTrends).every(Boolean),
  },
  model: { conditionChannels: config.conditionChannels, typedContributionsReachFinalVelocity: true, finalRgbPassesFrozenAutoencoder: true, latentChannels: config.latentChannels, latentDownsampleFactor: config.latentDownsampleFactor },
  training: { rolloutSteps: config.training.stage4FullRolloutFinalVisibleConsistency.rolloutSteps, gradientTailSteps: config.training.stage4FullRolloutFinalVisibleConsistency.gradientTailSteps, stage0CompletedWithoutResourceFailure: manifest.durationSeconds > 0 && manifest.device === "cuda" },
  discriminatingEvidence: { architectureCapacityControlledComparison: false, trainingParadigmControlledComparison: false, autoencoderSemanticRetentionAuditAcross64: false, stage1OrStage2ResourceEvidence: false },
}
const decision = adjudicateModelTrainingRootConvergence(input)
const now = new Date().toISOString()
const files = {
  cpu: path.join(output, "cpu-report.json"),
  analysis: path.join(output, "model-training-paradigm-root-analysis.json"),
  decision: path.join(output, "adjudication.json"),
  owner: path.join(output, "owner-evidence-request.json"),
  terminal: path.join(output, "phase-terminal.json"),
  capsule: path.join(output, "local-task-capsule.json"),
  planSync: path.join(output, "plan-sync-record.json"),
}
writeJsonAtomic(files.cpu, { ...cpuReport, authorization: bind(authorizationPath), consumption: bind(consumptionPath), sourceEvidence: authorization.sourceEvidence, recordedAtUtc: now, recordedAtAsiaShanghai: formatShanghai(now) })
writeJsonAtomic(files.analysis, {
  schemaVersion: "stage4-model-training-paradigm-root-analysis-v1",
  status: "cpu_readonly_root_analysis_completed",
  businessObjective: "generate_an_auditable_complete_game_map_from_worldfacts_visualfactmanifest_and_23_channel_conditions",
  retainedProductContract: { approvedRecords: 64, split: { train: 48, validation: 8, challenge: 4, regression: 4 }, dataDefectProven: false },
  historicalCandidateComparison: history,
  conditionToFinalRgbChain: ["23_channel_conditions", "multiscale_condition_trunk", "typed_semantic_mixture_experts", "12_channel_predicted_velocity", "50_step_final_clean_latent", "frozen_4x_autoencoder_decoder", "final_rgb"],
  modelCapacityAudit: {
    currentIdentity: { denoiserArchitecture: config.denoiserArchitecture, denoiserBaseChannels: config.denoiserBaseChannels, latentChannels: config.latentChannels, latentDownsampleFactor: config.latentDownsampleFactor },
    typedConditionsReachFinalVelocity: true,
    singleSampleExpressivityProven: true,
    multiSampleCapacitySufficiencyProven: false,
    capacityGapConfirmed: false,
    reason: "No immutable run compares the current model to a capacity-changed model while holding data, objectives, initialization and training schedule fixed.",
  },
  frozenAutoencoderAudit: {
    finalRgbBoundary: true,
    architecture: config.autoencoderArchitecture,
    checkpointWeightsReadInThisAudit: false,
    semanticRetentionAcrossAll64PreviouslyMeasured: false,
    bottleneckGapConfirmed: false,
    reason: "The frozen decoder is in the final path, but existing evidence does not isolate semantic information loss in its 12-channel 4x latent from upstream Denoiser/training behavior.",
  },
  trainingParadigmAudit: {
    batchSize: config.training.batchSize,
    rolloutSteps: config.training.stage4FullRolloutFinalVisibleConsistency.rolloutSteps,
    gradientTailSteps: config.training.stage4FullRolloutFinalVisibleConsistency.gradientTailSteps,
    stage0Epochs: manifest.trainingTokenAccounting.runTotals.epochCount,
    optimizerSteps: manifest.trainingTokenAccounting.runTotals.optimizerSteps,
    specializedReplayPresent: true,
    objectivesActiveAndImproving: true,
    controlledParadigmComparisonPresent: false,
    paradigmGapConfirmed: false,
  },
  smokeVersusStage0: {
    singleSampleSmokeQualified: true,
    stage0FullDatasetCompleted: true,
    stage0MachineReview: { passCount: 0, total: 6 },
    interpretation: "The model can fit the fixed approved sample, but the same candidate does not generalize across the approved multi-sample Stage 0 distribution.",
  },
  resourceAndResolutionAudit: {
    stage0: { width: manifest.resolutionStage.width, height: manifest.resolutionStage.height, durationSeconds: manifest.durationSeconds, completedWithoutCudaOrDiskFailure: true },
    stage1EvidencePresent: false,
    stage2EvidencePresent: false,
    resourceGapConfirmed: false,
    reason: "Resources completed Stage 0. Stage 1/2 never legally started, so high-resolution resource adequacy or insufficiency is not established.",
  },
  causalIdentifiability: { architectureCapacityIsolated: false, trainingParadigmIsolated: false, frozenAutoencoderRetentionIsolated: false, jointGapConfirmed: false },
  sourceEvidence: authorization.sourceEvidence,
  checkpointWeightsRead: false,
  gpuStarted: false,
  trainingStarted: false,
  recordedAtUtc: now,
  recordedAtAsiaShanghai: formatShanghai(now),
})
writeJsonAtomic(files.decision, { ...decision, analysis: bind(files.analysis), recordedAtUtc: now, recordedAtAsiaShanghai: formatShanghai(now) })
writeJsonAtomic(files.owner, {
  schemaVersion: "stage4-model-training-paradigm-discriminating-evidence-owner-request-v1",
  status: "owner_evidence_authorization_required",
  selectedDecision: decision.selectedDecision,
  reason: "A model-capacity redesign and a training/resource redesign remain different business investments. Existing evidence does not isolate either one, so choosing now would repeat the prior unsupported conclusion error.",
  requestedDependencyOrder: [
    { order: 1, id: "frozen_autoencoder_semantic_retention_audit_across_64", scope: "Read-only audit of approved reference RGB encode/decode and existing Autoencoder stages across all 64 records; no model changes, optimizer or training.", decisionUse: "If required object spatial semantics are not retained, architecture/Autoencoder boundary becomes the primary redesign target." },
    { order: 2, id: "current_model_multisample_capacity_and_gradient_interference_readonly_diagnostic", scope: "Read-only forward and autograd.grad diagnostic on a deterministic approved train/validation subset using the current frozen identities; no weight update.", decisionUse: "Separates representational/gradient interference evidence from generic training failure." },
    { order: 3, id: "bounded_controlled_training_paradigm_comparison", scope: "Only if steps 1 and 2 remain inconclusive: one separately authorized bounded controlled comparison using existing fixed values and a deterministic subset; no free hyperparameters or production promotion.", decisionUse: "Isolates training-paradigm effect before any new full Stage 0." },
  ],
  prohibitedAutomaticActions: ["name_or_build_new_architecture", "change_data", "add_same_kind_loss", "choose_free_hyperparameters", "rerun_stage0", "read_failed_checkpoint", "lower_review_thresholds"],
  boundDecision: bind(files.decision),
  automaticApproval: false,
  recordedAtUtc: now,
  recordedAtAsiaShanghai: formatShanghai(now),
})
writeJsonAtomic(files.terminal, {
  schemaVersion: "stage4-model-training-paradigm-root-convergence-terminal-v1",
  status: "stage4_model_training_root_evidence_insufficient_owner_decision_required_closed",
  selectedDecision: decision.selectedDecision,
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  original64Retained: true,
  modelArchitectureContractGenerated: false,
  trainingParadigmContractGenerated: false,
  jointContractGenerated: false,
  analysis: bind(files.analysis),
  adjudication: bind(files.decision),
  ownerEvidenceRequest: bind(files.owner),
  checkpointWeightsRead: false,
  gpuStarted: false,
  trainingStarted: false,
  recordedAtUtc: now,
  recordedAtAsiaShanghai: formatShanghai(now),
})
writeJsonAtomic(files.capsule, {
  schemaVersion: "ai-painter-local-task-capsule-v1",
  module: "AI Painter R5",
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  currentStage: "Stage4 model architecture versus training paradigm causal identity remains unresolved",
  latestTerminal: bind(files.terminal),
  latestFinding: decision.selectedDecision,
  nextLegalAction: "owner_authorize_ordered_discriminating_evidence_audits",
  evidence: { cpuReport: bind(files.cpu), analysis: bind(files.analysis), adjudication: bind(files.decision), ownerRequest: bind(files.owner) },
  recordedAtUtc: now,
  recordedAtAsiaShanghai: formatShanghai(now),
})

const planPath = projectFile("docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md")
const planBefore = shaFile(planPath)
let planText = fs.readFileSync(planPath, "utf8")
planText = planText.replace(/^更新时间：.*$/m, `更新时间：${formatShanghai(now).replace("T", " ")}`)
planText = planText.replace(/^状态：.*$/m, "状态：active-module-plan / AI Painter固定进度3/5（60%）；原始64份数据合同保持有效。Stage4根因审查确认单样本可学习、多样本Stage 0泛化失败，但当前证据不能唯一归因为模型容量、训练范式/资源或两者共同问题；禁止继续猜测式扩张，等待Owner授权按顺序完成Autoencoder语义保留、当前模型多样本容量/梯度干扰及必要时的有界训练范式对照证据")
const anchor = "### 3.2 当前尚未完成的业务门"
assert.equal(planText.includes(anchor), true, "unique_plan_anchor_missing")
const bullet = `- Stage4模型结构与训练范式根因收敛已完成：已证明固定单样本可收敛，而64份数据Stage 0在40 Epoch/5760次更新后仍为四类对象最终语义失败；五类历史候选均失败。现有证据没有做过只改容量、只改训练范式或跨64份Autoencoder语义保留的受控对照，唯一裁决为\`evidence_insufficient_owner_decision_required\`。不得生成新架构、继续叠加Loss或重跑Stage 0；下一步按Owner证据请求顺序补齐判别证据。\n`
if (!planText.includes(bullet.trim())) planText = planText.replace(anchor, `${bullet}\n${anchor}`)
writeTextAtomic(planPath, planText)
writeJsonAtomic(files.planSync, { schemaVersion: "ai-painter-plan-sync-record-v1", status: "unique_plan_synchronized", plan: bind(planPath), planSha256Before: planBefore, terminal: bind(files.terminal), fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 }, recordedAtUtc: now, recordedAtAsiaShanghai: formatShanghai(now) })

for (const target of [authorizationPath, consumptionPath, ...Object.values(files)]) {
  const stat = fs.statSync(target)
  indexArtifact({ logicalPath: logicalProjectPath(target), physicalUri: fs.realpathSync(target), storageLayer: "hot", runId: authorization.runId, artifactType: "stage4_model_training_paradigm_root_convergence", byteSize: stat.size, modifiedAtUtc: stat.mtime.toISOString(), sha256: shaFile(target) })
}
appendAiPainterProgramEvent({
  id: `stage4-model-training-paradigm-root-convergence-${authorization.runId}`,
  timestamp: now,
  action: "stage4_model_training_paradigm_root_convergence",
  runId: authorization.runId,
  kind: "cpu_readonly_root_causal_adjudication",
  status: "success",
  title: "Architecture versus training paradigm root cause remains unisolated",
  titleZh: "模型容量与训练范式根因尚未被受控证据区分",
  detailZh: "保留原始64份数据。单样本能力成立、多样本泛化失败，但没有受控容量、训练范式或Autoencoder语义保留对照，故不得猜测选择A/B/C。",
  evidencePath: relative(files.terminal),
  evidenceSha256: shaFile(files.terminal),
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
})

console.log(JSON.stringify({ status: readJson(files.terminal).status, selectedDecision: decision.selectedDecision, terminal: bind(files.terminal), analysis: bind(files.analysis), adjudication: bind(files.decision), ownerRequest: bind(files.owner), cpuReport: bind(files.cpu), capsule: bind(files.capsule), planSync: bind(files.planSync) }, null, 2))
