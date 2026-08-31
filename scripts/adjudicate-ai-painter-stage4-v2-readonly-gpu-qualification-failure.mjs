import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  advanceCurrentExecutionRegistry,
  readCurrentExecutionRegistry,
} from "../src/server/ai-painter-current-execution-registry.mjs";
import {
  formatShanghai,
} from "./lib/ai-painter-program-event-store.mjs";
import {
  commitStage4V2ExternalRegistryDependencies,
} from "./lib/ai-painter-stage4-v2-external-registry-dependency-v1.mjs";

export const CAPABILITY_VERSION = "stage4_full_resolution_typed_semantic_transport_rgb_responsibility_v2";
export const ADJUDICATION_TASK = "adjudicate_stage4_v2_readonly_gpu_qualification_failure";
export const ADJUDICATION_ACTION = "adjudicate:ai-painter-stage4-v2-readonly-gpu-qualification-failure";

const CATEGORY = Object.freeze({
  PROGRAM: "program_integration_failure",
  RESOURCE: "resource_boundary_failure",
  GRAPH: "computation_graph_or_gradient_failure",
  EVIDENCE: "evidence_integrity_failure",
  POLICY: "policy_boundary_failure",
});

const isMain = process.argv[1]
  && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (isMain) {
  adjudicateStage4V2ReadonlyGpuQualificationFailure().then((result) => {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  }).catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
    process.exitCode = 1;
  });
}

