// Read-only versioned proposal adapter, NOT a Smoke runner or qualification publisher.
// Historical CPU component evidence has no GPU, real-training or V2 authority.
import assert from "node:assert/strict";
import { createReader, sha256, validateMembership } from "./ai-painter-stage4-dataset-audit.mjs";
import { adjudicateStage4SplitData } from "./ai-painter-stage4-split-data-adjudication.mjs";
import { validateStage4CoreQualificationSummary, stage4CoreArgsForComponent } from "../check-ai-painter-stage4-core.mjs";
import { verifyConditionCompilerLineageCandidate } from "./ai-painter-stage4-condition-compiler-lineage.mjs";

export const SPLIT_SMOKE_PREFLIGHT_SCHEMA = "ai-painter-stage4-split-smoke-preflight-v1";
const PARENT = {
  path: "data/ai-painter/system-governance/stage4-full-resolution-typed-semantic-transport-rgb-responsibility-contract-v2.json",
  sha256: "9e4eb98a1bdcc4afe03aa7fcecfb8350ddaff8030a62e143c289461d7041eef3",
};
const PROGRAMS = [
  "ml/ai-painter/scripts/stage4_split_isolated_smoke.py",
  "ml/ai-painter/src/ai_painter/complete_world/split_release.py",
  "ml/ai-painter/src/ai_painter/complete_world/split_training.py",
];
const PROGRAMS_V2 = [...PROGRAMS, "scripts/lib/ai-painter-stage4-split-smoke-preflight.mjs",
  "scripts/lib/ai-painter-stage4-condition-compiler-lineage.mjs"];
const CPU_PROGRAMS = [
  "scripts/check-ai-painter-stage4-split-smoke-component.mjs", "scripts/check-ai-painter-stage4-core.mjs",
  "ml/ai-painter/tests/test_stage4_split_smoke.py", "scripts/audit-ai-painter-stage4-split-release.mjs",
  "scripts/lib/ai-painter-stage4-dataset-audit.mjs", "scripts/lib/ai-painter-stage4-historical-geometry.mjs",
  "scripts/lib/ai-painter-stage4-historical-exposure.mjs", "scripts/tests/test-ai-painter-stage4-dataset-audit.mjs",
  "scripts/tests/test-ai-painter-stage4-historical-exposure.mjs", "scripts/lib/ai-painter-stage4-lifecycle-projection.mjs",
  "scripts/reconcile-ai-painter-stage4-v2-capability-lifecycle.mjs",
  "scripts/tests/test-ai-painter-stage4-lifecycle-state-semantics.mjs",
  "scripts/tests/test-ai-painter-stage4-v2-capability-lifecycle-reconciliation.mjs",
  "scripts/check-ai-painter-split-successor-cpu-contract.mjs", "scripts/lib/ai-painter-current-entrypoint-command.mjs",
  "scripts/check-ai-painter-current-entrypoints.mjs", "scripts/check-ai-console-current-execution-projection.mjs",
  "scripts/tests/helpers/current-execution-projection-cpu.mjs",
  "scripts/tests/test-ai-painter-historical-registry-receipt.mjs", "scripts/tests/test-ai-painter-current-entrypoint-command.mjs",
  "scripts/tests/test-ai-console-current-projection-availability.mjs",
];
const EVALUATORS = [
  "scripts/lib/ai-painter-stage4-split-smoke-preflight.mjs",
  "scripts/lib/ai-painter-stage4-split-data-adjudication.mjs",
];
const CORE_KEYS = ["schemaVersion", "parentCapability", "modelArchitectureId", "datasetManifest",
  "datasetReleaseIdentity", "baseConfig", "derivedCpuConfigSha256", "selections", "schedule",
  "boundaries", "frozenProgramBindings", "programBindings"];
const QUALIFICATION = { cpuComponentEvidenceRequired: true, historicalDataAuditRequired: true,
  newCapabilityGpuQualificationRequired: true, lifecycleExecutionAdapterRequired: true,
  trainingAllowed: false, capabilityReleased: false };
