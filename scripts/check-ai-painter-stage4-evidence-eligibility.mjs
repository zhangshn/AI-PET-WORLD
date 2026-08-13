import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import {
  buildStage4EvidenceEligibilityRegistry,
  classifyTerminalForExecution,
  materializeStage4EvidenceRegistry,
  validateStage4ExecutionEvidenceBinding,
} from "./lib/ai-painter-stage4-evidence-eligibility.mjs"
import { runV8Stage4Smoke } from "./run-ai-assisted-v8-r5-stage4-smoke.mjs"

const ROOT = process.cwd()
const runId = requiredArg("--run-id")
const authorizationPath = projectPath(requiredArg("--implementation-authorization"))
const consumptionPath = projectPath(requiredArg("--implementation-consumption"))
const formalRegistryPath = projectPath(requiredArg("--formal-registry"))
const outputRoot = `.runtime/ai-painter/stage4-evidence-eligibility-checks/${runId}`
const reportPath = `${outputRoot}/cpu-report.json`
assert(!fs.existsSync(resolveInsideRoot(outputRoot)), "evidence eligibility check runId already exists")
fs.mkdirSync(resolveInsideRoot(outputRoot), { recursive: true })

const authorization = readJsonVerified(authorizationPath)
const consumption = readJsonVerified(consumptionPath)
assert(authorization.status === "resolved_owner_authorized_not_consumed", "implementation authorization status changed")
assert(consumption.status === "implementation_authorization_atomically_consumed", "implementation consumption status changed")
assert(consumption.authorizationSha256 === sha256File(resolveInsideRoot(authorizationPath)), "implementation lineage changed")

const successTerminal = binding(
  ".runtime/ai-painter/stage4-per-class-final-visible-rgb-obligation-cpu/20260812-230019573/phase-terminal.json",
)
const supportContract = binding(
  ".runtime/ai-painter/stage4-per-class-final-visible-rgb-obligation-cpu/20260812-230019573/training-objective-support-contract.json",
)
const oldConfig = binding(
  ".runtime/ai-painter/stage4-per-class-final-visible-rgb-obligation-cpu/20260812-190738093/inactive-config.json",
)
const failedTerminal = binding(
  ".runtime/ai-painter/stage4-per-class-final-visible-rgb-obligation-cpu/20260812-190738093/phase-terminal.json",
)
const authorizationBinding = { path: authorizationPath, sha256: sha256File(resolveInsideRoot(authorizationPath)) }
const formalRegistryBinding = binding(formalRegistryPath)
let fixtureRegistrySequence = 900000000
const nextFixtureRegistryId = () => `20991231-${String(fixtureRegistrySequence += 1).padStart(9, "0")}`

const parallelFixtureRoot = `${outputRoot}/parallel-binding-fixtures`
const parallelArtifactPath = `${parallelFixtureRoot}/artifact.json`
writeExclusiveJson(parallelArtifactPath, { fixture: "same_object_same_prefix_parallel_binding" })
const parallelArtifact = binding(parallelArtifactPath)
const parallelTerminalPath = `${parallelFixtureRoot}/success-terminal.json`
writeExclusiveJson(parallelTerminalPath, {
  status: "stage4_parallel_binding_fixture_succeeded_closed",
  reportPath: parallelArtifact.path,
  reportSha256: parallelArtifact.sha256,
})
const parallelTerminal = binding(parallelTerminalPath)
const parallelRegistry = buildStage4EvidenceEligibilityRegistry({
  root: ROOT,
  registryId: nextFixtureRegistryId(),
  authorization: authorizationBinding,
  reusableEvidence: [{ role: "stage4.test.parallelBinding", source: parallelArtifact, successTerminal: parallelTerminal }],
  historicalEvidence: [],
})

const runnerContract = await verifyStage4RunnerContract({
  outputRoot,
  formalRegistryBinding,
  oldConfig,
})