export async function adjudicateStage4V2ReadonlyGpuQualificationFailure({
  projectRoot = process.cwd(),
  currentReader = readCurrentExecutionRegistry,
  registryWriter = advanceCurrentExecutionRegistry,
  dependencyCommitter = commitStage4V2ExternalRegistryDependencies,
  commitCurrentRegistry = true,
  appendProgramEvent = true,
  now = () => new Date(),
  _testHooks = null,
} = {}) {
  const root = path.resolve(projectRoot);
  const current = await currentReader(root);
  assert.equal(current.ok, true, current.errorCode ?? "current execution registry is not verified");

  if (isCommittedAdjudicationCurrent(current)) {
    return recoverCommittedAdjudication({ root, current, now, _testHooks });
  }
  validateCurrentFailureTask(current);

  const sourceTerminal = current.currentTaskTerminal;
  const sourceTerminalBinding = bindVerifiedProjectFile(
    root,
    current.registry.terminalEvidence.path,
    current.registry.terminalEvidence.sha256,
    "source_terminal",
  );
  const evidence = readFailureEvidence(root, sourceTerminal);
  const classification = classifyStage4V2ReadonlyGpuFailure({
    terminal: sourceTerminal,
    failureReport: evidence.failureReport,
    evidenceIntegrityError: evidence.integrityError,
  });

  const sourceIdentity = sourceTerminalBinding.sha256.slice(0, 24);
  const adjudicationRunId = `stage4-v2-readonly-gpu-failure-adjudication-${sourceIdentity}`;
  const operationId = `stage4-v2-readonly-gpu-failure-adjudication:${sourceIdentity}`;
  const outputRoot = path.join(
    root,
    ".runtime",
    "ai-painter",
    "stage4-v2-readonly-gpu-failure-adjudications",
    adjudicationRunId,
  );
  const intentPath = path.join(outputRoot, "adjudication-intent.json");
  const journalPath = path.join(outputRoot, "outer-transaction-journal.json");
  const dependencyJournalPath = path.join(outputRoot, "registry-dependency-journal.json");
  const dependencyManifestPath = path.join(outputRoot, "registry-dependency-manifest.json");
  fs.mkdirSync(path.dirname(outputRoot), { recursive: true });
  if (!fs.existsSync(outputRoot)) fs.mkdirSync(outputRoot, { recursive: false });
  const existingIntent = fs.existsSync(intentPath) ? readJson(intentPath) : null;
  const recordedAtUtc = existingIntent?.recordedAtUtc ?? now().toISOString();
  const intent = {
    schemaVersion: "ai-painter-stage4-v2-readonly-gpu-failure-adjudication-intent-v1",
    operationId,
    adjudicationRunId,
    sourceRunId: sourceTerminal.runId,
    capabilityVersion: CAPABILITY_VERSION,
    sourceTerminal: sourceTerminalBinding,
    previousRegistry: {
      registryRevision: current.registry.registryRevision,
      registrySha256: current.registrySha256,
    },
    automaticRetryAllowed: false,
    ownerAuthorizationRequired: false,
    recordedAtUtc,
  };
  writeOrVerifyJson(intentPath, intent, "adjudication intent");
  invokeHook(_testHooks, "afterIntentPersisted", { operationId, adjudicationRunId });
  const recordedAtAsiaShanghai = formatShanghai(recordedAtUtc);
  const analysisPath = path.join(outputRoot, "failure-boundary-analysis.json");
  const terminalPath = path.join(outputRoot, "phase-terminal.json");
  const capsulePath = path.join(outputRoot, "local-task-capsule.json");

  writeOrVerifyJson(analysisPath, {
    schemaVersion: "ai-painter-stage4-v2-readonly-gpu-failure-boundary-analysis-v1",
    status: "stage4_v2_readonly_gpu_failure_classified",
    adjudicationRunId,
    sourceRunId: sourceTerminal.runId,
    capabilityVersion: CAPABILITY_VERSION,
    sourceTerminal: sourceTerminalBinding,
    sourceFailureReport: evidence.failureReportBinding,
    evidenceIntegrityError: evidence.integrityError,
    classification,
    automaticRetryAllowed: false,
    ownerAuthorizationRequired: false,
    gpuStarted: false,
    trainingStarted: false,
    checkpointWeightsRead: false,
    recordedAtUtc,
    recordedAtAsiaShanghai,
  });
  const analysisBinding = bindFile(root, analysisPath);

  const terminalState = classification.category === CATEGORY.POLICY
    ? "blocked_policy_boundary"
    : "completed";
  writeOrVerifyJson(terminalPath, {
    schemaVersion: "ai-painter-stage4-v2-readonly-gpu-failure-adjudication-terminal-v1",
    executionState: terminalState,
    status: classification.terminalStatus,
    adjudicationRunId,
    sourceRunId: sourceTerminal.runId,
    capabilityVersion: CAPABILITY_VERSION,
    sourceTerminal: sourceTerminalBinding,
    failureBoundaryAnalysis: analysisBinding,
    classification: classification.category,
    nextMachineAction: null,
    nextBoundaryAction: classification.nextBoundaryAction,
    automaticRetryAllowed: false,
    ownerAuthorizationRequired: false,
    gpuStarted: false,
    trainingStarted: false,
    checkpointWeightsRead: false,
    recordedAtUtc,
    recordedAtAsiaShanghai,
  });
  const terminalBinding = bindFile(root, terminalPath);

  writeOrVerifyJson(capsulePath, {
    schemaVersion: "ai-painter-local-task-capsule-v1",
    capsuleId: `local-ai-${adjudicationRunId}`,
    generatedFrom: "verified_current_execution_registry",
    readOnly: true,
    module: { id: "ai-painter-r5-stage4", nameZh: "AI Painter R5 / Stage4" },
    fixedOverallProgress: { completedStages: 3, totalStages: 5, percent: 60, source: "current_execution_registry" },
    currentStage: { number: 4, total: 5, status: classification.category },
    latestBlocker: {
      code: classification.category,
      summaryZh: classification.summaryZh,
    },
    nextAllowedAction: {
      code: classification.nextBoundaryAction,
      dispatchable: false,
      ownerAuthorizationRequired: false,
      automaticRetryAllowed: false,
    },
    evidence: [sourceTerminalBinding, analysisBinding, terminalBinding]
      .concat(evidence.failureReportBinding ? [evidence.failureReportBinding] : [])
      .map((binding) => ({ ...binding, sha256Verified: true })),
    integrity: {
      status: "verified",
      requiredEvidencePresent: true,
      boundEvidenceVerified: true,
      identityMatches: true,
    },
    recordedAtUtc,
    recordedAtAsiaShanghai,
  });
  const capsuleBinding = bindFile(root, capsulePath);

  const initialJournal = {
    schemaVersion: "ai-painter-stage4-v2-readonly-gpu-failure-adjudication-outer-journal-v1",
    state: "terminal_persisted",
    operationId,
    adjudicationRunId,
    sourceRunId: sourceTerminal.runId,
    capabilityVersion: CAPABILITY_VERSION,
    sourceTerminal: sourceTerminalBinding,
    previousRegistry: intent.previousRegistry,
    evidence: {
      analysis: analysisBinding,
      terminal: terminalBinding,
      capsule: capsuleBinding,
      ...(evidence.failureReportBinding
        ? { sourceFailureReport: evidence.failureReportBinding }
        : {}),
    },
    automaticRetryAllowed: false,
    ownerAuthorizationRequired: false,
    gpuStarted: false,
    trainingStarted: false,
    recordedAtUtc,
  };
  const existingJournal = fs.existsSync(journalPath) ? readJson(journalPath) : null;
  if (existingJournal === null) writeExclusiveJson(journalPath, initialJournal);
  else verifyAdjudicationJournalIdentity(existingJournal, initialJournal);
  invokeHook(_testHooks, "afterTerminalPersisted", { operationId, terminal: terminalBinding });

  // The append-only program event is a dependency of the published current
  // pointer.  Commit it first so a crash can never expose a current registry
  // revision whose corresponding durable event is absent.
  const eventInput = {
      id: `stage4-v2-readonly-gpu-failure-adjudication-${sourceIdentity}`,
      timestamp: recordedAtUtc,
      action: "stage4_v2_readonly_gpu_qualification_failure_adjudicated",
      runId: adjudicationRunId,
      kind: "cpu_readonly_adjudication",
      status: terminalState === "blocked_policy_boundary" ? "blocked" : "success",
      title: "Stage4 V2 readonly-GPU qualification failure adjudicated",
      titleZh: "Stage4 V2只读GPU资格失败已裁决",
      detailZh: classification.summaryZh,
      evidencePath: terminalBinding.path,
      evidenceSha256: terminalBinding.sha256,
      fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
  };
  assert.equal(appendProgramEvent, true,
    "registry publication requires the append-only adjudication event");
  const dependencyBindings = [
    { role: "qualification_failure_source_terminal", ...sourceTerminalBinding },
    { role: "qualification_failure_analysis", ...analysisBinding },
    { role: "qualification_failure_adjudication_terminal", ...terminalBinding },
    { role: "qualification_failure_adjudication_capsule", ...capsuleBinding },
    ...(evidence.failureReportBinding
      ? [{ role: "qualification_failure_report", ...evidence.failureReportBinding }]
      : []),
  ];
  const dependency = dependencyCommitter({
    projectRoot: root,
    journalPath: dependencyJournalPath,
    journalSchemaVersion: "ai-painter-stage4-v2-readonly-gpu-failure-adjudication-registry-dependency-v1",
    operationId,
    capabilityVersion: CAPABILITY_VERSION,
    packageId: adjudicationRunId,
    runId: adjudicationRunId,
    recordedAtUtc,
    bindings: dependencyBindings,
    eventInput,
    _testHooks,
  });
  assert.equal(dependency?.dependencyManifest?.mode, "external",
    "adjudication external registry dependency is missing");
  writeOrVerifyJson(dependencyManifestPath, dependency.dependencyManifest,
    "adjudication registry dependency manifest");
  transitionAdjudicationJournal(journalPath, initialJournal, "event_committed", {
    programEventId: dependency.eventCommit.event.id,
    dependencyJournal: bindFile(root, dependencyJournalPath),
    dependencyManifest: bindFile(root, dependencyManifestPath),
  });
  invokeHook(_testHooks, "afterProgramEventCommitted", {
    operationId,
    programEventId: dependency.eventCommit.event.id,
  });

  let registryCommit = null;
  if (commitCurrentRegistry) {
    registryCommit = await registryWriter({
      projectRoot: root,
      capabilityVersion: CAPABILITY_VERSION,
      packageId: adjudicationRunId,
      taskId: "stage4_v2_readonly_gpu_qualification_failure_adjudicated",
      taskKind: "cpu_readonly_adjudication",
      taskGoal: "Preserve the deterministic Stage4 V2 readonly-GPU failure classification without retrying GPU work.",
      priority: 1,
      queueStatus: terminalState,
      nextMachineAction: null,
      queuedAtUtc: recordedAtUtc,
      runId: adjudicationRunId,
      lifecycleStage: "cpu_contract_verified",
      executionState: terminalState,
      activity: classification.category,
      taskCapsulePath: capsuleBinding.path,
      terminalEvidencePath: terminalBinding.path,
      expectedPreviousRegistryRevision: current.registry.registryRevision,
      expectedPreviousRegistrySha256: current.registrySha256,
      dependencyManifest: dependency.dependencyManifest,
    });
    invokeHook(_testHooks, "afterRegistryCommitted", {
      operationId,
      registryRevision: registryCommit.registry.registryRevision,
      registrySha256: registryCommit.registrySha256,
    });
    transitionAdjudicationJournal(journalPath, initialJournal, "registry_committed", {
      programEventId: dependency.eventCommit.event.id,
      dependencyJournal: bindFile(root, dependencyJournalPath),
      dependencyManifest: bindFile(root, dependencyManifestPath),
      registryRevision: registryCommit.registry.registryRevision,
      registrySha256: registryCommit.registrySha256,
    });
  }

  return Object.freeze({
    status: classification.terminalStatus,
    classification: classification.category,
    adjudicationRunId,
    sourceRunId: sourceTerminal.runId,
    terminal: terminalBinding,
    taskCapsule: capsuleBinding,
    nextMachineAction: null,
    automaticRetryAllowed: false,
    ownerAuthorizationRequired: false,
    registryRevision: registryCommit?.registry?.registryRevision ?? null,
    gpuStarted: false,
    trainingStarted: false,
  });
}

