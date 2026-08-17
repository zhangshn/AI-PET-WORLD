import {
  createHash,
  createPublicKey,
  verify as verifySignature,
} from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import {
  canonicalJson,
  verifyOwnerAuthorization,
} from "./project-owner-authorization-core.mjs"

const CONTRACT_PATH = "data/ai-painter/system-governance/stage4-continuous-execution-authorization-contract-v1.json"
const DEFAULT_TRUST_REGISTRY_PATH = "data/ai-painter/system-governance/project-owner-trust-registry-v1.json"
const PACKAGE_PREFIX = ".runtime/ai-painter/owner-action-requests/"
const PACKAGE_SCHEMA = "project-owner-stage4-continuous-authorization-package-v1"
const KNOWN_PLACEHOLDERS = new Set([
  "RUNNER_AUTH_PATH",
  "RUNNER_AUTH_SHA256",
  "RUNNER_AUTH_ROOT",
  "CHILD_AUTH_PATH",
  "CHILD_AUTH_SHA256",
  "PREVIOUS_TERMINAL_PATH",
  "PREVIOUS_TERMINAL_SHA256",
  "PREVIOUS_CHECKPOINT_PATH",
  "PREVIOUS_CHECKPOINT_SHA256",
  "PREVIOUS_OUTPUT_NAMESPACE",
  "SMOKE_TERMINAL_PATH",
  "SMOKE_TERMINAL_SHA256",
  "SMOKE_FINALIZATION_PATH",
  "SMOKE_FINALIZATION_SHA256",
  "SMOKE_MANIFEST_PATH",
  "SMOKE_MANIFEST_SHA256",
  "SMOKE_REVIEW_PATH",
  "SMOKE_REVIEW_SHA256",
  "QUALIFICATION_TERMINAL_PATH",
  "QUALIFICATION_TERMINAL_SHA256",
])

export class DelegatedAuthorizationPackageError extends Error {
  constructor(message, code) {
    super(message)
    this.code = code
  }
}

export function loadStage4ContinuousExecutionContract({ root = process.cwd() } = {}) {
  const absolute = path.resolve(root, CONTRACT_PATH)
  const contract = readJson(absolute, "continuous_authorization_contract_missing_or_invalid")
  if (contract?.schemaVersion !== "stage4-continuous-execution-authorization-contract-v1" || contract?.status !== "active") {
    fail("Stage4 continuous authorization contract is inactive.", "continuous_authorization_contract_inactive")
  }
  return { contract, path: CONTRACT_PATH, sha256: sha256File(absolute) }
}

export function verifyStage4ContinuousAuthorizationPackage(input) {
  const root = path.resolve(input.root ?? process.cwd())
  const relativePackagePath = normalizeProjectRelativePath(input.packagePath, "continuous_package_path_invalid")
  if (!relativePackagePath.startsWith(PACKAGE_PREFIX) || !relativePackagePath.endsWith("/package.json")) {
    fail("Continuous authorization package is outside the Owner request namespace.", "continuous_package_path_invalid")
  }
  const absolutePackagePath = path.resolve(root, relativePackagePath)
  assertWithin(absolutePackagePath, root, "continuous_package_path_escape")
  const actualPackageSha256 = sha256File(absolutePackagePath)
  if (!isSha256(input.packageSha256) || actualPackageSha256 !== input.packageSha256.toLowerCase()) {
    fail("Continuous authorization package SHA-256 mismatch.", "continuous_package_hash_mismatch")
  }

  const { contract, sha256: contractSha256 } = loadStage4ContinuousExecutionContract({ root })
  const value = readJson(absolutePackagePath, "continuous_package_json_invalid")
  if (value.schemaVersion !== PACKAGE_SCHEMA || value.status !== "owner_signed_not_started") {
    fail("Continuous authorization package status is invalid.", "continuous_package_status_invalid")
  }
  if (value.contract?.path !== CONTRACT_PATH || value.contract?.sha256 !== contractSha256) {
    fail("Continuous authorization package contract identity mismatch.", "continuous_package_contract_mismatch")
  }
  if (!safeId(value.packageId) || value.commandRef !== value.packageId || value.scope !== "ai-painter:stage4:continuous-to-80") {
    fail("Continuous authorization package identity mismatch.", "continuous_package_identity_invalid")
  }
  verifyTimeWindow(value, input.now)
  const registry = loadRegistry({
    root,
    registryPath: input.trustRegistryPath,
    registrySha256: input.trustRegistrySha256,
  })
  verifyRecordSignature(value, registry, "continuous_package_signature_invalid")

  const coordinator = verifyPackageCoordinator({
    root,
    packageRoot: path.dirname(absolutePackagePath),
    packageId: value.packageId,
    coordinator: value.coordinator,
    contract,
    trustRegistryPath: input.trustRegistryPath,
    trustRegistrySha256: input.trustRegistrySha256,
    now: input.now,
  })

  const steps = Array.isArray(value.steps) ? value.steps : []
  const expectedRoles = contract.requiredStepOrder
  if (JSON.stringify(steps.map((step) => step.role)) !== JSON.stringify(expectedRoles)) {
    fail("Continuous authorization steps are missing, duplicated or out of order.", "continuous_package_step_order_invalid")
  }
  if (new Set(steps.map((step) => step.runId)).size !== steps.length) {
    fail("Continuous authorization step run IDs must be unique.", "continuous_package_run_id_duplicate")
  }

  const packageRoot = path.dirname(absolutePackagePath)
  const verifiedSteps = steps.map((step, index) => verifyPackageStep({
    root,
    packageRoot,
    step,
    index,
    contract,
    trustRegistryPath: input.trustRegistryPath,
    trustRegistrySha256: input.trustRegistrySha256,
    now: input.now,
  }))
  validatePackageCandidateIdentity(root, value.candidateIdentity, verifiedSteps)

  return {
    packageId: value.packageId,
    packagePath: relativePackagePath,
    packageSha256: actualPackageSha256,
    commandRef: value.commandRef,
    scope: value.scope,
    signerKeyId: value.signature.keyId,
    validFromUtc: value.validFromUtc,
    expiresAtUtc: value.expiresAtUtc,
    candidateIdentity: value.candidateIdentity,
    baselineProgress: value.baselineProgress,
    coordinator,
    steps: verifiedSteps,
    stopRules: value.stopRules,
  }
}

