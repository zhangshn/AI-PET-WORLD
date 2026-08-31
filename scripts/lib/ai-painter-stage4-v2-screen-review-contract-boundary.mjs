import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import sharp from "sharp"

export const STAGE4_V2_REVIEW_ARCHITECTURE_ID =
  "stage4_full_resolution_typed_semantic_transport_rgb_responsibility_v2"

export const STAGE4_V2_REVIEW_REQUEST_SCHEMA =
  "ai-painter-stage4-v2-screen-review-request-v1"

export const STAGE4_V2_REVIEW_REQUIRED_OBJECT_MASK_ROLES = Object.freeze([
  "object_footprints",
  "object_tree",
  "object_rock",
  "object_vegetation",
])

const SHA256_PATTERN = /^[a-f0-9]{64}$/
const STAGE_DIMENSIONS = Object.freeze({
  stage0: Object.freeze({ width: 256, height: 192 }),
  stage1: Object.freeze({ width: 512, height: 384 }),
  stage2: Object.freeze({ width: 1024, height: 768 }),
})

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex")
}

function assertSafeExplicitProjectPath(projectRoot, relativePath, role) {
  assert.equal(typeof relativePath, "string", `${role}.path must be a string`)
  assert(relativePath.length > 0, `${role}.path must not be empty`)
  assert(!path.isAbsolute(relativePath), `${role}.path must be project-relative`)
  const normalized = relativePath.replace(/\\/g, "/")
  assert(
    !/(^|\/)latest(?:\.json)?(?:\/|$)/i.test(normalized),
    `${role}.path must not select a latest pointer`,
  )
  assert(
    !/(^|\/)(historical-runs?|history)(?:\/|$)/i.test(normalized),
    `${role}.path must not select a historical-run namespace`,
  )
  const absolutePath = path.resolve(projectRoot, relativePath)
  assert(
    absolutePath === projectRoot || absolutePath.startsWith(`${projectRoot}${path.sep}`),
    `${role}.path escapes the project root`,
  )
  return absolutePath
}

function validateArtifactBinding(
  artifact,
  {
    projectRoot,
    role,
    verifyFiles,
  },
) {
  assert.equal(typeof artifact, "object", `${role} binding is required`)
  assert.match(artifact.sha256, SHA256_PATTERN, `${role}.sha256 must be a lowercase SHA-256`)
  const absolutePath = assertSafeExplicitProjectPath(projectRoot, artifact.path, role)
  if (verifyFiles) {
    assert(fs.existsSync(absolutePath), `${role} file is missing`)
    assert(fs.statSync(absolutePath).isFile(), `${role} path is not a file`)
    assert.equal(sha256(fs.readFileSync(absolutePath)), artifact.sha256, `${role} file SHA-256 mismatch`)
  }
  return absolutePath
}

function assertTrustedArtifact(requestArtifact, trustedArtifact, role) {
  assert.equal(typeof trustedArtifact, "object", `trusted ${role} binding is required`)
  assert.equal(requestArtifact.path, trustedArtifact.path, `${role} path is not trusted`)
  assert.equal(requestArtifact.sha256, trustedArtifact.sha256, `${role} SHA-256 is not trusted`)
}