function isCommittedAdjudicationCurrent(current) {
  return current.registry?.capabilityVersion === CAPABILITY_VERSION
    && current.registry?.taskId === "stage4_v2_readonly_gpu_qualification_failure_adjudicated"
    && current.registry?.nextMachineAction === null
    && ["completed", "blocked_policy_boundary"].includes(current.registry?.executionState)
    && current.currentTaskTerminal?.schemaVersion
      === "ai-painter-stage4-v2-readonly-gpu-failure-adjudication-terminal-v1";
}

function recoverCommittedAdjudication({ root, current, now, _testHooks }) {
  const terminalBinding = bindVerifiedProjectFile(
    root,
    current.registry.terminalEvidence.path,
    current.registry.terminalEvidence.sha256,
    "adjudication_terminal",
  );
  const terminal = current.currentTaskTerminal;
  assert.equal(terminalBinding.sha256, sha256File(resolveInside(root, terminalBinding.path)),
    "committed adjudication terminal changed");
  assert.equal(terminal.adjudicationRunId, current.registry.runId,
    "committed adjudication run mismatch");
  assert.equal(terminal.sourceTerminal?.sha256?.slice(0, 24),
    terminal.adjudicationRunId.replace("stage4-v2-readonly-gpu-failure-adjudication-", ""),
    "committed adjudication source identity mismatch");
  const outputRoot = path.dirname(resolveInside(root, terminalBinding.path));
  const journalPath = path.join(outputRoot, "outer-transaction-journal.json");
  const journal = readJson(journalPath);
  assert.equal(journal.operationId,
    `stage4-v2-readonly-gpu-failure-adjudication:${terminal.sourceTerminal.sha256.slice(0, 24)}`,
    "committed adjudication journal operation mismatch");
  assert.ok(["event_committed", "registry_committed"].includes(journal.state),
    "committed adjudication journal state is invalid");
  const capsuleBinding = bindVerifiedProjectFile(
    root,
    current.registry.taskCapsule.path,
    current.registry.taskCapsule.sha256,
    "adjudication_capsule",
  );
  if (journal.state === "event_committed") {
    transitionAdjudicationJournal(journalPath, journal, "registry_committed", {
      ...journal.registry,
      registryRevision: current.registry.registryRevision,
      registrySha256: current.registrySha256,
    });
  }
  invokeHook(_testHooks, "afterCommittedRegistryRecovered", {
    adjudicationRunId: terminal.adjudicationRunId,
  });
  return Object.freeze({
    status: terminal.status,
    classification: terminal.classification,
    adjudicationRunId: terminal.adjudicationRunId,
    sourceRunId: terminal.sourceRunId,
    terminal: terminalBinding,
    taskCapsule: capsuleBinding,
    nextMachineAction: null,
    automaticRetryAllowed: false,
    ownerAuthorizationRequired: false,
    registryRevision: current.registry.registryRevision,
    gpuStarted: false,
    trainingStarted: false,
    recovered: true,
    recoveredAtUtc: now().toISOString(),
  });
}

