import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  advanceCurrentExecutionRegistry,
  readCurrentExecutionRegistry,
} from "../src/server/ai-painter-current-execution-registry.mjs";
import {
  appendAiPainterProgramEvent,
  projectPath,
} from "./lib/ai-painter-program-event-store.mjs";

const DEFAULT_CONTRACT_PATH =
  "data/ai-painter/system-governance/stage4-full-resolution-typed-semantic-transport-rgb-responsibility-contract-v2.json";
const DEFAULT_CORE_CHECKER_PATH =
  "scripts/check-ai-painter-stage4-full-resolution-typed-semantic-transport-rgb-responsibility.mjs";
const DEFAULT_OUTPUT_PARENT =
  ".runtime/ai-painter/stage4-v2-cpu-contract-acceptance-executions";
const EXPECTED_ARCHITECTURE_ID =
  "stage4_full_resolution_typed_semantic_transport_rgb_responsibility_v2";
const CURRENT_TASK =
  "verify_stage4_full_resolution_typed_semantic_transport_rgb_responsibility_v2_cpu_contract";
const CURRENT_ACTION =
  "run:ai-painter-stage4-v2-cpu-contract-acceptance";
const NEXT_TASK = "plan_stage4_v2_readonly_gpu_qualification";
const NEXT_ACTION = "plan:ai-painter-stage4-v2-readonly-gpu-qualification";
const FALSE_SAFETY_FIELDS = Object.freeze([
  "gpuAllowed",
  "optimizerAllowed",
  "backwardAllowed",
  "checkpointWeightsReadAllowed",
  "weightMutationAllowed",
  "trainingAllowed",
]);

export class CpuAcceptanceError extends Error {
  constructor(code, message = code) {
    super(message);
    this.name = "CpuAcceptanceError";
    this.code = code;
  }
}

