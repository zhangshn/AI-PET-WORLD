// A pre-training scope check, not a GPU permit or a formal Stage0 review.
import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { readBound } from "./ai-painter-stage4-mvp-v13-review-lineage.mjs"

export const V17_DRY_SCOPE_PATH =
  "data/ai-painter/system-governance/stage4-mvp-v17-dry-single-world-scope-v1.json"

const parse = bytes => JSON.parse(bytes.toString("utf8"))
const sameBinding = (actual, expected, name) =>
  assert.deepEqual(actual, expected, `${name} binding differs`)

export function verifyV17DryScopeFacts({ scope, release, membership, sourceIndex,
  task, blueprint, conditionPack, visualFactManifest }) {
  assert.equal(scope.schemaVersion, "stage4-mvp-v17-dry-single-world-scope-v1")
  assert.equal(scope.status, "frozen_scope_not_execution_authorization")
  assert.equal(scope.capabilityVersion, "stage4_mvp_native_rgb_structured_object_v17")
  assert.equal(scope.purpose, "one_preselected_dry_fact_natural_world_visual_slice_at_256x192")
  for (const field of ["formalStage0QualificationGranted", "stage4ProgressIncreaseGranted",
    "runtimePublicationGranted"])
    assert.equal(scope[field], false, `${field} must remain false`)
  assert.deepEqual(scope.dataset.splitCounts,
    { train: 48, validation: 8, challenge: 4, regression: 4 })
  assert.deepEqual(release.splitCounts, scope.dataset.splitCounts)
  assert.equal(release.sampleCount, 64)
  assert.equal(release.qualification?.dataQualifiedForTraining, true)
  sameBinding(release.splits.validation, scope.dataset.validationMembership, "validation")
  assert.equal(scope.dataset.originalRgbAndSplitBytesMayChange, false)
  assert.equal(membership.split, "validation")
  assert.equal(membership.sampleIds?.length, 8)
  const selected = scope.preselectedSubject
  assert.equal(selected.validationOrdinal, 0)
  assert.equal(membership.sampleIds[0], selected.sampleId,
    "preselected sample is not frozen validation ordinal zero")
  assert.equal(new Set(membership.sampleIds).size, 8)
  const row = sourceIndex.samples?.find(item => item.sampleId === selected.sampleId)
  assert.ok(row && row.split === "validation", "preselected source row missing")
  sameBinding(row.conditionPack, selected.conditionPack, "condition pack")
  assert.equal(row.grouping?.worldId, selected.worldId)
  assert.equal(task.worldId, selected.worldId)
  assert.equal(task.tick, selected.tick)
  assert.equal(task.sourceBindings?.trainingBlueprintPath,
    selected.worldFactBlueprint.path)
  assert.equal(task.sourceBindings?.naturalizedWorldFactsSha256, selected.factHash)
  assert.equal(task.sourceBindings?.visualFactManifestSha256,
    selected.visualFactManifestSha256)
  assert.equal(task.sourceBindings?.visualFactManifestPath,
    selected.visualFactManifestFile.path)
  assert.equal(visualFactManifest.worldId, selected.worldId)
  assert.equal(visualFactManifest.tick, selected.tick)
  assert.equal(visualFactManifest.manifestSha256,
    selected.visualFactManifestSha256)
  const { manifestSha256: _embeddedHash, ...visualContent } = visualFactManifest
  assert.equal(crypto.createHash("sha256").update(JSON.stringify(visualContent))
    .digest("hex"), selected.visualFactManifestSha256,
  "visual fact content SHA differs from task identity")
  assert.equal(blueprint.worldId, selected.worldId)
  assert.equal(blueprint.regionId, selected.regionId)
  assert.equal(blueprint.tick, selected.tick)
  assert.equal(blueprint.geometry?.hasWater, false,
    "preselected world facts have water; dry scope cannot execute")
  assert.equal(selected.worldFactHasWater, false)
  assert.equal(conditionPack.worldId, selected.worldId)
  assert.equal(conditionPack.tick, selected.tick)
  for (const [channel, countField] of [
    ["terrain_water", "conditionWaterPixelCount"],
    ["terrain_shoreline", "conditionShorelinePixelCount"],
  ]) {
    const entry = conditionPack.channels?.find(item => item.id === channel)
    assert.ok(entry && Number.isSafeInteger(entry.statistics?.nonZeroCount),
      `${channel} statistics missing`)
    assert.equal(selected[countField], 0)
    assert.equal(entry.statistics.nonZeroCount, 0,
      `${channel} is positive; dry scope cannot execute`)
  }
  assert.deepEqual(scope.reviewScope.candidateResolution, [256, 192])
  assert.equal(scope.reviewScope.candidateCountToReview, 1)
  assert.equal(scope.reviewScope.reviewMustUsePreselectedSubject, true)
  assert.equal(scope.reviewScope.waterAndShorelinePositiveCapability, "unverified_not_passed")
  assert.equal(scope.reviewScope.waterOrShorelinePresentInSubject,
    "fail_scope_preflight_before_gpu")
  assert.equal(scope.reviewScope.challengeOrRegressionContentReadAllowed, false)
  assert.equal(scope.reviewScope.reviewScoresAsTrainingTargetsAllowed, false)
  assert.equal(scope.reviewScope.reviewThresholdLoweringAllowed, false)
  assert.equal(scope.numericThresholdAdoption.inheritInactiveV2Activation, false)
  assert.equal(scope.numericThresholdAdoption.numericOverridesAllowed, false)
  return { status: "v17_dry_scope_facts_verified_not_execution_qualified",
    sampleId: selected.sampleId, worldId: selected.worldId,
    regionId: selected.regionId, factHash: selected.factHash,
    waterAndShorelinePositiveCapability: "unverified_not_passed" }
}

