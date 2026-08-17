import assert from "node:assert/strict"
import {
  generateKeyPairSync,
} from "node:crypto"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import {
  consumeOwnerAuthorization,
} from "../src/server/project-owner-authorization-core.mjs"
import {
  assertStage4ContinuousStepPredecessor,
  DelegatedAuthorizationPackageError,
  materializeStage4ContinuousRuntimeEvidence,
  resolveStage4ContinuousArguments,
  sha256File,
  verifyStage4ContinuousAuthorizationPackage,
  verifyStage4ContinuousCoordinatorAuthorization,
  verifyStage4ContinuousStepAuthorization,
} from "../src/server/project-owner-delegated-authorization-package-core.mjs"
import {
  signStage4To80AuthorizationPackage,
} from "./owner-offline/sign-ai-painter-stage4-to-80-package.mjs"
import {
  appendAiPainterProgramEvent,
  formatShanghai,
  writeJsonAtomic,
} from "./lib/ai-painter-program-event-store.mjs"
import { indexArtifact } from "./lib/ai-pet-world-storage-catalog.mjs"
import { logicalProjectPath } from "./lib/ai-pet-world-storage.mjs"

const SOURCE_ROOT = process.cwd()
const testRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ai-pet-stage4-continuous-auth-"))
let positive = 0
let negative = 0

