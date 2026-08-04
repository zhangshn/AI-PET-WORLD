import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import {
  appendAiPainterProgramEvent,
  formatShanghai,
  projectPath,
  writeImmutableProgramRun,
} from "./lib/ai-painter-program-event-store.mjs"
import { recordAiPainterOwnerActionRequest } from "./lib/ai-painter-owner-action-request-store.mjs"

const ROOT = process.cwd()
const ANALYSIS_POINTER = ".runtime/ai-painter/v7-validation-failure-root-cause-analyses/latest.json"
const OUTPUT_ROOT = ".runtime/ai-painter/v7-validation-failure-repair-contracts"
const args = parseArgs(process.argv.slice(2))

const analysisPointerPath = path.resolve(ROOT, args.analysisPointer ?? ANALYSIS_POINTER)
const analysisPointer = readJson(analysisPointerPath)
const analysisPath = path.resolve(ROOT, analysisPointer.runPath)
const analysis = readJson(analysisPath)
assert(analysis.status === "root_cause_analysis_completed_repair_contract_pending", "root-cause analysis is not ready for repair contracting")
assert(analysis.scope?.machineRejectedCount === 8, "repair contract requires the 8/8 rejected validation result")

const existing = readExistingContract(analysisPath)
if (existing) {
  console.log(JSON.stringify({ ok: true, status: "existing_repair_contract_reused", ...existing }, null, 2))
  process.exit(0)
}

