import {
  createHash,
  createPrivateKey,
  createPublicKey,
  sign,
} from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const SCRIPT_PATH = fileURLToPath(import.meta.url)
const DEFAULT_OWNER_ROOT = path.resolve(process.env.USERPROFILE ?? "", ".ai-pet-world-owner")
const DEFAULT_PRIVATE_KEY_PATH = path.join(DEFAULT_OWNER_ROOT, "owner-private-key.pem")
const DEFAULT_REGISTRY_PATH = "data/ai-painter/system-governance/project-owner-trust-registry-v1.json"
const PACKAGE_ROOT = ".runtime/ai-painter/owner-action-requests"
const MAX_VALIDITY_HOURS = 24 * 7
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

if (path.resolve(process.argv[1] ?? "") === path.resolve(SCRIPT_PATH)) {
  try {
    const args = parseArgs(process.argv.slice(2))
    const result = signStage4To80AuthorizationPackage({
      root: args.projectRoot ?? process.cwd(),
      planPath: required(args.plan, "--plan is required"),
      planSha256: required(args.planSha256, "--plan-sha256 is required").toLowerCase(),
      trustRegistrySha256: required(args.trustRegistrySha256 ?? process.env.AI_PET_WORLD_OWNER_TRUST_REGISTRY_SHA256, "--trust-registry-sha256 is required").toLowerCase(),
    })
    console.log(JSON.stringify(result, null, 2))
  } catch (error) {
    console.error(JSON.stringify({
      status: "owner_offline_signing_failed_closed",
      errorCode: error?.code ?? "owner_offline_signing_failed",
      message: String(error?.message ?? error),
    }, null, 2))
    process.exitCode = 1
  }
}