function validatePackageCandidateIdentity(root, candidateIdentity, steps) {
  const identity = recordValue(candidateIdentity)
  if (identity.status !== "current_formal_candidate"
    || identity.selectionPolicy !== "current_unique_plan_bound_evidence_chain_v1"
    || identity.staleCandidateExecutionAllowed !== false
    || typeof identity.candidateId !== "string"
    || typeof identity.trainingObjectiveContractId !== "string") {
    fail("Continuous package candidate selection policy is invalid.", "continuous_candidate_identity_invalid")
  }
  const config = validateCandidateFileBinding(root, identity.configPath, identity.configSha256, "continuous_candidate_config_invalid")
  const smokeConfig = validateCandidateFileBinding(root, identity.smokeConfigPath, identity.smokeConfigSha256, "continuous_candidate_smoke_config_invalid")
  if (config.path === smokeConfig.path && config.sha256 !== smokeConfig.sha256) {
    fail("Continuous package candidate config identities conflict.", "continuous_candidate_config_conflict")
  }
  const chain = recordValue(identity.formalEvidenceChain)
  if (Object.keys(chain).length < 6) fail("Continuous package candidate evidence chain is incomplete.", "continuous_candidate_evidence_chain_invalid")
  for (const binding of Object.values(chain)) validateCandidateFileBinding(root, binding?.path, binding?.sha256, "continuous_candidate_evidence_chain_invalid")
  const smoke = steps.find((step) => step.role === "smoke")
  const smokeBinding = smoke?.runnerAuthorizationTemplate?.bindings?.inactiveConfig
  if (smokeBinding?.path !== smokeConfig.path || smokeBinding?.sha256 !== smokeConfig.sha256
    || smoke?.runnerAuthorizationTemplate?.taskIdentity?.trainingObjectiveContractId !== identity.trainingObjectiveContractId) {
    fail("Smoke authorization is bound to a different candidate.", "continuous_smoke_candidate_mismatch")
  }
  const smokeContractBinding = validateCandidateFileBinding(root, chain.smokeContract?.path, chain.smokeContract?.sha256, "continuous_candidate_smoke_contract_invalid")
  const smokeContract = JSON.parse(fs.readFileSync(path.resolve(root, smokeContractBinding.path), "utf8"))
  const expectedImplementationAuthorization = smokeContract?.proposedAuthorization?.bindings?.implementationAuthorization
  const expectedImplementationConsumption = smokeContract?.proposedAuthorization?.bindings?.implementationConsumption
  validateCandidateFileBinding(root, expectedImplementationAuthorization?.path, expectedImplementationAuthorization?.sha256, "continuous_candidate_implementation_authorization_invalid")
  validateCandidateFileBinding(root, expectedImplementationConsumption?.path, expectedImplementationConsumption?.sha256, "continuous_candidate_implementation_consumption_invalid")
  const suppliedImplementationAuthorization = smoke?.runnerAuthorizationTemplate?.bindings?.implementationAuthorization
  const suppliedImplementationConsumption = smoke?.runnerAuthorizationTemplate?.bindings?.implementationConsumption
  if (suppliedImplementationAuthorization?.path !== expectedImplementationAuthorization.path
    || suppliedImplementationAuthorization?.sha256 !== expectedImplementationAuthorization.sha256) {
    fail("Smoke implementation authorization is outside the current candidate evidence chain.", "continuous_smoke_implementation_authorization_lineage_mismatch")
  }
  if (suppliedImplementationConsumption?.path !== expectedImplementationConsumption.path
    || suppliedImplementationConsumption?.sha256 !== expectedImplementationConsumption.sha256) {
    fail("Smoke implementation consumption is outside the current candidate evidence chain.", "continuous_smoke_implementation_consumption_lineage_mismatch")
  }
  for (const step of steps.filter((item) => item.role.startsWith("stage"))) {
    const source = step.runnerAuthorizationTemplate?.bindings?.sourceConfig
    if (source?.path !== config.path || source?.sha256 !== config.sha256
      || step.runnerAuthorizationTemplate?.taskIdentity?.trainingObjective !== identity.trainingObjectiveContractId) {
      fail("Formal stage authorization is bound to a different candidate.", "continuous_stage_candidate_mismatch")
    }
  }
}

function validateCandidateFileBinding(root, suppliedPath, suppliedSha256, code) {
  const relative = normalizeProjectRelativePath(suppliedPath, code)
  const absolute = path.resolve(root, relative)
  assertWithin(absolute, root, code)
  if (!isSha256(suppliedSha256) || !fs.existsSync(absolute) || sha256File(absolute) !== suppliedSha256) fail("Continuous candidate evidence binding is invalid.", code)
  return { path: relative, sha256: suppliedSha256 }
}