try {
  const fixture = buildFixture(testRoot)
  const signed = signStage4To80AuthorizationPackage({
    root: testRoot,
    planPath: fixture.planPath,
    planSha256: fixture.planSha256,
    trustRegistryPath: fixture.registryPath,
    trustRegistrySha256: fixture.registrySha256,
    privateKeyPath: fixture.privateKeyPath,
    now: new Date("2026-08-15T16:00:00.000Z"),
  })
  check(signed.status === "owner_signed_stage4_continuous_package_ready", "package_signed")
  check(signed.stepCount === 5 && JSON.stringify(signed.stepRoles) === JSON.stringify(["smoke", "late_stability_qualification", "stage0", "stage1", "stage2"]), "exact_five_step_roles")

  const verified = verifyStage4ContinuousAuthorizationPackage({
    root: testRoot,
    packagePath: signed.packagePath,
    packageSha256: signed.packageSha256,
    trustRegistryPath: fixture.registryPath,
    trustRegistrySha256: fixture.registrySha256,
    now: new Date("2026-08-15T16:01:00.000Z"),
  })
  check(verified.packageId === signed.packageId && verified.signerKeyId === fixture.keyId, "package_signature_and_identity")
  check(verified.steps.every((step, index) => step.index === index), "step_indices_and_order")
  check(verified.steps.every((step) => step.authorization.path.includes(`/${step.role}/request.json`)), "independent_step_authorizations")
  check(verified.steps.every((step) => step.runnerAuthorization.path.includes(`/runner-authorizations/${step.role}/request.json`)), "runner_authorizations_bound")

  const coordinator = verifyStage4ContinuousCoordinatorAuthorization({
    root: testRoot,
    coordinator: verified.coordinator,
    trustRegistryPath: fixture.registryPath,
    trustRegistrySha256: fixture.registrySha256,
    now: new Date("2026-08-15T16:01:00.000Z"),
  })
  const coordinatorConsumption = consumeOwnerAuthorization(coordinator, { root: testRoot })
  check(fs.existsSync(path.resolve(testRoot, coordinatorConsumption)), "coordinator_consumed_once")
  expectCoreCode(() => consumeOwnerAuthorization(coordinator, { root: testRoot }), "owner_authorization_already_consumed", "coordinator_duplicate_consumption_rejected")

  const smoke = verified.steps[0]
  const smokeAuthorization = verifyStage4ContinuousStepAuthorization({
    root: testRoot,
    step: smoke,
    trustRegistryPath: fixture.registryPath,
    trustRegistrySha256: fixture.registrySha256,
    now: new Date("2026-08-15T16:01:00.000Z"),
  })
  const smokeConsumption = consumeOwnerAuthorization(smokeAuthorization, { root: testRoot })
  check(fs.existsSync(path.resolve(testRoot, smokeConsumption)), "step_consumed_once")
  expectCoreCode(() => consumeOwnerAuthorization(smokeAuthorization, { root: testRoot }), "owner_authorization_already_consumed", "step_duplicate_consumption_rejected")

  check(assertStage4ContinuousStepPredecessor(smoke, null) === true, "smoke_has_no_predecessor")
  const qualification = verified.steps[1]
  const stage0 = verified.steps[2]
  check(assertStage4ContinuousStepPredecessor(qualification, { role: "smoke", status: fixture.success.smoke, path: ".runtime/x.json", sha256: "a".repeat(64) }) === true, "qualification_requires_bound_smoke_terminal")
  check(assertStage4ContinuousStepPredecessor(stage0, { role: "late_stability_qualification", status: fixture.success.late_stability_qualification, path: ".runtime/x.json", sha256: "a".repeat(64) }) === true, "stage0_requires_package_qualification")
  expectDelegatedCode(() => assertStage4ContinuousStepPredecessor(stage0, { role: "smoke", status: fixture.success.smoke, path: ".runtime/x.json", sha256: "a".repeat(64) }), "continuous_previous_terminal_role_invalid", "stage0_cannot_skip_qualification")
  expectDelegatedCode(() => assertStage4ContinuousStepPredecessor(stage0, { role: "late_stability_qualification", status: "failed", path: ".runtime/x.json", sha256: "a".repeat(64) }), "continuous_previous_terminal_status_invalid", "failed_qualification_rejected")

  runRuntimeMaterializationChecks({ fixture, verified })

  const resolved = resolveStage4ContinuousArguments(["--authorization", "{{RUNNER_AUTH_PATH}}", "--parent", "{{PREVIOUS_CHECKPOINT_PATH}}"], {
    RUNNER_AUTH_PATH: ".runtime/runner-auth.json",
    PREVIOUS_CHECKPOINT_PATH: ".runtime/stage0.pt",
  })
  check(JSON.stringify(resolved) === JSON.stringify(["--authorization", ".runtime/runner-auth.json", "--parent", ".runtime/stage0.pt"]), "placeholder_resolution_exact")
  expectDelegatedCode(() => resolveStage4ContinuousArguments(["{{UNKNOWN}}"], {}), "continuous_runner_placeholder_invalid", "unknown_placeholder_rejected")

  const packageAbsolute = path.resolve(testRoot, signed.packagePath)
  const originalPackageBytes = fs.readFileSync(packageAbsolute)
  const tamperedPackage = JSON.parse(originalPackageBytes.toString("utf8"))
  tamperedPackage.signedAtUtc = "2026-08-15T16:02:00.000Z"
  fs.writeFileSync(packageAbsolute, `${JSON.stringify(tamperedPackage, null, 2)}\n`, "utf8")
  expectDelegatedCode(() => verifyStage4ContinuousAuthorizationPackage({
    root: testRoot,
    packagePath: signed.packagePath,
    packageSha256: sha256File(packageAbsolute),
    trustRegistryPath: fixture.registryPath,
    trustRegistrySha256: fixture.registrySha256,
    now: new Date("2026-08-15T16:01:00.000Z"),
  }), "continuous_package_signature_invalid", "package_tampering_rejected")
  fs.writeFileSync(packageAbsolute, originalPackageBytes)

  expectDelegatedCode(() => verifyStage4ContinuousAuthorizationPackage({
    root: testRoot,
    packagePath: signed.packagePath,
    packageSha256: "0".repeat(64),
    trustRegistryPath: fixture.registryPath,
    trustRegistrySha256: fixture.registrySha256,
    now: new Date("2026-08-15T16:01:00.000Z"),
  }), "continuous_package_hash_mismatch", "package_hash_mismatch_rejected")
  expectDelegatedCode(() => verifyStage4ContinuousAuthorizationPackage({
    root: testRoot,
    packagePath: signed.packagePath,
    packageSha256: signed.packageSha256,
    trustRegistryPath: fixture.registryPath,
    trustRegistrySha256: "0".repeat(64),
    now: new Date("2026-08-15T16:01:00.000Z"),
  }), "owner_trust_registry_invalid", "registry_hash_mismatch_rejected")

  const packageText = listFiles(path.dirname(packageAbsolute)).map((file) => fs.readFileSync(file, "utf8")).join("\n")
  check(!packageText.includes("PRIVATE KEY"), "private_key_not_exported_to_package")

  const duplicatePlan = structuredClone(fixture.plan)
  duplicatePlan.steps[3].role = "stage0"
  expectSignerFailure(testRoot, fixture, duplicatePlan, "stage4_execution_plan_step_order_invalid", "duplicate_or_out_of_order_role_rejected")
  const unknownPlaceholderPlan = structuredClone(fixture.plan)
  unknownPlaceholderPlan.steps[0].executeArgs.push("{{UNKNOWN_ACTION}}")
  expectSignerFailure(testRoot, fixture, unknownPlaceholderPlan, "stage4_execution_plan_placeholder_invalid", "unknown_plan_placeholder_rejected")
  const absoluteOutputPlan = structuredClone(fixture.plan)
  absoluteOutputPlan.steps[0].outputNamespace = "C:/outside-project"
  expectSignerFailure(testRoot, fixture, absoluteOutputPlan, "stage4_project_path_escape", "absolute_output_injection_rejected")
  const wrongRunnerHashPlan = structuredClone(fixture.plan)
  wrongRunnerHashPlan.steps[0].runner.sha256 = "f".repeat(64)
  expectSignerFailure(testRoot, fixture, wrongRunnerHashPlan, "stage4_execution_plan_runner_hash_mismatch", "runner_hash_injection_rejected")

  const report = {
    schemaVersion: "ai-painter-stage4-continuous-authorization-cpu-report-v1",
    status: "passed",
    positiveChecks: positive,
    negativeChecks: negative,
    gpuStarted: false,
    checkpointRead: false,
    optimizerCreated: false,
    backwardExecuted: false,
    modelWeightsModified: false,
    privateKeyExported: false,
  }
  const formalOutputRoot = optionValue(process.argv.slice(2), "--formal-output-root")
  if (formalOutputRoot) writeFormalEvidence(formalOutputRoot, report, {
    implementationAuthorization: verifiedInputBinding("--implementation-authorization", "--implementation-authorization-sha256"),
    implementationConsumption: verifiedInputBinding("--implementation-consumption", "--implementation-consumption-sha256"),
  })
  console.log(JSON.stringify(report, null, 2))
} finally {
  fs.rmSync(testRoot, { recursive: true, force: true })
}