export async function runStage4V2CpuContractAcceptance(options = {}) {
  const root = path.resolve(options.root ?? process.cwd());
  const authorization = await resolveStage4V2CpuAcceptanceAuthorization(root, options);
  const contractPath = authorization.successorContract.path;
  const coreCheckerPath = normalizeRelativePath(
    options.coreCheckerPath ?? DEFAULT_CORE_CHECKER_PATH,
    "core_checker_path",
  );
  const outputParent = normalizeRelativePath(
    options.outputParent ?? DEFAULT_OUTPUT_PARENT,
    "output_parent",
  );
  const startedAt = new Date(options.now ?? Date.now());
  const runId = options.runId ?? createRunId(startedAt);
  requireRunId(runId);

  const outputParentAbsolute = resolveInside(root, outputParent);
  fs.mkdirSync(outputParentAbsolute, { recursive: true });
  const outputDirectory = path.join(outputParentAbsolute, runId);
  fs.mkdirSync(outputDirectory, { recursive: false });

  const runnerPath = resolveInside(
    root,
    normalizeRelativePath(
      options.runnerProgramPath ?? relativeProjectPath(root, fileURLToPath(import.meta.url)),
      "runner_program_path",
    ),
  );
  const state = {
    schemaVersion: "stage4-v2-cpu-contract-acceptance-report-v1",
    runId,
    status: "running",
    architectureId: null,
    executionClass: "cpu_readonly",
    startedAtBeijing: formatBeijing(startedAt),
    completedAtBeijing: null,
    contract: { ...authorization.successorContract, actualSha256: null },
    sourceAdjudication: authorization.sourceAdjudication,
    programLineage: {
      runner: bindFile(root, runnerPath),
    },
    prerequisiteBindings: [],
    checks: [],
    safety: fixedSafetyRecord(),
    error: null,
  };

  let exitCode = 0;
  try {
    executeStage4V2CpuContractAcceptanceChecks({
      root,
      contractPath,
      coreCheckerPath,
      expectedContractSha256: authorization.successorContract.sha256,
      outputDirectory,
      timeoutMs: options.timeoutMs ?? 300_000,
      state,
    });
    state.status = "passed";
  } catch (error) {
    exitCode = 1;
    state.status = "failed_closed";
    state.error = serializeError(error);
  }

  const completedAt = new Date(options.completedAt ?? Date.now());
  state.completedAtBeijing = formatBeijing(completedAt);
  state.safety = fixedSafetyRecord();

  const reportPath = path.join(outputDirectory, "cpu-acceptance-report.json");
  writeJsonExclusive(reportPath, state);
  const reportBinding = bindFile(root, reportPath);

  const terminal = {
    schemaVersion: "stage4-v2-cpu-contract-acceptance-terminal-v1",
    runId,
    architectureId: state.architectureId ?? EXPECTED_ARCHITECTURE_ID,
    executionClass: "cpu_readonly",
    executionState: exitCode === 0 ? "completed" : "failed_closed",
    status:
      exitCode === 0
        ? "stage4_v2_cpu_contract_acceptance_passed_inactive"
        : "stage4_v2_cpu_contract_acceptance_failed_closed",
    failureCode: exitCode === 0 ? null : state.error?.code ?? "cpu_acceptance_failed",
    cpuAcceptanceReport: reportBinding,
    sourceAdjudication: authorization.sourceAdjudication,
    successorContract: authorization.successorContract,
    activationState: "inactive",
    nextActionEligible:
      exitCode === 0 ? "readonly_gpu_qualification_planning" : null,
    ownerAuthorizationRequired: false,
    safety: fixedSafetyRecord(),
    recordedAtBeijing: state.completedAtBeijing,
  };
  const terminalPath = path.join(outputDirectory, "phase-terminal.json");
  writeJsonExclusive(terminalPath, terminal);
  const terminalBinding = bindFile(root, terminalPath);

  const capsule = {
    schemaVersion: "ai-painter-local-task-capsule-v1",
    capsuleId: `local-ai-${runId}`,
    module: { id: "ai-painter-r5-stage4", nameZh: "AI Painter R5 / Stage4" },
    currentStage: { number: 4, total: 5, status: exitCode === 0 ? "cpu_contract_accepted" : "failed_closed" },
    taskId: CURRENT_TASK,
    runId,
    architectureId: terminal.architectureId,
    executionClass: "cpu_readonly",
    status: terminal.executionState,
    latestTerminal: terminalBinding,
    nextAllowedAction: {
      taskId: exitCode === 0 ? NEXT_TASK : null,
      action: exitCode === 0 ? NEXT_ACTION : null,
      gpuStarted: false,
      trainingStarted: false,
    },
    evidence: [
      { ...reportBinding, sha256Verified: true },
      { ...terminalBinding, sha256Verified: true },
      { ...authorization.sourceAdjudication.terminal, sha256Verified: true },
      { ...authorization.successorContract, sha256Verified: true },
    ],
    integrity: {
      status: "verified",
      requiredEvidencePresent: true,
      boundEvidenceVerified: true,
      identityMatches: true,
    },
    autonomousLocalProgramDecision: true,
    ownerAuthorizationRequired: false,
    nextActionEligible: terminal.nextActionEligible,
    safety: fixedSafetyRecord(),
    recordedAtBeijing: state.completedAtBeijing,
  };
  const capsulePath = path.join(outputDirectory, "task-capsule.json");
  writeJsonExclusive(capsulePath, capsule);

  let registryAdvance = null;
  if (exitCode === 0) {
    registryAdvance = await advanceCurrentExecutionRegistry({
      projectRoot: root,
      capabilityVersion: EXPECTED_ARCHITECTURE_ID,
      packageId: runId,
      taskId: NEXT_TASK,
      taskKind: "cpu_readonly_gpu_qualification_planning",
      taskGoal: "Materialize the bounded Stage4 V2 readonly-GPU qualification plan without starting GPU work, training, optimization, or checkpoint consumption.",
      priority: 1,
      queueStatus: "ready",
      nextMachineAction: NEXT_ACTION,
      runId,
      lifecycleStage: "cpu_contract_accepted",
      executionState: "package_materialized",
      activity: "readonly_gpu_qualification_planning_ready",
      taskCapsulePath: relativeProjectPath(root, capsulePath),
      terminalEvidencePath: relativeProjectPath(root, terminalPath),
      latestTrainingTerminal: authorization.current.registry.latestTrainingTerminal,
      expectedPreviousRegistryRevision: authorization.current.registry.registryRevision,
      expectedPreviousRegistrySha256: authorization.current.registrySha256,
    });
    appendAiPainterProgramEvent({
      id: `stage4-v2-cpu-contract-acceptance-${runId}`,
      timestamp: new Date().toISOString(),
      action: "stage4_v2_cpu_contract_acceptance_passed",
      runId,
      kind: "cpu_readonly_contract_acceptance",
      status: "success",
      title: "Stage4 V2 CPU contract acceptance passed",
      titleZh: "Stage4 V2 CPU合同验收已通过",
      detailZh: "已原子推进到只读GPU资格规划任务；未启动GPU、训练、优化或Checkpoint读取。",
      evidencePath: projectPath(terminalPath),
      evidenceSha256: terminalBinding.sha256,
      fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
    });
  }

  return {
    exitCode,
    status: terminal.status,
    runId,
    outputDirectory: relativeProjectPath(root, outputDirectory),
    report: reportBinding,
    terminal: terminalBinding,
    taskCapsule: bindFile(root, capsulePath),
    registryRevision: registryAdvance?.registry.registryRevision ?? null,
    error: state.error,
  };
}

