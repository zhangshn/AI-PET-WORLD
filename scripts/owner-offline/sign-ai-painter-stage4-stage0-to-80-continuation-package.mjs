import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { authorizationBinding, canonicalJson } from "../../src/server/project-owner-authorization-core.mjs"
import { buildCoordinatorExpectation, buildStepExpectation, loadStage4ContinuationContract, sha256File } from "../../src/server/project-owner-stage4-continuation-package-core.mjs"
import { auditStage4Stage0To80ContinuationPlan } from "../check-ai-painter-stage4-stage0-to-80-continuation-plan.mjs"

const SCRIPT_PATH = fileURLToPath(import.meta.url)
const DEFAULT_OWNER_ROOT = path.resolve(process.env.USERPROFILE ?? "", ".ai-pet-world-owner")
const DEFAULT_PRIVATE_KEY_PATH = path.join(DEFAULT_OWNER_ROOT, "owner-private-key.pem")
const DEFAULT_REGISTRY_PATH = "data/ai-painter/system-governance/project-owner-trust-registry-v1.json"
const PACKAGE_ROOT = ".runtime/ai-painter/owner-action-requests"

if (path.resolve(process.argv[1] ?? "") === path.resolve(SCRIPT_PATH)) {
  try {
    const args = parseArgs(process.argv.slice(2))
    console.log(JSON.stringify(signStage4Stage0To80ContinuationPackage({ root: args.projectRoot ?? process.cwd(), planPath: required(args.plan, "--plan is required"), planSha256: required(args.planSha256, "--plan-sha256 is required").toLowerCase(), trustRegistrySha256: required(args.trustRegistrySha256 ?? process.env.AI_PET_WORLD_OWNER_TRUST_REGISTRY_SHA256, "--trust-registry-sha256 is required").toLowerCase(), privateKeyPath: args.privateKey ?? DEFAULT_PRIVATE_KEY_PATH }), null, 2))
  } catch (error) {
    console.error(JSON.stringify({ status: "owner_offline_continuation_signing_failed_closed", errorCode: error?.code ?? "owner_offline_signing_failed", message: String(error?.message ?? error) }, null, 2))
    process.exitCode = 1
  }
}