const registry = buildStage4EvidenceEligibilityRegistry({
  root: ROOT,
  registryId: runId,
  authorization: authorizationBinding,
  reusableEvidence: [
    {
      role: "stage4.finalVisibleRgb.trainingObjectiveSupportContract",
      source: supportContract,
      successTerminal,
    },
    {
      role: "stage4.finalVisibleRgb.inactiveConfig",
      source: oldConfig,
      successTerminal,
      registrationChain: [supportContract],
    },
  ],
  historicalEvidence: [{
    runRoot: ".runtime/ai-painter/stage4-per-class-final-visible-rgb-obligation-cpu/20260812-190738093",
    terminal: failedTerminal,
  }],
})
const registryPath = `${outputRoot}/registry.json`
const registryBinding = materializeStage4EvidenceRegistry({ root: ROOT, registry, registryPath })
const supportEntry = registry.roles["stage4.finalVisibleRgb.trainingObjectiveSupportContract"]
const configEntry = registry.roles["stage4.finalVisibleRgb.inactiveConfig"]

const positive = {
  successTerminalClassifiedReusable: classifyTerminalForExecution(readJsonVerified(successTerminal.path).status) === "success_terminal",
  failedTerminalClassifiedHistorical: classifyTerminalForExecution(readJsonVerified(failedTerminal.path).status) === "historical_readonly",
  historicalFilesStillExist: fs.existsSync(resolveInsideRoot(oldConfig.path)) && fs.existsSync(resolveInsideRoot(failedTerminal.path)),
  canonicalSupportMaterialized: sha256File(resolveInsideRoot(supportEntry.canonicalPath)) === supportContract.sha256,
  canonicalConfigMaterialized: sha256File(resolveInsideRoot(configEntry.canonicalPath)) === oldConfig.sha256,
  canonicalPathsOutsideFailedRun: !supportEntry.canonicalPath.includes("20260812-190738093") && !configEntry.canonicalPath.includes("20260812-190738093"),
  supportRoleResolves: Boolean(validateStage4ExecutionEvidenceBinding({ root: ROOT, registryPath: registryBinding.path, registrySha256: registryBinding.sha256, role: "stage4.finalVisibleRgb.trainingObjectiveSupportContract", binding: { path: supportEntry.canonicalPath, sha256: supportEntry.sha256 } })),
  configRoleResolves: Boolean(validateStage4ExecutionEvidenceBinding({ root: ROOT, registryPath: registryBinding.path, registrySha256: registryBinding.sha256, role: "stage4.finalVisibleRgb.inactiveConfig", binding: { path: configEntry.canonicalPath, sha256: configEntry.sha256 } })),
  historicalAnalysisReadRemainsAllowed: registry.historical[0].analysisReadAllowed === true && registry.historical[0].executionUseAllowed === false,
  shaAloneSelectionDisabled: registry.policy.sha256AloneNeverSelectsEvidence === true,
  sameObjectSamePrefixParallelBindingAccepted: parallelRegistry.roles["stage4.test.parallelBinding"]?.sha256 === parallelArtifact.sha256,
  stage4RunnerAcceptsCanonicalRegisteredRoles: runnerContract.canonicalAccepted,
}

const malformedParallelTerminal = (name, body) => {
  const terminalPath = `${parallelFixtureRoot}/${name}.json`
  writeExclusiveJson(terminalPath, { status: "stage4_parallel_binding_fixture_succeeded_closed", ...body })
  return binding(terminalPath)
}
const rejectsParallelTerminal = (name, body) => rejects(() => buildStage4EvidenceEligibilityRegistry({
  root: ROOT,
  registryId: nextFixtureRegistryId(),
  authorization: authorizationBinding,
  reusableEvidence: [{ role: `stage4.test.${name}`, source: parallelArtifact, successTerminal: malformedParallelTerminal(name, body) }],
  historicalEvidence: [],
}))