const SCHEDULE = { epochCount: 30, batchSize: 1, optimizerStepsPerEpoch: 1, seed: 20263722,
  resolution: [256, 192], previewEpochs: [1, 5, 10, 20, 30] };
const BOUNDARIES = { optimizerSplit: "train", evaluationSplit: "validation", challengeConsumed: false,
  regressionConsumed: false, replayAllowed: false, smokeWeightsPromotable: false,
  lossOverrideAllowed: false, thresholdOverrideAllowed: false };
function sort(value) {
  if (Array.isArray(value)) return value.map(sort);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((k) => [k, sort(value[k])]));
  return value;
}
const canonical = (value) => JSON.stringify(sort(value));
const digest = (value) => sha256(Buffer.from(canonical(value)));
const equal = (a, b, message) => assert.equal(canonical(a), canonical(b), message);
function binding(value) {
  assert.ok(value && typeof value.path === "string", "explicit_binding_required");
  assert.match(value.sha256 ?? "", /^[a-f0-9]{64}$/u, "explicit_sha_required");
  return { path: value.path, sha256: value.sha256 };
}
function keys(value, expected, message) { equal(Object.keys(value ?? {}).sort(), [...expected].sort(), message); }
function byteBinding(reader, value) { const b = binding(value); reader.bytes(b.path, b.sha256); return b; }

