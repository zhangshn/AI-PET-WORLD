import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { verifyOwnerAuthorization } from "./project-owner-authorization-core.mjs"
import { auditStage4Stage0To80ContinuationPlan } from "../../scripts/check-ai-painter-stage4-stage0-to-80-continuation-plan.mjs"

const CONTRACT_PATH = "data/ai-painter/system-governance/stage4-stage0-to-80-continuation-authorization-contract-v1.json"
const PACKAGE_PREFIX = ".runtime/ai-painter/owner-action-requests/"
const ROLES = ["stage0", "stage1", "stage2"]
const PACKAGE_SCHEMA = "project-owner-stage4-stage0-to-80-continuation-package-v1"

export class Stage4ContinuationPackageError extends Error {
  constructor(message, code) { super(message); this.code = code }
}

export function loadStage4ContinuationContract({ root = process.cwd() } = {}) {
  const absolute = path.resolve(root, CONTRACT_PATH)
  const contract = readJson(absolute, "continuation_contract_invalid")
  if (contract?.schemaVersion !== "stage4-stage0-to-80-continuation-authorization-contract-v1" || contract?.status !== "active") fail("Continuation contract is inactive.", "continuation_contract_inactive")
  return { contract, path: CONTRACT_PATH, sha256: sha256File(absolute) }
}

export function verifyStage4ContinuationPackage({ root = process.cwd(), packagePath, packageSha256, trustRegistryPath, trustRegistrySha256, now }) {
  const projectRoot = path.resolve(root)
  const relativePackagePath = normalizeProjectPath(packagePath)
  if (!relativePackagePath.startsWith(PACKAGE_PREFIX) || !relativePackagePath.endsWith("/package.json")) fail("Package path is outside Owner namespace.", "continuation_package_path_invalid")
  const absolutePackagePath = path.resolve(projectRoot, relativePackagePath)
  if (!isSha256(packageSha256) || sha256File(absolutePackagePath) !== packageSha256.toLowerCase()) fail("Package SHA-256 mismatch.", "continuation_package_hash_mismatch")
  const value = readJson(absolutePackagePath, "continuation_package_json_invalid")
  if (value?.schemaVersion !== PACKAGE_SCHEMA || value?.status !== "owner_signed_not_started") fail("Package status is invalid.", "continuation_package_status_invalid")
  const { contract, sha256: contractSha256 } = loadStage4ContinuationContract({ root: projectRoot })
  if (value.contract?.path !== CONTRACT_PATH || value.contract?.sha256 !== contractSha256) fail("Package contract identity mismatch.", "continuation_package_contract_mismatch")
  if (!safeId(value.packageId) || value.commandRef !== value.packageId || value.scope !== "ai-painter:stage4:stage0-to-80-continuation") fail("Package identity is invalid.", "continuation_package_identity_invalid")
  if (!bindingValid(projectRoot, value.sourceExecutionPlan) || value.sourceExecutionPlan.sha256 !== value.planSha256) fail("Source plan identity is invalid.", "continuation_package_plan_binding_invalid")
  const plan = readJson(path.resolve(projectRoot, value.sourceExecutionPlan.path), "continuation_plan_invalid")
  auditStage4Stage0To80ContinuationPlan(plan, { root: projectRoot })
  if (JSON.stringify(value.candidateIdentity) !== JSON.stringify(plan.candidateIdentity) || JSON.stringify(value.qualificationTerminal) !== JSON.stringify(plan.qualificationTerminal)) fail("Package candidate or qualification differs from plan.", "continuation_package_lineage_mismatch")
  if (JSON.stringify(value.steps?.map((step) => step.role)) !== JSON.stringify(ROLES)) fail("Package step order invalid.", "continuation_package_step_order_invalid")
  const packageRoot = path.dirname(absolutePackagePath)
  const steps = value.steps.map((step, index) => verifyStep({ root: projectRoot, packageRoot, contract, planStep: plan.steps[index], step, trustRegistryPath, trustRegistrySha256, now }))
  const coordinator = verifyCoordinator({ root: projectRoot, packageRoot, contract, value, steps, trustRegistryPath, trustRegistrySha256, now })
  return { ...value, steps, coordinator, packagePath: relativePackagePath, packageSha256: packageSha256.toLowerCase(), packageRoot: projectPath(projectRoot, packageRoot), contract }
}