export async function resolveStage4V2CpuAcceptanceAuthorization(root, options = {}, readCurrent = readCurrentExecutionRegistry) {
  const current = await readCurrent(root);
  if (current.ok !== true) throw new CpuAcceptanceError("current_registry_not_verified");
  const registry = current.registry;
  if (registry.capabilityVersion !== EXPECTED_ARCHITECTURE_ID) {
    throw new CpuAcceptanceError("current_registry_capability_mismatch");
  }
  if (registry.taskId !== CURRENT_TASK || registry.nextMachineAction !== CURRENT_ACTION) {
    throw new CpuAcceptanceError("current_registry_task_not_cpu_contract_acceptance");
  }
  if (registry.taskKind !== "cpu_contract_verification" || registry.lifecycleStage !== "change_candidate") {
    throw new CpuAcceptanceError("current_registry_lifecycle_mismatch");
  }
  if (registry.executionState !== "package_materialized" || registry.activeExecution !== null) {
    throw new CpuAcceptanceError("current_registry_not_inactive_ready_state");
  }

  const adjudicationTerminal = readBoundJsonBinding(root, registry.terminalEvidence, "source_adjudication_terminal");
  if (adjudicationTerminal.value?.schemaVersion !== "stage4-joint-condition-full-data-screen-failure-boundary-adjudication-terminal-v1") {
    throw new CpuAcceptanceError("source_adjudication_terminal_schema_mismatch");
  }
  if (adjudicationTerminal.value?.successorCapabilityVersion !== EXPECTED_ARCHITECTURE_ID) {
    throw new CpuAcceptanceError("source_adjudication_successor_capability_mismatch");
  }
  const classification = readBoundJsonBinding(
    root,
    adjudicationTerminal.value.capabilityChangeClassification,
    "source_adjudication_classification",
  );
  const successorContract = normalizeBinding(
    classification.value?.successorContract,
    "source_adjudication_successor_contract",
  );
  const successorAbsolute = resolveInside(root, successorContract.path);
  requireRegularFile(successorAbsolute, "source_adjudication_successor_contract_missing");
  if (sha256File(successorAbsolute) !== successorContract.sha256) {
    throw new CpuAcceptanceError("source_adjudication_successor_contract_sha256_mismatch");
  }
  if (options.contractPath !== undefined && normalizeRelativePath(options.contractPath, "contract_path") !== successorContract.path) {
    throw new CpuAcceptanceError("manual_contract_path_not_authorized");
  }
  if (options.expectedContractSha256 !== undefined && options.expectedContractSha256 !== successorContract.sha256) {
    throw new CpuAcceptanceError("manual_contract_sha256_not_authorized");
  }
  if (successorContract.path !== DEFAULT_CONTRACT_PATH) {
    throw new CpuAcceptanceError("source_adjudication_successor_contract_path_unrecognized");
  }
  const capsuleEvidence = Array.isArray(current.taskCapsule?.evidence) ? current.taskCapsule.evidence : [];
  const capsuleHasTerminal = capsuleEvidence.some((item) => sameBinding(item, adjudicationTerminal.binding));
  const capsuleHasContract = capsuleEvidence.some((item) => sameBinding(item, successorContract));
  if (!capsuleHasTerminal || !capsuleHasContract) {
    throw new CpuAcceptanceError("current_task_capsule_source_binding_missing");
  }
  return {
    current,
    successorContract,
    sourceAdjudication: { terminal: adjudicationTerminal.binding, classification: classification.binding },
  };
}