export function classifyStage4V2ReadonlyGpuFailure({ terminal, failureReport, evidenceIntegrityError = null }) {
  if (evidenceIntegrityError) return classification(CATEGORY.EVIDENCE, evidenceIntegrityError);
  const code = String(failureReport?.failureCode ?? "").toLowerCase();
  const error = String(failureReport?.error ?? "").toLowerCase();
  const text = `${code}\n${error}`;
  if (terminal.executionState === "blocked_policy_boundary" || /policy|license|paid|irreversible|safety_boundary/u.test(text)) {
    return classification(CATEGORY.POLICY, code || "policy_boundary_detected");
  }
  if (/resource|gpu_utilization|memory|out of memory|cuda oom|disk|wddm|driver|cuda unavailable/u.test(text)) {
    return classification(CATEGORY.RESOURCE, code || "resource_boundary_detected");
  }
  if (/gradient|autograd|computation.graph|unused.parameter|zero.gradient|nan|inf|responsibility.output/u.test(text)) {
    return classification(CATEGORY.GRAPH, code || "computation_graph_boundary_detected");
  }
  if (/ticket|signature|replay|sha-?256|hash|evidence|binding|manifest|identity|state.integrity/u.test(text)) {
    return classification(CATEGORY.EVIDENCE, code || "evidence_integrity_boundary_detected");
  }
  return classification(CATEGORY.PROGRAM, code || "program_integration_boundary_detected");
}