export function verifyStage4ContinuousCoordinatorAuthorization({ root = process.cwd(), coordinator, trustRegistryPath, trustRegistrySha256, now }) {
  return verifyOwnerAuthorization({
    root,
    authorizationPath: coordinator.authorization.path,
    providedSha256: coordinator.authorization.sha256,
    ownerCommandRef: coordinator.commandRef,
    scope: coordinator.scope,
    expectation: coordinator.expectation,
    trustRegistryPath,
    trustRegistrySha256,
    now,
  })
}

export function verifyStage4ContinuousStepAuthorization({ root = process.cwd(), step, trustRegistryPath, trustRegistrySha256, now }) {
  return verifyOwnerAuthorization({
    root,
    authorizationPath: step.authorization.path,
    providedSha256: step.authorization.sha256,
    ownerCommandRef: step.commandRef,
    scope: step.scope,
    expectation: step.expectation,
    trustRegistryPath,
    trustRegistrySha256,
    now,
  })
}

export function assertStage4ContinuousStepPredecessor(step, previousTerminal) {
  if (!step.previousRole) return true
  if (!previousTerminal || previousTerminal.role !== step.previousRole) {
    fail("Previous Stage4 terminal role is missing or mismatched.", "continuous_previous_terminal_role_invalid")
  }
  if (previousTerminal.status !== step.predecessor.requiredStatus) {
    fail("Previous Stage4 terminal did not satisfy the signed success contract.", "continuous_previous_terminal_status_invalid")
  }
  if (!isSha256(previousTerminal.sha256) || !previousTerminal.path) {
    fail("Previous Stage4 terminal identity is incomplete.", "continuous_previous_terminal_identity_invalid")
  }
  return true
}

export function resolveStage4ContinuousArguments(values, bindings = {}) {
  if (!Array.isArray(values) || values.some((value) => typeof value !== "string")) {
    fail("Runner arguments must be a string array.", "continuous_runner_arguments_invalid")
  }
  return values.map((value) => value.replace(/\{\{([A-Z0-9_]+)\}\}/gu, (_, key) => {
    if (!KNOWN_PLACEHOLDERS.has(key) || typeof bindings[key] !== "string" || !bindings[key]) {
      fail(`Unknown or unresolved runner placeholder: ${key}`, "continuous_runner_placeholder_invalid")
    }
    return bindings[key]
  }))
}

export function materializeStage4ContinuousRuntimeEvidence({
  root = process.cwd(),
  executionRoot,
  step,
  previousStep = null,
  previousTerminal = null,
  qualificationStep = null,
  qualificationTerminal = null,
}) {
  const projectRoot = path.resolve(root)
  const materializationRoot = path.resolve(executionRoot)
  assertWithin(materializationRoot, projectRoot, "continuous_materialization_root_escape")
  if (!materializationRoot.includes(`${path.sep}stage4-continuous-executions${path.sep}`)) {
    fail("Runtime evidence may only be materialized inside the continuous execution namespace.", "continuous_materialization_root_invalid")
  }

  const bindings = buildRuntimeBindings({
    root: projectRoot,
    step,
    previousStep,
    previousTerminal,
    qualificationStep,
    qualificationTerminal,
  })
  const runtimeEvidence = materializeTemplate(step.runtimeEvidenceTemplate, bindings)
  const evidencePath = path.join(materializationRoot, "runtime-evidence", `${step.role}.json`)
  writeFreshJson(evidencePath, {
    schemaVersion: "ai-painter-stage4-continuous-runtime-evidence-v1",
    status: "materialized_from_signed_template",
    packageId: step.expectation?.target?.packageId,
    role: step.role,
    signedTemplate: step.runtimeEvidenceTemplate,
    resolvedEvidence: runtimeEvidence,
    recordedAtUtc: new Date().toISOString(),
  })

  let runnerAuthorizationPath = step.runnerAuthorization.path
  let runnerAuthorizationSha256 = step.runnerAuthorization.sha256
  let runnerAuthorizationRoot = path.dirname(runnerAuthorizationPath).replaceAll("\\", "/")
  if (containsTemplatePlaceholder(step.runnerAuthorizationTemplate)) {
    const materializedAuthorization = materializeTemplate(step.runnerAuthorizationTemplate, bindings)
    const fileName = step.role === "late_stability_qualification"
      ? "implementation-authorization.json"
      : "authorization.json"
    const absoluteAuthorizationPath = path.join(materializationRoot, "runner-authorizations", step.role, fileName)
    writeFreshJson(absoluteAuthorizationPath, materializedAuthorization)
    runnerAuthorizationPath = projectRelative(projectRoot, absoluteAuthorizationPath)
    runnerAuthorizationSha256 = sha256File(absoluteAuthorizationPath)
    runnerAuthorizationRoot = projectRelative(projectRoot, path.dirname(absoluteAuthorizationPath))
  }

  return {
    bindings: {
      ...bindings,
      RUNNER_AUTH_PATH: runnerAuthorizationPath,
      RUNNER_AUTH_SHA256: runnerAuthorizationSha256,
      RUNNER_AUTH_ROOT: runnerAuthorizationRoot,
    },
    runtimeEvidence: {
      path: projectRelative(projectRoot, evidencePath),
      sha256: sha256File(evidencePath),
    },
    runnerAuthorization: {
      path: runnerAuthorizationPath,
      sha256: runnerAuthorizationSha256,
      root: runnerAuthorizationRoot,
      materialized: containsTemplatePlaceholder(step.runnerAuthorizationTemplate),
    },
  }
}