export function signStage4To80AuthorizationPackage({
  root = process.cwd(),
  planPath,
  planSha256,
  trustRegistryPath = DEFAULT_REGISTRY_PATH,
  trustRegistrySha256,
  privateKeyPath = DEFAULT_PRIVATE_KEY_PATH,
  now = new Date(),
}) {
  const projectRoot = path.resolve(root)
  const relativePlanPath = projectRelative(projectRoot, planPath)
  const absolutePlanPath = path.resolve(projectRoot, relativePlanPath)
  if (!isSha256(planSha256) || sha256File(absolutePlanPath) !== planSha256) fail("Execution plan SHA-256 mismatch.", "stage4_execution_plan_hash_mismatch")

  const { contract, path: contractPath, sha256: contractSha256 } = loadStage4ContinuousExecutionContract({ root: projectRoot })
  const plan = readJson(absolutePlanPath, "stage4_execution_plan_invalid")
  validatePlan({ projectRoot, plan, contract })

  const absoluteRegistryPath = path.isAbsolute(trustRegistryPath) ? trustRegistryPath : path.resolve(projectRoot, trustRegistryPath)
  if (!isSha256(trustRegistrySha256) || sha256File(absoluteRegistryPath) !== trustRegistrySha256) fail("Owner trust registry SHA-256 mismatch.", "owner_trust_registry_hash_mismatch")
  const registry = readJson(absoluteRegistryPath, "owner_trust_registry_invalid")
  if (registry.schemaVersion !== "project-owner-trust-registry-v1" || registry.status !== "active") fail("Owner trust registry is inactive.", "owner_trust_registry_invalid")

  const privateKey = createPrivateKey(fs.readFileSync(privateKeyPath))
  const publicKeyPem = createPublicKey(privateKey).export({ type: "spki", format: "pem" }).toString().replaceAll("\r\n", "\n")
  const trustedKey = registry.keys.find((item) => item.status === "active" && item.algorithm === "ed25519" && item.publicKeyPem.replaceAll("\r\n", "\n") === publicKeyPem)
  if (!trustedKey) fail("Owner private key does not match an active trusted public key.", "owner_private_key_not_trusted")

  const validityHours = Number(plan.validityHours)
  if (!Number.isInteger(validityHours) || validityHours < 1 || validityHours > MAX_VALIDITY_HOURS) fail("Package validity must be between 1 and 168 hours.", "stage4_package_validity_invalid")
  const validFromUtc = new Date(now.getTime() - 60_000).toISOString()
  const expiresAtUtc = new Date(now.getTime() + validityHours * 60 * 60 * 1000).toISOString()
  const timestamp = now.toISOString().replace(/[^0-9]/gu, "").slice(0, 17)
  const packageId = `owner-authorized-ai-painter-stage4-continuous-to-80-${timestamp}`
  const relativeFinalRoot = `${PACKAGE_ROOT}/${packageId}`
  const absoluteFinalRoot = path.resolve(projectRoot, relativeFinalRoot)
  const absoluteStagingRoot = path.resolve(projectRoot, PACKAGE_ROOT, `.${packageId}.${process.pid}.tmp`)
  if (fs.existsSync(absoluteFinalRoot) || fs.existsSync(absoluteStagingRoot)) fail("Authorization package output already exists.", "stage4_package_output_exists")

  try {
    fs.mkdirSync(absoluteStagingRoot, { recursive: true })
    const steps = plan.steps.map((planStep, index) => {
      const role = planStep.role
      const commandRef = `${packageId}-${role}`
      const scope = `ai-painter:stage4:${role}`
      const runnerAuthorizationRelativePath = `${relativeFinalRoot}/runner-authorizations/${role}/request.json`
      const runnerAuthorizationStagingPath = path.join(absoluteStagingRoot, "runner-authorizations", role, "request.json")
      writeFreshJson(runnerAuthorizationStagingPath, planStep.runnerAuthorization)
      const runnerAuthorizationSha256 = sha256File(runnerAuthorizationStagingPath)
      const expectation = {
        action: contract.stepContracts[role].action,
        method: "EXEC",
        route: planStep.runner.path,
        target: {
          packageId,
          candidateIdentity: plan.candidateIdentity,
          role,
          runId: planStep.runId,
          outputNamespace: planStep.outputNamespace,
          runner: planStep.runner,
        },
        payload: {
          preflightArgs: planStep.preflightArgs,
          executeArgs: planStep.executeArgs,
          runnerAuthorization: {
            path: runnerAuthorizationRelativePath,
            sha256: runnerAuthorizationSha256,
          },
          previousRole: planStep.previousRole,
          predecessor: planStep.predecessor,
          terminal: planStep.terminal,
          progressPath: planStep.progressPath,
          runtimeEvidenceTemplate: planStep.runtimeEvidenceTemplate,
          runnerAuthorizationTemplate: planStep.runnerAuthorization,
          preflightMode: contract.stepContracts[role].preflightMode,
          boundTerminalMayProceedOnlyToCpuQualification: planStep.boundTerminalMayProceedOnlyToCpuQualification === true,
          automaticRetry: false,
        },
      }
      const unsignedAuthorization = {
        schemaVersion: "project-owner-write-authorization-v2",
        authorizationId: commandRef,
        status: "authorized",
        validFromUtc,
        expiresAtUtc,
        ownerDecision: { decision: "authorized", commandRef, scope },
        authorizedActions: [expectation.action],
        binding: authorizationBinding(expectation),
      }
      const authorization = signRecord(unsignedAuthorization, trustedKey.keyId, privateKey)
      const authorizationRelativePath = `${relativeFinalRoot}/${role}/request.json`
      const authorizationStagingPath = path.join(absoluteStagingRoot, role, "request.json")
      writeFreshJson(authorizationStagingPath, authorization)
      const authorizationSha256 = sha256File(authorizationStagingPath)
      return {
        index,
        role,
        action: expectation.action,
        commandRef,
        scope,
        runId: planStep.runId,
        previousRole: planStep.previousRole,
        predecessor: planStep.predecessor,
        runner: planStep.runner,
        outputNamespace: planStep.outputNamespace,
        preflightArgs: planStep.preflightArgs,
        executeArgs: planStep.executeArgs,
        terminal: planStep.terminal,
        progressPath: planStep.progressPath,
        runtimeEvidenceTemplate: planStep.runtimeEvidenceTemplate,
        runnerAuthorizationTemplate: planStep.runnerAuthorization,
        preflightMode: contract.stepContracts[role].preflightMode,
        boundTerminalMayProceedOnlyToCpuQualification: planStep.boundTerminalMayProceedOnlyToCpuQualification === true,
        runnerAuthorization: { path: runnerAuthorizationRelativePath, sha256: runnerAuthorizationSha256 },
        expectation,
        binding: unsignedAuthorization.binding,
        authorization: { path: authorizationRelativePath, sha256: authorizationSha256 },
      }
    })

    const coordinatorCommandRef = `${packageId}-coordinator`
    const coordinatorScope = "ai-painter:stage4:continuous-execution-coordinator"
    const coordinatorRunnerPath = contract.coordinatorAuthorization.runner
    const coordinatorRunnerSha256 = sha256File(path.resolve(projectRoot, coordinatorRunnerPath))
    const coordinatorExpectation = {
      action: contract.coordinatorAuthorization.action,
      method: "EXEC",
      route: coordinatorRunnerPath,
      target: {
        packageId,
        candidateIdentity: plan.candidateIdentity,
        baselineProgress: plan.baselineProgress,
      },
      payload: {
        stepAuthorizations: steps.map((step) => ({
          role: step.role,
          path: step.authorization.path,
          sha256: step.authorization.sha256,
        })),
        allowedWrites: [
          ".runtime/ai-painter/stage4-continuous-executions",
          ".runtime/ai-painter/training-process-ledger",
          "D:/AI-PET-WORLD-DATA/catalog/ai-pet-world-catalog.sqlite"
        ],
        gpuTrainingGrantedByCoordinator: false,
        automaticRetry: false,
      },
    }
    const unsignedCoordinatorAuthorization = {
      schemaVersion: "project-owner-write-authorization-v2",
      authorizationId: coordinatorCommandRef,
      status: "authorized",
      validFromUtc,
      expiresAtUtc,
      ownerDecision: { decision: "authorized", commandRef: coordinatorCommandRef, scope: coordinatorScope },
      authorizedActions: [coordinatorExpectation.action],
      binding: authorizationBinding(coordinatorExpectation),
    }
    const coordinatorAuthorization = signRecord(unsignedCoordinatorAuthorization, trustedKey.keyId, privateKey)
    const coordinatorAuthorizationRelativePath = `${relativeFinalRoot}/coordinator/request.json`
    const coordinatorAuthorizationStagingPath = path.join(absoluteStagingRoot, "coordinator", "request.json")
    writeFreshJson(coordinatorAuthorizationStagingPath, coordinatorAuthorization)
    const coordinator = {
      action: coordinatorExpectation.action,
      commandRef: coordinatorCommandRef,
      scope: coordinatorScope,
      runner: { path: coordinatorRunnerPath, sha256: coordinatorRunnerSha256 },
      expectation: coordinatorExpectation,
      binding: unsignedCoordinatorAuthorization.binding,
      authorization: {
        path: coordinatorAuthorizationRelativePath,
        sha256: sha256File(coordinatorAuthorizationStagingPath),
      },
    }

    const unsignedPackage = {
      schemaVersion: "project-owner-stage4-continuous-authorization-package-v1",
      packageId,
      status: "owner_signed_not_started",
      commandRef: packageId,
      scope: "ai-painter:stage4:continuous-to-80",
      validFromUtc,
      expiresAtUtc,
      contract: { path: contractPath, sha256: contractSha256 },
      sourceExecutionPlan: { path: relativePlanPath, sha256: planSha256 },
      candidateIdentity: plan.candidateIdentity,
      baselineProgress: plan.baselineProgress,
      coordinator,
      steps,
      stopRules: contract.stopRules,
      forbiddenActions: contract.forbiddenActions,
      signedAtUtc: now.toISOString(),
    }
    const signedPackage = signRecord(unsignedPackage, trustedKey.keyId, privateKey)
    const stagingPackagePath = path.join(absoluteStagingRoot, "package.json")
    writeFreshJson(stagingPackagePath, signedPackage)
    fs.renameSync(absoluteStagingRoot, absoluteFinalRoot)
    const packagePath = `${relativeFinalRoot}/package.json`
    return {
      status: "owner_signed_stage4_continuous_package_ready",
      packageId,
      packagePath,
      packageSha256: sha256File(path.resolve(projectRoot, packagePath)),
      signerKeyId: trustedKey.keyId,
      stepCount: steps.length,
      stepRoles: steps.map((step) => step.role),
      privateKeyExported: false,
      executionStarted: false,
    }
  } catch (error) {
    fs.rmSync(absoluteStagingRoot, { recursive: true, force: true })
    throw error
  }
}