const createdAtUtc = new Date().toISOString()
const contractId = `ai-assisted-v7-validation-failure-repair-contract-${createdAtUtc.replace(/[:.]/g, "-")}`
const contract = {
  schemaVersion: "ai-assisted-v7-validation-failure-repair-contract-v1",
  contractId,
  status: "repair_contract_ready_waiting_owner_authorization",
  createdAtUtc,
  createdAtAsiaShanghai: formatShanghai(createdAtUtc),
  generatedBy: "local_ai_pet_world_program",
  sourceRootCauseAnalysis: {
    analysisId: analysis.analysisId,
    path: projectPath(analysisPath),
    sha256: sha256File(analysisPath),
    confirmedFindingCodes: analysis.confirmedFindings.map((row) => row.code),
  },
  objectiveZh: "修复V7完整去噪结果的全画幅高频纹理、视觉层次塌缩和slot-204道路语义丢失，并让训练内部checkpoint选择与最终机器门禁形成闭环。",
  repairLane: "v7_bounded_repair_r1_new_stage0_lineage",
  immutableInputs: {
    datasetCapacityCount: 64,
    splitCounts: { train: 48, validation: 8, challenge: 4, regression: 4 },
    conditionChannelCount: 23,
    sourceCheckpointSha256: analysis.source.checkpointSha256,
    sourceCheckpointDisposition: "failed_validation_evidence_only_never_resume_for_repair",
    ownerApprovedRgbAndConditionPackagesRemainUnmodified: true,
    reviewThresholdsRemainUnmodified: true,
  },
  phaseDRepairDesign: {
    authorizationRequired: true,
    gpuTrainingAllowed: false,
    formalInferenceAllowed: false,
    actions: [
      {
        id: "challenge_autoencoder_roundtrip_audit",
        purposeZh: "先确认四张challenge目标经过现有自研Autoencoder编码再解码后，是否仍能保持道路、区域边界和低频结构。",
        writes: ["immutable_roundtrip_metrics", "diagnostic_reconstruction_images", "latest_pointer", "program_event"],
        weightMutation: false,
        failureReturnNode: "repair_contract_revision",
      },
      {
        id: "fixed_seed_condition_swap_ablation",
        purposeZh: "使用相同初始噪声分别绑定四组条件，测量输出结构对条件变化的真实响应，区分条件编码弱、去噪器忽略条件和Autoencoder瓶颈。",
        writes: ["immutable_ablation_metrics", "diagnostic_images", "latest_pointer", "program_event"],
        weightMutation: false,
        gpuInferenceRequired: true,
        formalCandidate: false,
        failureReturnNode: "repair_contract_revision",
      },
      {
        id: "checkpoint_selection_alignment_upgrade",
        purposeZh: "把固定种子完整去噪预览的专业纹理、安静区、层次、道路覆盖和边界接触结果写入checkpoint选择门禁。",
        requiredMetrics: [
          "professional_multiscale_texture_noise_overload",
          "professional_quiet_region_missing",
          "professional_texture_hierarchy_collapsed",
          "terrain_path_ground_coverage",
          "terrain_path_ground_required_boundary_contact",
          "cross_condition_structural_response",
        ],
      },
      {
        id: "path_semantic_training_signal_upgrade",
        purposeZh: "增加道路区域、道路背景对比和规定入口边界连续性的可微训练信号，避免只靠全图RGB平均误差。",
        affectedConditionChannel: "terrain_path_ground",
        thresholdPolicy: "reuse_current_locked_machine_gate_thresholds_no_lowering",
      },
      {
        id: "fixed_epoch_preview_storage",
        purposeZh: "Smoke和后续正式Stage按固定epoch、固定条件、固定种子自动保存预览图和对应审核指标。",
        previewEpochPolicy: {
          smoke: [1],
          formalStage: [1, 5, 10, 20, 30, 40],
        },
        storageRequirements: ["run_bound_image", "sha256", "condition_identity", "seed", "machine_metrics", "token_accounting"],
      },
    ],
  },
  phaseESmokeGate: {
    separatelyRecorded: true,
    trainingScope: "one_new_stage0_smoke_only",
    epochCount: 1,
    gpuTrainingRequired: true,
    fullStageTrainingAllowed: false,
    acceptance: [
      "all_64_dataset_rows_and_48_8_4_4_split_remain_exact",
      "old_failed_checkpoint_is_not_parent_checkpoint",
      "fixed_preview_is_automatically_saved_and_machine_reviewed",
      "token_hardware_epoch_checkpoint_and_failure_records_are_automatically_written",
      "condition_swap_and_roundtrip_diagnostics_are_present",
      "no_review_threshold_is_lowered",
      "no_formal_candidate_is_created",
    ],
    onFailure: "return_to_phaseD_repair_design",
    onPass: "create_separate_owner_request_for_stage0_stage1_stage2_training",
  },
  laterPhasesNotAuthorizedByThisContract: [
    "full_stage0_stage1_stage2_training",
    "strict_challenge_revalidation",
    "formal_model_promotion",
    "formal_image_generation",
    "runtime_frame",
    "world_entry",
  ],
  acceptanceThresholdAuthority: {
    policy: "reuse_current_owner_calibrated_machine_gate_envelopes",
    prohibited: [
      "lower_threshold_to_force_pass",
      "remove_failed_metric_from_review",
      "replace_complete_rollout_with_single_timestep_proxy",
      "approve_by_rgb_mae_only",
    ],
  },
  rollbackBoundary: {
    oldCheckpointAndValidationEvidenceRemainImmutable: true,
    repairedArchitectureUsesNewVersionAndNewRunIds: true,
    failureDoesNotOverwriteCurrentModelOrDataset: true,
    anyDiagnosticOrSmokeFailureReturnsTo: "phaseD_repair_design",
  },
  automaticWriteContract: {
    runtimeWriter: "local_ai_pet_world_program",
    codexManualRuntimeWriteAllowed: false,
    requiredForEveryAction: [
      "immutable_terminal_report",
      "latest_pointer",
      "program_event",
      "sqlite_artifact_index",
      "token_and_hardware_accounting",
      "failure_codes",
      "next_owner_action_request_when_owner_authority_is_required",
    ],
  },
  currentAuthorization: {
    repairImplementationAuthorized: false,
    diagnosticGpuInferenceAuthorized: false,
    smokeTrainingAuthorized: false,
    fullTrainingAuthorized: false,
    revalidationAuthorized: false,
    formalInferenceAuthorized: false,
  },
  nextClosedLoopNode: "owner_authorization_for_bounded_diagnostics_repair_and_single_smoke",
  formalInferenceEligible: false,
  runtimeFrameEligible: false,
  canEnterWorld: false,
  automaticStorage: true,
}