function classification(category, reasonCode) {
  const details = {
    [CATEGORY.PROGRAM]: ["stage4_v2_readonly_gpu_program_integration_failure_confirmed", "形成隔离的程序接入修复候选；不得原样重试资格。", "isolate_program_integration_repair_candidate"],
    [CATEGORY.RESOURCE]: ["stage4_v2_readonly_gpu_resource_boundary_failure_confirmed", "重新评估本机资源边界并形成新的资源资格计划；不得自动重试。", "reassess_readonly_gpu_resource_boundary"],
    [CATEGORY.GRAPH]: ["stage4_v2_readonly_gpu_computation_graph_failure_confirmed", "形成隔离的计算图或梯度合同修复候选；不得修改阈值或复用失败运行。", "isolate_computation_graph_contract_repair_candidate"],
    [CATEGORY.EVIDENCE]: ["stage4_v2_readonly_gpu_evidence_integrity_failure_confirmed", "修复当前证据生成或绑定链；不得扫描历史目录补证。", "repair_current_evidence_integrity_chain"],
    [CATEGORY.POLICY]: ["stage4_v2_readonly_gpu_policy_boundary_blocked", "保持政策边界失败关闭，仅允许项目边界内安全替代路线。", "preserve_policy_boundary_and_stop"],
  }[category];
  return Object.freeze({
    category,
    terminalStatus: details[0],
    summaryZh: details[1],
    nextBoundaryAction: details[2],
    reasonCode,
  });
}

function validateCurrentFailureTask(current) {
  assert.equal(current.registry.capabilityVersion, CAPABILITY_VERSION, "current capability is not Stage4 V2");
  assert.equal(current.registry.taskId, ADJUDICATION_TASK, "current task is not the V2 qualification failure adjudication");
  assert.equal(current.registry.taskKind, "cpu_readonly_adjudication", "current task kind is not CPU read-only adjudication");
  assert.equal(current.registry.nextMachineAction, ADJUDICATION_ACTION, "current next action is not the V2 failure adjudicator");
  assert.equal(current.registry.executionState, "package_materialized", "failure adjudication is not materialized");
  assert.equal(current.registry.activeExecution, null, "failure adjudication cannot run beside another active execution");
  assert.equal(current.currentTaskTerminal.schemaVersion, "ai-painter-stage4-v2-readonly-gpu-terminal-v1");
  assert.equal(current.currentTaskTerminal.status, "stage4_v2_readonly_gpu_qualification_failed_closed");
  assert.equal(current.currentTaskTerminal.executionState, "failed_closed");
  assert.equal(current.currentTaskTerminal.nextMachineAction, ADJUDICATION_ACTION);
  assert.equal(current.currentTaskTerminal.ownerAuthorizationRequired, false);
  assert.equal(current.currentTaskTerminal.automaticRetryAllowed, false);
}

function readFailureEvidence(root, terminal) {
  try {
    const binding = terminal.failureReport;
    assert.ok(binding && typeof binding === "object" && !Array.isArray(binding), "failure_report_binding_missing");
    const verified = bindVerifiedProjectFile(root, binding.path, binding.sha256, "failure_report");
    const report = JSON.parse(fs.readFileSync(resolveInside(root, verified.path), "utf8"));
    assert.equal(report.schemaVersion, "ai-painter-stage4-v2-readonly-gpu-failure-report-v1", "failure_report_schema_invalid");
    assert.equal(report.status, "stage4_v2_readonly_gpu_qualification_failed_closed", "failure_report_status_invalid");
    assert.equal(report.executionState, "failed_closed", "failure_report_execution_state_invalid");
    assert.equal(report.runId, terminal.runId, "failure_report_cross_run_forbidden");
    assert.equal(report.capabilityVersion, CAPABILITY_VERSION, "failure_report_capability_mismatch");
    assert.equal(report.automaticRetryAllowed, false, "failure_report_automatic_retry_forbidden");
    assert.equal(report.ownerAuthorizationRequired, false, "failure_report_owner_wait_forbidden");
    return { failureReport: report, failureReportBinding: verified, integrityError: null };
  } catch (error) {
    return {
      failureReport: null,
      failureReportBinding: null,
      integrityError: error instanceof Error ? error.message : String(error),
    };
  }
}

