import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import test from "node:test"
import { readBound } from "../lib/ai-painter-stage4-mvp-v13-review-lineage.mjs"
import { V17_DRY_SCOPE_PATH, decideV17DrySlice, verifyV17DryScope,
  verifyV17DryScopeFacts } from "../lib/ai-painter-stage4-mvp-v17-dry-scope.mjs"

const root = process.cwd()
const bytes = fs.readFileSync(V17_DRY_SCOPE_PATH)
const scopeBinding = { path: V17_DRY_SCOPE_PATH,
  sha256: crypto.createHash("sha256").update(bytes).digest("hex") }
const json = binding => JSON.parse(readBound(root, binding).toString("utf8"))
const scope = JSON.parse(bytes.toString("utf8"))
const release = json(scope.dataset.manifest)
const facts = {
  scope, release,
  membership: json(scope.dataset.validationMembership),
  sourceIndex: json(release.sourceIndex),
  task: json(scope.preselectedSubject.taskPackage),
  blueprint: json(scope.preselectedSubject.worldFactBlueprint),
  conditionPack: json(scope.preselectedSubject.conditionPack),
  visualFactManifest: json(scope.preselectedSubject.visualFactManifestFile),
}
const changed = mutator => {
  const copy = structuredClone(facts)
  mutator(copy)
  return copy
}

test("the real frozen dry subject passes pre-training scope checks only", () => {
  const result = verifyV17DryScope({ projectRoot: root, scopeBinding })
  assert.equal(result.status, "v17_dry_scope_facts_verified_not_execution_qualified")
  assert.equal(result.waterAndShorelinePositiveCapability, "unverified_not_passed")
})

test("a positive water or shoreline condition fails before GPU", () => {
  for (const channel of ["terrain_water", "terrain_shoreline"]) {
    const copy = changed(input => {
      input.conditionPack.channels.find(row => row.id === channel).statistics.nonZeroCount = 1
    })
    assert.throws(() => verifyV17DryScopeFacts(copy), /is positive/)
  }
})

test("a positive water world fact cannot be renamed dry", () => {
  assert.throws(() => verifyV17DryScopeFacts(changed(input => {
    input.blueprint.geometry.hasWater = true
  })), /world facts have water/)
})

test("the fixed first validation sample cannot be swapped or reordered", () => {
  assert.throws(() => verifyV17DryScopeFacts(changed(input => {
    input.membership.sampleIds.reverse()
  })), /preselected sample/)
  assert.throws(() => verifyV17DryScopeFacts(changed(input => {
    input.scope.preselectedSubject.sampleId = "another-sample"
  })), /preselected sample/)
})

test("scope cannot claim formal Stage0, Stage4, or Runtime publication", () => {
  for (const field of ["formalStage0QualificationGranted", "stage4ProgressIncreaseGranted",
    "runtimePublicationGranted"]) {
    assert.throws(() => verifyV17DryScopeFacts(changed(input => {
      input.scope[field] = true
    })), /must remain false/)
  }
})

test("task and condition identities must equal the frozen world", () => {
  assert.throws(() => verifyV17DryScopeFacts(changed(input => {
    input.task.sourceBindings.naturalizedWorldFactsSha256 = "0".repeat(64)
  })), /Expected values to be strictly equal/)
  assert.throws(() => verifyV17DryScopeFacts(changed(input => {
    input.conditionPack.worldId = "another-world"
  })), /Expected values to be strictly equal/)
})

test("visual fact content hash is recomputed, not confused with file hash", () => {
  assert.throws(() => verifyV17DryScopeFacts(changed(input => {
    input.visualFactManifest.visualFacts[0] = { altered: true }
  })), /visual fact content SHA differs/)
})

test("scope may not turn this one scene into water capability or lower thresholds", () => {
  assert.throws(() => verifyV17DryScopeFacts(changed(input => {
    input.scope.reviewScope.waterAndShorelinePositiveCapability = "passed"
  })), /Expected values to be strictly equal/)
  assert.throws(() => verifyV17DryScopeFacts(changed(input => {
    input.scope.reviewScope.reviewThresholdLoweringAllowed = true
  })), /Expected values to be strictly equal/)
})

function oneReview() {
  const candidate = {
    sampleIndex: 0, sampleId: scope.preselectedSubject.sampleId,
    split: "validation", conditionPack: scope.preselectedSubject.conditionPack,
    candidateRgb: { path: "one.png", sha256: "a".repeat(64) },
    responsibilityEvidence: {
      worldId: scope.preselectedSubject.worldId,
      regionId: scope.preselectedSubject.regionId,
      factHash: scope.preselectedSubject.factHash,
    },
  }
  const audit = {
    candidateCount: 1, reviews: [{ sampleIndex: 0,
      sampleId: candidate.sampleId, candidateRgb: candidate.candidateRgb,
      conditionPack: candidate.conditionPack,
      semanticAndAestheticPassed: true, minimumDetailPassed: true,
      professionalAesthetic: { passed: true },
      conditionAlignment: { passed: true },
      minimumDetail: { passed: true }, issueCodes: [] }],
    frozenThresholds: { path: scope.numericThresholdAdoption.path,
      sha256: scope.numericThresholdAdoption.sha256 },
    frozenMinimumDetail: scope.minimumDetailGate,
    formalReviewDispatchable: false, formalQualificationGranted: false,
  }
  const scopeVerdict = verifyV17DryScope({ projectRoot: root, scopeBinding })
  return { scope, scopeVerdict, candidate, audit }
}

test("one passing dry review remains outside formal Stage0 and Stage4", () => {
  const result = decideV17DrySlice(oneReview())
  assert.equal(result.status, scope.reviewScope.outputStatusOnSuccess)
  assert.equal(result.formalStage0QualificationGranted, false)
  assert.equal(result.stage4ProgressIncreaseGranted, false)
})

test("a failed semantic item fails closed, never becomes a dry qualification", () => {
  const input = oneReview()
  input.audit.reviews[0].conditionAlignment.passed = false
  input.audit.reviews[0].issueCodes = ["condition_object_tree_rgb_mismatch"]
  assert.equal(decideV17DrySlice(input).status, scope.reviewScope.outputStatusOnFailure)
})

test("a forged subject or asserted formal qualification is rejected", () => {
  const input = oneReview()
  input.candidate.sampleId = "another-world"
  assert.throws(() => decideV17DrySlice(input))
  const second = oneReview()
  second.audit.formalQualificationGranted = true
  assert.throws(() => decideV17DrySlice(second))
})