function readComponent(reader, contractBinding, root) {
  const contract = reader.bound(contractBinding);
  const v2 = contract.schemaVersion === "ai-painter-stage4-split-isolated-smoke-contract-v2";
  assert.ok(v2 || contract.schemaVersion === "ai-painter-stage4-split-isolated-smoke-contract-v1", "unsupported_component_schema");
  const coreKeys = v2 ? [...CORE_KEYS, "compilerLineage"] : CORE_KEYS;
  keys(contract, [...coreKeys, "capabilityVersion", "immutable", "status", "qualification"], "unsupported_component_fields");
  assert.equal(contract.status, "inactive_component_candidate_not_execution_qualified", "component_not_inactive");
  assert.equal(contract.immutable, true, "component_not_immutable");
  equal(contract.qualification, QUALIFICATION, "component_qualification_conflict");
  equal(contract.schedule, SCHEDULE, "unsupported_smoke_schedule");
  equal(contract.boundaries, BOUNDARIES, "split_boundary_conflict");
  equal(contract.parentCapability, PARENT, "unsupported_parent_binding");
  const parent = reader.bound(PARENT);
  assert.equal(contract.modelArchitectureId, parent.architectureId, "architecture_binding_conflict");
  equal(contract.frozenProgramBindings, parent.programBindings, "frozen_program_bindings_conflict");
  assert.equal(Object.keys(parent.programBindings).length, 18, "unsupported_parent_program_set");
  equal(contract.programBindings.map((v) => v.path), v2 ? PROGRAMS_V2 : PROGRAMS, "unsupported_component_program_set");
  let effective = contract.frozenProgramBindings;
  if (v2) {
    const graph = reader.bound(binding(contract.compilerLineage));
    verifyConditionCompilerLineageCandidate(root, binding(contract.compilerLineage));
    equal(graph.parentCapability, PARENT, "compiler_lineage_parent_conflict");
    effective = graph.effectiveProgramBindings;
    for (const b of graph.evaluatorBindings) byteBinding(reader, b);
  }
  for (const b of [...Object.values(effective), ...contract.programBindings]) byteBinding(reader, b);
  equal(contract.baseConfig, { path: "ml/ai-painter/config/complete-world-ai-assisted-cold-start-v6.json",
    sha256: "fadda5b15947de94bd689ce82e1bfa0ce88c18c7c4445549a79660594d6cc97c" }, "unsupported_base_config");
  byteBinding(reader, contract.baseConfig);
  assert.match(contract.derivedCpuConfigSha256 ?? "", /^[a-f0-9]{64}$/u, "derived_config_binding_missing");
  const core = Object.fromEntries(coreKeys.map((key) => [key, contract[key]]));
  assert.equal(contract.capabilityVersion, `stage4-split-isolated-smoke-${v2 ? "v2" : "v1"}-${digest(core)}`, "component_identity_not_reproduced");

  const manifest = reader.bound(binding(contract.datasetManifest));
  assert.equal(manifest.status, "immutable_split_candidate_not_training_qualified", "dataset_not_inactive_candidate");
  assert.equal(manifest.immutable, true, "dataset_not_immutable");
  assert.equal(manifest.qualification?.trainingAllowed, false, "dataset_claim_cannot_grant_training");
  const source = reader.bound(binding(manifest.sourceIndex));
  assert.equal(source.schemaVersion, "ai-painter-stage4-v2-split-source-index-v1", "unsupported_source_schema");
  keys(manifest.splits, ["train", "validation", "challenge", "regression"], "unsupported_split_set");
  const memberships = Object.fromEntries(Object.entries(manifest.splits).map(([split, b]) => [split, reader.bound(binding(b))]));
  for (const membership of Object.values(memberships)) assert.equal(membership.schemaVersion,
    "ai-painter-stage4-v2-split-membership-v1", "unsupported_membership_schema");
  validateMembership(manifest, source, memberships);
  assert.equal(manifest.datasetReleaseIdentity, `stage4-v2-split64-${digest(manifest.identityPayload)}`, "dataset_identity_not_reproduced");
  assert.equal(manifest.packageId, manifest.datasetReleaseIdentity, "dataset_package_identity_conflict");
  assert.equal(contract.datasetReleaseIdentity, manifest.datasetReleaseIdentity, "component_dataset_identity_conflict");
  assert.equal(manifest.identityPayload.selectionReproductionSha256, digest(source.samples), "source_rows_identity_conflict");
  for (const [name, b] of [["source-index.json", manifest.sourceIndex],
    ...Object.entries(manifest.splits).map(([split, b]) => [`splits/${split}.json`, b])]) {
    assert.equal(manifest.identityPayload.artifactHashes[name], b.sha256, "dataset_artifact_identity_conflict");
  }
  keys(contract.selections, ["train", "validation"], "unsupported_selected_splits");
  const selections = [];
  for (const split of ["train", "validation"]) {
    const selection = contract.selections[split];
    assert.equal(selection.sampleIds?.length, 1, "one_explicit_sample_per_split_required");
    equal(selection.splitFile, manifest.splits[split], "selected_membership_binding_conflict");
    const rows = source.samples.filter((r) => r.split === split);
    const selected = rows.filter((r) => r.sampleId === selection.sampleIds[0]);
    assert.equal(selected.length, 1, "selected_sample_not_in_split");
    assert.equal(selection.rowsSha256, digest(selected), "selected_row_hash_conflict");
    const row = selected[0];
    byteBinding(reader, row.image);
    const pack = reader.bound(binding(row.conditionPack));
    assert.equal(pack.channels?.length, 23, "selected_condition_channel_count_conflict");
    equal(pack.channels.map((c) => c.id), manifest.identityPayload.channelOrder, "selected_condition_order_conflict");
    for (const channel of pack.channels) byteBinding(reader, channel);
    selections.push({ split, sampleId: row.sampleId, selectedRowsSha256: selection.rowsSha256,
      datasetSelectionSha256: digest(rows), image: binding(row.image), conditionPack: binding(row.conditionPack) });
  }
  return { contract, selections };
}

/** Component identity only: no CPU/data grant, process, dispatch or registry write. */
export function inspectSplitSmokeComponent({ root, componentContractBinding }) {
  const reader = createReader(root);
  const result = readComponent(reader, binding(componentContractBinding), root);
  reader.verifyStable();
  return { ...result, status: "component_identity_verified_not_execution_qualified",
    inputReceipts: reader.receipts(), trainingAllowed: false, gpuAllowed: false,
    nextMachineAction: null, runtimeAdapterRegistered: false };
}

