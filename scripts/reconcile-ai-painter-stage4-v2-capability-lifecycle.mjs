import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { DatabaseSync } from "node:sqlite";

import {
  advanceCapabilityLifecycle,
  createCapabilityCandidate,
} from "./lib/ai-painter-capability-lifecycle-v1.mjs";

export const STAGE4_V2_CAPABILITY =
  "stage4_full_resolution_typed_semantic_transport_rgb_responsibility_v2";
export const STAGE4_V2_LIFECYCLE_ROOT =
  `.runtime/ai-painter/capability-lifecycle/${STAGE4_V2_CAPABILITY}`;
export const STAGE4_V2_CPU_ACCEPTANCE_TERMINAL = Object.freeze({
  path: ".runtime/ai-painter/stage4-v2-cpu-contract-acceptance-executions/stage4-v2-cpu-acceptance-20260831021114635-eb0cbdaa/phase-terminal.json",
  sha256: "b32c93e9bad135e0226b9309f0005851a337edaebf6afa3a453a4ad817aa776f",
});

const CPU_TERMINAL_SCHEMA = "stage4-v2-cpu-contract-acceptance-terminal-v1";
const CPU_REPORT_SCHEMA = "stage4-v2-cpu-contract-acceptance-report-v1";
const CLASSIFICATION_SCHEMA =
  "stage4-joint-condition-full-data-screen-capability-change-classification-v1";
const PARENT_CONTRACT_SCHEMA =
  "stage4-full-resolution-typed-semantic-transport-rgb-responsibility-contract-v2";
const CANDIDATE_SCHEMA = "ai-painter-capability-change-candidate-v1";
const STAGE_EVIDENCE_SCHEMA = "ai-painter-capability-stage-evidence-v1";
const STATE_SCHEMA = "ai-painter-capability-lifecycle-state-v1";
const EXPECTED_CPU_CHECK_IDS = Object.freeze([
  "stage4_v2_parent_contract_core",
  "condition_contract",
  "dataset_release",
  "trainer_loss_support",
  "machine_review_threshold",
  "foundation_autoencoder_lineage",
]);
const EXPECTED_PREREQUISITE_IDS = Object.freeze([
  "condition_contract",
  "dataset_release",
  "trainer_loss_support",
  "machine_review_threshold",
  "foundation_autoencoder_lineage",
]);
const EXPECTED_CPU_PROGRAM_ROLES = Object.freeze([
  "runner",
  "checker:stage4_v2_parent_contract_core",
  "checker:condition_contract",
  "checker:dataset_release",
  "checker:trainer_loss_support",
  "checker:machine_review_threshold",
  "checker:foundation_autoencoder_lineage",
]);
const EXPECTED_PARENT_PROGRAM_ROLES = Object.freeze([
  "modelFactory",
  "successorModule",
  "cpuContractTest",
  "conditionCompiler",
  "currentConditionValidator",
  "typedResizeBehaviorValidator",
  "conditionSemanticAlignmentValidator",
  "datasetReleaseValidator",
  "trainer",
  "trainerSupport",
  "trainerSupportCpuChecker",
  "trainerSupportCpuTest",
  "reviewThresholdValidator",
  "reviewCompositionBoundary",
  "foundationAssetValidator",
  "cpuContractValidator",
  "cpuAcceptanceRunner",
  "cpuAcceptanceTest",
]);

const TRANSITIONS = Object.freeze({
  change_candidate: ["isolated_implementation", "rejected"],
  isolated_implementation: ["cpu_contract_verified", "rejected"],
  cpu_contract_verified: ["readonly_gpu_qualified", "controlled_smoke_completed", "rejected"],
  readonly_gpu_qualified: ["controlled_smoke_completed", "rejected"],
  controlled_smoke_completed: ["formal_stage_validation_completed", "rejected"],
  formal_stage_validation_completed: ["independent_regression_completed", "rejected"],
  independent_regression_completed: ["machine_release_adjudicated", "rejected"],
  machine_release_adjudicated: ["released", "rejected"],
  released: ["rolled_back"],
});
const CPU_RECONCILED_STATES = new Set([
  "cpu_contract_verified",
  "readonly_gpu_qualified",
  "controlled_smoke_completed",
  "formal_stage_validation_completed",
  "independent_regression_completed",
  "machine_release_adjudicated",
  "released",
]);