export function sha256File(value) {
  return createHash("sha256").update(fs.readFileSync(value)).digest("hex")
}

function verifyPackageStep({ root, packageRoot, step, index, contract, trustRegistryPath, trustRegistrySha256, now }) {
  const stepContract = contract.stepContracts?.[step.role]
  if (!stepContract || step.index !== index || step.action !== stepContract.action || step.runner?.path !== stepContract.runner) {
    fail("Continuous authorization step contract mismatch.", "continuous_package_step_contract_invalid")
  }
  if (!safeId(step.runId) || !safeId(step.commandRef) || step.scope !== `ai-painter:stage4:${step.role}`) {
    fail("Continuous authorization step identity is invalid.", "continuous_package_step_identity_invalid")
  }
  const runnerPath = normalizeProjectRelativePath(step.runner.path, "continuous_runner_path_invalid")
  const runnerAbsolute = path.resolve(root, runnerPath)
  assertWithin(runnerAbsolute, root, "continuous_runner_path_escape")
  if (!isSha256(step.runner.sha256) || sha256File(runnerAbsolute) !== step.runner.sha256) {
    fail("Continuous authorization runner identity mismatch.", "continuous_runner_hash_mismatch")
  }
  validateArgumentTemplate(step.preflightArgs)
  validateArgumentTemplate(step.executeArgs)
  if (step.executeArgs.includes("--preflight-only")) {
    fail("Execution arguments cannot remain in preflight-only mode.", "continuous_execution_arguments_invalid")
  }
  if (stepContract.preflightMode === "runner_preflight_only" && !step.preflightArgs.includes("--preflight-only")) {
    fail("Continuous authorization step lacks its runner read-only preflight.", "continuous_preflight_flag_missing")
  }
  if (stepContract.preflightMode === "embedded_cpu_readonly" && step.preflightArgs.length !== 0) {
    fail("CPU read-only qualification must use the embedded evidence preflight.", "continuous_embedded_preflight_arguments_invalid")
  }
  const outputNamespace = normalizeProjectRelativePath(step.outputNamespace, "continuous_output_namespace_invalid")
  if (!outputNamespace.startsWith(".runtime/ai-painter/") || fs.existsSync(path.resolve(root, outputNamespace))) {
    fail("Continuous authorization output namespace must be a fresh AI Painter runtime path.", "continuous_output_namespace_not_fresh")
  }
  if (stepContract.outputNamespacePrefix
    && (!outputNamespace.startsWith(stepContract.outputNamespacePrefix) || path.posix.basename(outputNamespace) !== step.runId)) {
    fail("Continuous output namespace does not match the frozen runner contract.", "continuous_output_namespace_contract_invalid")
  }
  const expectedTerminalPath = stepContract.terminalLocation === "output_root"
    ? `${outputNamespace}/phase-terminal.json`
    : `${outputNamespace}/finalization/phase-terminal.json`
  if (step.terminal?.path !== expectedTerminalPath || typeof step.terminal?.requiredStatus !== "string") {
    fail("Continuous authorization terminal contract is invalid.", "continuous_terminal_contract_invalid")
  }
  const progressPath = normalizeProjectRelativePath(step.progressPath, "continuous_progress_path_invalid")
  if (!progressPath.startsWith(`${outputNamespace}/`)) {
    fail("Continuous authorization progress path is outside the step output namespace.", "continuous_progress_path_invalid")
  }
  const previousRole = stepContract.previousRole ?? null
  if (step.previousRole !== previousRole) {
    fail("Continuous authorization predecessor role mismatch.", "continuous_predecessor_contract_invalid")
  }
  if (previousRole && step.predecessor?.role !== previousRole) {
    fail("Continuous authorization predecessor binding is missing.", "continuous_predecessor_contract_invalid")
  }
  validateRuntimeEvidenceTemplate(step, stepContract)
  const mayProceedToQualification = stepContract.boundTerminalMayProceedOnlyToCpuQualification === true
  if ((step.boundTerminalMayProceedOnlyToCpuQualification === true) !== mayProceedToQualification) {
    fail("Continuous bounded terminal transition contract mismatch.", "continuous_bound_terminal_transition_invalid")
  }

  const authorizationPath = normalizeProjectRelativePath(step.authorization?.path, "continuous_step_authorization_path_invalid")
  const authorizationAbsolute = path.resolve(root, authorizationPath)
  assertWithin(authorizationAbsolute, packageRoot, "continuous_step_authorization_path_escape")
  if (!authorizationPath.endsWith(`/${step.role}/request.json`) || !isSha256(step.authorization?.sha256) || sha256File(authorizationAbsolute) !== step.authorization.sha256) {
    fail("Continuous step authorization identity mismatch.", "continuous_step_authorization_hash_mismatch")
  }
  const authorization = readJson(authorizationAbsolute, "continuous_step_authorization_json_invalid")
  if (authorization.authorizationId !== step.commandRef || authorization.ownerDecision?.scope !== step.scope || authorization.authorizedActions?.[0] !== step.action || authorization.authorizedActions?.length !== 1) {
    fail("Continuous step authorization fields mismatch.", "continuous_step_authorization_fields_invalid")
  }
  if (JSON.stringify(authorization.binding) !== JSON.stringify(step.binding)) {
    fail("Continuous step signed binding mismatch.", "continuous_step_authorization_binding_invalid")
  }
  const verified = verifyOwnerAuthorization({
    root,
    authorizationPath,
    providedSha256: step.authorization.sha256,
    ownerCommandRef: step.commandRef,
    scope: step.scope,
    expectation: step.expectation,
    trustRegistryPath,
    trustRegistrySha256,
    now,
  })
  if (verified.authorizationId !== step.commandRef) {
    fail("Continuous step authorization verification returned the wrong identity.", "continuous_step_authorization_identity_invalid")
  }
  const runnerAuthorizationPath = normalizeProjectRelativePath(step.runnerAuthorization?.path, "continuous_runner_authorization_path_invalid")
  const runnerAuthorizationAbsolute = path.resolve(root, runnerAuthorizationPath)
  assertWithin(runnerAuthorizationAbsolute, packageRoot, "continuous_runner_authorization_path_escape")
  if (!runnerAuthorizationPath.endsWith(`/runner-authorizations/${step.role}/request.json`)
    || !isSha256(step.runnerAuthorization?.sha256)
    || sha256File(runnerAuthorizationAbsolute) !== step.runnerAuthorization.sha256) {
    fail("Runner compatibility authorization identity mismatch.", "continuous_runner_authorization_hash_mismatch")
  }
  const runnerAuthorizationTemplate = readJson(runnerAuthorizationAbsolute, "continuous_runner_authorization_json_invalid")
  if (JSON.stringify(runnerAuthorizationTemplate) !== JSON.stringify(step.runnerAuthorizationTemplate)) {
    fail("Runner authorization template does not match the signed package step.", "continuous_runner_authorization_template_mismatch")
  }
  validateRunnerAuthorizationTemplate(step, stepContract, runnerAuthorizationTemplate)
  return {
    ...step,
    runner: { path: runnerPath, sha256: step.runner.sha256 },
    outputNamespace,
    progressPath,
    authorization: { path: authorizationPath, sha256: step.authorization.sha256 },
    runnerAuthorization: { path: runnerAuthorizationPath, sha256: step.runnerAuthorization.sha256 },
    runnerAuthorizationTemplate,
    preflightMode: stepContract.preflightMode,
    boundTerminalMayProceedOnlyToCpuQualification: mayProceedToQualification,
  }
}