function readFormalThresholdContract(absolutePath, binding) {
  assert.equal(
    binding.path,
    "data/ai-painter/system-governance/ai-painter-stage4-v2-machine-review-threshold-contract-v1.json",
    "thresholdContract must bind the formal Stage4 V2 threshold contract path",
  )
  assert(fs.existsSync(absolutePath), "thresholdContract formal file is missing")
  assert(fs.statSync(absolutePath).isFile(), "thresholdContract formal path is not a file")
  assert.equal(
    sha256(fs.readFileSync(absolutePath)),
    binding.sha256,
    "thresholdContract formal file SHA-256 mismatch",
  )
  let contract
  try {
    contract = JSON.parse(fs.readFileSync(absolutePath, "utf8"))
  } catch (error) {
    assert.fail(`thresholdContract formal JSON is invalid: ${error.message}`)
  }
  assert.equal(contract.schemaVersion, "ai-painter-stage4-v2-machine-review-threshold-contract-v1")
  assert.equal(contract.contractId, "ai-painter-stage4-v2-machine-review-threshold-contract-v1")
  assert.equal(contract.status, "cpu_supported_inactive")
  assert.equal(contract.immutable, true)
  assert.equal(contract.architectureId, STAGE4_V2_REVIEW_ARCHITECTURE_ID)
  assert.equal(contract.formalReviewBoundary?.trustedAuthoritySource, "verified_immutable_current_execution_package_lineage")
  assert.equal(contract.formalReviewBoundary?.authoritativeLineageSchema, "ai-painter-stage4-v2-current-execution-package-lineage-v1")
  assert.equal(contract.formalReviewBoundary?.authoritativeLineageStatus, "verified_immutable_current_execution_package")
  assert.equal(contract.formalReviewBoundary?.authoritativeLineageOrigin, "current_execution_registry_committed_transaction")
  assert.equal(contract.formalReviewBoundary?.authoritativeRegistryTransactionSchema, "ai-painter-current-execution-registry-transaction-v1")
  assert.equal(contract.formalReviewBoundary?.authoritativeRegistryTransactionStatus, "committed")
  assert.equal(contract.formalReviewBoundary?.authoritativeCurrentRegistrySchema, "ai-painter-current-execution-registry-v1")
  assert.equal(contract.formalReviewBoundary?.authoritativeCurrentExecutionState, "package_materialized")
  assert.equal(contract.formalReviewBoundary?.authoritativeTaskCapsuleSchema, "ai-painter-local-task-capsule-v1")
  assert.equal(contract.formalReviewBoundary?.authoritativeSourceTerminalSchema, "stage4-v2-cpu-contract-acceptance-terminal-v1")
  assert.equal(contract.formalReviewBoundary?.authoritativeSourceTerminalStatus, "stage4_v2_cpu_contract_acceptance_passed_inactive")
  assert.equal(contract.formalReviewBoundary?.authoritativeSourceTerminalExecutionState, "completed")
  assert.equal(contract.formalReviewBoundary?.authoritativeLineageSelfAttestationSufficient, false)
  assert.equal(contract.reviewTrainingSeparation?.reviewResultsUsedAsTrainingTarget, false)
  assert.equal(contract.reviewTrainingSeparation?.thresholdLoweringAllowed, false)
  return contract
}

function parseBoundJson(absolutePath, role) {
  try {
    return JSON.parse(fs.readFileSync(absolutePath, "utf8"))
  } catch (error) {
    assert.fail(`${role} JSON is invalid: ${error.message}`)
  }
}