const negative = {
  directOldConfigRejected: rejects(() => validateStage4ExecutionEvidenceBinding({ root: ROOT, registryPath: registryBinding.path, registrySha256: registryBinding.sha256, role: "stage4.finalVisibleRgb.inactiveConfig", binding: oldConfig })),
  roleSwapRejected: rejects(() => validateStage4ExecutionEvidenceBinding({ root: ROOT, registryPath: registryBinding.path, registrySha256: registryBinding.sha256, role: "stage4.finalVisibleRgb.trainingObjectiveSupportContract", binding: { path: configEntry.canonicalPath, sha256: configEntry.sha256 } })),
  hashMismatchRejected: rejects(() => validateStage4ExecutionEvidenceBinding({ root: ROOT, registryPath: registryBinding.path, registrySha256: registryBinding.sha256, role: "stage4.finalVisibleRgb.inactiveConfig", binding: { path: configEntry.canonicalPath, sha256: "0".repeat(64) } })),
  failedTerminalSourceRejected: rejects(() => buildStage4EvidenceEligibilityRegistry({ root: ROOT, registryId: "20990101-000000000", authorization: authorizationBinding, reusableEvidence: [{ role: "stage4.test.failedSource", source: oldConfig, successTerminal: failedTerminal }], historicalEvidence: [] })),
  unregisteredSiblingRejected: rejects(() => buildStage4EvidenceEligibilityRegistry({ root: ROOT, registryId: "20990101-000000001", authorization: authorizationBinding, reusableEvidence: [{ role: "stage4.test.unregisteredSibling", source: oldConfig, successTerminal }], historicalEvidence: [] })),
  shaOnlyUnknownPathRejected: rejects(() => validateStage4ExecutionEvidenceBinding({ root: ROOT, registryPath: registryBinding.path, registrySha256: registryBinding.sha256, role: "stage4.finalVisibleRgb.inactiveConfig", binding: { path: ".runtime/ai-painter/nonexistent.json", sha256: oldConfig.sha256 } })),
  absolutePathRejected: rejects(() => buildStage4EvidenceEligibilityRegistry({ root: ROOT, registryId: "20990101-000000002", authorization: authorizationBinding, reusableEvidence: [{ role: "stage4.test.absolute", source: { path: resolveInsideRoot(oldConfig.path), sha256: oldConfig.sha256 }, successTerminal }], historicalEvidence: [] })),
  unknownTerminalStatusRejected: classifyTerminalForExecution("closed_without_explicit_outcome") === "unknown_fail_closed",
  duplicateRoleRejected: rejects(() => buildStage4EvidenceEligibilityRegistry({ root: ROOT, registryId: "20990101-000000003", authorization: authorizationBinding, reusableEvidence: [{ role: "stage4.test.duplicate", source: supportContract, successTerminal }, { role: "stage4.test.duplicate", source: supportContract, successTerminal }], historicalEvidence: [] })),
  historicalTerminalCannotBeReclassified: rejects(() => buildStage4EvidenceEligibilityRegistry({ root: ROOT, registryId: "20990101-000000004", authorization: authorizationBinding, reusableEvidence: [{ role: "stage4.test.valid", source: supportContract, successTerminal }], historicalEvidence: [{ runRoot: path.dirname(successTerminal.path), terminal: successTerminal }] })),
  parallelMissingPathRejected: rejectsParallelTerminal("parallelMissingPath", { reportSha256: parallelArtifact.sha256 }),
  parallelMissingSha256Rejected: rejectsParallelTerminal("parallelMissingSha256", { reportPath: parallelArtifact.path }),
  parallelPrefixMismatchRejected: rejectsParallelTerminal("parallelPrefixMismatch", { reportPath: parallelArtifact.path, artifactSha256: parallelArtifact.sha256 }),
  parallelCrossObjectAssemblyRejected: rejectsParallelTerminal("parallelCrossObjectAssembly", { left: { reportPath: parallelArtifact.path }, right: { reportSha256: parallelArtifact.sha256 } }),
  parallelHashMismatchRejected: rejectsParallelTerminal("parallelHashMismatch", { reportPath: parallelArtifact.path, reportSha256: "0".repeat(64) }),
  stage4RunnerRejectsDirectHistoricalPath: runnerContract.directHistoricalRejected,
}