function validateRuntimeEvidenceTemplate(step, stepContract) {
  const template = recordValue(step.runtimeEvidenceTemplate)
  if (template.schemaVersion !== "ai-painter-stage4-continuous-runtime-evidence-template-v1" || template.role !== step.role) {
    fail("Continuous runtime evidence template is missing or invalid.", "continuous_runtime_evidence_template_invalid")
  }
  if (step.previousRole) {
    const previous = recordValue(template.previousTerminal)
    if (previous.role !== step.previousRole
      || previous.path !== "{{PREVIOUS_TERMINAL_PATH}}"
      || previous.sha256 !== "{{PREVIOUS_TERMINAL_SHA256}}"
      || previous.requiredStatus !== step.predecessor?.requiredStatus) {
      fail("Previous terminal signed template is invalid.", "continuous_previous_terminal_template_invalid")
    }
  } else if (template.previousTerminal !== null) {
    fail("Smoke runtime template cannot bind historical evidence.", "continuous_smoke_runtime_template_invalid")
  }
  if (stepContract.runtimeEvidenceMaterialization === "parent_checkpoint_from_previous_terminal_v1") {
    const checkpoint = recordValue(template.parentCheckpoint)
    if (checkpoint.source !== "previous_terminal.checkpoint"
      || checkpoint.path !== "{{PREVIOUS_CHECKPOINT_PATH}}"
      || checkpoint.sha256 !== "{{PREVIOUS_CHECKPOINT_SHA256}}") {
      fail("Parent Checkpoint signed template is invalid.", "continuous_parent_checkpoint_template_invalid")
    }
  } else if (template.parentCheckpoint !== null) {
    fail("This step cannot bind a parent Checkpoint template.", "continuous_parent_checkpoint_template_forbidden")
  }
  validateTemplatePlaceholders(template)
}

function validateRunnerAuthorizationTemplate(step, stepContract, template) {
  validateTemplatePlaceholders(template)
  if (stepContract.runnerAuthorizationMaterialization === "late_stability_from_bound_smoke_v1") {
    const expectedActions = ["run_cpu_positive_negative_timeline_contract", "adjudicate_bound_epoch_1_5_10_20_30_reviews", "write_stage0_entry_qualification", "record_local_evidence"]
    const expectedDenied = ["modify_source_smoke", "change_review_thresholds", "rerun_smoke", "read_checkpoint_weights", "start_gpu", "start_training"]
    if (template.schemaVersion !== "ai-painter-owner-implementation-authorization-v1"
      || template.status !== "resolved_owner_authorized_not_consumed"
      || template.requestId !== template.commandRef
      || template.scope !== "cpu_readonly_qualify_bound_smoke_terminal_pass_late_convergence_then_stage0_entry_only"
      || JSON.stringify([...(template.implementationActions ?? [])].sort()) !== JSON.stringify([...expectedActions].sort())
      || JSON.stringify([...(template.explicitlyDeniedActions ?? [])].sort()) !== JSON.stringify([...expectedDenied].sort())
      || template.runner?.path !== step.runner.path
      || template.runner?.sha256 !== step.runner.sha256) {
      fail("Late-stability authorization template identity is invalid.", "continuous_late_stability_authorization_identity_invalid")
    }
    const evidence = recordValue(template.sourceEvidence)
    const expected = {
      terminal: ["{{SMOKE_TERMINAL_PATH}}", "{{SMOKE_TERMINAL_SHA256}}"],
      finalization: ["{{SMOKE_FINALIZATION_PATH}}", "{{SMOKE_FINALIZATION_SHA256}}"],
      manifest: ["{{SMOKE_MANIFEST_PATH}}", "{{SMOKE_MANIFEST_SHA256}}"],
      review: ["{{SMOKE_REVIEW_PATH}}", "{{SMOKE_REVIEW_SHA256}}"],
    }
    for (const [name, [expectedPath, expectedSha256]] of Object.entries(expected)) {
      if (evidence[name]?.path !== expectedPath || evidence[name]?.sha256 !== expectedSha256) {
        fail("Late-stability authorization template is not bound to this package Smoke.", "continuous_late_stability_template_invalid")
      }
    }
  }
  if (step.role.startsWith("stage")) {
    const qualification = recordValue(template.bindings)?.terminalQualification
    if (qualification?.path !== "{{QUALIFICATION_TERMINAL_PATH}}"
      || qualification?.sha256 !== "{{QUALIFICATION_TERMINAL_SHA256}}") {
      fail("Formal Stage authorization template lacks the package qualification binding.", "continuous_stage_qualification_template_invalid")
    }
  }
}