function validateLineageContents(lineage, registry, authorityContract, request, projectRoot, verifyFiles) {
  assert.equal(lineage.schemaVersion, authorityContract.authoritativeLineageSchema)
  assert.equal(lineage.authority, "local_ai_pet_world_program")
  assert.equal(lineage.status, authorityContract.authoritativeLineageStatus)
  assert.equal(lineage.origin, authorityContract.authoritativeLineageOrigin)
  assert.equal(Object.hasOwn(lineage, "selectedHistoricalRun"), false, "lineage may not select a historical run")
  assert.equal(Object.hasOwn(lineage, "latestPointer"), false, "lineage may not use a latest pointer")
  assert.equal(Object.hasOwn(lineage, "crossExecutionPackageEvidence"), false, "lineage may not self-attest cross-package evidence")
  assert.equal(registry.schemaVersion, authorityContract.authoritativeRegistryTransactionSchema)
  assert.equal(registry.status, authorityContract.authoritativeRegistryTransactionStatus)
  assert.match(registry.transactionId, /^[a-z0-9][a-z0-9._-]{7,191}$/u, "registry transaction identity is invalid")
  assert(Number.isInteger(registry.registryRevision) && registry.registryRevision > 0, "registry revision is invalid")
  assert(Number.isInteger(registry.eventSequence) && registry.eventSequence > 0, "registry event sequence is invalid")
  assert.match(registry.currentSha256, SHA256_PATTERN, "registry current SHA-256 is invalid")
  assert.deepEqual(lineage.registryTransaction, {
    transactionId: registry.transactionId,
    registryRevision: registry.registryRevision,
    eventSequence: registry.eventSequence,
    currentSha256: registry.currentSha256,
  }, "execution-package lineage does not bind the committed registry transaction")
  assert.equal(lineage.executionPackageIdentity, request.executionPackageIdentity)
  assert.equal(lineage.datasetReleaseIdentity, request.datasetReleaseIdentity)
  const currentStagedPath = validateArtifactBinding(registry.currentStaged, {
    projectRoot,
    role: "registry.currentStaged",
    verifyFiles,
  })
  assert.equal(registry.currentSha256, registry.currentStaged.sha256, "registry current SHA-256 must bind currentStaged")
  const currentStaged = verifyFiles
    ? parseBoundJson(currentStagedPath, "registry.currentStaged")
    : registry.fixtureCurrentStaged
  assert.equal(currentStaged?.schemaVersion, authorityContract.authoritativeCurrentRegistrySchema)
  assert.equal(currentStaged?.registryRevision, registry.registryRevision)
  assert.equal(currentStaged?.eventSequence, registry.eventSequence)
  assert.equal(currentStaged?.transactionId, registry.transactionId)
  assert.equal(currentStaged?.packageId, request.executionPackageIdentity)
  assert.equal(currentStaged?.capabilityVersion, request.architectureId)
  assert.equal(currentStaged?.executionState, authorityContract.authoritativeCurrentExecutionState)
  assert.equal(currentStaged?.activeExecution, null)
  assert.equal(typeof currentStaged?.taskId, "string")
  assert(currentStaged.taskId.length > 0, "current staged task identity is invalid")
  assert.equal(typeof currentStaged?.runId, "string")
  assert(currentStaged.runId.length > 0, "current staged run identity is invalid")
  assert.deepEqual(lineage.currentExecution, {
    taskId: currentStaged.taskId,
    runId: currentStaged.runId,
  }, "execution-package lineage does not bind the current task and run")
  assert.equal(lineage.sourceTerminal?.status, authorityContract.authoritativeSourceTerminalStatus)
  const sourceTerminalPath = validateArtifactBinding(lineage.sourceTerminal, {
    projectRoot,
    role: "lineage.sourceTerminal",
    verifyFiles,
  })
  if (verifyFiles) {
    const sourceTerminal = parseBoundJson(sourceTerminalPath, "lineage.sourceTerminal")
    assert.equal(sourceTerminal.schemaVersion, authorityContract.authoritativeSourceTerminalSchema)
    assert.equal(sourceTerminal.status, authorityContract.authoritativeSourceTerminalStatus)
    assert.equal(sourceTerminal.executionState, authorityContract.authoritativeSourceTerminalExecutionState)
    assert.equal(sourceTerminal.architectureId, request.architectureId)
    assert.equal(sourceTerminal.runId, currentStaged.runId)
  }
  assert.equal(currentStaged.terminalEvidence?.path, lineage.sourceTerminal.path)
  assert.equal(currentStaged.terminalEvidence?.sha256, lineage.sourceTerminal.sha256)
  const taskCapsulePath = validateArtifactBinding(currentStaged.taskCapsule, {
    projectRoot,
    role: "currentStaged.taskCapsule",
    verifyFiles,
  })
  const taskCapsule = verifyFiles
    ? parseBoundJson(taskCapsulePath, "currentStaged.taskCapsule")
    : registry.fixtureTaskCapsule
  assert.equal(taskCapsule?.schemaVersion, authorityContract.authoritativeTaskCapsuleSchema)
  assert.equal(taskCapsule?.runId, currentStaged.runId)
  assert.equal(taskCapsule?.architectureId, request.architectureId)
  assert.equal(taskCapsule?.latestTerminal?.path, lineage.sourceTerminal.path)
  assert.equal(taskCapsule?.latestTerminal?.sha256, lineage.sourceTerminal.sha256)
  assert.equal(taskCapsule?.nextAllowedAction?.taskId, currentStaged.taskId)
  const executionPackageRoot = assertSafeExplicitProjectPath(projectRoot, lineage.executionPackageRoot, "lineage.executionPackageRoot")
  assertTrustedArtifact(request.candidateRgb, lineage.candidateRgb, "candidateRgb")
  assertTrustedArtifact(request.conditionPack, lineage.conditionPack, "conditionPack")
  assertTrustedArtifact(request.referenceRgb, lineage.referenceRgb, "referenceRgb")
  assert.equal(lineage.objectMasks?.length, STAGE4_V2_REVIEW_REQUIRED_OBJECT_MASK_ROLES.length)
  assert.deepEqual(
    lineage.objectMasks.map((item) => item.role),
    STAGE4_V2_REVIEW_REQUIRED_OBJECT_MASK_ROLES,
    "authoritative lineage object mask roles or order changed",
  )
  for (let index = 0; index < lineage.objectMasks.length; index += 1) {
    assertTrustedArtifact(request.objectMasks[index], lineage.objectMasks[index], request.objectMasks[index].role)
  }
  assertTrustedArtifact(request.thresholdContract, lineage.thresholdContract, "thresholdContract")
  return executionPackageRoot
}

