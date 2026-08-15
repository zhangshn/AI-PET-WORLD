import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { appendAiPainterProgramEvent, formatShanghai, writeJsonAtomic } from "./lib/ai-painter-program-event-store.mjs"
import { indexArtifact } from "./lib/ai-pet-world-storage-catalog.mjs"
import { logicalProjectPath } from "./lib/ai-pet-world-storage.mjs"

const ROOT = process.cwd()
const REQUEST_ID = "owner-authorized-stage4-object-visible-structure-readonly-gpu-gradient-design-20260815-004100000"
const SCHEMA = "owner-authorized-stage4-object-visible-structure-readonly-gpu-gradient-design-v1"
const SCOPE = "one_cpu_only_readonly_gpu_gradient_qualification_design_and_owner_request_only"
const TARGET = "scripts/record-stage4-object-visible-structure-readonly-gpu-gradient-design.mjs"
const ACTIONS = [
  "implement_one_bounded_cpu_only_gpu_gradient_design_writer",
  "read_bound_cpu_implementation_evidence_and_existing_diagnostic_source",
  "form_one_inactive_four_object_readonly_gpu_gradient_qualification_design",
  "execute_node_syntax_and_cpu_design_contract_checks",
  "write_design_inactive_execution_contract_owner_request_terminal_and_capsule",
  "synchronize_design_event_ledger_and_sqlite",
]
const OBJECTS = ["object_footprints", "object_tree", "object_rock", "object_vegetation"]
const value = (name) => {
  const index = process.argv.indexOf(name)
  return index < 0 ? null : process.argv[index + 1]
}
const resolveProject = (input) => {
  assert.equal(path.isAbsolute(input), false, `absolute_path_rejected:${input}`)
  const result = path.resolve(ROOT, input)
  assert.ok(result.startsWith(`${ROOT}${path.sep}`), `path_outside_project:${input}`)
  return result
}
const sha = (input) => crypto.createHash("sha256").update(fs.readFileSync(input)).digest("hex")
const read = (input) => JSON.parse(fs.readFileSync(input, "utf8"))
const relative = (input) => path.relative(ROOT, input).replaceAll("\\", "/")
const bind = (input) => ({ path: relative(input), sha256: sha(input) })
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right)

const authorizationArg = value("--authorization")
const authorizationSha256 = value("--authorization-sha256")
const consumptionArg = value("--consumption")
assert.ok(authorizationArg && authorizationSha256 && consumptionArg, "authorization_arguments_required")
const authorizationPath = resolveProject(authorizationArg)
const consumptionPath = resolveProject(consumptionArg)
assert.equal(sha(authorizationPath), authorizationSha256, "authorization_hash_changed")
const authorization = read(authorizationPath)
const consumption = read(consumptionPath)
assert.equal(authorization.schemaVersion, SCHEMA)
assert.equal(authorization.status, "resolved_owner_authorized_not_consumed")
assert.equal(authorization.requestId, REQUEST_ID)
assert.equal(authorization.commandRef, REQUEST_ID)
assert.equal(authorization.scope, SCOPE)
assert.equal(same(authorization.authorizedTargetPaths, [TARGET]), true, "target_scope_changed")
assert.equal(same(authorization.allowedActions, ACTIONS), true, "allowed_actions_changed")
assert.equal(authorization.designWriterImplementationAuthorized, true)
assert.equal(authorization.formalDesignRecordAuthorized, true)
for (const field of ["gpuExecutionAuthorized", "autogradExecutionAuthorized", "checkpointFileReadAuthorized", "trainingAuthorized", "validationAuthorized", "smokeAuthorized"]) {
  assert.equal(authorization[field], false, `${field}_opened`)
}
for (const [name, binding] of Object.entries(authorization.sourceEvidence)) {
  const file = resolveProject(binding.path)
  assert.equal(fs.existsSync(file), true, `${name}_missing`)
  assert.equal(sha(file), binding.sha256, `${name}_binding_changed`)
}
assert.equal(consumption.status, "cpu_only_gpu_gradient_design_authorization_atomically_consumed")
assert.equal(consumption.authorizationSha256, authorizationSha256)
assert.equal(consumption.requestId, REQUEST_ID)
assert.equal(consumption.commandRef, REQUEST_ID)
for (const field of ["gpuUsed", "autogradExecuted", "checkpointFileRead", "modelLoaded", "optimizerCreated", "backwardExecuted", "trainingStarted", "validationStarted", "smokeStarted"]) {
  assert.equal(consumption[field], false, `${field}_opened_in_consumption`)
}