export function signStage4Stage0To80ContinuationPackage({ root = process.cwd(), planPath, planSha256, trustRegistryPath = DEFAULT_REGISTRY_PATH, trustRegistrySha256, privateKeyPath = DEFAULT_PRIVATE_KEY_PATH, now = new Date() }) {
  const projectRoot = path.resolve(root)
  const relativePlanPath = projectRelative(projectRoot, planPath)
  const absolutePlanPath = path.resolve(projectRoot, relativePlanPath)
  if (!isSha256(planSha256) || sha256File(absolutePlanPath) !== planSha256) fail("Execution plan SHA-256 mismatch.", "continuation_plan_hash_mismatch")
  const plan = readJson(absolutePlanPath)
  auditStage4Stage0To80ContinuationPlan(plan, { root: projectRoot })
  const { contract, path: contractPath, sha256: contractSha256 } = loadStage4ContinuationContract({ root: projectRoot })
  if (plan.contract?.path !== contractPath || plan.contract?.sha256 !== contractSha256) fail("Plan contract identity mismatch.", "continuation_plan_contract_mismatch")
  const registryPath = path.isAbsolute(trustRegistryPath) ? trustRegistryPath : path.resolve(projectRoot, trustRegistryPath)
  if (!isSha256(trustRegistrySha256) || sha256File(registryPath) !== trustRegistrySha256) fail("Trust registry SHA-256 mismatch.", "owner_trust_registry_hash_mismatch")
  const registry = readJson(registryPath)
  const privateKey = crypto.createPrivateKey(fs.readFileSync(privateKeyPath))
  const publicKeyPem = crypto.createPublicKey(privateKey).export({ type: "spki", format: "pem" }).toString().replaceAll("\r\n", "\n")
  const trustedKey = registry.keys?.find((item) => item.status === "active" && item.algorithm === "ed25519" && item.publicKeyPem.replaceAll("\r\n", "\n") === publicKeyPem)
  if (!trustedKey) fail("Owner private key is not trusted.", "owner_private_key_not_trusted")
  const validityHours = Number(plan.validityHours)
  if (!Number.isInteger(validityHours) || validityHours < 1 || validityHours > 168) fail("Validity hours invalid.", "continuation_validity_invalid")
  const validFromUtc = new Date(now.getTime() - 60_000).toISOString()
  const expiresAtUtc = new Date(now.getTime() + validityHours * 3_600_000).toISOString()
  const stamp = now.toISOString().replace(/[^0-9]/gu, "").slice(0, 17)
  const packageId = `owner-authorized-ai-painter-stage4-stage0-to-80-continuation-${stamp}`
  const relativeFinalRoot = `${PACKAGE_ROOT}/${packageId}`
  const absoluteFinalRoot = path.resolve(projectRoot, relativeFinalRoot)
  const stagingRoot = path.resolve(projectRoot, PACKAGE_ROOT, `.${packageId}.${process.pid}.tmp`)
  if (fs.existsSync(absoluteFinalRoot) || fs.existsSync(stagingRoot)) fail("Package output exists.", "continuation_package_output_exists")
  fs.mkdirSync(stagingRoot, { recursive: true })
  const unsignedSteps = plan.steps.map((planStep, index) => {
    const step = {
      index,
      role: planStep.role,
      stage: planStep.stage,
      action: planStep.action,
      packageId,
      candidateIdentity: plan.candidateIdentity,
      qualificationTerminal: plan.qualificationTerminal,
      commandRef: `${packageId}-${planStep.role}`,
      scope: `ai-painter:stage4:${planStep.role}`,
      runId: planStep.runId,
      previousRole: planStep.previousRole,
      predecessor: planStep.predecessor,
      runner: planStep.runner,
      outputNamespace: planStep.outputNamespace,
      progressPath: planStep.progressPath,
      preflightArgs: planStep.preflightArgs,
      executeArgs: planStep.executeArgs,
      terminal: planStep.terminal,
      runtimeEvidenceTemplate: planStep.runtimeEvidenceTemplate,
      runnerAuthorizationTemplate: planStep.runnerAuthorization,
    }
    step.expectation = buildStepExpectation(step)
    return step
  })
  const steps = unsignedSteps.map((step) => {
    const unsignedAuthorization = {
      schemaVersion: "project-owner-write-authorization-v2",
      authorizationId: step.commandRef,
      status: "authorized",
      validFromUtc,
      expiresAtUtc,
      ownerDecision: { decision: "authorized", commandRef: step.commandRef, scope: step.scope },
      authorizedActions: [step.action],
      binding: authorizationBinding(step.expectation),
    }
    const authorization = signRecord(unsignedAuthorization, trustedKey.keyId, privateKey)
    const relativeAuthorizationPath = `${relativeFinalRoot}/${step.role}/request.json`
    const stagingAuthorizationPath = path.join(stagingRoot, step.role, "request.json")
    writeFreshJson(stagingAuthorizationPath, authorization)
    return { ...step, binding: unsignedAuthorization.binding, authorization: { path: relativeAuthorizationPath, sha256: sha256File(stagingAuthorizationPath) } }
  })
  const packageBase = {
    schemaVersion: "project-owner-stage4-stage0-to-80-continuation-package-v1",
    packageId,
    status: "owner_signed_not_started",
    commandRef: packageId,
    scope: "ai-painter:stage4:stage0-to-80-continuation",
    validFromUtc,
    expiresAtUtc,
    contract: { path: contractPath, sha256: contractSha256 },
    sourceExecutionPlan: { path: relativePlanPath, sha256: planSha256 },
    planSha256,
    candidateIdentity: plan.candidateIdentity,
    qualificationTerminal: plan.qualificationTerminal,
    baselineProgress: plan.baselineProgress,
    targetProgress: plan.targetProgress,
    hostExecution: plan.hostExecution,
    steps,
    stopRules: contract.stopRules,
    forbiddenActions: contract.forbiddenActions,
    signedAtUtc: now.toISOString(),
  }
  const coordinatorCommandRef = `${packageId}-coordinator`
  const coordinatorScope = contract.coordinatorAuthorization.scope
  const coordinatorSkeleton = { action: contract.coordinatorAuthorization.action, commandRef: coordinatorCommandRef, scope: coordinatorScope }
  const coordinatorExpectation = buildCoordinatorExpectation({ ...packageBase, coordinator: coordinatorSkeleton }, steps)
  const unsignedCoordinatorAuthorization = {
    schemaVersion: "project-owner-write-authorization-v2",
    authorizationId: coordinatorCommandRef,
    status: "authorized",
    validFromUtc,
    expiresAtUtc,
    ownerDecision: { decision: "authorized", commandRef: coordinatorCommandRef, scope: coordinatorScope },
    authorizedActions: [contract.coordinatorAuthorization.action],
    binding: authorizationBinding(coordinatorExpectation),
  }
  const coordinatorAuthorization = signRecord(unsignedCoordinatorAuthorization, trustedKey.keyId, privateKey)
  const coordinatorRelativePath = `${relativeFinalRoot}/coordinator/request.json`
  const coordinatorStagingPath = path.join(stagingRoot, "coordinator", "request.json")
  writeFreshJson(coordinatorStagingPath, coordinatorAuthorization)
  const coordinator = { ...coordinatorSkeleton, runner: { path: contract.coordinatorAuthorization.route, sha256: sha256File(path.resolve(projectRoot, contract.coordinatorAuthorization.route)) }, expectation: coordinatorExpectation, binding: unsignedCoordinatorAuthorization.binding, authorization: { path: coordinatorRelativePath, sha256: sha256File(coordinatorStagingPath) } }
  writeFreshJson(path.join(stagingRoot, "package.json"), { ...packageBase, coordinator })
  fs.renameSync(stagingRoot, absoluteFinalRoot)
  const packagePath = `${relativeFinalRoot}/package.json`
  return { status: "owner_signed_stage4_stage0_to_80_continuation_package_ready", packageId, packagePath, packageSha256: sha256File(path.resolve(projectRoot, packagePath)), signerKeyId: trustedKey.keyId, stepCount: steps.length, stepRoles: steps.map((step) => step.role), smokeAuthorizationCreated: false, privateKeyExported: false, executionStarted: false }
}