function validatePlan({ projectRoot, plan, contract }) {
  if (plan.schemaVersion !== contract.executionPlanSchemaVersion || plan.status !== "ready_for_owner_signature") fail("Stage4 execution plan status is invalid.", "stage4_execution_plan_status_invalid")
  if (plan.baselineProgress?.completedStages !== 3 || plan.baselineProgress?.totalStages !== 5 || plan.baselineProgress?.percent !== 60) fail("Stage4 execution plan baseline progress must be 3/5 (60%).", "stage4_execution_plan_progress_invalid")
  if (!plan.candidateIdentity || typeof plan.candidateIdentity.candidateId !== "string" || !isSha256(plan.candidateIdentity.configSha256)) fail("Stage4 candidate identity is incomplete.", "stage4_execution_plan_candidate_invalid")
  if (!Array.isArray(plan.steps) || JSON.stringify(plan.steps.map((step) => step.role)) !== JSON.stringify(contract.requiredStepOrder)) fail("Stage4 execution plan steps are missing, duplicated or out of order.", "stage4_execution_plan_step_order_invalid")
  if (new Set(plan.steps.map((step) => step.runId)).size !== plan.steps.length) fail("Stage4 execution plan run IDs must be unique.", "stage4_execution_plan_run_id_duplicate")

  for (const [index, step] of plan.steps.entries()) {
    const expected = contract.stepContracts[step.role]
    if (!expected || step.runner?.path !== expected.runner || !safeId(step.runId)) fail("Stage4 execution plan step identity is invalid.", "stage4_execution_plan_step_invalid")
    const runnerAbsolute = path.resolve(projectRoot, projectRelative(projectRoot, step.runner.path))
    if (!isSha256(step.runner.sha256) || sha256File(runnerAbsolute) !== step.runner.sha256) fail("Stage4 execution runner SHA-256 mismatch.", "stage4_execution_plan_runner_hash_mismatch")
    if (!Array.isArray(step.preflightArgs) || !Array.isArray(step.executeArgs) || step.executeArgs.includes("--preflight-only")) fail("Stage4 preflight or execution arguments are invalid.", "stage4_execution_plan_arguments_invalid")
    if (expected.preflightMode === "runner_preflight_only" && !step.preflightArgs.includes("--preflight-only")) fail("Stage4 runner preflight flag is missing.", "stage4_execution_plan_arguments_invalid")
    if (expected.preflightMode === "embedded_cpu_readonly" && step.preflightArgs.length !== 0) fail("CPU read-only qualification must use the embedded preflight.", "stage4_execution_plan_arguments_invalid")
    const mayProceedToQualification = expected.boundTerminalMayProceedOnlyToCpuQualification === true
    if ((step.boundTerminalMayProceedOnlyToCpuQualification === true) !== mayProceedToQualification) fail("Stage4 bounded terminal transition contract is invalid.", "stage4_execution_plan_bound_terminal_transition_invalid")
    if (step.preflightArgs.some((item) => typeof item !== "string") || step.executeArgs.some((item) => typeof item !== "string")) fail("Stage4 runner arguments must be arrays of strings.", "stage4_execution_plan_arguments_invalid")
    for (const value of [...step.preflightArgs, ...step.executeArgs]) {
      for (const match of value.matchAll(/\{\{([A-Z0-9_]+)\}\}/gu)) {
        if (!KNOWN_PLACEHOLDERS.has(match[1])) fail("Stage4 runner arguments contain an unknown placeholder.", "stage4_execution_plan_placeholder_invalid")
      }
      if (/\{\{|\}\}/u.test(value.replace(/\{\{[A-Z0-9_]+\}\}/gu, ""))) fail("Stage4 runner arguments contain a malformed placeholder.", "stage4_execution_plan_placeholder_invalid")
    }
    const outputNamespace = projectRelative(projectRoot, step.outputNamespace)
    if (!outputNamespace.startsWith(".runtime/ai-painter/") || fs.existsSync(path.resolve(projectRoot, outputNamespace))) fail("Stage4 output namespace must be fresh.", "stage4_execution_plan_output_not_fresh")
    if (expected.outputNamespacePrefix
      && (!outputNamespace.startsWith(expected.outputNamespacePrefix) || path.posix.basename(outputNamespace) !== step.runId)) {
      fail("Stage4 output namespace does not match the frozen runner contract.", "stage4_execution_plan_output_namespace_invalid")
    }
    const expectedTerminalPath = expected.terminalLocation === "output_root"
      ? `${outputNamespace}/phase-terminal.json`
      : `${outputNamespace}/finalization/phase-terminal.json`
    if (step.terminal?.path !== expectedTerminalPath || typeof step.terminal?.requiredStatus !== "string") fail("Stage4 terminal contract is invalid.", "stage4_execution_plan_terminal_invalid")
    const progressPath = projectRelative(projectRoot, step.progressPath)
    if (!progressPath.startsWith(`${outputNamespace}/`)) fail("Stage4 progress path is outside the step output namespace.", "stage4_execution_plan_progress_path_invalid")
    const previousRole = expected.previousRole ?? null
    if (step.previousRole !== previousRole || (previousRole && (step.predecessor?.role !== previousRole || typeof step.predecessor?.requiredStatus !== "string"))) fail("Stage4 predecessor contract is invalid.", "stage4_execution_plan_predecessor_invalid")
    if (index === 0 && step.predecessor != null) fail("Smoke cannot bind a previous execution terminal.", "stage4_execution_plan_predecessor_invalid")
    if (!step.runnerAuthorization || typeof step.runnerAuthorization !== "object" || Array.isArray(step.runnerAuthorization)) fail("Stage4 runner compatibility authorization is missing.", "stage4_runner_authorization_missing")
    validateRuntimeEvidenceTemplate(step, expected)
    validateRunnerAuthorizationTemplate(step, expected)
  }
}