function executionPassed(execution, label) {
  assert.ok(execution && execution.exitCode === 0 && execution.signal === null && execution.interrupted === null,
    `${label}_execution_not_successful`);
  assert.ok(typeof execution.command === "string" && execution.command.length > 0
    && Array.isArray(execution.args) && typeof execution.stdout === "string", `${label}_execution_missing`);
}

function readCpu(reader, cpuBinding, contractBinding, contract, selections, requiredReceipts) {
  const report = reader.bound(cpuBinding);
  assert.equal(report.schemaVersion, "ai-painter-stage4-split-smoke-component-cpu-verification-v1", "unsupported_cpu_schema");
  assert.equal(report.status, "cpu_component_verified_runtime_inactive", "cpu_component_not_verified");
  equal(report.contract, contractBinding, "cpu_contract_binding_conflict");
  equal(report.qualification, QUALIFICATION, "cpu_qualification_conflict");
  for (const key of ["realDatasetOptimizerExecuted", "gpuStarted", "trainingStarted", "runtimeAdapterRegistered", "currentRegistryModified"])
    assert.equal(report[key], false, `cpu_scope_conflict:${key}`);
  assert.equal(report.syntheticCpuOptimizerExecutedByTests, true, "cpu_synthetic_test_scope_missing");
  executionPassed(report.selectionExecution, "selection");
  executionPassed(report.coreExecution, "core");
  equal(report.coreExecution.args, stage4CoreArgsForComponent(contractBinding, Boolean(contract.compilerLineage)), "cpu_core_entrypoint_conflict");
  const args = report.selectionExecution.args;
  assert.ok(args.length === 4 && args[0] === "-B" && args[1] === "-c" && typeof args[2] === "string",
    "cpu_selection_entrypoint_conflict");
  equal(JSON.parse(args[3]), contractBinding, "cpu_selection_contract_conflict");
  equal(JSON.parse(report.selectionExecution.stdout), report.selectedTensors, "cpu_selection_output_conflict");
  const offset = report.coreExecution.stdout.lastIndexOf('\n{\n  "status":');
  assert.ok(offset >= 0, "cpu_core_summary_missing");
  equal(JSON.parse(report.coreExecution.stdout.slice(offset + 1)), report.coreSummary, "cpu_core_output_conflict");
  validateStage4CoreQualificationSummary(report.coreSummary);
  if (contract.compilerLineage) {
    equal(report.coreSummary.componentContract, contractBinding, "cpu_core_component_binding_conflict");
    assert.equal(report.coreSummary.inheritedParentQualification, false, "cpu_core_parent_qualification_inherited");
  }
  const tensors = report.selectedTensors;
  assert.equal(tensors?.status, "real_selected_tensors_verified_cpu_only", "cpu_selected_tensors_missing");
  for (const key of ["optimizerCreated", "modelCreated", "gpuStarted"]) assert.equal(tensors[key], false, "cpu_tensor_scope_conflict");
  assert.equal(tensors.samples?.length, selections.length, "cpu_selected_sample_count_conflict");
  for (const [index, selected] of selections.entries()) {
    const sample = tensors.samples[index];
    for (const key of ["sampleId", "split", "datasetSelectionSha256"]) assert.equal(sample[key], selected[key], "cpu_selected_identity_conflict");
    for (const key of ["imageTensorSha256", "conditionsTensorSha256"]) assert.match(sample[key] ?? "", /^[a-f0-9]{64}$/u, "cpu_tensor_digest_missing");
  }
  assert.ok(Array.isArray(report.inputReceipts) && report.inputReceipts.length > 0, "cpu_input_receipts_missing");
  const receipts = new Map();
  for (const receipt of report.inputReceipts) {
    assert.ok(!receipts.has(receipt.path), "cpu_duplicate_input_receipt");
    assert.ok(Number.isSafeInteger(receipt.bytes) && receipt.bytes >= 0, "cpu_input_size_invalid");
    const b = binding(receipt), bytes = reader.bytes(b.path, b.sha256);
    assert.equal(bytes.length, receipt.bytes, "cpu_input_size_conflict");
    receipts.set(b.path, receipt);
  }
  for (const expected of requiredReceipts) {
    equal(receipts.get(expected.path), expected, `cpu_required_receipt_missing_or_conflicting:${expected.path}`);
  }
  // No tensor re-execution, derived-config reconstruction or optimization occurs
  // here. This is verified provenance of a component report, not a new CPU run.
  return { status: "bound_cpu_component_report_verified", syntheticOptimizerEvidenceOnly: true,
    realSelectedInputBytesRehashed: true, tensorsReexecuted: false,
    derivedCpuConfigSha256: contract.derivedCpuConfigSha256, derivedConfigRebuilt: false,
    capabilityQualificationGranted: false };
}