function verifyStep({ root, packageRoot, contract, planStep, step, trustRegistryPath, trustRegistrySha256, now }) {
  if (step?.index !== planStep.index || step?.role !== planStep.role || step?.runId !== planStep.runId || JSON.stringify(step.runner) !== JSON.stringify(planStep.runner) || step.outputNamespace !== planStep.outputNamespace || JSON.stringify(step.preflightArgs) !== JSON.stringify(planStep.preflightArgs) || JSON.stringify(step.executeArgs) !== JSON.stringify(planStep.executeArgs) || JSON.stringify(step.terminal) !== JSON.stringify(planStep.terminal) || JSON.stringify(step.runnerAuthorizationTemplate) !== JSON.stringify(planStep.runnerAuthorization)) fail("Signed step differs from source plan.", "continuation_step_plan_mismatch")
  const expected = buildStepExpectation(step)
  if (JSON.stringify(expected) !== JSON.stringify(step.expectation)) fail("Step expectation mismatch.", "continuation_step_expectation_mismatch")
  const authPath = normalizeProjectPath(step.authorization?.path)
  if (!authPath.startsWith(`${projectPath(root, packageRoot)}/${step.role}/`) || !bindingValid(root, step.authorization)) fail("Step authorization binding invalid.", "continuation_step_authorization_binding_invalid")
  const verifiedAuthorization = verifyOwnerAuthorization({ root, authorizationPath: authPath, providedSha256: step.authorization.sha256, ownerCommandRef: step.commandRef, scope: step.scope, expectation: expected, trustRegistryPath, trustRegistrySha256, now })
  if (step.action !== contract.stepContracts[step.role].action || step.scope !== `ai-painter:stage4:${step.role}` || step.commandRef !== `${step.packageId}-${step.role}`) fail("Step signed identity invalid.", "continuation_step_identity_invalid")
  return { ...step, verifiedAuthorization }
}

function verifyCoordinator({ root, packageRoot, contract, value, steps, trustRegistryPath, trustRegistrySha256, now }) {
  const coordinator = value.coordinator
  const expected = buildCoordinatorExpectation(value, steps)
  if (JSON.stringify(coordinator?.expectation) !== JSON.stringify(expected)) fail("Coordinator expectation mismatch.", "continuation_coordinator_expectation_mismatch")
  if (coordinator?.action !== contract.coordinatorAuthorization.action || coordinator?.scope !== contract.coordinatorAuthorization.scope || coordinator?.commandRef !== `${value.packageId}-coordinator`) fail("Coordinator identity invalid.", "continuation_coordinator_identity_invalid")
  const authPath = normalizeProjectPath(coordinator.authorization?.path)
  if (!authPath.startsWith(`${projectPath(root, packageRoot)}/coordinator/`) || !bindingValid(root, coordinator.authorization)) fail("Coordinator authorization binding invalid.", "continuation_coordinator_authorization_binding_invalid")
  const verifiedAuthorization = verifyOwnerAuthorization({ root, authorizationPath: authPath, providedSha256: coordinator.authorization.sha256, ownerCommandRef: coordinator.commandRef, scope: coordinator.scope, expectation: expected, trustRegistryPath, trustRegistrySha256, now })
  return { ...coordinator, verifiedAuthorization }
}

export function buildStepExpectation(step) {
  return {
    action: step.action,
    method: "EXEC",
    route: step.runner.path,
    target: { packageId: step.packageId, candidateIdentity: step.candidateIdentity, qualificationTerminal: step.qualificationTerminal, role: step.role, runId: step.runId, outputNamespace: step.outputNamespace, runner: step.runner },
    payload: { preflightArgs: step.preflightArgs, executeArgs: step.executeArgs, previousRole: step.previousRole, predecessor: step.predecessor, terminal: step.terminal, progressPath: step.progressPath, runtimeEvidenceTemplate: step.runtimeEvidenceTemplate, runnerAuthorizationTemplate: step.runnerAuthorizationTemplate, automaticRetry: false },
  }
}

export function buildCoordinatorExpectation(value, steps = value.steps) {
  return {
    action: "ai_painter.stage4.run_stage0_to_stage2_continuation",
    method: "EXEC",
    route: "scripts/run-ai-painter-stage4-stage0-to-80-continuation.mjs",
    target: { packageId: value.packageId, candidateIdentity: value.candidateIdentity, qualificationTerminal: value.qualificationTerminal, baselineProgress: value.baselineProgress, targetProgress: value.targetProgress },
    payload: { stepAuthorizations: steps.map((step) => ({ role: step.role, path: step.authorization.path, sha256: step.authorization.sha256 })), stepOrder: ROLES, automaticRetry: false, smokeRerunAuthorized: false, updateUniquePlanOnStage2Success: true },
  }
}

export function verifyStage4ContinuationCoordinator({ root = process.cwd(), packageValue, trustRegistryPath, trustRegistrySha256, now }) {
  return verifyOwnerAuthorization({ root, authorizationPath: packageValue.coordinator.authorization.path, providedSha256: packageValue.coordinator.authorization.sha256, ownerCommandRef: packageValue.coordinator.commandRef, scope: packageValue.coordinator.scope, expectation: packageValue.coordinator.expectation, trustRegistryPath, trustRegistrySha256, now })
}

export function verifyStage4ContinuationStep({ root = process.cwd(), step, trustRegistryPath, trustRegistrySha256, now }) {
  return verifyOwnerAuthorization({ root, authorizationPath: step.authorization.path, providedSha256: step.authorization.sha256, ownerCommandRef: step.commandRef, scope: step.scope, expectation: step.expectation, trustRegistryPath, trustRegistrySha256, now })
}

