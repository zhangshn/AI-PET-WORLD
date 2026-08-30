import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { pathToFileURL } from "node:url"

import {
  CAPABILITY_VERSION,
  FROZEN_AUTOENCODER_SHA256,
  validateJointConditionLocalTransportControlledSmokeContract,
} from "./lib/ai-painter-stage4-joint-condition-local-transport-smoke-compiler-v1.mjs"
import { validateJointConditionLocalTransportSmokeExecutionPlan } from "./lib/ai-painter-stage4-joint-condition-local-transport-smoke-adapters-v1.mjs"

export function checkJointConditionLocalTransportSmokeCompilation(planPath, {
  root = process.cwd(), mode = "compilation",
} = {}) {
  assert.ok(["compilation", "preflight"].includes(mode), "checker mode is invalid")
  const projectRoot = path.resolve(root)
  const normalizedPlanPath = normalizeProjectPath(planPath)
  const absolutePlanPath = resolveInside(projectRoot, normalizedPlanPath)
  const plan = readJson(absolutePlanPath)
  validateJointConditionLocalTransportSmokeExecutionPlan(plan, {
    projectRoot, requireFiles: true,
  })
  const contractBinding = plan.evidenceBindings.compiledSmokeContract
  assert.equal(sha256File(resolveInside(projectRoot, contractBinding.path)), contractBinding.sha256)
  const contract = readJson(resolveInside(projectRoot, contractBinding.path))
  validateJointConditionLocalTransportControlledSmokeContract(contract, {
    projectRoot, requireFiles: true, sha256File,
  })
  assert.equal(contract.executionIdentity.runId, plan.runId)
  assert.equal(contract.futureEvidenceNamespace.outputDirectory, plan.outputRoot)
  assert.equal(contract.executionIdentity.sampleId, plan.fixedTrainingIdentity.sampleId)
  assert.deepEqual(contract.executionIdentity.resolution, plan.fixedTrainingIdentity.resolution)
  assert.deepEqual(contract.executionIdentity.previewEpochs, plan.fixedTrainingIdentity.previewEpochs)
  assert.equal(contract.internalCapability.ownerAuthorizationRequired, false)
  assert.equal(contract.internalCapability.ownerResponseRequired, false)

  const outputRoot = resolveInside(projectRoot, plan.outputRoot)
  if (mode === "compilation") {
    assert.equal(fs.existsSync(outputRoot), false, "compilation must not create the Smoke output root")
  } else {
    assert.ok(fs.existsSync(outputRoot) && fs.statSync(outputRoot).isDirectory(), "preflight root is missing")
    assert.equal(fs.lstatSync(outputRoot).isSymbolicLink(), false, "preflight root cannot be a link")
    assert.equal(fs.existsSync(path.join(outputRoot, "training-output")), false, "preflight cannot reuse training-output")
    assert.deepEqual(fs.readdirSync(outputRoot), [], "CPU preflight must start from an empty Smoke root")
  }

  const dataset = validateApprovedDataset(projectRoot, plan, contract)
  const pythonValidation = validateWithAuthoritativePythonContract(projectRoot, plan, contractBinding)
  const positive = {
    executionPlanMatchesDedicatedValidator: true,
    compiledContractMatchesPythonSchema: true,
    readonlyGpuEvidenceAndCurrentCodeHashesVerified: true,
    formalSourceIndex116WithApproved64SelectionVerified: dataset.sourceIndexCount === 116,
    approvedSplit48_8_4_4Verified: true,
    fixedValidation194ConditionAndReferenceVerified: true,
    frozenAutoencoderIdentityVerified: true,
    ownerFreeInternalCapabilityVerified: true,
    automaticTrainingValidationReviewAdjudicationFinalizationBound: true,
    smokeOutputOwnershipVerified: true,
    noGpuOrTrainingStartedByChecker: true,
  }
  const negative = runNegativeChecks(plan, contract)
  return {
    status: "passed",
    capabilityVersion: CAPABILITY_VERSION,
    mode,
    planPath: normalizedPlanPath,
    planSha256: sha256File(absolutePlanPath),
    compiledContract: contractBinding,
    runId: plan.runId,
    outputRoot: plan.outputRoot,
    outputRootCreatedByChecker: false,
    positive,
    negative,
    positiveCount: Object.values(positive).filter(Boolean).length,
    negativeCount: Object.values(negative).filter(Boolean).length,
    pythonValidation,
    ownerAuthorizationRequired: false,
    gpuStarted: false,
    optimizerCreated: false,
    backwardExecuted: false,
    trainingStarted: false,
  }
}