export function verifyV17DryScope({ projectRoot, scopeBinding }) {
  const root = fs.realpathSync(path.resolve(projectRoot))
  assert.equal(scopeBinding.path, V17_DRY_SCOPE_PATH)
  const scope = parse(readBound(root, scopeBinding))
  const release = parse(readBound(root, scope.dataset.manifest))
  const membership = parse(readBound(root, scope.dataset.validationMembership))
  const sourceIndex = parse(readBound(root, release.sourceIndex))
  const task = parse(readBound(root, scope.preselectedSubject.taskPackage))
  const blueprint = parse(readBound(root, scope.preselectedSubject.worldFactBlueprint))
  const conditionPack = parse(readBound(root, scope.preselectedSubject.conditionPack))
  const visualFactManifest = parse(readBound(root,
    scope.preselectedSubject.visualFactManifestFile))
  readBound(root, {
    path: task.sourceBindings.naturalizedWorldFactsPath,
    sha256: scope.preselectedSubject.factHash,
  })
  readBound(root, scope.numericThresholdAdoption)
  readBound(root, scope.minimumDetailGate)
  return verifyV17DryScopeFacts({ scope, release, membership, sourceIndex,
    task, blueprint, conditionPack, visualFactManifest })
}

/** Consume an already authenticated one-subject audit. No Stage0 or publish grant. */
export function decideV17DrySlice({ scope, scopeVerdict, candidate, audit }) {
  assert.equal(scopeVerdict?.status,
    "v17_dry_scope_facts_verified_not_execution_qualified")
  assert.equal(scopeVerdict.sampleId, scope.preselectedSubject.sampleId)
  assert.equal(scopeVerdict.worldId, scope.preselectedSubject.worldId)
  assert.equal(scopeVerdict.regionId, scope.preselectedSubject.regionId)
  assert.equal(scopeVerdict.factHash, scope.preselectedSubject.factHash)
  assert.equal(scopeVerdict.waterAndShorelinePositiveCapability,
    "unverified_not_passed")
  assert.equal(candidate?.sampleIndex, 0)
  assert.equal(candidate?.sampleId, scope.preselectedSubject.sampleId)
  assert.equal(candidate?.split, "validation")
  assert.deepEqual(candidate?.conditionPack, scope.preselectedSubject.conditionPack)
  assert.equal(candidate?.responsibilityEvidence?.worldId,
    scope.preselectedSubject.worldId)
  assert.equal(candidate?.responsibilityEvidence?.regionId,
    scope.preselectedSubject.regionId)
  assert.equal(candidate?.responsibilityEvidence?.factHash,
    scope.preselectedSubject.factHash)
  assert.equal(audit?.candidateCount, 1)
  assert.equal(audit?.reviews?.length, 1)
  assert.deepEqual(audit?.frozenThresholds, {
    path: scope.numericThresholdAdoption.path,
    sha256: scope.numericThresholdAdoption.sha256,
  })
  assert.deepEqual(audit?.frozenMinimumDetail, scope.minimumDetailGate)
  assert.equal(audit?.formalReviewDispatchable, false)
  assert.equal(audit?.formalQualificationGranted, false)
  const row = audit.reviews[0]
  assert.equal(row.sampleIndex, 0)
  assert.equal(row.sampleId, candidate.sampleId)
  assert.deepEqual(row.candidateRgb, candidate.candidateRgb)
  assert.deepEqual(row.conditionPack, candidate.conditionPack)
  assert.ok(Array.isArray(row.issueCodes), "review issue codes missing")
  const passed = row.semanticAndAestheticPassed === true
    && row.minimumDetailPassed === true
    && row.professionalAesthetic?.passed === true
    && row.conditionAlignment?.passed === true
    && row.minimumDetail?.passed === true
    && row.issueCodes.length === 0
  return {
    status: passed ? scope.reviewScope.outputStatusOnSuccess
      : scope.reviewScope.outputStatusOnFailure,
    sampleId: candidate.sampleId,
    candidateRgb: candidate.candidateRgb,
    issueCodes: row.issueCodes,
    waterAndShorelinePositiveCapability: "unverified_not_passed",
    formalStage0QualificationGranted: false,
    stage4ProgressIncreaseGranted: false,
    runtimePublicationGranted: false,
  }
}