function validateRuntimeEvidenceTemplate(step, expected) {
  const template = step.runtimeEvidenceTemplate
  if (!template || Array.isArray(template) || template.schemaVersion !== "ai-painter-stage4-continuous-runtime-evidence-template-v1" || template.role !== step.role) {
    fail("Stage4 runtime evidence template is invalid.", "stage4_runtime_evidence_template_invalid")
  }
  if (step.previousRole) {
    if (template.previousTerminal?.role !== step.previousRole
      || template.previousTerminal?.path !== "{{PREVIOUS_TERMINAL_PATH}}"
      || template.previousTerminal?.sha256 !== "{{PREVIOUS_TERMINAL_SHA256}}"
      || template.previousTerminal?.requiredStatus !== step.predecessor?.requiredStatus) {
      fail("Stage4 previous terminal template is invalid.", "stage4_previous_terminal_template_invalid")
    }
  } else if (template.previousTerminal !== null) {
    fail("Smoke cannot bind historical runtime evidence.", "stage4_smoke_runtime_template_invalid")
  }
  if (expected.runtimeEvidenceMaterialization === "parent_checkpoint_from_previous_terminal_v1") {
    if (template.parentCheckpoint?.source !== "previous_terminal.checkpoint"
      || template.parentCheckpoint?.path !== "{{PREVIOUS_CHECKPOINT_PATH}}"
      || template.parentCheckpoint?.sha256 !== "{{PREVIOUS_CHECKPOINT_SHA256}}") {
      fail("Stage4 parent Checkpoint template is invalid.", "stage4_parent_checkpoint_template_invalid")
    }
  } else if (template.parentCheckpoint !== null) {
    fail("Stage4 step cannot bind a parent Checkpoint.", "stage4_parent_checkpoint_template_forbidden")
  }
  validateTemplatePlaceholders(template)
}