function buildRuntimeBindings({ root, step, previousStep, previousTerminal, qualificationStep, qualificationTerminal }) {
  const bindings = {
    RUNNER_AUTH_PATH: step.runnerAuthorization.path,
    RUNNER_AUTH_SHA256: step.runnerAuthorization.sha256,
    CHILD_AUTH_PATH: step.authorization.path,
    CHILD_AUTH_SHA256: step.authorization.sha256,
    PREVIOUS_TERMINAL_PATH: "not-applicable",
    PREVIOUS_TERMINAL_SHA256: "not-applicable",
    PREVIOUS_CHECKPOINT_PATH: "not-applicable",
    PREVIOUS_CHECKPOINT_SHA256: "not-applicable",
    PREVIOUS_OUTPUT_NAMESPACE: "not-applicable",
    SMOKE_TERMINAL_PATH: "not-applicable",
    SMOKE_TERMINAL_SHA256: "not-applicable",
    SMOKE_FINALIZATION_PATH: "not-applicable",
    SMOKE_FINALIZATION_SHA256: "not-applicable",
    SMOKE_MANIFEST_PATH: "not-applicable",
    SMOKE_MANIFEST_SHA256: "not-applicable",
    SMOKE_REVIEW_PATH: "not-applicable",
    SMOKE_REVIEW_SHA256: "not-applicable",
    QUALIFICATION_TERMINAL_PATH: qualificationTerminal?.path ?? "not-applicable",
    QUALIFICATION_TERMINAL_SHA256: qualificationTerminal?.sha256 ?? "not-applicable",
  }
  if (!step.previousRole) return bindings
  assertStage4ContinuousStepPredecessor(step, previousTerminal)
  if (!previousStep
    || previousStep.role !== step.previousRole
    || previousStep.index !== step.index - 1
    || previousStep.expectation?.target?.packageId !== step.expectation?.target?.packageId
    || previousTerminal.path !== previousStep.terminal.path) {
    fail("Runtime predecessor is not the signed package predecessor.", "continuous_runtime_predecessor_mismatch")
  }
  const terminalAbsolute = path.resolve(root, previousTerminal.path)
  if (!fs.existsSync(terminalAbsolute) || sha256File(terminalAbsolute) !== previousTerminal.sha256) {
    fail("Runtime predecessor terminal changed after completion.", "continuous_runtime_predecessor_hash_mismatch")
  }
  bindings.PREVIOUS_TERMINAL_PATH = previousTerminal.path
  bindings.PREVIOUS_TERMINAL_SHA256 = previousTerminal.sha256
  bindings.PREVIOUS_OUTPUT_NAMESPACE = previousStep.outputNamespace

  if (step.role === "late_stability_qualification") {
    const artifacts = {
      SMOKE_TERMINAL: previousStep.terminal.path,
      SMOKE_FINALIZATION: `${previousStep.outputNamespace}/finalization/finalization-report.json`,
      SMOKE_MANIFEST: `${previousStep.outputNamespace}/training-output/manifest.json`,
      SMOKE_REVIEW: `${previousStep.outputNamespace}/training-output/fixed-preview-reviews.json`,
    }
    for (const [name, relativePath] of Object.entries(artifacts)) {
      const normalized = normalizeProjectRelativePath(relativePath, "continuous_smoke_evidence_path_invalid")
      const absolute = path.resolve(root, normalized)
      assertWithin(absolute, path.resolve(root, previousStep.outputNamespace), "continuous_smoke_evidence_path_escape")
      if (!fs.existsSync(absolute)) fail("Bound Smoke evidence is missing.", "continuous_smoke_evidence_missing")
      bindings[`${name}_PATH`] = normalized
      bindings[`${name}_SHA256`] = sha256File(absolute)
    }
  }

  if (step.role.startsWith("stage")) {
    if (!qualificationStep
      || qualificationStep.role !== "late_stability_qualification"
      || qualificationStep.expectation?.target?.packageId !== step.expectation?.target?.packageId
      || qualificationTerminal?.role !== "late_stability_qualification"
      || qualificationTerminal?.path !== qualificationStep.terminal.path
      || !isSha256(qualificationTerminal.sha256)
      || !qualificationTerminal.path
      || !fs.existsSync(path.resolve(root, qualificationTerminal.path))
      || sha256File(path.resolve(root, qualificationTerminal.path)) !== qualificationTerminal.sha256) {
      fail("Package late-stability qualification is missing or changed.", "continuous_qualification_terminal_invalid")
    }
    const qualification = readJson(path.resolve(root, qualificationTerminal.path), "continuous_qualification_terminal_json_invalid")
    if (qualification.stage0EntryPermitted !== true
      || !["terminal_pass_with_late_convergence_evidence_qualified_closed", "three_consecutive_late_previews_qualified_closed"].includes(qualification.status)) {
      fail("Package late-stability qualification does not permit Stage 0.", "continuous_qualification_not_eligible")
    }
    bindings.QUALIFICATION_TERMINAL_PATH = qualificationTerminal.path
    bindings.QUALIFICATION_TERMINAL_SHA256 = qualificationTerminal.sha256
  }

  if (step.role === "stage1" || step.role === "stage2") {
    const checkpoint = recordValue(previousTerminal.checkpoint)
    if (!checkpoint.path || !isSha256(checkpoint.sha256)) {
      fail("Previous successful Stage terminal lacks a parent Checkpoint.", "continuous_parent_checkpoint_missing")
    }
    const checkpointAbsolute = path.resolve(root, checkpoint.path)
    assertWithin(checkpointAbsolute, path.resolve(root, previousStep.outputNamespace), "continuous_parent_checkpoint_path_escape")
    if (!fs.existsSync(checkpointAbsolute) || sha256File(checkpointAbsolute) !== checkpoint.sha256) {
      fail("Parent Checkpoint does not match the previous successful Stage terminal.", "continuous_parent_checkpoint_hash_mismatch")
    }
    bindings.PREVIOUS_CHECKPOINT_PATH = checkpoint.path
    bindings.PREVIOUS_CHECKPOINT_SHA256 = checkpoint.sha256
  }
  return bindings
}