function validateAuthoritativeLineage(authority, authorityContract, request, projectRoot, verifyFiles) {
  assert.equal(typeof authority, "object", "trustedAuthority must bind immutable registry and execution-package records")
  const allowedKeys = verifyFiles
    ? ["registryRecord", "executionPackageRecord"]
    : ["registryRecord", "executionPackageRecord", "testOnlyFixture", "fixtureRegistry", "fixtureLineage"]
  assert.deepEqual(Object.keys(authority).sort(), allowedKeys.sort(), "trustedAuthority may not self-declare lineage identity")
  const registryPath = validateArtifactBinding(authority.registryRecord, { projectRoot, role: "trustedAuthority.registryRecord", verifyFiles })
  const packagePath = validateArtifactBinding(authority.executionPackageRecord, { projectRoot, role: "trustedAuthority.executionPackageRecord", verifyFiles })
  if (!verifyFiles) {
    assert.equal(authority.testOnlyFixture, true, "non-file lineage validation is test-only")
    return validateLineageContents(authority.fixtureLineage, authority.fixtureRegistry, authorityContract, request, projectRoot, false)
  }
  const registry = parseBoundJson(registryPath, "trustedAuthority.registryRecord")
  const lineage = parseBoundJson(packagePath, "trustedAuthority.executionPackageRecord")
  return validateLineageContents(lineage, registry, authorityContract, request, projectRoot, true)
}

function resolveFlowingWaterApplicability(conditionPack, thresholdContract) {
  const rule = thresholdContract.conditionAlignmentThresholds?.flowingWaterConnectivity
  assert.equal(typeof rule, "object", "formal threshold flowing-water applicability is missing")
  const subject = conditionPack.reviewSubject
  assert.equal(typeof subject, "object", "conditionPack.reviewSubject is required for boundary applicability")
  const expectedWaterPixels = subject.expectedWaterMaskNonzeroPixels
  assert(Number.isInteger(expectedWaterPixels) && expectedWaterPixels >= 0, "conditionPack expected water pixels is invalid")
  const applicable = subject.rebuild64SequenceSeriesId === rule.applicability.rebuild64SequenceSeriesId
    && rule.applicability.regionalLandscapeTypes.includes(subject.regionalLandscapeType)
    && expectedWaterPixels > rule.applicability.waterMaskPresence.value
  return Object.freeze({
    applicable,
    requiredBoundarySides: applicable ? [...rule.requiredBoundarySides] : [],
    requiredPorts: applicable ? [...rule.requiredPorts] : [],
  })
}

async function assertImageIdentity(absolutePath, artifact, role) {
  const metadata = await sharp(absolutePath, { failOn: "error" }).metadata()
  assert.equal(metadata.format, "png", `${role} must be a PNG`)
  assert.equal(metadata.width, artifact.width, `${role} width does not match the immutable file`)
  assert.equal(metadata.height, artifact.height, `${role} height does not match the immutable file`)
  assert.equal(metadata.channels >= 3, true, `${role} must contain RGB channels`)
  return { width: metadata.width, height: metadata.height, format: metadata.format }
}

function assertNoForbiddenSelector(value, location = "request") {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoForbiddenSelector(item, `${location}[${index}]`))
    return
  }
  if (!value || typeof value !== "object") return
  for (const [key, child] of Object.entries(value)) {
    assert(!/^latest(?:Path|Pointer|Record)?$/i.test(key), `${location}.${key} is a forbidden latest selector`)
    assert(!/^historicalRun(?:Id|Path|Selector)?$/i.test(key), `${location}.${key} is a forbidden historical-run selector`)
    assertNoForbiddenSelector(child, `${location}.${key}`)
  }
}