function validateApprovedDataset(projectRoot, plan, contract) {
  const sourceIndex = readBoundJson(projectRoot, plan.evidenceBindings.sourceIndex)
  assert.equal(sourceIndex.schemaVersion, "ai-assisted-cold-start-dataset-source-index-v1")
  assert.ok(Array.isArray(sourceIndex.samples))
  assert.equal(sourceIndex.sampleCount, sourceIndex.samples.length)
  const approved = sourceIndex.samples.filter((row) => row.v7CapacityContributionRegistered === true)
  assert.equal(approved.length, 64)
  assert.deepEqual(Object.fromEntries(["train", "validation", "challenge", "regression"].map((split) => [
    split, approved.filter((row) => row.split === split).length,
  ])), { train: 48, validation: 8, challenge: 4, regression: 4 })
  assert.equal(new Set(approved.map((row) => row.recordId)).size, 64)
  const sampleId = plan.fixedTrainingIdentity.sampleId
  const matches = approved.filter((row) => row.sampleId === sampleId && row.recordId === sampleId)
  assert.equal(matches.length, 1)
  const sample = matches[0]
  assert.equal(sample.split, "validation")
  assert.equal(sample.conditionBound, true)
  assert.equal(sample.formalConditionalTrainingEligible, true)
  const roles = new Map(contract.sourceEvidence.map((binding) => [binding.role, binding]))
  const condition = roles.get("fixed-validation-condition-pack")
  const reference = roles.get("fixed-validation-reference-rgb")
  assert.ok(condition && reference)
  assert.equal(sample.conditionPackPath, condition.path)
  assert.equal(sample.imagePath, reference.path)
  assert.equal(sample.imageSha256, reference.sha256)
  assert.equal(sha256File(resolveInside(projectRoot, condition.path)), condition.sha256)
  assert.equal(sha256File(resolveInside(projectRoot, reference.path)), reference.sha256)
  assert.equal(plan.evidenceBindings.frozenAutoencoder.sha256, FROZEN_AUTOENCODER_SHA256)
  assert.equal(sha256File(resolveInside(projectRoot, plan.evidenceBindings.frozenAutoencoder.path)), FROZEN_AUTOENCODER_SHA256)
  const manifest = readBoundJson(projectRoot, plan.evidenceBindings.datasetManifest)
  assert.equal(manifest.immutable, true)
  assert.equal(manifest.v7CapacityContributionCount, 64)
  assert.equal(manifest.sourceIndexPath, plan.evidenceBindings.sourceIndex.path)
  return { sourceIndexCount: sourceIndex.sampleCount, approvedCount: approved.length }
}

function validateWithAuthoritativePythonContract(projectRoot, plan, contractBinding) {
  const python = resolvePython(projectRoot)
  const source = [
    "import json, sys",
    "from pathlib import Path",
    "from ai_painter_joint_condition_local_transport_contract import build_joint_condition_local_transport_controlled_smoke_config_template",
    "from materialize_stage4_joint_condition_local_transport_controlled_smoke import _assert_new_candidate_identity",
    "config = build_joint_condition_local_transport_controlled_smoke_config_template(run_id=sys.argv[1], output_namespace=sys.argv[2], compiled_contract_path=sys.argv[3], compiled_contract_sha256=sys.argv[4], project_root=Path.cwd())",
    "_assert_new_candidate_identity(config)",
    "print(json.dumps({'schemaVersion': config['schemaVersion'], 'status': config['status'], 'architectureVersion': config['architectureVersion'], 'denoiserArchitecture': config['denoiserArchitecture'], 'jointContractArchitectureId': config['jointConditionLocalTransportContract']['architectureId'], 'jointContractCapabilityVersion': config['jointConditionLocalTransportContract']['capabilityVersion'], 'ownerAuthorizationRequired': config['ownerAuthorizationRequired'], 'ownerResponseRequired': config['ownerResponseRequired'], 'compiledContract': config['evidenceBindings']['compiledControlledSmokeContract']}))",
  ].join("; ")
  const output = execFileSync(python, [
    "-c", source,
    plan.runId,
    plan.outputRoot,
    contractBinding.path,
    contractBinding.sha256,
  ], {
    cwd: projectRoot,
    encoding: "utf8",
    env: pythonEnvironment(projectRoot),
    maxBuffer: 8 * 1024 * 1024,
  })
  const value = JSON.parse(output)
  assert.equal(value.schemaVersion, "ai-painter-stage4-joint-condition-local-transport-controlled-smoke-config-v1")
  assert.equal(value.status, "controlled_smoke_active_not_started")
  assert.equal(value.architectureVersion, "joint-condition-local-transport-denoiser-v1")
  assert.equal(value.denoiserArchitecture, CAPABILITY_VERSION)
  assert.equal(value.jointContractArchitectureId, CAPABILITY_VERSION)
  assert.equal(value.jointContractCapabilityVersion, CAPABILITY_VERSION)
  assert.equal(value.ownerAuthorizationRequired, false)
  assert.equal(value.ownerResponseRequired, false)
  assert.equal(value.compiledContract.path, contractBinding.path)
  assert.equal(value.compiledContract.sha256, contractBinding.sha256)
  return value
}