function materializeTemplate(value, bindings) {
  if (value === null || typeof value === "number" || typeof value === "boolean") return value
  if (typeof value === "string") {
    const result = value.replace(/\{\{([A-Z0-9_]+)\}\}/gu, (_, key) => {
      if (!KNOWN_PLACEHOLDERS.has(key) || typeof bindings[key] !== "string" || !bindings[key] || bindings[key] === "not-applicable") {
        fail(`Unknown or unresolved runtime evidence placeholder: ${key}`, "continuous_runtime_placeholder_unresolved")
      }
      return bindings[key]
    })
    if (/\{\{|\}\}/u.test(result)) fail("Runtime evidence contains a malformed placeholder.", "continuous_runtime_placeholder_invalid")
    return result
  }
  if (Array.isArray(value)) return value.map((item) => materializeTemplate(item, bindings))
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, materializeTemplate(item, bindings)]))
  fail("Runtime evidence template contains an unsupported value.", "continuous_runtime_template_value_invalid")
}

function containsTemplatePlaceholder(value) {
  if (typeof value === "string") return /\{\{[A-Z0-9_]+\}\}/u.test(value)
  if (Array.isArray(value)) return value.some(containsTemplatePlaceholder)
  return Boolean(value && typeof value === "object" && Object.values(value).some(containsTemplatePlaceholder))
}

function validateTemplatePlaceholders(value) {
  if (typeof value === "string") {
    for (const match of value.matchAll(/\{\{([A-Z0-9_]+)\}\}/gu)) {
      if (!KNOWN_PLACEHOLDERS.has(match[1])) fail("Signed template contains an unknown placeholder.", "continuous_runtime_template_placeholder_invalid")
    }
    if (/\{\{|\}\}/u.test(value.replace(/\{\{[A-Z0-9_]+\}\}/gu, ""))) fail("Signed template contains a malformed placeholder.", "continuous_runtime_template_placeholder_invalid")
    return
  }
  if (Array.isArray(value)) return value.forEach(validateTemplatePlaceholders)
  if (value && typeof value === "object") Object.values(value).forEach(validateTemplatePlaceholders)
}

function writeFreshJson(value, record) {
  fs.mkdirSync(path.dirname(value), { recursive: true })
  fs.writeFileSync(value, `${JSON.stringify(record, null, 2)}\n`, { encoding: "utf8", flag: "wx" })
}

function projectRelative(root, value) {
  const absolute = path.resolve(value)
  assertWithin(absolute, root, "continuous_materialized_path_escape")
  return path.relative(root, absolute).replaceAll("\\", "/")
}