function readBoundJsonBinding(root, binding, code) {
  const normalized = normalizeBinding(binding, code);
  const absolute = resolveInside(root, normalized.path);
  requireRegularFile(absolute, `${code}_missing`);
  if (sha256File(absolute) !== normalized.sha256) {
    throw new CpuAcceptanceError(`${code}_sha256_mismatch`);
  }
  return { value: readJson(absolute, `${code}_json_invalid`), binding: normalized };
}

function normalizeBinding(value, code) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new CpuAcceptanceError(`${code}_binding_missing`);
  const binding = {
    path: normalizeRelativePath(value.path, `${code}_path`),
    sha256: value.sha256,
  };
  requireSha256(binding.sha256, `${code}_sha256_invalid`);
  return binding;
}

function sameBinding(left, right) {
  return left?.path === right.path && left?.sha256 === right.sha256;
}

export function executeStage4V2CpuContractAcceptanceChecks({
  root,
  contractPath,
  coreCheckerPath,
  expectedContractSha256,
  outputDirectory,
  timeoutMs,
  state,
}) {
  const contractAbsolute = resolveInside(root, contractPath);
  requireRegularFile(contractAbsolute, "parent_contract_missing");
  rejectCheckpointPath(contractPath, "parent_contract_checkpoint_path_forbidden");
  const contractSha256 = sha256File(contractAbsolute);
  state.contract.actualSha256 = contractSha256;
  if (expectedContractSha256 !== null) {
    requireSha256(expectedContractSha256, "expected_contract_sha256_invalid");
    if (expectedContractSha256 !== contractSha256) {
      throw new CpuAcceptanceError(
        "parent_contract_sha256_mismatch",
        `expected ${expectedContractSha256}, found ${contractSha256}`,
      );
    }
  }

  const contract = readJson(contractAbsolute, "parent_contract_json_invalid");
  if (
    contract.schemaVersion !==
    "stage4-full-resolution-typed-semantic-transport-rgb-responsibility-contract-v2"
  ) {
    throw new CpuAcceptanceError("parent_contract_schema_mismatch");
  }
  if (contract.architectureId !== EXPECTED_ARCHITECTURE_ID) {
    throw new CpuAcceptanceError("parent_contract_architecture_mismatch");
  }
  if (contract.status !== "cpu_supported_inactive") {
    throw new CpuAcceptanceError("parent_contract_not_cpu_supported_inactive");
  }
  state.architectureId = contract.architectureId;
  verifyInactiveGates(contract.activationGates);

  const prerequisites = normalizePrerequisiteBindings(contract.prerequisiteBindings);
  state.prerequisiteBindings = prerequisites.map((item) => ({
    id: item.id,
    executionClass: item.executionClass,
    contract: { path: item.path, expectedSha256: item.sha256 },
    checkerCommand: item.checkerCommand,
    safety: item.safety,
  }));

  const coreCheck = {
    id: "stage4_v2_parent_contract_core",
    executionClass: "cpu_readonly",
    path: contractPath,
    sha256: contractSha256,
    checkerCommand: { command: "node", args: [coreCheckerPath] },
    safety: fixedSafetyPolicy(),
  };
  const checks = [coreCheck, ...prerequisites];
  const immutableInputs = new Map([[contractAbsolute, contractSha256]]);

  for (let index = 0; index < checks.length; index += 1) {
    const item = checks[index];
    verifySafetyPolicy(item.safety, item.id);
    rejectCheckpointPath(item.path, `${item.id}_checkpoint_path_forbidden`);
    const boundContractAbsolute = resolveInside(root, item.path);
    requireRegularFile(boundContractAbsolute, `${item.id}_contract_missing`);
    const boundContractSha256 = sha256File(boundContractAbsolute);
    requireSha256(item.sha256, `${item.id}_contract_sha256_invalid`);
    if (boundContractSha256 !== item.sha256) {
      throw new CpuAcceptanceError(`${item.id}_contract_sha256_mismatch`);
    }
    immutableInputs.set(boundContractAbsolute, boundContractSha256);

    const command = normalizeCheckerCommand(root, item.checkerCommand, item.id);
    state.programLineage[`checker:${item.id}`] = bindFile(root, command.scriptAbsolute);
    immutableInputs.set(command.scriptAbsolute, sha256File(command.scriptAbsolute));

    const checkStartedAt = new Date();
    const result = spawnSync(command.executable, command.args, {
      cwd: root,
      encoding: "utf8",
      windowsHide: true,
      timeout: timeoutMs,
      env: cpuOnlyEnvironment(process.env),
      maxBuffer: 16 * 1024 * 1024,
    });
    const stdoutPath = path.join(
      outputDirectory,
      `${String(index + 1).padStart(2, "0")}-${safeFilePart(item.id)}-stdout.txt`,
    );
    const stderrPath = path.join(
      outputDirectory,
      `${String(index + 1).padStart(2, "0")}-${safeFilePart(item.id)}-stderr.txt`,
    );
    writeTextExclusive(stdoutPath, result.stdout ?? "");
    writeTextExclusive(stderrPath, result.stderr ?? "");
    const checkRecord = {
      id: item.id,
      executionClass: "cpu_readonly",
      startedAtBeijing: formatBeijing(checkStartedAt),
      completedAtBeijing: formatBeijing(new Date()),
      command: command.publicCommand,
      boundContract: bindFile(root, boundContractAbsolute),
      checkerProgram: bindFile(root, command.scriptAbsolute),
      exitCode: result.status,
      signal: result.signal ?? null,
      timedOut: result.error?.code === "ETIMEDOUT",
      stdout: bindFile(root, stdoutPath),
      stderr: bindFile(root, stderrPath),
      passed: result.status === 0,
    };
    state.checks.push(checkRecord);
    if (result.error) {
      throw new CpuAcceptanceError(
        checkRecord.timedOut ? `${item.id}_checker_timeout` : `${item.id}_checker_spawn_failed`,
        result.error.message,
      );
    }
    if (result.status !== 0) {
      throw new CpuAcceptanceError(
        `${item.id}_checker_failed`,
        `checker exited with ${String(result.status)}`,
      );
    }
  }

  for (const [absolutePath, expectedSha256] of immutableInputs) {
    if (!fs.existsSync(absolutePath) || sha256File(absolutePath) !== expectedSha256) {
      throw new CpuAcceptanceError(
        "input_or_program_changed_during_acceptance",
        relativeProjectPath(root, absolutePath),
      );
    }
  }
  if (sha256File(contractAbsolute) !== contractSha256) {
    throw new CpuAcceptanceError("parent_contract_changed_during_acceptance");
  }
}