function writeFormalEvidence(relativeOutputRoot, report, sourceAuthorization) {
  const normalized = relativeOutputRoot.replaceAll("\\", "/")
  const absoluteOutputRoot = path.resolve(SOURCE_ROOT, normalized)
  const relative = path.relative(SOURCE_ROOT, absoluteOutputRoot).replaceAll("\\", "/")
  if (!relative.startsWith(".runtime/ai-painter/stage4-continuous-authorization-installations/") || fs.existsSync(absoluteOutputRoot)) {
    throw new Error("Formal output root must be a fresh Stage4 continuous authorization installation namespace.")
  }
  const now = new Date()
  const recordedAtUtc = now.toISOString()
  const runId = path.basename(absoluteOutputRoot)
  const contractPath = path.resolve(SOURCE_ROOT, "data/ai-painter/system-governance/stage4-continuous-execution-authorization-contract-v1.json")
  const signerPath = path.resolve(SOURCE_ROOT, "scripts/owner-offline/sign-ai-painter-stage4-to-80-package.mjs")
  const executorPath = path.resolve(SOURCE_ROOT, "scripts/run-ai-painter-stage4-to-80.mjs")
  const installedSignerPath = path.resolve(process.env.USERPROFILE ?? "", ".ai-pet-world-owner/sign-ai-painter-stage4-to-80-package.mjs")
  if (!fs.existsSync(installedSignerPath) || sha256File(installedSignerPath) !== sha256File(signerPath)) {
    throw new Error("Owner offline signer installation does not match the CPU-verified project signer.")
  }
  const files = {
    cpuReport: path.join(absoluteOutputRoot, "cpu-report.json"),
    supportContract: path.join(absoluteOutputRoot, "continuous-authorization-support-contract.json"),
    implementationReport: path.join(absoluteOutputRoot, "implementation-report.json"),
    localTaskCapsule: path.join(absoluteOutputRoot, "local-task-capsule.json"),
    terminal: path.join(absoluteOutputRoot, "phase-terminal.json"),
  }
  writeJsonAtomic(files.cpuReport, { ...report, runId, recordedAtUtc, recordedAtAsiaShanghai: formatShanghai(recordedAtUtc) })
  writeJsonAtomic(files.supportContract, {
    schemaVersion: "ai-painter-stage4-continuous-authorization-support-contract-v1",
    status: "active_cpu_verified",
    ownerSigningIsOfflineOnly: true,
    privateKeyMayEnterProject: false,
    packageIsWildcardAuthorization: false,
    stepOrder: ["smoke", "late_stability_qualification", "stage0", "stage1", "stage2"],
    lateStabilityQualificationIsCpuReadonly: true,
    futureEvidenceResolvedOnlyFromPackagePredecessor: true,
    parentCheckpointResolvedOnlyFromPreviousStageTerminal: true,
    independentStepConsumption: true,
    automaticRetry: false,
    stopOnRealFailureOrOwnerDecision: true,
    machineContract: { path: logicalProjectPath(contractPath), sha256: sha256File(contractPath) },
    signer: { path: logicalProjectPath(signerPath), sha256: sha256File(signerPath) },
    ownerInstalledSigner: { path: "%USERPROFILE%/.ai-pet-world-owner/sign-ai-painter-stage4-to-80-package.mjs", sha256: sha256File(installedSignerPath) },
    executor: { path: logicalProjectPath(executorPath), sha256: sha256File(executorPath) },
    sourceAuthorization,
    recordedAtUtc,
  })
  writeJsonAtomic(files.implementationReport, {
    schemaVersion: "ai-painter-stage4-continuous-authorization-implementation-report-v1",
    status: "implementation_cpu_verified",
    result: "Owner signs once; Smoke, CPU read-only late-stability qualification and Stage 0/1/2 retain independent identities, consumption and terminal gates. Future qualification and parent Checkpoint identities are materialized only from this package's preceding terminal.",
    projectFilesChanged: [
      "data/ai-painter/system-governance/stage4-continuous-execution-authorization-contract-v1.json",
      "src/server/project-owner-delegated-authorization-package-core.mjs",
      "scripts/owner-offline/sign-ai-painter-stage4-to-80-package.mjs",
      "scripts/run-ai-painter-stage4-to-80.mjs",
      "scripts/check-ai-painter-stage4-continuous-authorization.mjs",
    ],
    docsUpdatedInThisBoundedChange: [],
    gpuStarted: false,
    trainingStarted: false,
    recordedAtUtc,
  })
  const refs = Object.fromEntries(Object.entries(files).filter(([key]) => key !== "terminal" && key !== "localTaskCapsule").map(([key, value]) => [key, { path: logicalProjectPath(value), sha256: sha256File(value) }]))
  writeJsonAtomic(files.localTaskCapsule, {
    schemaVersion: "ai-painter-local-task-capsule-v1",
    status: "stage4_continuous_late_stability_support_cpu_succeeded_closed",
    module: "AI Painter R5",
    currentStage: "Stage4 current candidate Smoke ready but inactive",
    fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
    latestBlocker: "exact_stage4_execution_plan_not_yet_prepared_and_owner_signed",
    nextLegalAction: "local_system_prepare_exact_five_step_plan_then_owner_offline_sign_once",
    evidence: refs,
    gpuUsedNow: false,
    trainingStartedNow: false,
    recordedAtUtc,
    recordedAtAsiaShanghai: formatShanghai(recordedAtUtc),
  })
  writeJsonAtomic(files.terminal, {
    schemaVersion: "ai-painter-stage4-continuous-authorization-installation-terminal-v1",
    status: "stage4_continuous_late_stability_support_cpu_succeeded_closed",
    fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
    ...refs,
    localTaskCapsule: { path: logicalProjectPath(files.localTaskCapsule), sha256: sha256File(files.localTaskCapsule) },
    gpuStarted: false,
    trainingStarted: false,
    recordedAtUtc,
    recordedAtAsiaShanghai: formatShanghai(recordedAtUtc),
  })
  for (const value of Object.values(files)) indexEvidenceFile(value, runId)
  appendAiPainterProgramEvent({
    action: "install_ai_painter_stage4_continuous_authorization_governance",
    runId,
    kind: "cpu_only_governance_implementation",
    status: "success",
    title: "Stage4 continuous authorization governance installed and CPU verified",
    titleZh: "Stage4一次签署与连续执行治理工具已安装并通过CPU验证",
    detailZh: `正向${report.positiveChecks}/${report.positiveChecks}、反向${report.negativeChecks}/${report.negativeChecks}；私钥未读取，GPU与训练未启动。`,
    script: "scripts/check-ai-painter-stage4-continuous-authorization.mjs",
    currentStep: "stage4_continuous_authorization_infrastructure_cpu_succeeded_closed",
    evidencePath: logicalProjectPath(files.terminal),
    evidenceSha256: sha256File(files.terminal),
    fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
    finalGameMapSuccess: false,
    canEnterWorld: false,
  })
}