const failedPositiveKeys = Object.entries(positive).filter(([, value]) => value !== true).map(([key]) => key)
const failedNegativeKeys = Object.entries(negative).filter(([, value]) => value !== true).map(([key]) => key)
const recordedAtUtc = new Date().toISOString()
const report = {
  schemaVersion: "ai-painter-stage4-execution-evidence-eligibility-cpu-report-v1",
  status: failedPositiveKeys.length || failedNegativeKeys.length
    ? "stage4_execution_evidence_eligibility_cpu_failed_closed"
    : "stage4_execution_evidence_eligibility_cpu_passed",
  runId,
  recordedAtUtc,
  positive,
  negative,
  failedPositiveKeys,
  failedNegativeKeys,
  positivePassed: Object.values(positive).filter((value) => value === true).length,
  positiveTotal: Object.keys(positive).length,
  negativePassed: Object.values(negative).filter((value) => value === true).length,
  negativeTotal: Object.keys(negative).length,
  registry: registryBinding,
  historicalFilesMoved: false,
  historicalFilesDeleted: false,
  checkpointRead: false,
  gpuStarted: false,
  trainingStarted: false,
}
writeExclusiveJson(reportPath, report)
process.stdout.write(`${JSON.stringify({ status: report.status, positive: `${report.positivePassed}/${report.positiveTotal}`, negative: `${report.negativePassed}/${report.negativeTotal}`, report: binding(reportPath), registry: registryBinding }, null, 2)}\n`)
if (failedPositiveKeys.length || failedNegativeKeys.length) process.exitCode = 1

function requiredArg(name) {
  const index = process.argv.indexOf(name)
  if (index < 0 || !process.argv[index + 1]) throw new Error(`${name} is required`)
  return process.argv[index + 1]
}

function rejects(callback) {
  try { callback(); return false } catch { return true }
}