function normalizePrerequisiteBindings(value) {
  if (value === null || value === undefined) {
    throw new CpuAcceptanceError("prerequisite_bindings_missing");
  }
  const entries = Array.isArray(value)
    ? value.map((item, index) => [item?.id ?? `prerequisite_${index + 1}`, item])
    : Object.entries(value);
  if (entries.length === 0) {
    throw new CpuAcceptanceError("prerequisite_bindings_empty");
  }
  const ids = new Set();
  return entries.map(([fallbackId, value]) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new CpuAcceptanceError(`${fallbackId}_prerequisite_binding_invalid`);
    }
    const id = value.id ?? fallbackId;
    if (!/^[a-z][a-z0-9_]{2,95}$/u.test(id)) {
      throw new CpuAcceptanceError("prerequisite_id_invalid", String(id));
    }
    if (ids.has(id)) throw new CpuAcceptanceError("prerequisite_id_duplicate", id);
    ids.add(id);
    if (value.required !== true) {
      throw new CpuAcceptanceError(`${id}_must_be_required`);
    }
    if (value.executionClass !== "cpu_readonly") {
      throw new CpuAcceptanceError(`${id}_execution_class_not_cpu_readonly`);
    }
    return {
      id,
      executionClass: value.executionClass,
      path: normalizeRelativePath(value.path, `${id}_path`),
      sha256: value.sha256,
      checkerCommand: value.checkerCommand,
      safety: value.safety,
    };
  });
}