function signRecord(value, keyId, privateKey) { return { ...value, signature: { algorithm: "ed25519", keyId, valueBase64: crypto.sign(null, Buffer.from(canonicalJson(value), "utf8"), privateKey).toString("base64") } } }
function writeFreshJson(value, body) { fs.mkdirSync(path.dirname(value), { recursive: true }); const handle = fs.openSync(value, "wx"); try { fs.writeFileSync(handle, `${JSON.stringify(body, null, 2)}\n`, "utf8"); fs.fsyncSync(handle) } finally { fs.closeSync(handle) } }
function readJson(value) { return JSON.parse(fs.readFileSync(value, "utf8")) }
function projectRelative(root, value) { const absolute = path.isAbsolute(value) ? value : path.resolve(root, value); const relative = path.relative(root, absolute).replaceAll("\\", "/"); if (relative.startsWith("../") || path.isAbsolute(relative)) fail("Path outside project.", "continuation_path_invalid"); return relative }
function isSha256(value) { return typeof value === "string" && /^[a-f0-9]{64}$/u.test(value) }
function required(value, message) { if (typeof value !== "string" || !value.trim()) fail(message, "continuation_signer_argument_missing"); return value.trim() }
function fail(message, code) { const error = new Error(message); error.code = code; throw error }
function parseArgs(values) { const result = {}; for (let index = 0; index < values.length; index += 1) { const value = values[index]; if (!value.startsWith("--") || !values[index + 1]) fail(`Unexpected argument: ${value}`, "continuation_signer_argument_invalid"); result[value.slice(2).replace(/-([a-z])/gu, (_, char) => char.toUpperCase())] = values[index + 1]; index += 1 } return result }