function validateRunnerAuthorizationTemplate(step, expected) {
  validateTemplatePlaceholders(step.runnerAuthorization)
  if (expected.runnerAuthorizationMaterialization === "late_stability_from_bound_smoke_v1") {
    const expectedActions = ["run_cpu_positive_negative_timeline_contract", "adjudicate_bound_epoch_1_5_10_20_30_reviews", "write_stage0_entry_qualification", "record_local_evidence"]
    const expectedDenied = ["modify_source_smoke", "change_review_thresholds", "rerun_smoke", "read_checkpoint_weights", "start_gpu", "start_training"]
    if (step.runnerAuthorization.schemaVersion !== "ai-painter-owner-implementation-authorization-v1"
      || step.runnerAuthorization.status !== "resolved_owner_authorized_not_consumed"
      || step.runnerAuthorization.requestId !== step.runnerAuthorization.commandRef
      || step.runnerAuthorization.scope !== "cpu_readonly_qualify_bound_smoke_terminal_pass_late_convergence_then_stage0_entry_only"
      || JSON.stringify([...(step.runnerAuthorization.implementationActions ?? [])].sort()) !== JSON.stringify([...expectedActions].sort())
      || JSON.stringify([...(step.runnerAuthorization.explicitlyDeniedActions ?? [])].sort()) !== JSON.stringify([...expectedDenied].sort())
      || step.runnerAuthorization.runner?.path !== step.runner.path
      || step.runnerAuthorization.runner?.sha256 !== step.runner.sha256) {
      fail("Late-stability runner authorization identity is invalid.", "stage4_late_stability_authorization_identity_invalid")
    }
    const source = step.runnerAuthorization.sourceEvidence ?? {}
    const required = {
      terminal: ["{{SMOKE_TERMINAL_PATH}}", "{{SMOKE_TERMINAL_SHA256}}"],
      finalization: ["{{SMOKE_FINALIZATION_PATH}}", "{{SMOKE_FINALIZATION_SHA256}}"],
      manifest: ["{{SMOKE_MANIFEST_PATH}}", "{{SMOKE_MANIFEST_SHA256}}"],
      review: ["{{SMOKE_REVIEW_PATH}}", "{{SMOKE_REVIEW_SHA256}}"],
    }
    for (const [name, pair] of Object.entries(required)) {
      if (source[name]?.path !== pair[0] || source[name]?.sha256 !== pair[1]) fail("Late-stability template must bind the package Smoke.", "stage4_late_stability_template_invalid")
    }
  }
  if (step.role.startsWith("stage")) {
    const qualification = step.runnerAuthorization.bindings?.terminalQualification
    if (qualification?.path !== "{{QUALIFICATION_TERMINAL_PATH}}" || qualification?.sha256 !== "{{QUALIFICATION_TERMINAL_SHA256}}") {
      fail("Formal Stage template lacks a future qualification binding.", "stage4_qualification_template_invalid")
    }
  }
}