function normalizeCheckerCommand(root, value, id) {
  let command;
  let args;
  if (Array.isArray(value)) {
    [command, ...args] = value;
  } else if (value && typeof value === "object" && !Array.isArray(value)) {
    command = value.command ?? value.executable;
    args = value.args;
  } else {
    throw new CpuAcceptanceError(`${id}_checker_command_must_be_structured`);
  }
  if (typeof command !== "string" || !Array.isArray(args) || args.length !== 1) {
    throw new CpuAcceptanceError(`${id}_checker_command_shape_invalid`);
  }
  if (typeof args[0] !== "string") {
    throw new CpuAcceptanceError(`${id}_checker_script_invalid`);
  }
  const scriptRelative = normalizeRelativePath(args[0], `${id}_checker_script`);
  rejectCheckpointPath(scriptRelative, `${id}_checker_checkpoint_path_forbidden`);
  const normalized = scriptRelative.replaceAll("\\", "/");
  const nodeChecker = /^scripts\/check-[a-z0-9][a-z0-9._-]*\.mjs$/u.test(normalized);
  const pythonChecker = /^ml\/ai-painter\/scripts\/check_[a-z0-9][a-z0-9._-]*\.py$/u.test(normalized);
  if (!nodeChecker && !pythonChecker) {
    throw new CpuAcceptanceError(`${id}_checker_entrypoint_not_allowlisted`, normalized);
  }
  const scriptAbsolute = resolveInside(root, scriptRelative);
  requireRegularFile(scriptAbsolute, `${id}_checker_missing`);

  if (nodeChecker) {
    if (command !== "node" && path.resolve(command) !== path.resolve(process.execPath)) {
      throw new CpuAcceptanceError(`${id}_node_executable_invalid`);
    }
    return {
      executable: process.execPath,
      args: [scriptAbsolute],
      scriptAbsolute,
      publicCommand: { command: "node", args: [scriptRelative] },
    };
  }
  if (!/^python(?:3(?:\.\d+)?)?(?:\.exe)?$/iu.test(path.basename(command))) {
    throw new CpuAcceptanceError(`${id}_python_executable_invalid`);
  }
  const python = resolvePython(root, command);
  return {
    executable: python,
    args: [scriptAbsolute],
    scriptAbsolute,
    publicCommand: { command: "python", args: [scriptRelative] },
  };
}

function resolvePython(root, requested) {
  const candidates = [
    process.env.AI_PAINTER_PYTHON,
    process.platform === "win32"
      ? path.join(root, "ml", "ai-painter", ".venv", "Scripts", "python.exe")
      : null,
    requested,
    process.platform === "win32" ? "python" : "python3",
  ].filter(Boolean);
  for (const candidate of [...new Set(candidates)]) {
    const probe = spawnSync(candidate, ["--version"], {
      cwd: root,
      encoding: "utf8",
      windowsHide: true,
      timeout: 15_000,
      env: cpuOnlyEnvironment(process.env),
    });
    if (probe.status === 0) return candidate;
  }
  throw new CpuAcceptanceError("cpu_python_interpreter_unavailable");
}

function verifyInactiveGates(gates) {
  if (!gates || typeof gates !== "object" || Array.isArray(gates)) {
    throw new CpuAcceptanceError("parent_activation_gates_missing");
  }
  for (const [name, value] of Object.entries(gates)) {
    if (value !== false) {
      throw new CpuAcceptanceError("parent_activation_gate_not_false", `${name}=${String(value)}`);
    }
  }
}

function verifySafetyPolicy(value, id) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new CpuAcceptanceError(`${id}_safety_policy_missing`);
  }
  for (const field of FALSE_SAFETY_FIELDS) {
    if (value[field] !== false) {
      throw new CpuAcceptanceError(`${id}_${field}_must_be_false`);
    }
  }
  if (value.checkpointFileHashVerificationAllowed !== true) {
    throw new CpuAcceptanceError(`${id}_checkpointFileHashVerificationAllowed_must_be_true`);
  }
}

function fixedSafetyPolicy() {
  return {
    ...Object.fromEntries(FALSE_SAFETY_FIELDS.map((field) => [field, false])),
    checkpointFileHashVerificationAllowed: true,
  };
}

function fixedSafetyRecord() {
  return {
    ...fixedSafetyPolicy(),
    checkpointWeightsRead: false,
    gpuStarted: false,
    optimizerCreated: false,
    backwardExecuted: false,
    weightsModified: false,
    trainingStarted: false,
  };
}

function cpuOnlyEnvironment(source) {
  return {
    ...source,
    CUDA_VISIBLE_DEVICES: "-1",
    NVIDIA_VISIBLE_DEVICES: "none",
    AI_PAINTER_CPU_ONLY: "1",
    AI_PAINTER_ALLOW_GPU: "0",
  };
}