export async function validateStage4V2ScreenReviewRequest(
  request,
  {
    projectRoot = process.cwd(),
    verifyFiles = true,
    trustedAuthority,
  } = {},
) {
  const resolvedProjectRoot = path.resolve(projectRoot)
  assert.equal(request?.schemaVersion, STAGE4_V2_REVIEW_REQUEST_SCHEMA)
  assert.equal(request.status, "cpu_supported_inactive")
  assert.equal(request.architectureId, STAGE4_V2_REVIEW_ARCHITECTURE_ID)
  assert.match(
    request.executionPackageIdentity,
    /^[a-z0-9][a-z0-9._-]{15,191}$/,
    "executionPackageIdentity must be an explicit immutable package identity",
  )
  assertNoForbiddenSelector(request)

  assert.equal(request.bindingPolicy?.explicitArtifactsOnly, true)
  assert.equal(request.bindingPolicy?.latestPointerAllowed, false)
  assert.equal(request.bindingPolicy?.historicalRunSelectionAllowed, false)
  assert.equal(request.bindingPolicy?.crossExecutionPackageEvidenceAllowed, false)
  assert.equal(request.bindingPolicy?.thresholdOverrideAllowed, false)
  assert.equal(request.bindingPolicy?.reviewOutputMayBecomeTrainingTarget, false)
  assert.equal(request.bindingPolicy?.failedPixelFeedbackMayBecomeTrainingTarget, false)

  assert(Object.hasOwn(STAGE_DIMENSIONS, request.stage), "stage must be stage0, stage1, or stage2")
  const expectedDimensions = STAGE_DIMENSIONS[request.stage]
  const thresholdContractPath = validateArtifactBinding(request.thresholdContract, {
    projectRoot: resolvedProjectRoot,
    role: "thresholdContract",
    verifyFiles,
  })
  assert.equal(
    request.thresholdContract.schemaVersion,
    "ai-painter-stage4-v2-machine-review-threshold-contract-v1",
  )
  const thresholdContract = readFormalThresholdContract(thresholdContractPath, request.thresholdContract)
  const executionPackageRoot = validateAuthoritativeLineage(
    trustedAuthority,
    thresholdContract.formalReviewBoundary,
    request,
    resolvedProjectRoot,
    verifyFiles,
  )

  const candidatePath = validateArtifactBinding(request.candidateRgb, {
    projectRoot: resolvedProjectRoot,
    role: "candidateRgb",
    verifyFiles,
  })
  assert.equal(request.candidateRgb.executionPackageIdentity, request.executionPackageIdentity)
  assert(
    candidatePath.startsWith(`${executionPackageRoot}${path.sep}`),
    "candidateRgb is outside the trusted current execution-package namespace",
  )
  assert.equal(request.candidateRgb.role, "complete_rgb_candidate")
  assert.equal(request.candidateRgb.completeFrame, true)
  assert.equal(request.candidateRgb.width, expectedDimensions.width)
  assert.equal(request.candidateRgb.height, expectedDimensions.height)

  const conditionPackPath = validateArtifactBinding(request.conditionPack, {
    projectRoot: resolvedProjectRoot,
    role: "conditionPack",
    verifyFiles,
  })
  assert.equal(request.conditionPack.datasetReleaseIdentity, request.datasetReleaseIdentity)
  assert.equal(typeof request.conditionPack.conditionPackId, "string")
  assert(request.conditionPack.conditionPackId.length > 0)
  assert.equal(request.conditionPack.channelCount, 23)

  const referenceRgbPath = validateArtifactBinding(request.referenceRgb, {
    projectRoot: resolvedProjectRoot,
    role: "referenceRgb",
    verifyFiles,
  })
  assert.equal(request.referenceRgb.datasetReleaseIdentity, request.datasetReleaseIdentity)
  assert.equal(request.referenceRgb.role, "approved_reference_rgb")

  assert(Array.isArray(request.objectMasks), "objectMasks must be an array")
  assert.equal(request.objectMasks.length, STAGE4_V2_REVIEW_REQUIRED_OBJECT_MASK_ROLES.length)
  assert.deepEqual(
    request.objectMasks.map((item) => item.role),
    STAGE4_V2_REVIEW_REQUIRED_OBJECT_MASK_ROLES,
    "object mask roles or order changed",
  )
  const objectMaskPaths = request.objectMasks.map((artifact, index) => {
    const absolutePath = validateArtifactBinding(artifact, {
      projectRoot: resolvedProjectRoot,
      role: artifact.role,
      verifyFiles,
    })
    assert.equal(artifact.datasetReleaseIdentity, request.datasetReleaseIdentity)
    return absolutePath
  })

  let dimensions = { width: request.candidateRgb.width, height: request.candidateRgb.height }
  let flowingWaterConnectivity = Object.freeze({ applicable: false, requiredBoundarySides: [], requiredPorts: [] })
  if (verifyFiles) {
    const candidateMetadata = await assertImageIdentity(candidatePath, request.candidateRgb, "candidateRgb")
    const referenceMetadata = await assertImageIdentity(referenceRgbPath, request.referenceRgb, "referenceRgb")
    assert.equal(referenceMetadata.width, candidateMetadata.width, "referenceRgb width mismatch")
    assert.equal(referenceMetadata.height, candidateMetadata.height, "referenceRgb height mismatch")
    for (let index = 0; index < objectMaskPaths.length; index += 1) {
      const maskMetadata = await sharp(objectMaskPaths[index], { failOn: "error" }).metadata()
      assert.equal(maskMetadata.format, "png", `${request.objectMasks[index].role} must be a PNG`)
      assert.equal(maskMetadata.width, candidateMetadata.width, `${request.objectMasks[index].role} width mismatch`)
      assert.equal(maskMetadata.height, candidateMetadata.height, `${request.objectMasks[index].role} height mismatch`)
    }
    const conditionPack = JSON.parse(fs.readFileSync(conditionPackPath, "utf8"))
    assert.equal(conditionPack.conditionPackId, request.conditionPack.conditionPackId)
    assert.equal(conditionPack.channels?.length, 23)
    assert.deepEqual(conditionPack.canvas, {
      width: candidateMetadata.width,
      height: candidateMetadata.height,
    })
    flowingWaterConnectivity = resolveFlowingWaterApplicability(conditionPack, thresholdContract)
    dimensions = candidateMetadata
  }

  return {
    projectRoot: resolvedProjectRoot,
    executionPackageIdentity: request.executionPackageIdentity,
    stage: request.stage,
    dimensions,
    candidatePath,
    conditionPackPath,
    referenceRgbPath,
    objectMaskPaths,
    thresholdContractPath,
    flowingWaterConnectivity,
  }
}