function validateTemplatePlaceholders(value) {
  if (typeof value === "string") {
    for (const match of value.matchAll(/\{\{([A-Z0-9_]+)\}\}/gu)) {
      if (!KNOWN_PLACEHOLDERS.has(match[1])) fail("Stage4 signed template contains an unknown placeholder.", "stage4_execution_plan_placeholder_invalid")
    }
    if (/\{\{|\}\}/u.test(value.replace(/\{\{[A-Z0-9_]+\}\}/gu, ""))) fail("Stage4 signed template contains a malformed placeholder.", "stage4_execution_plan_placeholder_invalid")
    return
  }
  if (Array.isArray(value)) return value.forEach(validateTemplatePlaceholders)
  if (value && typeof value === "object") Object.values(value).forEach(validateTemplatePlaceholders)
}

function signRecord(unsigned, keyId, privateKey) {
  return {
    ...unsigned,
    signature: {
      algorithm: "ed25519",
      keyId,
      valueBase64: sign(null, Buffer.from(canonicalJson(unsigned), "utf8"), privateKey).toString("base64"),
    },
  }
}

function writeFreshJson(value, record) {
  fs.mkdirSync(path.dirname(value), { recursive: true })
  fs.writeFileSync(value, `${JSON.stringify(record, null, 2)}\n`, { encoding: "utf8", flag: "wx" })
}