function normalizeRelativePath(value, code) {
  if (typeof value !== "string" || value.length === 0 || path.isAbsolute(value)) {
    throw new CpuAcceptanceError(`${code}_must_be_project_relative`);
  }
  const normalized = path.normalize(value);
  if (normalized === ".." || normalized.startsWith(`..${path.sep}`)) {
    throw new CpuAcceptanceError(`${code}_escapes_project`);
  }
  return normalized.replaceAll("\\", "/");
}

function resolveInside(root, relativePath) {
  const absolute = path.resolve(root, relativePath);
  if (absolute !== root && !absolute.startsWith(`${root}${path.sep}`)) {
    throw new CpuAcceptanceError("path_escapes_project", relativePath);
  }
  return absolute;
}

function relativeProjectPath(root, absolutePath) {
  return path.relative(root, absolutePath).replaceAll("\\", "/");
}

function rejectCheckpointPath(value, code) {
  if (/\.(?:pt|pth|ckpt|safetensors)$/iu.test(value)) {
    throw new CpuAcceptanceError(code);
  }
}

function requireRegularFile(absolutePath, code) {
  if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) {
    throw new CpuAcceptanceError(code, absolutePath);
  }
}

function requireSha256(value, code) {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/u.test(value)) {
    throw new CpuAcceptanceError(code);
  }
}

function requireRunId(value) {
  if (!/^[a-z0-9][a-z0-9._-]{7,159}$/u.test(value)) {
    throw new CpuAcceptanceError("run_id_invalid", String(value));
  }
}

function readJson(absolutePath, code) {
  try {
    return JSON.parse(fs.readFileSync(absolutePath, "utf8"));
  } catch (error) {
    throw new CpuAcceptanceError(code, error.message);
  }
}

function sha256File(absolutePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(absolutePath)).digest("hex");
}

function bindFile(root, absolutePath) {
  requireRegularFile(absolutePath, "binding_file_missing");
  return {
    path: relativeProjectPath(root, absolutePath),
    sha256: sha256File(absolutePath),
    byteSize: fs.statSync(absolutePath).size,
  };
}

function writeJsonExclusive(absolutePath, value) {
  writeTextExclusive(absolutePath, `${JSON.stringify(value, null, 2)}${os.EOL}`);
}

function writeTextExclusive(absolutePath, value) {
  fs.writeFileSync(absolutePath, value, { encoding: "utf8", flag: "wx" });
}

function serializeError(error) {
  return {
    code: error instanceof CpuAcceptanceError ? error.code : "unexpected_cpu_acceptance_error",
    name: error?.name ?? "Error",
    message: error?.message ?? String(error),
  };
}

function createRunId(date) {
  const compact = formatBeijing(date).replace(/[-:+.T]/gu, "").slice(0, 17);
  return `stage4-v2-cpu-acceptance-${compact}-${crypto.randomBytes(4).toString("hex")}`;
}

function formatBeijing(date) {
  const shifted = new Date(date.getTime() + 8 * 60 * 60 * 1000);
  return `${shifted.toISOString().slice(0, 23)}+08:00`;
}

function safeFilePart(value) {
  return value.replace(/[^a-z0-9._-]/giu, "_").slice(0, 96);
}

function parseArguments(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (!key.startsWith("--")) throw new CpuAcceptanceError("unknown_positional_argument", key);
    const value = argv[index + 1];
    if (value === undefined || value.startsWith("--")) {
      throw new CpuAcceptanceError("missing_argument_value", key);
    }
    index += 1;
    if (key === "--contract") parsed.contractPath = value;
    else if (key === "--contract-sha256") parsed.expectedContractSha256 = value;
    else if (key === "--run-id") parsed.runId = value;
    else throw new CpuAcceptanceError("unknown_argument", key);
  }
  return parsed;
}

const invokedAsScript = process.argv[1]
  ? path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))
  : false;

if (invokedAsScript) {
  let result;
  try {
    result = await runStage4V2CpuContractAcceptance(parseArguments(process.argv.slice(2)));
  } catch (error) {
    process.stderr.write(`${JSON.stringify(serializeError(error))}${os.EOL}`);
    process.exitCode = 1;
  }
  if (result) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}${os.EOL}`);
    process.exitCode = result.exitCode;
  }
}