function bindVerifiedProjectFile(root, logicalPath, expectedSha256, label) {
  assert.match(expectedSha256 ?? "", /^[a-f0-9]{64}$/u, `${label}_sha256_invalid`);
  const absolute = resolveInside(root, logicalPath);
  assert.equal(fs.existsSync(absolute), true, `${label}_missing`);
  assert.equal(sha256File(absolute), expectedSha256, `${label}_sha256_mismatch`);
  return { path: normalizeRelative(logicalPath), sha256: expectedSha256 };
}

function resolveInside(root, logicalPath) {
  const normalized = normalizeRelative(logicalPath);
  const absoluteRoot = path.resolve(root);
  const absolute = path.resolve(absoluteRoot, ...normalized.split("/"));
  assert.ok(absolute.startsWith(`${absoluteRoot}${path.sep}`), "path escapes project root");
  return absolute;
}

function normalizeRelative(value) {
  assert.equal(typeof value, "string", "project path must be a string");
  const candidate = value.replaceAll("\\", "/");
  assert.equal(path.posix.isAbsolute(candidate), false, "absolute project path forbidden");
  assert.equal(/^[A-Za-z]:\//u.test(candidate), false, "drive project path forbidden");
  const normalized = path.posix.normalize(candidate);
  assert.equal(normalized === ".." || normalized.startsWith("../"), false, "parent project path forbidden");
  return normalized;
}

function bindFile(root, filePath) {
  return { path: path.relative(root, filePath).replaceAll("\\", "/"), sha256: sha256File(filePath) };
}

function sha256File(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function writeExclusiveJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, { flag: "wx", encoding: "utf8" });
}

function writeOrVerifyJson(filePath, value, label) {
  if (!fs.existsSync(filePath)) {
    writeExclusiveJson(filePath, value);
    return;
  }
  assert.deepEqual(readJson(filePath), value, `${label} conflicts with immutable recovery bytes`);
}

function readJson(filePath) {
  const value = JSON.parse(fs.readFileSync(filePath, "utf8"));
  assert.ok(value && typeof value === "object" && !Array.isArray(value),
    `JSON object required: ${filePath}`);
  return value;
}

function verifyAdjudicationJournalIdentity(actual, expected) {
  assert.ok(["terminal_persisted", "event_committed", "registry_committed"].includes(actual?.state),
    "adjudication journal state is invalid");
  for (const key of [
    "schemaVersion",
    "operationId",
    "adjudicationRunId",
    "sourceRunId",
    "capabilityVersion",
    "sourceTerminal",
    "previousRegistry",
    "evidence",
    "automaticRetryAllowed",
    "ownerAuthorizationRequired",
    "gpuStarted",
    "trainingStarted",
    "recordedAtUtc",
  ]) {
    assert.deepEqual(actual[key], expected[key], `adjudication journal ${key} changed`);
  }
}

function transitionAdjudicationJournal(filePath, expected, nextState, commitEvidence) {
  const current = readJson(filePath);
  verifyAdjudicationJournalIdentity(current, expected);
  const allowed = {
    terminal_persisted: ["event_committed"],
    event_committed: ["event_committed", "registry_committed"],
    registry_committed: ["registry_committed"],
  };
  assert.ok(allowed[current.state]?.includes(nextState),
    `invalid adjudication journal transition ${current.state} -> ${nextState}`);
  const field = nextState === "event_committed" ? "event" : "registry";
  if (current.state === nextState) {
    assert.deepEqual(current[field], commitEvidence,
      `adjudication journal ${nextState} evidence changed`);
    return current;
  }
  const updated = { ...current, state: nextState, [field]: commitEvidence };
  const temporary = `${filePath}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, `${JSON.stringify(updated, null, 2)}\n`, {
    flag: "wx",
    encoding: "utf8",
  });
  fs.renameSync(temporary, filePath);
  assert.deepEqual(readJson(filePath), updated,
    "adjudication journal atomic read-back mismatch");
  return updated;
}

function invokeHook(hooks, point, detail) {
  if (typeof hooks?.[point] === "function") hooks[point](detail);
}