function verifiedInputBinding(pathKey, hashKey) {
  const values = process.argv.slice(2)
  const suppliedPath = optionValue(values, pathKey)
  const suppliedSha256 = optionValue(values, hashKey)?.toLowerCase()
  if (!suppliedPath || !/^[a-f0-9]{64}$/u.test(suppliedSha256 ?? "")) throw new Error(`${pathKey} and ${hashKey} are required for formal evidence.`)
  const absolute = path.resolve(SOURCE_ROOT, suppliedPath)
  const relative = path.relative(SOURCE_ROOT, absolute).replaceAll("\\", "/")
  const allowedEvidenceNamespace = relative.startsWith(".runtime/ai-painter/")
    || relative.startsWith(".runtime/project-owner-write-authorization-consumptions/")
  if (!allowedEvidenceNamespace || !fs.existsSync(absolute) || sha256File(absolute) !== suppliedSha256) {
    throw new Error(`${pathKey} immutable evidence binding is invalid.`)
  }
  return { path: relative, sha256: suppliedSha256 }
}

function indexEvidenceFile(file, runId) {
  const info = fs.statSync(file)
  indexArtifact({
    logicalPath: logicalProjectPath(file),
    physicalUri: fs.realpathSync(file),
    storageLayer: "hot",
    runId,
    byteSize: info.size,
    modifiedAtUtc: info.mtime.toISOString(),
    sha256: sha256File(file),
  })
}