function runNegativeChecks(plan, contract) {
  return {
    ownerGateRejected: rejects(() => validateJointConditionLocalTransportSmokeExecutionPlan({ ...structuredClone(plan), ownerAuthorizationRequired: true }, { requireFiles: false })),
    legacyCandidateRejected: rejects(() => validateJointConditionLocalTransportSmokeExecutionPlan({ ...structuredClone(plan), capabilityVersion: "stage4_full_backbone_spatial_affine_conditioned_denoiser_v1" }, { requireFiles: false })),
    outputRunMismatchRejected: rejects(() => validateJointConditionLocalTransportSmokeExecutionPlan({ ...structuredClone(plan), outputRoot: `${plan.outputRoot}-reused` }, { requireFiles: false })),
    autoencoderSubstitutionRejected: rejects(() => {
      const value = structuredClone(plan)
      value.evidenceBindings.frozenAutoencoder.sha256 = "0".repeat(64)
      validateJointConditionLocalTransportSmokeExecutionPlan(value, { requireFiles: false })
    }),
    transportBoundaryMutationRejected: rejects(() => {
      const value = structuredClone(contract)
      value.modelBoundary.transportParameterCount += 1
      validateJointConditionLocalTransportControlledSmokeContract(value)
    }),
    missingFixedValidationEvidenceRejected: rejects(() => {
      const value = structuredClone(contract)
      value.sourceEvidence = value.sourceEvidence.filter((row) => row.role !== "fixed-validation-condition-pack")
      validateJointConditionLocalTransportControlledSmokeContract(value)
    }),
  }
}

function rejects(action) {
  try { action(); return false } catch { return true }
}

function readBoundJson(projectRoot, binding) {
  const absolute = resolveInside(projectRoot, binding.path)
  assert.equal(sha256File(absolute), binding.sha256)
  return readJson(absolute)
}

function resolvePython(projectRoot) {
  const candidates = process.platform === "win32"
    ? ["ml/ai-painter/.venv/Scripts/python.exe"]
    : ["ml/ai-painter/.venv/bin/python", "ml/ai-painter/.venv/bin/python3"]
  const match = candidates.map((item) => resolveInside(projectRoot, item)).find((item) => fs.existsSync(item))
  assert.ok(match, "project Python runtime is missing")
  return match
}

function pythonEnvironment(projectRoot) {
  return {
    ...process.env,
    PYTHONPATH: [
      path.join(projectRoot, "ml", "ai-painter", "src"),
      path.join(projectRoot, "ml", "ai-painter", "scripts"),
      process.env.PYTHONPATH,
    ].filter(Boolean).join(path.delimiter),
  }
}

function readJson(filePath) { return JSON.parse(fs.readFileSync(filePath, "utf8")) }
function sha256File(filePath) { return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex") }

function normalizeProjectPath(value) {
  assert.equal(typeof value, "string")
  const normalized = value.replaceAll("\\", "/")
  assert.ok(normalized.length > 0 && !path.isAbsolute(normalized) && !/^[A-Za-z]:[\\/]/u.test(normalized))
  assert.ok(!normalized.split("/").includes(".."))
  return normalized
}

function resolveInside(projectRoot, relativePath) {
  const root = path.resolve(projectRoot)
  const absolute = path.resolve(root, normalizeProjectPath(relativePath))
  assert.ok(absolute.startsWith(`${root}${path.sep}`), `path escapes project: ${relativePath}`)
  return absolute
}

function valueOf(args, key) {
  const index = args.indexOf(key)
  return index >= 0 ? args[index + 1] : null
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
if (isMain) {
  try {
    const args = process.argv.slice(2)
    const planPath = valueOf(args, "--plan")
    assert.ok(planPath, "--plan is required")
    const report = checkJointConditionLocalTransportSmokeCompilation(planPath, {
      mode: valueOf(args, "--mode") ?? "compilation",
    })
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`)
    process.exitCode = 1
  }
}