function verifyPackageCoordinator({ root, packageRoot, packageId, coordinator, contract, trustRegistryPath, trustRegistrySha256, now }) {
  const expected = contract.coordinatorAuthorization
  if (!coordinator || coordinator.action !== expected.action || coordinator.commandRef !== `${packageId}-coordinator` || coordinator.scope !== "ai-painter:stage4:continuous-execution-coordinator") {
    fail("Continuous execution coordinator identity is invalid.", "continuous_coordinator_identity_invalid")
  }
  if (coordinator.runner?.path !== expected.runner || !isSha256(coordinator.runner?.sha256) || sha256File(path.resolve(root, expected.runner)) !== coordinator.runner.sha256) {
    fail("Continuous execution coordinator runner identity is invalid.", "continuous_coordinator_runner_invalid")
  }
  const authorizationPath = normalizeProjectRelativePath(coordinator.authorization?.path, "continuous_coordinator_authorization_path_invalid")
  const authorizationAbsolute = path.resolve(root, authorizationPath)
  assertWithin(authorizationAbsolute, packageRoot, "continuous_coordinator_authorization_path_escape")
  if (!authorizationPath.endsWith("/coordinator/request.json") || !isSha256(coordinator.authorization?.sha256) || sha256File(authorizationAbsolute) !== coordinator.authorization.sha256) {
    fail("Continuous coordinator authorization identity mismatch.", "continuous_coordinator_authorization_hash_mismatch")
  }
  const verified = verifyOwnerAuthorization({
    root,
    authorizationPath,
    providedSha256: coordinator.authorization.sha256,
    ownerCommandRef: coordinator.commandRef,
    scope: coordinator.scope,
    expectation: coordinator.expectation,
    trustRegistryPath,
    trustRegistrySha256,
    now,
  })
  if (verified.authorizationId !== coordinator.commandRef) {
    fail("Continuous coordinator authorization verification returned the wrong identity.", "continuous_coordinator_authorization_identity_invalid")
  }
  return {
    ...coordinator,
    authorization: { path: authorizationPath, sha256: coordinator.authorization.sha256 },
  }
}

function validateArgumentTemplate(values) {
  if (!Array.isArray(values) || values.some((value) => typeof value !== "string" || value.includes("\0"))) {
    fail("Continuous runner arguments must be a safe string array.", "continuous_runner_arguments_invalid")
  }
  for (const value of values) {
    for (const match of value.matchAll(/\{\{([A-Z0-9_]+)\}\}/gu)) {
      if (!KNOWN_PLACEHOLDERS.has(match[1])) {
        fail("Continuous runner argument contains an unknown placeholder.", "continuous_runner_placeholder_invalid")
      }
    }
    if (/\{\{|\}\}/u.test(value.replace(/\{\{[A-Z0-9_]+\}\}/gu, ""))) {
      fail("Continuous runner argument contains a malformed placeholder.", "continuous_runner_placeholder_invalid")
    }
  }
}

function loadRegistry({ root, registryPath, registrySha256 }) {
  const relativeOrAbsolute = registryPath ?? process.env.AI_PET_WORLD_OWNER_TRUST_REGISTRY_PATH ?? DEFAULT_TRUST_REGISTRY_PATH
  const expectedSha256 = String(registrySha256 ?? process.env.AI_PET_WORLD_OWNER_TRUST_REGISTRY_SHA256 ?? "").toLowerCase()
  if (!isSha256(expectedSha256)) fail("Owner trust registry hash anchor is missing.", "owner_trust_registry_anchor_missing")
  const absolute = path.isAbsolute(relativeOrAbsolute) ? relativeOrAbsolute : path.resolve(root, relativeOrAbsolute)
  const registry = readJson(absolute, "owner_trust_registry_missing_or_invalid")
  if (sha256File(absolute) !== expectedSha256 || registry.schemaVersion !== "project-owner-trust-registry-v1" || registry.status !== "active" || !Array.isArray(registry.keys)) {
    fail("Owner trust registry identity is invalid.", "owner_trust_registry_invalid")
  }
  return registry
}

function verifyRecordSignature(record, registry, code) {
  const signature = recordValue(record.signature)
  const key = registry.keys.find((item) => item.keyId === signature.keyId && item.status === "active" && item.algorithm === "ed25519")
  if (!key || signature.algorithm !== "ed25519" || typeof signature.valueBase64 !== "string") fail("Owner signature key is invalid.", code)
  const unsigned = Object.fromEntries(Object.entries(record).filter(([name]) => name !== "signature"))
  let valid = false
  try {
    valid = verifySignature(null, Buffer.from(canonicalJson(unsigned), "utf8"), createPublicKey(key.publicKeyPem), Buffer.from(signature.valueBase64, "base64"))
  } catch {
    valid = false
  }
  if (!valid) fail("Owner signature verification failed.", code)
}

function verifyTimeWindow(record, nowValue) {
  const now = nowValue instanceof Date ? nowValue.getTime() : Date.now()
  const start = Date.parse(record.validFromUtc)
  const end = Date.parse(record.expiresAtUtc)
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > now || end <= now || end <= start) {
    fail("Continuous authorization package is outside its validity window.", "continuous_package_time_invalid")
  }
}

function normalizeProjectRelativePath(value, code) {
  if (typeof value !== "string" || !value.trim()) fail("Project path is missing.", code)
  const normalized = value.trim().replaceAll("\\", "/")
  if (path.isAbsolute(normalized) || normalized.startsWith("../") || normalized.includes("/../")) fail("Project path is invalid.", code)
  return normalized
}

function assertWithin(candidate, parent, code) {
  const relative = path.relative(parent, candidate)
  if (relative === "" || relative.startsWith("..") || path.isAbsolute(relative)) fail("Path escaped its allowed parent.", code)
}

function readJson(value, code) {
  try {
    return JSON.parse(fs.readFileSync(value, "utf8"))
  } catch {
    fail("Required JSON file is missing or invalid.", code)
  }
}

function isSha256(value) {
  return typeof value === "string" && /^[a-f0-9]{64}$/u.test(value)
}

function safeId(value) {
  return typeof value === "string" && /^[A-Za-z0-9._-]{1,160}$/u.test(value)
}

function recordValue(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {}
}

function fail(message, code) {
  throw new DelegatedAuthorizationPackageError(message, code)
}