function projectRelative(root, value) {
  if (typeof value !== "string" || !value.trim()) fail("Project path is missing.", "stage4_project_path_invalid")
  const normalized = value.trim().replaceAll("\\", "/")
  const absolute = path.isAbsolute(normalized) ? path.resolve(normalized) : path.resolve(root, normalized)
  const relative = path.relative(root, absolute).replaceAll("\\", "/")
  if (!relative || relative.startsWith("../") || path.isAbsolute(relative)) fail("Project path escaped the project root.", "stage4_project_path_escape")
  return relative
}

function readJson(value, code) {
  try {
    return JSON.parse(fs.readFileSync(value, "utf8"))
  } catch {
    fail("Required JSON is missing or invalid.", code)
  }
}

function loadStage4ContinuousExecutionContract({ root }) {
  const contractPath = "data/ai-painter/system-governance/stage4-continuous-execution-authorization-contract-v1.json"
  const absolutePath = path.resolve(root, contractPath)
  const contract = readJson(absolutePath, "stage4_continuous_contract_invalid")
  if (contract.schemaVersion !== "stage4-continuous-execution-authorization-contract-v1" || contract.status !== "active") {
    fail("Stage4 continuous execution contract is inactive.", "stage4_continuous_contract_invalid")
  }
  return { contract, path: contractPath, sha256: sha256File(absolutePath) }
}

function canonicalJson(value) {
  return JSON.stringify(normalizeJson(value))
}

function normalizeJson(value) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (Array.isArray(value)) return value.map(normalizeJson)
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().filter((key) => value[key] !== undefined).map((key) => [key, normalizeJson(value[key])]))
  }
  fail("Authorization binding data is not canonical JSON.", "owner_authorization_binding_not_json")
}

function authorizationBinding(expectation) {
  const action = required(expectation?.action, "authorization action is required")
  const method = required(expectation?.method, "authorization method is required").toUpperCase()
  const route = required(expectation?.route, "authorization route is required")
  return {
    action,
    method,
    route,
    targetSha256: sha256Buffer(Buffer.from(canonicalJson(expectation?.target ?? null))),
    payloadSha256: sha256Buffer(Buffer.from(canonicalJson(expectation?.payload ?? null))),
  }
}

function sha256File(value) {
  return sha256Buffer(fs.readFileSync(value))
}

function sha256Buffer(value) {
  return createHash("sha256").update(value).digest("hex")
}

function parseArgs(values) {
  const result = {}
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index]
    if (!value.startsWith("--")) fail(`Unexpected argument: ${value}`, "owner_signer_argument_invalid")
    const key = value.slice(2).replace(/-([a-z])/gu, (_, char) => char.toUpperCase())
    result[key] = values[index + 1]
    index += 1
  }
  return result
}

function required(value, message) {
  if (typeof value !== "string" || !value.trim()) throw new Error(message)
  return value.trim()
}

function isSha256(value) {
  return typeof value === "string" && /^[a-f0-9]{64}$/u.test(value)
}

function safeId(value) {
  return typeof value === "string" && /^[A-Za-z0-9._-]{1,160}$/u.test(value)
}

function fail(message, code) {
  const error = new Error(message)
  error.code = code
  throw error
}