/** Explicit bindings only. No injected evaluator, caller permits, registry writes or process creation. */
export function preflightSplitSmoke(options) {
  const blockers = [], checks = { component: "not_checked", cpu: "not_checked", data: "not_checked" };
  let reader, contract, selections, cpuComponentEvidence = null, dataAdjudication = null;
  let componentContractBinding, cpuEvidenceBinding, dataEvidenceBindings;
  let phase = "input";
  const add = (code, scope, details) => blockers.push({ code, scope, details });
  try {
    keys(options, ["root", "componentContractBinding", "cpuEvidenceBinding", "dataEvidenceBindings"], "unsupported_preflight_input");
    assert.ok(typeof options.root === "string" && options.root.length > 0, "project_root_required");
    keys(options.dataEvidenceBindings, ["baselineBinding", "geometryBinding", "exposureBinding"], "explicit_data_bindings_required");
    componentContractBinding = binding(options.componentContractBinding);
    cpuEvidenceBinding = binding(options.cpuEvidenceBinding);
    dataEvidenceBindings = Object.fromEntries(Object.entries(options.dataEvidenceBindings).map(([k, v]) => [k, binding(v)]));
    reader = createReader(options.root);
    // Evaluator receipts are new provenance, not obligations retroactively added
    // to an old CPU report. Its own existing program receipts must still match.
    for (const logical of EVALUATORS) reader.bytes(logical);
    phase = "component";
    ({ contract, selections } = readComponent(reader, componentContractBinding, options.root));
    for (const logical of CPU_PROGRAMS) reader.bytes(logical);
    const requiredCpuReceipts = reader.receipts().filter((r) => !EVALUATORS.includes(r.path));
    checks.component = "explicit_bindings_verified";
    phase = "cpu";
    cpuComponentEvidence = readCpu(reader, cpuEvidenceBinding, componentContractBinding, contract, selections, requiredCpuReceipts);
    checks.cpu = cpuComponentEvidence.status;
    phase = "data";
    dataAdjudication = adjudicateStage4SplitData({ root: options.root, manifestBinding: binding(contract.datasetManifest), ...dataEvidenceBindings });
    assert.equal(dataAdjudication.schemaVersion, "ai-painter-stage4-split-data-adjudication-v1", "unsupported_data_adjudication_schema");
    assert.ok(["blocked_data_qualification", "unknown_or_stale"].includes(dataAdjudication.status), "no_trusted_data_grant_schema");
    assert.equal(dataAdjudication.trainingAllowed, false, "no_trusted_data_grant_schema");
    equal(dataAdjudication.qualification, { trainingAllowed: false, dataQualified: false }, "no_trusted_data_grant_schema");
    equal(dataAdjudication.datasetManifest, contract.datasetManifest, "adjudication_dataset_binding_conflict");
    equal(dataAdjudication.sourceEvidence, { baseline: dataEvidenceBindings.baselineBinding,
      geometry: dataEvidenceBindings.geometryBinding, exposure: dataEvidenceBindings.exposureBinding }, "adjudication_source_binding_conflict");
    assert.ok(dataAdjudication.datasetReleaseIdentity === null
      || dataAdjudication.datasetReleaseIdentity === contract.datasetReleaseIdentity, "adjudication_dataset_identity_conflict");
    for (const receipt of dataAdjudication.inputReceipts) {
      const bytes = reader.bytes(receipt.path, receipt.sha256);
      assert.equal(bytes.length, receipt.bytes, "adjudication_input_size_conflict");
    }
    checks.data = dataAdjudication.status;
    for (const blocker of dataAdjudication.blockers) blockers.push(blocker);
    add("data_qualification_not_established", "data", "Bounded diagnostics cannot grant real-data optimization or independent holdout qualification.");
  } catch (error) {
    checks[phase] = "unknown_or_stale";
    add(`${phase}_evidence_invalid_or_stale`, phase, { reason: error.message.split("\n")[0].slice(0, 1000) });
  }
  // Separate workflow gaps from the data verdict. Neither old V2 success nor
  // component-only synthetic optimization discharges these requirements.
  add("new_capability_gpu_qualification_not_established", "gpu", "Requires new candidate-specific qualification; GPU is not started by this adapter.");
  add("split_smoke_lifecycle_execution_adapter_unregistered", "execution", "No task dispatch, checkpoint/review/failure-terminal publication or registry transition is implemented here.");
  add("cpu_component_report_not_real_training_qualification", "cpu", "Synthetic CPU optimizer tests and real selected tensor reads are component evidence only.");
  let stable = true;
  try { reader?.verifyStable(); } catch (error) {
    stable = false;
    add("preflight_input_changed_during_read", "evidence_integrity", { reason: error.message });
    checks.component = checks.cpu = checks.data = "unknown_or_stale";
  }
  const inputReceipts = reader?.receipts() ?? [];
  const canPlan = stable && checks.component === "explicit_bindings_verified" && checks.cpu === "bound_cpu_component_report_verified";
  const proposal = canPlan ? {
    schemaVersion: contract.compilerLineage ? "ai-painter-stage4-split-smoke-plan-candidate-v2" : "ai-painter-stage4-split-smoke-plan-candidate-v1", status: "blocked_unregistered_proposal",
    actionId: "resolve_split_smoke_data_and_execution_prerequisites", dispatchable: false, entrypointId: null,
    capabilityVersion: contract.capabilityVersion, parentCapability: contract.parentCapability,
    inheritedParentQualification: false, datasetManifest: contract.datasetManifest,
    datasetReleaseIdentity: contract.datasetReleaseIdentity, selections,
    componentContract: componentContractBinding, cpuComponentEvidence: cpuEvidenceBinding,
    ...(contract.compilerLineage ? { compilerLineage: contract.compilerLineage } : {}),
    dataEvidenceBindings, programBindings: contract.programBindings, frozenProgramBindings: contract.frozenProgramBindings,
    evaluatorBindings: inputReceipts.filter((r) => EVALUATORS.includes(r.path)),
    inputReceipts, blockers, trainingAllowed: false,
    cpuNextSteps: ["resolve_bound_data_evidence_gaps", "implement_and_test_new_candidate_lifecycle_adapter"],
  } : null;
  return {
    schemaVersion: SPLIT_SMOKE_PREFLIGHT_SCHEMA,
    status: checks.data === "blocked_data_qualification" && canPlan ? "blocked_data_qualification" : "unknown_or_stale",
    checks, blockers, cpuComponentEvidence, dataAdjudication,
    planCandidate: proposal ? { ...proposal, planCandidateId: `split-smoke-preflight-plan-${digest(proposal)}` } : null,
    nextMachineAction: null, trainingAllowed: false, qualification: { trainingAllowed: false, dataQualified: false },
    gpuAllowed: false, gpuStarted: false, trainingStarted: false, modelCreated: false, optimizerCreated: false,
    processCreated: false, taskCreated: false, ticketConsumed: false, runtimeAdapterRegistered: false,
    currentRegistryModified: false, historicalFilesModified: false, inputReceipts,
  };
}