async function verifyStage4RunnerContract({ outputRoot, formalRegistryBinding, oldConfig }) {
  const registry = readJsonVerified(formalRegistryBinding.path)
  const templatePath = ".runtime/ai-painter/owner-action-requests/owner-authorized-stage4-fact-conditioned-semantic-mixture-30-epoch-model-smoke-20260812-122933771/gpu-execution-authorization.json"
  const template = readJsonVerified(templatePath)
  const roleToBinding = (role) => {
    const entry = registry.roles?.[role]
    assert(entry?.canonicalPath && entry?.sha256, `formal registry role missing: ${role}`)
    return { path: entry.canonicalPath, sha256: entry.sha256 }
  }
  const createRunnerFixture = (name, historical = false) => {
    const fixtureRoot = `${outputRoot}/runner-contract/${name}`
    const fixturePath = `${fixtureRoot}/gpu-authorization.json`
    const value = structuredClone(template)
    value.requestId = `owner-authorized-stage4-fact-conditioned-semantic-mixture-30-epoch-model-smoke-20991231-${name === "canonical" ? "235959001" : "235959002"}`
    value.commandRef = value.requestId
    value.taskIdentity.evidenceEligibilityContractId = "stage4_execution_evidence_eligibility_v1"
    value.bindings.executionEvidenceRegistry = formalRegistryBinding
    value.bindings.readonlyGpuTerminal = roleToBinding("stage4.finalVisibleRgb.gpuQualificationTerminal")
    value.bindings.readonlyGpuDiagnostic = roleToBinding("stage4.finalVisibleRgb.gpuDiagnosticReport")
    value.bindings.cudaTelemetry = roleToBinding("stage4.finalVisibleRgb.cudaTelemetry")
    value.bindings.readonlyCpuReport = roleToBinding("stage4.finalVisibleRgb.cpuAuthorizationReport")
    value.bindings.inactiveConfig = historical
      ? oldConfig
      : roleToBinding("stage4.finalVisibleRgb.inactiveConfig")
    value.bindings.architectureSupportContract = roleToBinding("stage4.finalVisibleRgb.trainingObjectiveSupportContract")
    const codePaths = {
      authorizationPolicy: "ml/ai-painter/scripts/ai_painter_authorization_policy.py",
      executionGrant: "ml/ai-painter/scripts/ai_painter_execution_grant.py",
      modeRegistry: "ml/ai-painter/scripts/ai_painter_stage_mode_registry.py",
      trainer: "ml/ai-painter/scripts/train_ai_assisted_conditional_denoiser.py",
      runner: "scripts/run-ai-assisted-v8-r5-stage4-smoke.mjs",
      cpuChecker: "ml/ai-painter/scripts/check_ai_assisted_v9_r5_stage4_cpu.py",
      model: "ml/ai-painter/src/ai_painter/complete_world/model.py",
      inactiveConfigCompiler: "ml/ai-painter/scripts/compile_ai_assisted_v9_r5_stage4_inactive_config.py",
    }
    value.codeBindings = Object.fromEntries(Object.entries(codePaths).map(([key, value]) => [key, binding(value)]))
    value.execution = {
      consumptionPath: `${fixtureRoot}/execution-consumption-must-not-exist.json`,
      activeConfigPath: `${fixtureRoot}/active-config-must-not-exist.json`,
      trainingOutputDirectory: `${fixtureRoot}/training-output-must-not-exist`,
      finalizationDirectory: `${fixtureRoot}/finalization-must-not-exist`,
      preflightReportPath: `${fixtureRoot}/preflight-report-must-not-exist.json`,
    }
    writeExclusiveJson(fixturePath, value)
    return binding(fixturePath)
  }
  const canonical = createRunnerFixture("canonical")
  const canonicalResult = await runV8Stage4Smoke([
    "--stage4-fact-conditioned-semantic-mixture-model-smoke",
    "--gpu-authorization", canonical.path,
    "--gpu-authorization-sha256", canonical.sha256,
    "--cpu-contract-only",
  ])
  const historical = createRunnerFixture("historical", true)
  let directHistoricalRejected = false
  try {
    await runV8Stage4Smoke([
      "--stage4-fact-conditioned-semantic-mixture-model-smoke",
      "--gpu-authorization", historical.path,
      "--gpu-authorization-sha256", historical.sha256,
      "--cpu-contract-only",
    ])
  } catch (error) {
    directHistoricalRejected = String(error?.message ?? error).includes("execution evidence must use canonical registered path")
  }
  return { canonicalAccepted: canonicalResult === 0, directHistoricalRejected }
}

function readJsonVerified(value) {
  return JSON.parse(fs.readFileSync(resolveInsideRoot(value), "utf8"))
}

function binding(value) {
  const project = projectPath(value)
  return { path: project, sha256: sha256File(resolveInsideRoot(project)) }
}

function resolveInsideRoot(value) {
  if (path.isAbsolute(value)) throw new Error(`absolute path forbidden: ${value}`)
  const resolved = path.resolve(ROOT, value)
  const relative = path.relative(ROOT, resolved)
  if (!relative || relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) throw new Error(`path escapes project: ${value}`)
  return resolved
}

function projectPath(value) {
  return path.relative(ROOT, path.resolve(ROOT, value)).replaceAll("\\", "/")
}

function sha256File(value) {
  return crypto.createHash("sha256").update(fs.readFileSync(value)).digest("hex")
}

function writeExclusiveJson(value, body) {
  const absolute = resolveInsideRoot(value)
  fs.mkdirSync(path.dirname(absolute), { recursive: true })
  const fd = fs.openSync(absolute, "wx")
  try { fs.writeFileSync(fd, `${JSON.stringify(body, null, 2)}\n`, "utf8"); fs.fsyncSync(fd) } finally { fs.closeSync(fd) }
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}