function optionValue(values, key) {
  const index = values.indexOf(key)
  if (index < 0) return null
  const value = values[index + 1]
  if (!value || value.startsWith("--")) throw new Error(`${key} requires a value.`)
  return value
}

function buildFixture(root) {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519")
  const keyId = "fixture-owner-key"
  const privateKeyPath = path.join(root, "owner-private-key.pem")
  fs.mkdirSync(root, { recursive: true })
  fs.writeFileSync(privateKeyPath, privateKey.export({ type: "pkcs8", format: "pem" }))
  const registryPath = path.join(root, "trust-registry.json")
  const registry = {
    schemaVersion: "project-owner-trust-registry-v1",
    status: "active",
    keys: [{
      keyId,
      status: "active",
      algorithm: "ed25519",
      publicKeyPem: publicKey.export({ type: "spki", format: "pem" }).toString(),
      allowedActions: ["*"],
      allowedScopes: ["*"],
    }],
  }
  fs.writeFileSync(registryPath, `${JSON.stringify(registry, null, 2)}\n`)
  const contractTarget = path.join(root, "data/ai-painter/system-governance/stage4-continuous-execution-authorization-contract-v1.json")
  fs.mkdirSync(path.dirname(contractTarget), { recursive: true })
  fs.copyFileSync(path.join(SOURCE_ROOT, "data/ai-painter/system-governance/stage4-continuous-execution-authorization-contract-v1.json"), contractTarget)
  const smokeRunner = path.join(root, "scripts/run-ai-assisted-v8-r5-stage4-smoke.mjs")
  const qualificationRunner = path.join(root, "scripts/run-stage4-general-late-convergence-qualification.mjs")
  const stageRunner = path.join(root, "scripts/run-stage4-semantic-mixture-formal-stage.mjs")
  const coordinatorRunner = path.join(root, "scripts/run-ai-painter-stage4-to-80.mjs")
  for (const runner of [smokeRunner, qualificationRunner, stageRunner, coordinatorRunner]) {
    fs.mkdirSync(path.dirname(runner), { recursive: true })
    fs.writeFileSync(runner, "process.exit(0)\n")
  }
  const smokeHash = sha256File(smokeRunner)
  const qualificationHash = sha256File(qualificationRunner)
  const stageHash = sha256File(stageRunner)
  const roles = ["smoke", "late_stability_qualification", "stage0", "stage1", "stage2"]
  const success = {
    smoke: "semantic-mixture_stage4_single_sample_30_epoch_gpu_smoke_failed_closed",
    late_stability_qualification: "terminal_pass_with_late_convergence_evidence_qualified_closed",
    stage0: "semantic_mixture_stage4_formal_stage_completed_closed",
    stage1: "semantic_mixture_stage4_formal_stage_completed_closed",
    stage2: "semantic_mixture_stage4_formal_stage_completed_closed",
  }
  const plan = {
    schemaVersion: "ai-painter-stage4-to-80-execution-plan-v1",
    status: "ready_for_owner_signature",
    validityHours: 24,
    candidateIdentity: { candidateId: "fixture-candidate", configPath: ".runtime/fixture/config.json", configSha256: "a".repeat(64) },
    baselineProgress: { completedStages: 3, totalStages: 5, percent: 60 },
    steps: roles.map((role, index) => {
      const outputNamespace = role === "late_stability_qualification"
        ? `.runtime/ai-painter/stage4-terminal-pass-late-convergence-qualifications/fixture-${role}`
        : role.startsWith("stage")
          ? `.runtime/ai-painter/stage4-semantic-mixture-formal-training/fixture-${role}`
          : `.runtime/ai-painter/fixture-${role}`
      const previousRole = index === 0 ? null : roles[index - 1]
      const baseArgs = role === "late_stability_qualification"
        ? ["--run-id", `fixture-${role}`, "--authorization-root", "{{RUNNER_AUTH_ROOT}}", "--smoke-root", "{{PREVIOUS_OUTPUT_NAMESPACE}}"]
        : ["--authorization", "{{RUNNER_AUTH_PATH}}", "--authorization-sha256", "{{RUNNER_AUTH_SHA256}}", "--run-id", `fixture-${role}`]
      if (role.startsWith("stage")) baseArgs.push("--stage", role.slice(-1))
      if (role === "stage1" || role === "stage2") baseArgs.push("--parent-checkpoint", "{{PREVIOUS_CHECKPOINT_PATH}}", "--parent-checkpoint-sha256", "{{PREVIOUS_CHECKPOINT_SHA256}}", "--parent-terminal", "{{PREVIOUS_TERMINAL_PATH}}", "--parent-terminal-sha256", "{{PREVIOUS_TERMINAL_SHA256}}")
      const runtimeEvidenceTemplate = {
        schemaVersion: "ai-painter-stage4-continuous-runtime-evidence-template-v1",
        role,
        previousTerminal: previousRole ? {
          role: previousRole,
          path: "{{PREVIOUS_TERMINAL_PATH}}",
          sha256: "{{PREVIOUS_TERMINAL_SHA256}}",
          requiredStatus: success[previousRole],
        } : null,
        parentCheckpoint: role === "stage1" || role === "stage2" ? {
          source: "previous_terminal.checkpoint",
          path: "{{PREVIOUS_CHECKPOINT_PATH}}",
          sha256: "{{PREVIOUS_CHECKPOINT_SHA256}}",
        } : null,
      }
      const runnerAuthorization = role === "late_stability_qualification" ? {
        schemaVersion: "ai-painter-owner-implementation-authorization-v1",
        status: "resolved_owner_authorized_not_consumed",
        requestId: `fixture-${role}-authorization`,
        commandRef: `fixture-${role}-authorization`,
        scope: "cpu_readonly_qualify_bound_smoke_terminal_pass_late_convergence_then_stage0_entry_only",
        implementationActions: ["run_cpu_positive_negative_timeline_contract", "adjudicate_bound_epoch_1_5_10_20_30_reviews", "write_stage0_entry_qualification", "record_local_evidence"],
        explicitlyDeniedActions: ["modify_source_smoke", "change_review_thresholds", "rerun_smoke", "read_checkpoint_weights", "start_gpu", "start_training"],
        sourceEvidence: {
          terminal: { path: "{{SMOKE_TERMINAL_PATH}}", sha256: "{{SMOKE_TERMINAL_SHA256}}" },
          finalization: { path: "{{SMOKE_FINALIZATION_PATH}}", sha256: "{{SMOKE_FINALIZATION_SHA256}}" },
          manifest: { path: "{{SMOKE_MANIFEST_PATH}}", sha256: "{{SMOKE_MANIFEST_SHA256}}" },
          review: { path: "{{SMOKE_REVIEW_PATH}}", sha256: "{{SMOKE_REVIEW_SHA256}}" },
        },
        runner: { path: "scripts/run-stage4-general-late-convergence-qualification.mjs", sha256: qualificationHash },
      } : role.startsWith("stage") ? {
        schemaVersion: "fixture-stage-runner-authorization-v1",
        status: "resolved_owner_authorized_not_consumed",
        role,
        bindings: { terminalQualification: { path: "{{QUALIFICATION_TERMINAL_PATH}}", sha256: "{{QUALIFICATION_TERMINAL_SHA256}}" } },
      } : { schemaVersion: "fixture-runner-authorization-v1", status: "resolved_owner_authorized_not_consumed", role }
      return {
        role,
        runId: `fixture-${role}`,
        previousRole,
        predecessor: previousRole ? { role: previousRole, requiredStatus: success[previousRole] } : null,
        runner: {
          path: role === "smoke" ? "scripts/run-ai-assisted-v8-r5-stage4-smoke.mjs" : role === "late_stability_qualification" ? "scripts/run-stage4-general-late-convergence-qualification.mjs" : "scripts/run-stage4-semantic-mixture-formal-stage.mjs",
          sha256: role === "smoke" ? smokeHash : role === "late_stability_qualification" ? qualificationHash : stageHash,
        },
        outputNamespace,
        progressPath: `${outputNamespace}/training-output/progress.json`,
        preflightArgs: role === "late_stability_qualification" ? [] : [...baseArgs, "--preflight-only"],
        executeArgs: [...baseArgs],
        terminal: { path: role === "late_stability_qualification" ? `${outputNamespace}/phase-terminal.json` : `${outputNamespace}/finalization/phase-terminal.json`, requiredStatus: success[role] },
        runtimeEvidenceTemplate,
        runnerAuthorization,
        boundTerminalMayProceedOnlyToCpuQualification: role === "smoke",
      }
    }),
  }
  const planPath = "execution-plan.json"
  fs.writeFileSync(path.join(root, planPath), `${JSON.stringify(plan, null, 2)}\n`)
  return {
    keyId,
    privateKeyPath,
    registryPath,
    registrySha256: sha256File(registryPath),
    plan,
    planPath,
    planSha256: sha256File(path.join(root, planPath)),
    success,
  }
}