export async function buildStage4V2ScreenReviewCompositionPlan(request, options = {}) {
  const validated = await validateStage4V2ScreenReviewRequest(request, options)
  return {
    schemaVersion: "ai-painter-stage4-v2-screen-review-composition-plan-v1",
    status: "formal_runner_pending_execution_package_materialization",
    dispatchable: false,
    architectureId: STAGE4_V2_REVIEW_ARCHITECTURE_ID,
    executionPackageIdentity: validated.executionPackageIdentity,
    stage: validated.stage,
    flowingWaterConnectivity: validated.flowingWaterConnectivity,
    immutableInputBindings: {
      candidateRgb: request.candidateRgb,
      conditionPack: request.conditionPack,
      referenceRgb: request.referenceRgb,
      objectMasks: request.objectMasks,
      thresholdContract: request.thresholdContract,
    },
    compositionBoundary: [
      {
        order: 1,
        responsibility: "condition_alignment",
        implementationRole: "algorithm_provenance_reference_not_dispatchable",
        requiredExplicitInputs: ["candidateRgb", "conditionPack", "referenceRgb", "objectMasks"],
      },
      {
        order: 2,
        responsibility: "professional_aesthetic",
        implementationRole: "algorithm_provenance_reference_not_dispatchable",
        requiredExplicitInputs: ["candidateRgb", "thresholdContract.styleFingerprint"],
      },
      {
        order: 3,
        responsibility: "screen_review_terminal",
        implementationRole: "pending_execution_package_materialization",
        requiredExplicitInputs: ["condition_alignment_result", "professional_aesthetic_result"],
      },
    ],
    forbiddenFeedback: {
      reviewOutputMayBecomeTrainingTarget: false,
      failedPixelFeedbackMayBecomeTrainingTarget: false,
      thresholdAdaptationDuringTraining: false,
    },
  }
}