const terminal = read(resolveProject(authorization.sourceEvidence.cpuTerminal.path))
const implementation = read(resolveProject(authorization.sourceEvidence.implementationReport.path))
const cpu = read(resolveProject(authorization.sourceEvidence.cpuReport.path))
const support = read(resolveProject(authorization.sourceEvidence.inactiveSupportContract.path))
const existingDiagnosticSource = fs.readFileSync(resolveProject(authorization.sourceEvidence.existingGpuDiagnosticSource.path), "utf8")
const checks = {
  cpuTerminalClosed: terminal.status === "stage4_object_visible_structure_supervision_cpu_succeeded_closed",
  progressRemains60: terminal.fixedTotalProgress?.percent === 60,
  cpuImplementationInactive: implementation.status === "stage4_object_visible_structure_supervision_cpu_support_implemented_inactive",
  exactFourObjectChannels: same(implementation.implementationFinding?.exactObjectChannels, OBJECTS),
  noNewNumericWeight: implementation.implementationFinding?.newNumericWeightSelected === false,
  waterPathPreserved: implementation.implementationFinding?.waterAndPathBehaviorPreserved === true,
  reviewThresholdsPreserved: implementation.implementationFinding?.reviewThresholdsChanged === false,
  cpuPositiveClosed: cpu.positivePassed === cpu.positiveTotal,
  cpuNegativeClosed: cpu.negativePassed === cpu.negativeTotal,
  cpuExecutionBoundaryClosed: Object.values(cpu.executionBoundary ?? {}).every((item) => item === false),
  supportGateClosed: Object.values(support.activationGate ?? {}).every((item) => item === false),
  existingDiagnosticUsesAutogradGrad: existingDiagnosticSource.includes("torch.autograd.grad"),
  existingDiagnosticHasReadonlyScopes: existingDiagnosticSource.includes("readonly_gpu") && existingDiagnosticSource.includes("gradient"),
}
assert.equal(Object.values(checks).every(Boolean), true, "gpu_gradient_design_source_contract_failed")