function runRuntimeMaterializationChecks({ fixture, verified }) {
  const [smoke, qualification, stage0, stage1] = verified.steps
  const smokeTerminal = {
    schemaVersion: "fixture-smoke-terminal-v1",
    status: fixture.success.smoke,
  }
  writeFixtureJson(path.resolve(testRoot, smoke.terminal.path), smokeTerminal)
  writeFixtureJson(path.resolve(testRoot, `${smoke.outputNamespace}/finalization/finalization-report.json`), { status: fixture.success.smoke })
  writeFixtureJson(path.resolve(testRoot, `${smoke.outputNamespace}/training-output/manifest.json`), { status: "conditional_denoiser_single_sample_overfit_smoke_completed" })
  writeFixtureJson(path.resolve(testRoot, `${smoke.outputNamespace}/training-output/fixed-preview-reviews.json`), { status: "machine_reviews_failed_closed" })
  const smokeTerminalRecord = {
    role: "smoke",
    status: fixture.success.smoke,
    path: smoke.terminal.path,
    sha256: sha256File(path.resolve(testRoot, smoke.terminal.path)),
    checkpoint: null,
  }
  const qualifierMaterialization = materializeStage4ContinuousRuntimeEvidence({
    root: testRoot,
    executionRoot: path.resolve(testRoot, ".runtime/ai-painter/stage4-continuous-executions/fixture-package-a"),
    step: qualification,
    previousStep: smoke,
    previousTerminal: smokeTerminalRecord,
  })
  check(qualifierMaterialization.runnerAuthorization.materialized === true, "qualification_authorization_materialized")
  const materializedQualifierAuthorization = JSON.parse(fs.readFileSync(path.resolve(testRoot, qualifierMaterialization.runnerAuthorization.path), "utf8"))
  check(materializedQualifierAuthorization.sourceEvidence.terminal.sha256 === smokeTerminalRecord.sha256, "qualification_binds_exact_package_smoke")

  const forgedSmoke = { ...smokeTerminalRecord, sha256: "f".repeat(64) }
  expectDelegatedCode(() => materializeStage4ContinuousRuntimeEvidence({
    root: testRoot,
    executionRoot: path.resolve(testRoot, ".runtime/ai-painter/stage4-continuous-executions/fixture-forged-smoke"),
    step: qualification,
    previousStep: smoke,
    previousTerminal: forgedSmoke,
  }), "continuous_runtime_predecessor_hash_mismatch", "forged_smoke_sha_rejected")
  const historicalSmoke = structuredClone(smoke)
  historicalSmoke.expectation.target.packageId = "historical-package"
  expectDelegatedCode(() => materializeStage4ContinuousRuntimeEvidence({
    root: testRoot,
    executionRoot: path.resolve(testRoot, ".runtime/ai-painter/stage4-continuous-executions/fixture-historical-smoke"),
    step: qualification,
    previousStep: historicalSmoke,
    previousTerminal: smokeTerminalRecord,
  }), "continuous_runtime_predecessor_mismatch", "historical_run_rejected")

  const qualificationTerminalValue = {
    schemaVersion: "fixture-qualification-terminal-v1",
    status: fixture.success.late_stability_qualification,
    stage0EntryPermitted: true,
  }
  writeFixtureJson(path.resolve(testRoot, qualification.terminal.path), qualificationTerminalValue)
  const qualificationTerminalRecord = {
    role: "late_stability_qualification",
    status: fixture.success.late_stability_qualification,
    path: qualification.terminal.path,
    sha256: sha256File(path.resolve(testRoot, qualification.terminal.path)),
    checkpoint: null,
  }
  const stage0Materialization = materializeStage4ContinuousRuntimeEvidence({
    root: testRoot,
    executionRoot: path.resolve(testRoot, ".runtime/ai-painter/stage4-continuous-executions/fixture-package-stage0"),
    step: stage0,
    previousStep: qualification,
    previousTerminal: qualificationTerminalRecord,
    qualificationStep: qualification,
    qualificationTerminal: qualificationTerminalRecord,
  })
  check(stage0Materialization.bindings.QUALIFICATION_TERMINAL_SHA256 === qualificationTerminalRecord.sha256, "stage0_binds_exact_qualification")
  expectDelegatedCode(() => materializeStage4ContinuousRuntimeEvidence({
    root: testRoot,
    executionRoot: path.resolve(testRoot, ".runtime/ai-painter/stage4-continuous-executions/fixture-missing-qualification"),
    step: stage0,
    previousStep: qualification,
    previousTerminal: qualificationTerminalRecord,
  }), "continuous_qualification_terminal_invalid", "missing_qualification_rejected")

  const checkpointPath = `${stage0.outputNamespace}/training-output/stage0.pt`
  const checkpointAbsolute = path.resolve(testRoot, checkpointPath)
  fs.mkdirSync(path.dirname(checkpointAbsolute), { recursive: true })
  fs.writeFileSync(checkpointAbsolute, "fixture-stage0-checkpoint", { flag: "wx" })
  const stage0TerminalValue = {
    schemaVersion: "fixture-stage-terminal-v1",
    status: fixture.success.stage0,
    checkpoint: { path: checkpointPath, sha256: sha256File(checkpointAbsolute) },
  }
  writeFixtureJson(path.resolve(testRoot, stage0.terminal.path), stage0TerminalValue)
  const stage0TerminalRecord = {
    role: "stage0",
    status: fixture.success.stage0,
    path: stage0.terminal.path,
    sha256: sha256File(path.resolve(testRoot, stage0.terminal.path)),
    checkpoint: stage0TerminalValue.checkpoint,
  }
  const stage1Materialization = materializeStage4ContinuousRuntimeEvidence({
    root: testRoot,
    executionRoot: path.resolve(testRoot, ".runtime/ai-painter/stage4-continuous-executions/fixture-package-stage1"),
    step: stage1,
    previousStep: stage0,
    previousTerminal: stage0TerminalRecord,
    qualificationStep: qualification,
    qualificationTerminal: qualificationTerminalRecord,
  })
  check(stage1Materialization.bindings.PREVIOUS_CHECKPOINT_SHA256 === stage0TerminalValue.checkpoint.sha256, "stage1_parent_checkpoint_from_previous_terminal")
  const crossPackageTerminal = {
    ...stage0TerminalRecord,
    checkpoint: { path: ".runtime/ai-painter/other-package/stage0.pt", sha256: stage0TerminalValue.checkpoint.sha256 },
  }
  expectDelegatedCode(() => materializeStage4ContinuousRuntimeEvidence({
    root: testRoot,
    executionRoot: path.resolve(testRoot, ".runtime/ai-painter/stage4-continuous-executions/fixture-cross-package"),
    step: stage1,
    previousStep: stage0,
    previousTerminal: crossPackageTerminal,
    qualificationStep: qualification,
    qualificationTerminal: qualificationTerminalRecord,
  }), "continuous_parent_checkpoint_path_escape", "cross_package_checkpoint_rejected")
}

function writeFixtureJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", flag: "wx" })
}

function expectSignerFailure(root, fixture, plan, code, label) {
  const planPath = `negative-${label}.json`
  fs.writeFileSync(path.join(root, planPath), `${JSON.stringify(plan, null, 2)}\n`)
  assert.throws(() => signStage4To80AuthorizationPackage({
    root,
    planPath,
    planSha256: sha256File(path.join(root, planPath)),
    trustRegistryPath: fixture.registryPath,
    trustRegistrySha256: fixture.registrySha256,
    privateKeyPath: fixture.privateKeyPath,
    now: new Date(`2026-08-15T17:00:${String(negative).padStart(2, "0")}.000Z`),
  }), (error) => error?.code === code)
  negative += 1
}

function expectDelegatedCode(callback, code, label) {
  assert.throws(callback, (error) => error instanceof DelegatedAuthorizationPackageError && error.code === code)
  negative += 1
  assert.ok(label)
}

function expectCoreCode(callback, code, label) {
  assert.throws(callback, (error) => error?.code === code)
  negative += 1
  assert.ok(label)
}

function check(value, label) {
  assert.equal(Boolean(value), true, label)
  positive += 1
}

function listFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name)
    return entry.isDirectory() ? listFiles(absolute) : [absolute]
  })
}