if (isDirectExecution()) {
  assert.equal(process.argv.length, 2, "Stage4 V2 lifecycle reconciliation accepts no caller-selected evidence");
  const result = reconcileStage4V2CapabilityLifecycle({ projectRoot: process.cwd() });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

export function reconcileStage4V2CapabilityLifecycle({
  projectRoot = process.cwd(),
  now = () => new Date().toISOString(),
} = {}) {
  const root = path.resolve(projectRoot);
  const lifecycleRoot = resolveProjectPath(root, STAGE4_V2_LIFECYCLE_ROOT);
  const candidateAlreadyExists = fs.existsSync(lifecycleRoot);
  const sources = collectStage4V2LifecycleSources({
    projectRoot: root,
    cpuAcceptanceTerminalPath: STAGE4_V2_CPU_ACCEPTANCE_TERMINAL.path,
    expectedCpuAcceptanceTerminalSha256: STAGE4_V2_CPU_ACCEPTANCE_TERMINAL.sha256,
  });
  const candidate = buildStage4V2CandidateSpec(sources);
  const isolatedEvidence = buildStage4V2IsolatedImplementationEvidence(sources);
  const cpuEvidence = buildStage4V2CpuContractEvidence(sources);
  const actions = [];

  if (!candidateAlreadyExists) {
    createCapabilityCandidate(candidate, {
      root,
      recordedAtUtc: nextTimestamp(now),
    });
    actions.push("created_change_candidate");
  }

  let state = verifyLifecycleStorage({
    root,
    expectedCandidate: candidate,
    isolatedEvidence,
    cpuEvidence,
  });
  if (state.state === "change_candidate") {
    advanceCapabilityLifecycle({
      root,
      capabilityVersion: STAGE4_V2_CAPABILITY,
      targetState: "isolated_implementation",
      evidence: isolatedEvidence,
      recordedAtUtc: nextTimestamp(now),
    });
    actions.push("advanced_isolated_implementation");
    state = verifyLifecycleStorage({
      root,
      expectedCandidate: candidate,
      isolatedEvidence,
      cpuEvidence,
    });
  }
  if (state.state === "isolated_implementation") {
    advanceCapabilityLifecycle({
      root,
      capabilityVersion: STAGE4_V2_CAPABILITY,
      targetState: "cpu_contract_verified",
      evidence: cpuEvidence,
      recordedAtUtc: nextTimestamp(now),
    });
    actions.push("advanced_cpu_contract_verified");
    state = verifyLifecycleStorage({
      root,
      expectedCandidate: candidate,
      isolatedEvidence,
      cpuEvidence,
    });
  }

  assert.notEqual(state.state, "rejected", "Stage4 V2 lifecycle is rejected and cannot be reconciled");
  assert.notEqual(state.state, "rolled_back", "Stage4 V2 lifecycle is rolled back and cannot be reconciled");
  assert.ok(
    CPU_RECONCILED_STATES.has(state.state),
    `Stage4 V2 lifecycle did not reach cpu_contract_verified: ${state.state}`,
  );

  return Object.freeze({
    schemaVersion: "stage4-v2-capability-lifecycle-reconciliation-result-v1",
    status: actions.length === 0
      ? (state.state === "cpu_contract_verified" ? "already_reconciled" : "already_beyond_cpu_contract_verified")
      : "reconciled",
    capabilityVersion: STAGE4_V2_CAPABILITY,
    lifecycleState: state.state,
    lifecycleSequence: state.sequence,
    lifecycleRoot: STAGE4_V2_LIFECYCLE_ROOT,
    actions,
    sourceEvidence: candidate.sourceEvidence,
    currentExecutionRegistryWritten: false,
    gpuStarted: false,
    optimizerCreated: false,
    backwardExecuted: false,
    weightsModified: false,
    trainingStarted: false,
    ownerAuthorizationRequired: false,
  });
}

export function collectStage4V2LifecycleSources({
  projectRoot,
  cpuAcceptanceTerminalPath,
  expectedCpuAcceptanceTerminalSha256 = null,
}) {
  const root = path.resolve(projectRoot);
  const cpuTerminal = bindProjectFile(root, cpuAcceptanceTerminalPath, "cpu_acceptance_terminal");
  if (expectedCpuAcceptanceTerminalSha256 !== null) {
    assert.equal(
      cpuTerminal.sha256,
      expectedCpuAcceptanceTerminalSha256,
      "V2 CPU acceptance terminal SHA-256 mismatch",
    );
  }
  const terminal = readJson(root, cpuTerminal.path);
  assert.equal(terminal.schemaVersion, CPU_TERMINAL_SCHEMA, "V2 CPU acceptance terminal schema mismatch");
  assert.equal(terminal.architectureId, STAGE4_V2_CAPABILITY, "V2 CPU terminal capability mismatch");
  assert.equal(terminal.executionClass, "cpu_readonly", "V2 CPU terminal execution class mismatch");
  assert.equal(terminal.executionState, "completed", "V2 CPU terminal is not completed");
  assert.equal(
    terminal.status,
    "stage4_v2_cpu_contract_acceptance_passed_inactive",
    "V2 CPU terminal did not pass inactive acceptance",
  );
  assert.equal(terminal.failureCode, null, "V2 CPU terminal contains a failure code");
  assert.equal(terminal.activationState, "inactive", "V2 CPU terminal is not inactive");
  assert.equal(
    terminal.nextActionEligible,
    "readonly_gpu_qualification_planning",
    "V2 CPU terminal next action eligibility mismatch",
  );
  assert.equal(terminal.ownerAuthorizationRequired, false, "V2 CPU terminal contains an Owner gate");
  verifyClosedSafety(terminal.safety, "V2 CPU terminal");

  const classification = bindDeclaredProjectFile(
    root,
    terminal.sourceAdjudication?.classification,
    "failure_boundary_classification",
  );
  const sourceAdjudicationTerminal = bindDeclaredProjectFile(
    root,
    terminal.sourceAdjudication?.terminal,
    "source_adjudication_terminal",
  );
  const parentContract = bindDeclaredProjectFile(
    root,
    terminal.successorContract,
    "v2_parent_contract",
  );
  const cpuReport = bindDeclaredProjectFile(
    root,
    terminal.cpuAcceptanceReport,
    "cpu_acceptance_report",
  );

  const classificationValue = readJson(root, classification.path);
  assert.equal(classificationValue.schemaVersion, CLASSIFICATION_SCHEMA, "V2 classification schema mismatch");
  assert.equal(
    classificationValue.status,
    "major_capability_change_candidate_required",
    "V2 classification does not require a change candidate",
  );
  assert.equal(classificationValue.changeRequirement, "AP-CHANGE-001", "V2 classification change requirement mismatch");
  assert.equal(
    classificationValue.successorCapabilityVersion,
    STAGE4_V2_CAPABILITY,
    "V2 classification successor capability mismatch",
  );
  assert.equal(
    classificationValue.successorDisposition,
    "change_candidate_not_yet_qualified",
    "V2 classification successor disposition mismatch",
  );
  assert.equal(classificationValue.ownerAuthorizationRequired, false, "V2 classification contains an Owner gate");
  assert.equal(classificationValue.trainingAuthorized, false, "V2 classification unexpectedly authorizes training");
  assertSameBinding(classificationValue.successorContract, parentContract, "classification parent contract");

  const sourceTerminalValue = readJson(root, sourceAdjudicationTerminal.path);
  assert.equal(
    sourceTerminalValue.schemaVersion,
    "stage4-joint-condition-full-data-screen-failure-boundary-adjudication-terminal-v1",
    "source adjudication terminal schema mismatch",
  );
  assert.equal(sourceTerminalValue.executionState, "completed", "source adjudication terminal is not completed");
  assert.equal(
    sourceTerminalValue.status,
    "joint_condition_full_data_screen_failure_boundary_adjudicated_change_candidate_required",
    "source adjudication terminal status mismatch",
  );
  assert.equal(sourceTerminalValue.runId, classificationValue.runId, "source adjudication/classification run mismatch");
  assert.equal(sourceTerminalValue.sourceRunId, classificationValue.sourceRunId, "source failure run mismatch");
  assert.equal(sourceTerminalValue.successorCapabilityVersion, STAGE4_V2_CAPABILITY,
    "source adjudication successor capability mismatch");
  assert.equal(sourceTerminalValue.nextLegalAction,
    "verify_stage4_full_resolution_typed_semantic_transport_rgb_responsibility_v2_cpu_contract",
    "source adjudication next legal action mismatch");
  assert.equal(sourceTerminalValue.automaticTrainingContinuationAllowed, false,
    "source adjudication unexpectedly permits training continuation");
  assert.equal(sourceTerminalValue.ownerAuthorizationRequired, false, "source adjudication contains an Owner gate");
  assertSameBinding(sourceTerminalValue.capabilityChangeClassification, classification,
    "source adjudication classification");

  const contract = readJson(root, parentContract.path);
  assert.equal(contract.schemaVersion, PARENT_CONTRACT_SCHEMA, "V2 parent contract schema mismatch");
  assert.equal(contract.contractId, PARENT_CONTRACT_SCHEMA, "V2 parent contract identity mismatch");
  assert.equal(contract.architectureId, STAGE4_V2_CAPABILITY, "V2 parent contract capability mismatch");
  assert.equal(contract.status, "cpu_supported_inactive", "V2 parent contract is not CPU-supported inactive");
  assert.equal(contract.trainingPrerequisites?.readonlyGpuQualificationRequired, true,
    "V2 parent contract does not require readonly GPU qualification");
  assert.equal(contract.trainingPrerequisites?.controlledSmokeRequired, true,
    "V2 parent contract does not require controlled Smoke");
  for (const gate of [
    "configurationActiveNow", "gpuNow", "optimizerNow", "backwardNow", "weightModificationNow",
    "trainingNow", "formalInferenceNow", "runtimeFrameNow", "worldEntryNow",
  ]) assert.equal(contract.activationGates?.[gate], false, `V2 parent contract gate is open: ${gate}`);
  for (const [role, binding] of [
    ["condition_contract", contract.conditionContract],
    ["dataset_release", contract.datasetBinding],
    ["dataset_source_manifest", contract.datasetBinding?.sourceManifest],
    ["dataset_source_index", contract.datasetBinding?.sourceIndex],
    ["loss_contract", contract.lossContract],
    ["review_threshold_contract", contract.reviewThresholdContract],
    ["foundation_asset_contract", contract.foundationAssetBinding],
  ]) bindDeclaredProjectFile(root, binding, `parent_${role}`);
  assert.deepEqual(Object.keys(contract.prerequisiteBindings ?? {}).sort(), [...EXPECTED_PREREQUISITE_IDS].sort(),
    "V2 parent prerequisite role set mismatch");
  for (const prerequisiteId of EXPECTED_PREREQUISITE_IDS) {
    const prerequisite = contract.prerequisiteBindings[prerequisiteId];
    assert.equal(prerequisite.id, prerequisiteId, `V2 parent prerequisite identity mismatch: ${prerequisiteId}`);
    assert.equal(prerequisite.required, true, `V2 parent prerequisite is optional: ${prerequisiteId}`);
    assert.equal(prerequisite.executionClass, "cpu_readonly", `V2 parent prerequisite is not CPU-only: ${prerequisiteId}`);
    bindDeclaredProjectFile(root, prerequisite, `parent_prerequisite_${prerequisiteId}`);
    verifyPreExecutionSafety(prerequisite.safety, `V2 parent prerequisite ${prerequisiteId}`);
  }
  assert.deepEqual(Object.keys(contract.programBindings ?? {}).sort(), [...EXPECTED_PARENT_PROGRAM_ROLES].sort(),
    "V2 parent program role set mismatch");
  for (const role of EXPECTED_PARENT_PROGRAM_ROLES) {
    bindDeclaredProjectFile(root, contract.programBindings[role], `parent_program_${normalizeRole(role)}`);
  }

  const report = readJson(root, cpuReport.path);
  assert.equal(report.schemaVersion, CPU_REPORT_SCHEMA, "V2 CPU acceptance report schema mismatch");
  assert.equal(report.runId, terminal.runId, "V2 CPU report/terminal run identity mismatch");
  assert.equal(report.status, "passed", "V2 CPU acceptance report did not pass");
  assert.equal(report.architectureId, STAGE4_V2_CAPABILITY, "V2 CPU report capability mismatch");
  assert.equal(report.executionClass, "cpu_readonly", "V2 CPU report execution class mismatch");
  assertSameBinding(report.contract, parentContract, "CPU report parent contract");
  assert.equal(report.contract?.actualSha256, parentContract.sha256, "CPU report actual contract SHA mismatch");
  assertSameBinding(report.sourceAdjudication?.classification, classification, "CPU report classification");
  assertSameBinding(report.sourceAdjudication?.terminal, sourceAdjudicationTerminal, "CPU report adjudication terminal");
  verifyClosedSafety(report.safety, "V2 CPU report");
  assert.ok(Array.isArray(report.checks), "V2 CPU report checks are missing");
  assert.deepEqual(report.checks.map((entry) => entry?.id), EXPECTED_CPU_CHECK_IDS,
    "V2 CPU report check identity set mismatch");
  assert.equal(report.checks.every((entry) => entry?.passed === true), true, "V2 CPU report contains a failed check");
  assert.equal(report.error, null, "V2 CPU report contains an error");
  assert.ok(report.programLineage && typeof report.programLineage === "object", "V2 CPU program lineage is missing");
  assert.deepEqual(Object.keys(report.programLineage), EXPECTED_CPU_PROGRAM_ROLES,
    "V2 CPU program lineage role set mismatch");
  for (const role of EXPECTED_CPU_PROGRAM_ROLES) {
    bindDeclaredProjectFile(root, report.programLineage[role], `cpu_program_${normalizeRole(role)}`);
  }
  assert.ok(Array.isArray(report.prerequisiteBindings), "V2 CPU prerequisite bindings are missing");
  assert.deepEqual(report.prerequisiteBindings.map((entry) => entry?.id), EXPECTED_PREREQUISITE_IDS,
    "V2 CPU prerequisite binding identity set mismatch");
  for (const prerequisite of report.prerequisiteBindings) {
    assert.equal(prerequisite.executionClass, "cpu_readonly",
      `V2 CPU prerequisite is not CPU-only: ${prerequisite.id}`);
    const parentPrerequisite = contract.prerequisiteBindings[prerequisite.id];
    assert.equal(prerequisite.contract?.path, parentPrerequisite.path,
      `V2 CPU prerequisite contract path mismatch: ${prerequisite.id}`);
    assert.equal(prerequisite.contract?.expectedSha256, parentPrerequisite.sha256,
      `V2 CPU prerequisite contract SHA mismatch: ${prerequisite.id}`);
    const actual = bindProjectFile(root, prerequisite.contract.path, `cpu_prerequisite_${prerequisite.id}`);
    assert.equal(actual.sha256, prerequisite.contract.expectedSha256,
      `V2 CPU prerequisite contract bytes mismatch: ${prerequisite.id}`);
    assert.deepEqual(prerequisite.checkerCommand, parentPrerequisite.checkerCommand,
      `V2 CPU prerequisite checker command mismatch: ${prerequisite.id}`);
    verifyPreExecutionSafety(prerequisite.safety, `V2 CPU prerequisite ${prerequisite.id}`);
  }

  return Object.freeze({
    classification,
    parentContract,
    cpuTerminal,
    cpuReport,
    sourceAdjudicationTerminal,
    sourceRunId: classificationValue.sourceRunId,
    cpuRunId: terminal.runId,
  });
}

export function buildStage4V2CandidateSpec(sources) {
  return {
    schemaVersion: CANDIDATE_SCHEMA,
    capabilityVersion: STAGE4_V2_CAPABILITY,
    changeClass: "model_family",
    status: "change_candidate",
    authority: "local_ai_pet_world_program",
    ownerAuthorizationRequired: false,
    ownerInLifecycle: false,
    sourceEvidence: [
      sources.classification,
      sources.parentContract,
      sources.cpuTerminal,
    ].map(copyBinding),
    reconciliation: {
      reason: "canonical_lifecycle_missing_after_verified_v2_cpu_acceptance",
      sourceRunId: sources.sourceRunId,
      cpuAcceptanceRunId: sources.cpuRunId,
      historicalCurrentRegistryRewriteAllowed: false,
    },
    executionBoundary: closedExecutionBoundary(),
  };
}

export function buildStage4V2IsolatedImplementationEvidence(sources) {
  return {
    schemaVersion: STAGE_EVIDENCE_SCHEMA,
    capabilityVersion: STAGE4_V2_CAPABILITY,
    targetState: "isolated_implementation",
    status: "passed",
    executionClass: "cpu_readonly",
    reconciliation: true,
    bindings: [sources.classification, sources.parentContract].map(copyBinding),
    executionBoundary: closedExecutionBoundary(),
  };
}

export function buildStage4V2CpuContractEvidence(sources) {
  return {
    schemaVersion: STAGE_EVIDENCE_SCHEMA,
    capabilityVersion: STAGE4_V2_CAPABILITY,
    targetState: "cpu_contract_verified",
    status: "passed",
    executionClass: "cpu_readonly",
    reconciliation: true,
    bindings: [sources.cpuTerminal, sources.cpuReport, sources.parentContract].map(copyBinding),
    executionBoundary: closedExecutionBoundary(),
  };
}

function verifyLifecycleStorage({ root, expectedCandidate, isolatedEvidence, cpuEvidence }) {
  const lifecycleRoot = resolveProjectPath(root, STAGE4_V2_LIFECYCLE_ROOT, { mustExist: true, kind: "directory" });
  const candidate = readJson(root, `${STAGE4_V2_LIFECYCLE_ROOT}/candidate.json`);
  assert.deepEqual(candidate, expectedCandidate, "existing V2 capability candidate conflicts with canonical reconciliation");
  const state = readJson(root, `${STAGE4_V2_LIFECYCLE_ROOT}/state.json`);
  assert.equal(state.schemaVersion, STATE_SCHEMA, "V2 lifecycle state schema mismatch");
  assert.equal(state.capabilityVersion, STAGE4_V2_CAPABILITY, "V2 lifecycle state capability mismatch");
  assert.equal(state.changeClass, "model_family", "V2 lifecycle change class mismatch");
  assert.equal(state.ownerAuthorizationRequired, false, "V2 lifecycle state contains an Owner gate");
  assert.equal(state.ownerResponseRequired, false, "V2 lifecycle state contains an Owner response gate");
  assert.ok(Number.isInteger(state.sequence) && state.sequence >= 0, "V2 lifecycle sequence is invalid");

  const ledgerPath = path.join(lifecycleRoot, "event-ledger.jsonl");
  assert.ok(fs.existsSync(ledgerPath), "V2 lifecycle event ledger is missing");
  const ledgerText = fs.readFileSync(ledgerPath, "utf8");
  assert.ok(ledgerText.endsWith("\n"), "V2 lifecycle event ledger has a partial final line");
  const events = ledgerText.trim().split("\n").filter(Boolean).map((line) => JSON.parse(line));
  assert.equal(events.length, state.sequence + 1, "V2 lifecycle event count conflicts with state sequence");

  const databasePath = path.join(lifecycleRoot, "lifecycle.sqlite");
  assert.ok(fs.existsSync(databasePath), "V2 lifecycle SQLite database is missing");
  const database = new DatabaseSync(databasePath, { readOnly: true });
  let capabilityRow;
  let transitions;
  try {
    capabilityRow = database.prepare(
      "SELECT state, change_class, owner_response_required FROM capabilities WHERE capability_version = ?",
    ).get(STAGE4_V2_CAPABILITY);
    transitions = database.prepare(
      "SELECT sequence, from_state, to_state, evidence_sha256 FROM lifecycle_transitions WHERE capability_version = ? ORDER BY sequence",
    ).all(STAGE4_V2_CAPABILITY);
  } finally {
    database.close();
  }
  assert.equal(capabilityRow?.state, state.state, "V2 lifecycle SQLite state conflict");
  assert.equal(capabilityRow?.change_class, "model_family", "V2 lifecycle SQLite change class conflict");
  assert.equal(capabilityRow?.owner_response_required, 0, "V2 lifecycle SQLite Owner gate conflict");
  assert.equal(transitions.length, state.sequence + 1, "V2 lifecycle SQLite transition count conflict");
  assert.equal(events[state.sequence]?.state, state.state, "V2 lifecycle state/event tail conflict");
  assert.equal(transitions[state.sequence]?.to_state, state.state, "V2 lifecycle state/SQLite tail conflict");

  const evidenceRoot = path.join(lifecycleRoot, "evidence");
  assert.ok(fs.existsSync(evidenceRoot) && fs.statSync(evidenceRoot).isDirectory(), "V2 lifecycle evidence directory is missing");
  const evidenceFiles = fs.readdirSync(evidenceRoot).filter((name) => name.endsWith(".json")).sort();
  assert.equal(evidenceFiles.length, state.sequence, "V2 lifecycle evidence count conflicts with state sequence");

  for (let sequence = 0; sequence <= state.sequence; sequence += 1) {
    const event = events[sequence];
    const transition = transitions[sequence];
    assert.equal(event.schemaVersion, "ai-painter-capability-lifecycle-event-v1", "V2 lifecycle event schema mismatch");
    assert.equal(event.capabilityVersion, STAGE4_V2_CAPABILITY, "V2 lifecycle event capability mismatch");
    assert.equal(event.sequence, sequence, "V2 lifecycle event sequence gap");
    assert.equal(event.ownerResponseRequired, false, "V2 lifecycle event contains an Owner gate");
    assert.equal(transition.sequence, sequence, "V2 lifecycle SQLite sequence gap");
    assert.equal(transition.to_state, event.state, "V2 lifecycle event/SQLite state conflict");
    if (sequence === 0) {
      assert.equal(event.state, "change_candidate", "V2 lifecycle initial state mismatch");
      assert.equal(event.evidenceSha256, null, "V2 lifecycle initial event unexpectedly binds evidence");
      assert.equal(transition.from_state, null, "V2 lifecycle initial transition source mismatch");
      assert.equal(transition.evidence_sha256, null, "V2 lifecycle initial SQLite evidence mismatch");
      continue;
    }
    const previousState = events[sequence - 1].state;
    assert.ok(TRANSITIONS[previousState]?.includes(event.state), `invalid stored V2 lifecycle transition ${previousState} -> ${event.state}`);
    assert.equal(transition.from_state, previousState, "V2 lifecycle SQLite transition source conflict");
    assert.match(event.evidenceSha256 ?? "", /^[a-f0-9]{64}$/u, "V2 lifecycle event evidence SHA is invalid");
    assert.equal(transition.evidence_sha256, event.evidenceSha256, "V2 lifecycle event/SQLite evidence SHA conflict");
    const relativeEvidencePath = `evidence/${String(sequence).padStart(3, "0")}-${event.state}.json`;
    const evidenceBinding = bindProjectFile(
      root,
      `${STAGE4_V2_LIFECYCLE_ROOT}/${relativeEvidencePath}`,
      `lifecycle_${sequence}_${event.state}`,
    );
    assert.equal(evidenceBinding.sha256, event.evidenceSha256, "V2 lifecycle evidence bytes conflict with ledger");
    const evidence = readJson(root, evidenceBinding.path);
    assert.equal(evidence.schemaVersion, STAGE_EVIDENCE_SCHEMA, "V2 lifecycle stage evidence schema mismatch");
    assert.equal(evidence.capabilityVersion, STAGE4_V2_CAPABILITY, "V2 lifecycle stage evidence capability mismatch");
    assert.equal(evidence.targetState, event.state, "V2 lifecycle stage evidence target mismatch");
    assert.equal(evidence.ownerAuthorizationRequired, false, "V2 lifecycle evidence contains an Owner gate");
    assert.equal(evidence.ownerResponseRequired, false, "V2 lifecycle evidence contains an Owner response gate");
    assert.ok(Array.isArray(evidence.bindings) && evidence.bindings.length > 0,
      "V2 lifecycle stage evidence bindings are missing");
    for (const [index, binding] of evidence.bindings.entries()) {
      bindDeclaredProjectFile(root, binding, `lifecycle_${sequence}_${event.state}_binding_${index}`);
    }
    if (sequence === 1) verifyExpectedStageEvidence(evidence, isolatedEvidence, "isolated implementation");
    if (sequence === 2) verifyExpectedStageEvidence(evidence, cpuEvidence, "CPU contract");
  }

  if (state.sequence === 0) {
    assert.equal(state.latestEvidence, null, "initial V2 lifecycle state unexpectedly binds evidence");
  } else {
    const latestEvent = events[state.sequence];
    assert.equal(
      state.latestEvidence?.path,
      `evidence/${String(state.sequence).padStart(3, "0")}-${latestEvent.state}.json`,
      "V2 lifecycle latest evidence path mismatch",
    );
    assert.equal(state.latestEvidence?.sha256, latestEvent.evidenceSha256, "V2 lifecycle latest evidence SHA mismatch");
  }
  return state;
}

function verifyExpectedStageEvidence(actual, expected, label) {
  for (const field of ["schemaVersion", "capabilityVersion", "targetState", "status", "executionClass", "reconciliation"]) {
    assert.deepEqual(actual[field], expected[field], `${label} evidence ${field} mismatch`);
  }
  assert.deepEqual(actual.bindings, expected.bindings, `${label} evidence bindings mismatch`);
  assert.deepEqual(actual.executionBoundary, expected.executionBoundary, `${label} execution boundary mismatch`);
}

function verifyClosedSafety(safety, label) {
  assert.ok(safety && typeof safety === "object" && !Array.isArray(safety), `${label} safety is missing`);
  for (const field of [
    "gpuAllowed", "optimizerAllowed", "backwardAllowed", "checkpointWeightsReadAllowed",
    "weightMutationAllowed", "trainingAllowed", "checkpointWeightsRead", "gpuStarted",
    "optimizerCreated", "backwardExecuted", "weightsModified", "trainingStarted",
  ]) {
    assert.equal(Object.prototype.hasOwnProperty.call(safety, field), true, `${label} safety field is missing: ${field}`);
    assert.equal(safety[field], false, `${label} safety boundary is open: ${field}`);
  }
  assert.equal(safety.gpuStarted, false, `${label} must prove GPU was not started`);
  assert.equal(safety.trainingStarted, false, `${label} must prove training was not started`);
  assert.equal(safety.weightsModified, false, `${label} must prove weights were not modified`);
}

function verifyPreExecutionSafety(safety, label) {
  assert.ok(safety && typeof safety === "object" && !Array.isArray(safety), `${label} safety is missing`);
  for (const field of [
    "gpuAllowed", "optimizerAllowed", "backwardAllowed", "checkpointWeightsReadAllowed",
    "weightMutationAllowed", "trainingAllowed",
  ]) assert.equal(safety[field], false, `${label} safety boundary is open: ${field}`);
  assert.equal(safety.checkpointFileHashVerificationAllowed, true,
    `${label} must permit CPU-only checkpoint file hash verification`);
}

function closedExecutionBoundary() {
  return {
    cpuReadonlyOnly: true,
    gpuAllowed: false,
    optimizerAllowed: false,
    backwardAllowed: false,
    checkpointWeightsReadAllowed: false,
    weightMutationAllowed: false,
    trainingAllowed: false,
    currentExecutionRegistryWriteAllowed: false,
  };
}

function bindDeclaredProjectFile(root, declared, role) {
  assert.ok(declared && typeof declared === "object" && !Array.isArray(declared), `${role} binding is missing`);
  assert.match(declared.sha256 ?? "", /^[a-f0-9]{64}$/u, `${role} SHA-256 is invalid`);
  const binding = bindProjectFile(root, declared.path, role);
  assert.equal(binding.sha256, declared.sha256, `${role} SHA-256 mismatch`);
  return binding;
}

function bindProjectFile(root, logicalPath, role) {
  const normalized = normalizeRelativePath(logicalPath);
  const absolute = resolveProjectPath(root, normalized, { mustExist: true, kind: "file" });
  return Object.freeze({ role, path: normalized, sha256: sha256File(absolute) });
}

function assertSameBinding(actual, expected, label) {
  assert.equal(actual?.path, expected.path, `${label} path mismatch`);
  assert.equal(actual?.sha256, expected.sha256, `${label} SHA-256 mismatch`);
}

function copyBinding(binding) {
  return { role: binding.role, path: binding.path, sha256: binding.sha256 };
}

function readJson(root, logicalPath) {
  const absolute = resolveProjectPath(root, logicalPath, { mustExist: true, kind: "file" });
  return JSON.parse(fs.readFileSync(absolute, "utf8"));
}

function resolveProjectPath(root, logicalPath, { mustExist = false, kind = null } = {}) {
  const normalized = normalizeRelativePath(logicalPath);
  const projectRoot = path.resolve(root);
  const absolute = path.resolve(projectRoot, ...normalized.split("/"));
  const relative = path.relative(projectRoot, absolute);
  assert.ok(relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative), "path escapes project root");
  if (mustExist) {
    assert.equal(fs.existsSync(absolute), true, `file is missing: ${normalized}`);
    if (kind === "file") assert.equal(fs.statSync(absolute).isFile(), true, `not a file: ${normalized}`);
    if (kind === "directory") assert.equal(fs.statSync(absolute).isDirectory(), true, `not a directory: ${normalized}`);
    const trustedLogicalRoot = normalized === ".runtime" || normalized.startsWith(".runtime/")
      ? path.join(projectRoot, ".runtime")
      : projectRoot;
    const physicalTrustedRoot = fs.realpathSync(trustedLogicalRoot);
    const physicalPath = fs.realpathSync(absolute);
    assert.equal(isInside(physicalPath, physicalTrustedRoot), true, `path resolves outside its trusted root: ${normalized}`);
  }
  return absolute;
}