const stored = writeImmutableProgramRun({
  root: OUTPUT_ROOT,
  runId: contractId,
  fileName: "repair-contract.json",
  record: contract,
  latest: {
    sourceRootCauseAnalysisSha256: contract.sourceRootCauseAnalysis.sha256,
    nextClosedLoopNode: contract.nextClosedLoopNode,
    ownerAuthorizationRequired: true,
    formalInferenceEligible: false,
  },
})
const ownerActionRequest = recordAiPainterOwnerActionRequest({
  schemaVersion: "ai-painter-owner-action-request-input-v1",
  requestId: `owner-action-request-v7-bounded-repair-r1-${createdAtUtc.replace(/[:.]/g, "-").toLowerCase()}`,
  subsystem: "ai_painter_v7_bounded_validation_failure_repair_r1",
  status: "waiting_owner_authorization",
  taskIdentity: {
    modelId: "ai-pet-world-complete-world-ai-assisted-cold-start-v7",
    failedCheckpointSha256: analysis.source.checkpointSha256,
    rootCauseAnalysisId: analysis.analysisId,
    repairContractId: contractId,
  },
  ownerVisibleConclusionZh: "V7验证失败根因已自动分析，修复合同已生成；当前只能申请有界诊断、修复实现和一次新Stage 0 Smoke，不能直接启动完整重训。",
  localSystemFindingZh: `确认问题：${contract.sourceRootCauseAnalysis.confirmedFindingCodes.join(", ")}。`,
  blockingReasonCode: "v7_bounded_repair_r1_requires_owner_authorization",
  whyCannotProceedZh: "下一步包含GPU条件互换诊断、训练算法修改和一次Smoke训练，属于新计算与权重变更，必须取得项目所有者明确授权。",
  minimumRequestedActionZh: "请项目所有者决定是否授权按本修复合同执行有界诊断、修复实现及一次新Stage 0 Smoke；不授权完整Stage 0→1→2重训。",
  invariants: [
    "dataset_remains_64_with_48_8_4_4_split",
    "23_condition_channels_remain_locked",
    "old_checkpoint_and_all_failure_evidence_remain_immutable",
    "machine_review_thresholds_remain_unchanged",
    "formal_inference_runtime_frame_and_world_remain_blocked",
  ],
  forbiddenActions: contract.laterPhasesNotAuthorizedByThisContract,
  ownerFacingMessageZh: "闭环B已完成。是否允许进入闭环D：有界诊断、V7修复实现和一次Stage 0 Smoke？",
  nextActionAfterAuthorization: [
    "run_challenge_autoencoder_roundtrip_audit",
    "run_fixed_seed_condition_swap_ablation",
    "implement_checkpoint_and_path_semantic_repair",
    "run_cpu_static_and_data_binding_regression",
    "run_one_new_stage0_smoke",
    "stop_and_record_smoke_outcome",
  ],
  evidencePaths: [projectPath(analysisPath), stored.runPath],
  ownerDecision: null,
  resolution: {
    boundedDiagnosticsAuthorized: false,
    repairImplementationAuthorized: false,
    singleStage0SmokeAuthorized: false,
    fullTrainingAuthorized: false,
    revalidationAuthorized: false,
    formalInferenceAuthorized: false,
    runtimeFrameAuthorized: false,
    worldEntryAuthorized: false,
  },
}, {
  root: ROOT,
  sourceEvidencePath: stored.runPath,
  script: "scripts/build-ai-assisted-v7-validation-repair-contract.mjs",
})
appendAiPainterProgramEvent({
  action: "build_ai_assisted_v7_validation_repair_contract",
  runId: contractId,
  kind: "validation_failure_repair_contract_ready",
  status: "blocked",
  title: "V7 bounded repair contract is ready and waiting for owner authorization",
  titleZh: "V7有界修复合同已就绪，等待项目所有者授权",
  detail: "bounded diagnostics + repair implementation + one new Stage 0 smoke only",
  detailZh: "范围仅含有界诊断、修复实现和一次新Stage 0 Smoke",
  script: "scripts/build-ai-assisted-v7-validation-repair-contract.mjs",
  currentStep: "waiting_owner_authorization_for_bounded_repair_r1",
  evidencePath: stored.runPath,
  nextAction: "wait_for_owner_authorization",
  nextActionZh: contract.nextClosedLoopNode,
  finalGameMapSuccess: false,
  canEnterWorld: false,
})

console.log(JSON.stringify({
  ok: true,
  status: contract.status,
  contractId,
  contractPath: stored.runPath,
  contractSha256: sha256File(path.resolve(ROOT, stored.runPath)),
  ownerActionRequest,
  authorizedNow: contract.currentAuthorization,
  nextClosedLoopNode: contract.nextClosedLoopNode,
}, null, 2))

function parseArgs(values) {
  const read = (name) => { const index = values.indexOf(name); return index >= 0 ? values[index + 1] : null }
  return { analysisPointer: read("--analysis-pointer") }
}
function readExistingContract(analysisReportPath) {
  const pointerPath = path.resolve(ROOT, OUTPUT_ROOT, "latest.json")
  if (!fs.existsSync(pointerPath)) return null
  const pointer = readJson(pointerPath)
  if (pointer.sourceRootCauseAnalysisSha256 !== sha256File(analysisReportPath)) return null
  if (!pointer.runPath || !fs.existsSync(path.resolve(ROOT, pointer.runPath))) return null
  return { contractId: pointer.runId, contractPath: pointer.runPath, contractSha256: sha256File(path.resolve(ROOT, pointer.runPath)) }
}
function readJson(value) { return JSON.parse(fs.readFileSync(value, "utf8")) }
function sha256File(value) { return crypto.createHash("sha256").update(fs.readFileSync(value)).digest("hex") }
function assert(condition, message) { if (!condition) throw new Error(message) }