export function materializeStage4ContinuationStep({ root = process.cwd(), executionRoot, packageValue, step, previousTerminal }) {
  const projectRoot = path.resolve(root)
  const qualification = packageValue.qualificationTerminal
  if (!bindingValid(projectRoot, qualification)) fail("Qualification terminal binding invalid.", "continuation_qualification_binding_invalid")
  const qualificationValue = readJson(path.resolve(projectRoot, qualification.path), "continuation_qualification_json_invalid")
  if (qualificationValue.status !== "terminal_pass_with_late_convergence_evidence_qualified_closed" || qualificationValue.stage0EntryPermitted !== true) fail("Qualification terminal status invalid.", "continuation_qualification_status_invalid")
  let previous = qualification
  let checkpoint = null
  if (step.stage > 0) {
    if (!previousTerminal || previousTerminal.role !== `stage${step.stage - 1}` || previousTerminal.status !== "semantic_mixture_stage4_formal_stage_completed_closed" || !bindingValid(projectRoot, previousTerminal) || !bindingValid(projectRoot, previousTerminal.checkpoint)) fail("Previous Stage terminal or checkpoint invalid.", "continuation_previous_stage_invalid")
    previous = { path: previousTerminal.path, sha256: previousTerminal.sha256 }
    checkpoint = previousTerminal.checkpoint
  }
  const bindings = {
    RUNNER_AUTH_PATH: projectPath(projectRoot, path.join(executionRoot, "runner-authorizations", step.role, "request.json")),
    RUNNER_AUTH_SHA256: "pending",
    PREVIOUS_TERMINAL_PATH: previous.path,
    PREVIOUS_TERMINAL_SHA256: previous.sha256,
    PREVIOUS_CHECKPOINT_PATH: checkpoint?.path ?? "not-applicable",
    PREVIOUS_CHECKPOINT_SHA256: checkpoint?.sha256 ?? "not-applicable",
    QUALIFICATION_TERMINAL_PATH: qualification.path,
    QUALIFICATION_TERMINAL_SHA256: qualification.sha256,
  }
  const authorization = replacePlaceholders(step.runnerAuthorizationTemplate, bindings)
  const authPath = path.resolve(projectRoot, bindings.RUNNER_AUTH_PATH)
  writeFreshJson(authPath, authorization)
  bindings.RUNNER_AUTH_SHA256 = sha256File(authPath)
  const runtimePath = path.join(executionRoot, "runtime-evidence", `${step.role}.json`)
  const runtimeEvidence = { schemaVersion: "ai-painter-stage4-continuation-runtime-evidence-v1", packageId: packageValue.packageId, role: step.role, qualificationTerminal: qualification, previousTerminal: previous, parentCheckpoint: checkpoint, runnerAuthorization: { path: bindings.RUNNER_AUTH_PATH, sha256: bindings.RUNNER_AUTH_SHA256 }, recordedAtUtc: new Date().toISOString() }
  writeFreshJson(runtimePath, runtimeEvidence)
  return { bindings, runnerAuthorization: { path: bindings.RUNNER_AUTH_PATH, sha256: bindings.RUNNER_AUTH_SHA256 }, runtimeEvidence: { path: projectPath(projectRoot, runtimePath), sha256: sha256File(runtimePath) } }
}

export function resolveStage4ContinuationArgs(values, bindings) {
  return values.map((value) => typeof value === "string" ? value.replace(/\{\{([A-Z0-9_]+)\}\}/gu, (_, name) => {
    if (!(name in bindings)) fail(`Unknown runtime placeholder ${name}.`, "continuation_unknown_placeholder")
    return bindings[name]
  }) : value)
}

function replacePlaceholders(value, bindings) { return JSON.parse(JSON.stringify(value).replace(/\{\{([A-Z0-9_]+)\}\}/gu, (_, name) => JSON.stringify(bindings[name] ?? `{{${name}}}`).slice(1, -1))) }
function bindingValid(root, value) { return value && safeProjectPath(value.path) && isSha256(value.sha256) && fs.existsSync(path.resolve(root, value.path)) && sha256File(path.resolve(root, value.path)) === value.sha256 }
function safeProjectPath(value) { return typeof value === "string" && !path.isAbsolute(value) && !value.startsWith("../") && !value.includes("/../") && !value.includes("\\") }
function normalizeProjectPath(value) { if (!safeProjectPath(value)) fail("Project path invalid.", "continuation_project_path_invalid"); return value }
function projectPath(root, value) { return path.relative(root, path.resolve(value)).replaceAll("\\", "/") }
function safeId(value) { return typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._-]{7,159}$/u.test(value) }
function isSha256(value) { return typeof value === "string" && /^[a-f0-9]{64}$/u.test(value) }
function readJson(value, code) { try { return JSON.parse(fs.readFileSync(value, "utf8")) } catch { fail("JSON evidence invalid.", code) } }
function writeFreshJson(value, body) { fs.mkdirSync(path.dirname(value), { recursive: true }); const handle = fs.openSync(value, "wx"); try { fs.writeFileSync(handle, `${JSON.stringify(body, null, 2)}\n`, "utf8"); fs.fsyncSync(handle) } finally { fs.closeSync(handle) } }
function sha256File(value) { return crypto.createHash("sha256").update(fs.readFileSync(value)).digest("hex") }
function fail(message, code) { throw new Stage4ContinuationPackageError(message, code) }
export { sha256File }