const output = resolveProject(authorization.outputNamespace)
assert.equal(fs.existsSync(output), false, "design_output_namespace_exists")
fs.mkdirSync(output, { recursive: true })
const files = {
  cpu: path.join(output, "cpu-design-contract-report.json"),
  writer: path.join(output, "design-writer-report.json"),
  design: path.join(output, "readonly-gpu-gradient-qualification-design.json"),
  contract: path.join(output, "inactive-gpu-execution-contract.json"),
  owner: path.join(output, "owner-action-request.json"),
  terminal: path.join(output, "phase-terminal.json"),
  capsule: path.join(output, "local-task-capsule.json"),
}
const now = new Date().toISOString()
writeJsonAtomic(files.cpu, {
  schemaVersion: "stage4-object-visible-structure-readonly-gpu-gradient-design-cpu-contract-v1",
  status: "passed",
  passed: Object.values(checks).filter(Boolean).length,
  total: Object.keys(checks).length,
  checks,
  executionBoundary: {
    gpuUsed: false,
    autogradExecuted: false,
    checkpointFileRead: false,
    modelLoaded: false,
    optimizerCreated: false,
    backwardExecuted: false,
    trainingStarted: false,
    validationStarted: false,
    smokeStarted: false,
  },
  recordedAtUtc: now,
  recordedAtAsiaShanghai: formatShanghai(now),
})
writeJsonAtomic(files.writer, {
  schemaVersion: "stage4-object-visible-structure-readonly-gpu-gradient-design-writer-report-v1",
  status: "bounded_cpu_design_writer_implemented_and_executed",
  authorization: bind(authorizationPath),
  consumption: bind(consumptionPath),
  writer: bind(resolveProject(TARGET)),
  cpuContract: bind(files.cpu),
  sourceEvidence: authorization.sourceEvidence,
  gpuExecutionPerformed: false,
  recordedAtUtc: now,
  recordedAtAsiaShanghai: formatShanghai(now),
})
writeJsonAtomic(files.design, {
  schemaVersion: "stage4-object-visible-structure-readonly-gpu-gradient-qualification-design-v1",
  status: "bounded_design_converged_inactive",
  runId: "20260814-154900000-stage0",
  purpose: "verify_that_each_of_the_four_typed_visible_structure_losses_reaches_the_current_semantic_mixture_denoiser_without_mutating_weights",
  objectChannels: OBJECTS,
  proposedExecution: {
    hardware: "one_cuda_gpu_only_after_separate_owner_authorization",
    denoiserInitialization: "fresh_project_random_fact_conditioned_semantic_mixture_only",
    failedDenoiserCheckpointLoading: false,
    autoencoderPolicy: "load_project_autoencoder_only_frozen_eval_no_parameter_grad",
    samplePolicy: "one_owner_approved_current_dataset_sample_with_original_reference_rgb_and_bound_23_channel_conditions",
    operations: [
      "one_forward_pass_through_current_semantic_mixture_and_frozen_autoencoder_decode",
      "four_separate_torch_autograd_grad_queries_one_per_typed_visible_structure_loss",
      "one_combined_typed_visible_structure_gradient_query",
      "pre_and_post_model_state_sha256_identity_comparison",
    ],
    forbiddenOperations: [
      "optimizer_creation",
      "loss_backward_call",
      "optimizer_step",
      "model_weight_or_buffer_mutation",
      "failed_checkpoint_weight_read_or_load",
      "training_validation_or_smoke",
    ],
  },
  requiredChecks: [
    "each_typed_loss_is_finite",
    "each_typed_loss_has_a_finite_nonzero_gradient_to_current_denoiser_parameters",
    "each_typed_loss_reaches_its_matching_semantic_mixture_expert_route",
    "combined_loss_has_a_finite_nonzero_gradient_to_current_denoiser_parameters",
    "frozen_autoencoder_parameters_receive_no_gradient_and_state_hash_is_unchanged",
    "denoiser_state_hash_is_byte_identical_before_and_after",
    "no_optimizer_or_backward_call_is_created",
    "gpu_memory_and_device_identity_are_recorded",
  ],
  acceptance: {
    allFourTypedRoutesRequired: true,
    aggregateCannotReplacePerObjectEvidence: true,
    arbitraryGradientMagnitudeThresholdSelected: false,
    finiteAndStrictlyNonzeroRequired: true,
    modelStateMutationAllowed: false,
  },
  implementationRoute: {
    existingSource: authorization.sourceEvidence.existingGpuDiagnosticSource,
    requiredChange: "add_one_current_four_object_visible_structure_mode_with_new_authorization_identity_and_cpu_positive_negative_authorization_regression",
    implementationAuthorizedNow: false,
    gpuExecutionAuthorizedNow: false,
  },
  failurePolicy: {
    stopImmediately: true,
    automaticRetry: false,
    preserveAllEvidence: true,
    noTrainingEscalation: true,
  },
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  nextLegalAction: "owner_authorize_bounded_readonly_gpu_gradient_diagnostic_entry_implementation_or_exit",
  recordedAtUtc: now,
  recordedAtAsiaShanghai: formatShanghai(now),
})
writeJsonAtomic(files.contract, {
  schemaVersion: "stage4-object-visible-structure-readonly-gpu-gradient-inactive-execution-contract-v1",
  status: "inactive_separate_owner_authorization_and_implementation_required",
  design: bind(files.design),
  sourceCpuImplementation: authorization.sourceEvidence.implementationReport,
  requiredImplementationScope: "extend_existing_diagnostic_with_current_four_object_mode_and_cpu_authorization_regression_only",
  eventualGpuExecutionScope: "one_fresh_random_denoiser_forward_and_autograd_grad_qualification_only",
  checkpointWeightsReadAuthorized: false,
  optimizerAuthorized: false,
  backwardCallAuthorized: false,
  modelMutationAuthorized: false,
  gpuAuthorizedNow: false,
  trainingAuthorized: false,
  validationAuthorized: false,
  smokeAuthorized: false,
  automaticApproval: false,
  recordedAtUtc: now,
  recordedAtAsiaShanghai: formatShanghai(now),
})
writeJsonAtomic(files.owner, {
  schemaVersion: "ai-painter-owner-action-request-preview-v1",
  status: "not_authorized_not_consumed",
  requestedAction: "owner_authorize_bounded_readonly_gpu_gradient_diagnostic_entry_implementation_or_exit",
  boundDesign: bind(files.design),
  boundInactiveExecutionContract: bind(files.contract),
  currentGpuExecutionRequested: false,
  currentTrainingRequested: false,
  automaticApproval: false,
  recordedAtUtc: now,
  recordedAtAsiaShanghai: formatShanghai(now),
})
writeJsonAtomic(files.terminal, {
  schemaVersion: "stage4-object-visible-structure-readonly-gpu-gradient-design-terminal-v1",
  status: "readonly_gpu_gradient_qualification_design_completed_closed",
  runId: "20260814-154900000-stage0",
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  nextLegalAction: "owner_authorize_bounded_readonly_gpu_gradient_diagnostic_entry_implementation_or_exit",
  design: bind(files.design),
  inactiveExecutionContract: bind(files.contract),
  ownerActionRequest: bind(files.owner),
  gpuUsed: false,
  autogradExecuted: false,
  trainingStarted: false,
  validationStarted: false,
  smokeStarted: false,
  recordedAtUtc: now,
  recordedAtAsiaShanghai: formatShanghai(now),
})
writeJsonAtomic(files.capsule, {
  schemaVersion: "ai-painter-local-task-capsule-v1",
  module: "AI Painter R5",
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  currentStage: "Stage4 four-object readonly GPU gradient qualification designed; implementation and GPU execution inactive",
  candidateTerminal: bind(files.terminal),
  latestBlocker: "readonly_gpu_gradient_diagnostic_entry_not_implemented_or_authorized",
  nextLegalAction: "owner_authorize_bounded_readonly_gpu_gradient_diagnostic_entry_implementation_or_exit",
  forbiddenActions: authorization.deniedActions,
  evidence: { cpuContract: bind(files.cpu), writerReport: bind(files.writer), design: bind(files.design), inactiveExecutionContract: bind(files.contract), ownerActionRequest: bind(files.owner) },
  recordedAtUtc: now,
  recordedAtAsiaShanghai: formatShanghai(now),
})
for (const file of [authorizationPath, consumptionPath, resolveProject(TARGET), ...Object.values(files)]) {
  const stat = fs.statSync(file)
  indexArtifact({ logicalPath: logicalProjectPath(file), physicalUri: fs.realpathSync(file), storageLayer: "hot", runId: REQUEST_ID, byteSize: stat.size, modifiedAtUtc: stat.mtime.toISOString(), sha256: sha(file) })
}
appendAiPainterProgramEvent({
  id: `stage4-object-visible-structure-gpu-design-${REQUEST_ID}`,
  timestamp: now,
  action: "stage4_object_visible_structure_readonly_gpu_gradient_design",
  runId: REQUEST_ID,
  kind: "cpu_readonly_design",
  status: "success",
  title: "Stage4 four-object readonly GPU gradient qualification designed",
  titleZh: "Stage4 四对象只读 GPU 梯度线路检查设计完成",
  detailZh: "仅形成设计与未激活 Owner 请求；未启动 GPU、autograd、Checkpoint 读取、训练、验证或 Smoke。",
  evidencePath: relative(files.terminal),
  evidenceSha256: sha(files.terminal),
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
})
console.log(JSON.stringify({ status: read(files.terminal).status, terminal: bind(files.terminal), design: bind(files.design), inactiveExecutionContract: bind(files.contract), ownerActionRequest: bind(files.owner), capsule: bind(files.capsule), cpuContract: bind(files.cpu) }, null, 2))