function isInside(candidate, parent) {
  const relative = path.relative(path.resolve(parent), path.resolve(candidate));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function normalizeRelativePath(value) {
  assert.equal(typeof value, "string", "path must be a string");
  assert.ok(value.length > 0, "path is required");
  assert.equal(path.isAbsolute(value), false, "absolute path is forbidden");
  assert.equal(/^[A-Za-z]:[\\/]/u.test(value), false, "drive-qualified path is forbidden");
  assert.equal(value.includes("\\"), false, "path must use forward slashes");
  assert.equal(value.split("/").includes(".."), false, "path traversal is forbidden");
  assert.equal(path.posix.normalize(value), value, "path is not normalized");
  return value;
}

function sha256File(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function normalizeRole(value) {
  return String(value).replace(/[^A-Za-z0-9._-]/gu, "_").slice(0, 80);
}

function nextTimestamp(now) {
  const value = now();
  const timestamp = value instanceof Date ? value.toISOString() : value;
  assert.equal(typeof timestamp, "string", "reconciliation clock must return a timestamp");
  assert.equal(Number.isFinite(Date.parse(timestamp)) && timestamp.endsWith("Z"), true,
    "reconciliation clock timestamp is invalid");
  return timestamp;
}

function isDirectExecution() {
  return Boolean(process.argv[1])
    && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
}
