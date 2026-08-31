import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(SCRIPT_DIR, "..")
const CONTRACT_PATH = "data/ai-painter/system-governance/ai-painter-stage4-v2-mvp64-dataset-release-v1.json"
const CONTRACT_SHA256 = "cd6b7e3fe70549788159237a86f1ab7144ee39db6cc011abaac43b6e5e15affc"
const CONDITION_CONTRACT_PATH = "data/ai-painter/system-governance/ai-painter-complete-map-condition-contract-v1.json"
const CONDITION_CONTRACT_SHA256 = "c8941c7730edb73c0b0a733bc877cf550184e2f3ab2adb08102fb0214d38cac2"
const SOURCE_MANIFEST_PATH = "data/world-samples/ai-assisted-cold-start-dataset-packages/natural-home-ai-assisted-cold-start-mvp-natural-home-v0.3-2026-08-02T01-38-05-149Z/manifest.json"
const SOURCE_INDEX_PATH = "data/world-samples/ai-assisted-cold-start-dataset-packages/natural-home-ai-assisted-cold-start-mvp-natural-home-v0.3-2026-08-02T01-38-05-149Z/source-index.json"
const SOURCE_PACKAGE_ID = "natural-home-ai-assisted-cold-start-mvp-natural-home-v0.3-2026-08-02T01-38-05-149Z"
const SOURCE_MANIFEST_SHA256 = "8001f5a27bb8bc18883184b0c7e39ef1336eb295ce5787618bf4e60059dd48aa"
const SOURCE_INDEX_SHA256 = "84f1d4c810e9023f3517f9fd6567dfc2414a0eb95a0a56df45a3025344e12251"
const EXPECTED_SPLITS = Object.freeze({ train: 48, validation: 8, challenge: 4, regression: 4 })
const RELEASE_SAMPLE_KEYS = Object.freeze([
  "ordinal",
  "sourceSampleIndex",
  "sourceContributionIndex",
  "sampleId",
  "capacitySlotId",
  "split",
  "image",
  "conditionPack",
  "contribution",
])

function sha256Bytes(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex")
}

function sha256File(relativePath) {
  return sha256Bytes(fs.readFileSync(resolveProjectFile(relativePath)))
}

function sha256Json(value) {
  return sha256Bytes(Buffer.from(JSON.stringify(value), "utf8"))
}

function resolveProjectFile(relativePath) {
  assert.equal(typeof relativePath, "string", "artifact path must be a string")
  assert(relativePath.length > 0, "artifact path must not be empty")
  assert(!path.isAbsolute(relativePath), `absolute artifact path is forbidden: ${relativePath}`)
  assert(!/(^|[\\/])latest(?:\.json)?$/i.test(relativePath), `latest pointer is forbidden: ${relativePath}`)
  const resolved = path.resolve(ROOT, relativePath)
  assert(
    resolved === ROOT || resolved.startsWith(`${ROOT}${path.sep}`),
    `artifact path escapes the project root: ${relativePath}`,
  )
  assert(fs.existsSync(resolved), `artifact does not exist: ${relativePath}`)
  assert(fs.statSync(resolved).isFile(), `artifact is not a file: ${relativePath}`)
  return resolved
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(resolveProjectFile(relativePath), "utf8"))
}

function assertNoLegacyHumanAuthorityFields(value, location = "contract") {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoLegacyHumanAuthorityFields(item, `${location}[${index}]`))
    return
  }
  if (!value || typeof value !== "object") return
  for (const [key, child] of Object.entries(value)) {
    assert(
      !/(owner|authorization|approval|signature)/i.test(key),
      `legacy human authority field is forbidden in the current release: ${location}.${key}`,
    )
    assertNoLegacyHumanAuthorityFields(child, `${location}.${key}`)
  }
}

function assertUnique(values, role) {
  assert.equal(new Set(values).size, values.length, `${role} must be unique`)
}

function assertExactKeys(value, keys, role) {
  assert.deepEqual(Object.keys(value), keys, `${role} keys changed`)
}

function buildExpectedReleaseRows(sourceIndex, verifyReferencedFiles) {
  assert.equal(sourceIndex.schemaVersion, "ai-assisted-cold-start-dataset-source-index-v1")
  assert.equal(sourceIndex.sampleCount, 116)
  assert(Array.isArray(sourceIndex.samples), "source-index samples must be an array")
  assert.equal(sourceIndex.samples.length, 116)
  assert(Array.isArray(sourceIndex.v7CapacityContributions), "source-index v7CapacityContributions must be an array")
  assert.equal(sourceIndex.v7CapacityContributionCount, 64)
  assert.equal(sourceIndex.v7CapacityContributions.length, 64)

  assertUnique(sourceIndex.samples.map((sample) => sample.sampleId), "source-index sampleId")
  assertUnique(sourceIndex.v7CapacityContributions.map((item) => item.sampleId), "capacity contribution sampleId")
  assertUnique(sourceIndex.v7CapacityContributions.map((item) => item.capacitySlotId), "capacity slot")

  const sourceSamplesById = new Map(
    sourceIndex.samples.map((sample, sourceSampleIndex) => [sample.sampleId, { sample, sourceSampleIndex }]),
  )

  const conditionContract = readJson(CONDITION_CONTRACT_PATH)
  const expectedChannelOrder = conditionContract.tensorContract.channelOrder
  const channelDefinitions = new Map(
    conditionContract.channelDefinitions.map((definition) => [definition.id, definition]),
  )
  const verifiedFileCounts = { image: 0, conditionPack: 0, conditionChannel: 0, contribution: 0 }
  const rows = sourceIndex.v7CapacityContributions.map((capacityContribution, sourceContributionIndex) => {
    const match = sourceSamplesById.get(capacityContribution.sampleId)
    assert(match, `capacity contribution has no matching source sample: ${capacityContribution.sampleId}`)
    const { sample, sourceSampleIndex } = match

    assert.equal(sample.split, capacityContribution.split, `split mismatch for ${sample.sampleId}`)
    assert.equal(sample.imageSha256, capacityContribution.imageSha256, `image identity mismatch for ${sample.sampleId}`)
    assert.equal(sample.conditionPackPath, capacityContribution.conditionPackPath, `condition pack path mismatch for ${sample.sampleId}`)
    assert.equal(sample.v7CapacitySlotId, capacityContribution.capacitySlotId, `capacity slot mismatch for ${sample.sampleId}`)
    assert.equal(sample.v7CapacityContributionPath, capacityContribution.contributionPath, `contribution path mismatch for ${sample.sampleId}`)
    assert.equal(sample.v7CapacityContributionSha256, capacityContribution.contributionSha256, `contribution identity mismatch for ${sample.sampleId}`)
    assert.equal(sample.v7CapacityContributionRegistered, true, `capacity contribution is not registered for ${sample.sampleId}`)

    const actualContributionSha256 = sha256File(capacityContribution.contributionPath)
    assert.equal(
      actualContributionSha256,
      capacityContribution.contributionSha256,
      `contribution bytes changed for ${sample.sampleId}`,
    )
    const contributionEvidence = readJson(capacityContribution.contributionPath)
    assert.equal(contributionEvidence.schemaVersion, "ai-assisted-v7-capacity-contribution-v1")
    assert.equal(contributionEvidence.status, "registered")
    assert.equal(contributionEvidence.recordId, sample.sampleId)
    assert.equal(contributionEvidence.capacitySlotId, capacityContribution.capacitySlotId)
    assert.equal(contributionEvidence.split, capacityContribution.split)
    assert.equal(contributionEvidence.imageSha256, sample.imageSha256)
    assert.equal(contributionEvidence.conditionPackPath, sample.conditionPackPath)
    assert.equal(contributionEvidence.conditionChannelCount, 23)

    const conditionPack = readJson(sample.conditionPackPath)
    assert.equal(conditionPack.schemaVersion, "complete-world-visual-condition-pack-v1")
    assert(Array.isArray(conditionPack.channels), `condition channels missing for ${sample.sampleId}`)
    assert.equal(conditionPack.channels.length, expectedChannelOrder.length)
    assert.deepEqual(
      conditionPack.channels.map((channel) => channel.id),
      expectedChannelOrder,
      `condition channel order mismatch for ${sample.sampleId}`,
    )
    const packDirectory = path.posix.dirname(sample.conditionPackPath.replaceAll("\\", "/"))
    conditionPack.channels.forEach((channel, index) => {
      const expectedId = expectedChannelOrder[index]
      const definition = channelDefinitions.get(expectedId)
      assert(definition, `condition definition missing for ${expectedId}`)
      assert.equal(channel.id, expectedId)
      assert.equal(channel.dtype, conditionContract.tensorContract.storage.dtype)
      assert.deepEqual(channel.valueRange, conditionContract.tensorContract.storage.valueRangeInclusive)
      assert.deepEqual(channel.shape, conditionContract.tensorContract.storage.nativeShape)
      assert.equal(
        channel.kind,
        definition.type === "continuous"
          ? "continuous_map"
          : expectedId === "object_instance" ? "instance_map" : "binary_mask",
        `condition kind mismatch for ${sample.sampleId}/${expectedId}`,
      )
      const normalizedChannelPath = channel.path.replaceAll("\\", "/")
      assert.equal(
        normalizedChannelPath,
        `${packDirectory}/channels/${expectedId}.png`,
        `condition channel path mismatch for ${sample.sampleId}/${expectedId}`,
      )
      assert.match(channel.sha256, /^[a-f0-9]{64}$/u)
      if (verifyReferencedFiles) {
        assert.equal(
          sha256File(normalizedChannelPath),
          channel.sha256,
          `condition channel bytes changed for ${sample.sampleId}/${expectedId}`,
        )
        verifiedFileCounts.conditionChannel += 1
      }
    })

    if (verifyReferencedFiles) {
      assert.equal(sha256File(sample.imagePath), sample.imageSha256, `image bytes changed for ${sample.sampleId}`)
      assert.equal(
        sha256File(sample.conditionPackPath),
        contributionEvidence.conditionPackFileSha256,
        `condition pack bytes changed for ${sample.sampleId}`,
      )
      verifiedFileCounts.image += 1
      verifiedFileCounts.conditionPack += 1
      verifiedFileCounts.contribution += 1
    }

    return {
      ordinal: sourceContributionIndex + 1,
      sourceSampleIndex,
      sourceContributionIndex,
      sampleId: sample.sampleId,
      capacitySlotId: capacityContribution.capacitySlotId,
      split: capacityContribution.split,
      image: {
        path: sample.imagePath,
        sha256: sample.imageSha256,
      },
      conditionPack: {
        path: sample.conditionPackPath,
        sha256: contributionEvidence.conditionPackFileSha256,
      },
      contribution: {
        path: capacityContribution.contributionPath,
        sha256: capacityContribution.contributionSha256,
      },
    }
  })

  return { rows, verifiedFileCounts }
}

function validateContract(contract, { verifyReferencedFiles = true } = {}) {
  assertNoLegacyHumanAuthorityFields(contract)
  assert.equal(contract.schemaVersion, "ai-painter-stage4-v2-dataset-release-contract-v1")
  assert.equal(contract.status, "verified_dataset_release")
  assert.equal(contract.immutable, true)
  assert.equal(contract.createdBy, "local_ai_dataset_release_compiler")

  assert.equal(contract.conditionContractBinding.conditionContractIdentity, "ai-painter-complete-map-23-channel-condition-v1")
  assert.equal(contract.conditionContractBinding.path, CONDITION_CONTRACT_PATH)
  assert.equal(contract.conditionContractBinding.sha256, CONDITION_CONTRACT_SHA256)
  assert.equal(sha256File(CONDITION_CONTRACT_PATH), CONDITION_CONTRACT_SHA256)
  assert.equal(contract.conditionContractBinding.sourcePackCompatibilityMode, "immutable_source_pack_wrapped_by_dataset_release_v1")
  assert.equal(contract.conditionContractBinding.sourcePacksPredateEmbeddedContractIdentity, true)
  assert.equal(contract.conditionContractBinding.sourcePackSelfDeclaredCurrentIdentityTrusted, false)
  assert.equal(contract.conditionContractBinding.exactChannelOrderTypeStorageAndBytesRequired, true)
  assert.equal(contract.conditionContractBinding.compatibilityEstablishedByReleaseChecker, true)
  assert.equal(contract.conditionContractBinding.useOutsideThisDatasetReleaseAllowed, false)

  assert.equal(contract.sourcePackage.packageId, SOURCE_PACKAGE_ID)
  assert.equal(contract.sourcePackage.packageSampleCount, 116)
  assert.equal(contract.sourcePackage.manifest.path, SOURCE_MANIFEST_PATH)
  assert.equal(contract.sourcePackage.manifest.sha256, SOURCE_MANIFEST_SHA256)
  assert.equal(contract.sourcePackage.sourceIndex.path, SOURCE_INDEX_PATH)
  assert.equal(contract.sourcePackage.sourceIndex.sha256, SOURCE_INDEX_SHA256)
  assert.equal(contract.sourcePackage.sourceIndex.schemaVersion, "ai-assisted-cold-start-dataset-source-index-v1")
  assert.equal(contract.sourcePackage.sourceIndex.sampleCount, 116)

  assert.equal(sha256File(SOURCE_MANIFEST_PATH), SOURCE_MANIFEST_SHA256, "source manifest bytes changed")
  assert.equal(sha256File(SOURCE_INDEX_PATH), SOURCE_INDEX_SHA256, "source-index bytes changed")
  const sourceManifest = readJson(SOURCE_MANIFEST_PATH)
  const sourceIndex = readJson(SOURCE_INDEX_PATH)
  assert.equal(sourceManifest.schemaVersion, "ai-assisted-cold-start-dataset-package-v1")
  assert.equal(sourceManifest.packageId, SOURCE_PACKAGE_ID)
  assert.equal(sourceManifest.sampleCount, 116)
  assert.equal(sourceManifest.v7CapacityContributionCount, 64)
  assert.equal(sourceManifest.sourceIndexPath, SOURCE_INDEX_PATH)

  assert.equal(contract.selectionContract.selector, "source_index_v7CapacityContributions_exact_membership_v1")
  assert.equal(contract.selectionContract.sourceCollection, "v7CapacityContributions")
  assert.equal(contract.selectionContract.matchCollection, "samples")
  assert.equal(contract.selectionContract.matchKey, "sampleId")
  assert.equal(contract.selectionContract.order, "v7CapacityContributions_array_order")
  assert.equal(contract.selectionContract.exactContributionCount, 64)
  assert.deepEqual(contract.selectionContract.exactSplitCounts, EXPECTED_SPLITS)
  assert(contract.selectionContract.disallowedQualificationSources.includes("latest_pointer_or_directory_recency"))
  assert(contract.selectionContract.disallowedQualificationSources.includes("legacy_human_authorization_or_review_fields"))

  assert(Array.isArray(contract.samples), "release samples must be an array")
  assert.equal(contract.samples.length, 64)
  assertUnique(contract.samples.map((sample) => sample.sampleId), "released sampleId")
  assertUnique(contract.samples.map((sample) => sample.capacitySlotId), "released capacitySlotId")
  assertUnique(contract.samples.map((sample) => sample.image.path), "released image path")
  assertUnique(contract.samples.map((sample) => sample.image.sha256), "released image SHA-256")
  assertUnique(contract.samples.map((sample) => sample.conditionPack.path), "released condition pack path")
  assertUnique(contract.samples.map((sample) => sample.conditionPack.sha256), "released condition pack SHA-256")
  assertUnique(contract.samples.map((sample) => sample.contribution.path), "released contribution path")
  assertUnique(contract.samples.map((sample) => sample.contribution.sha256), "released contribution SHA-256")
  contract.samples.forEach((sample, index) => {
    assertExactKeys(sample, RELEASE_SAMPLE_KEYS, `release sample ${index + 1}`)
    assertExactKeys(sample.image, ["path", "sha256"], `release sample ${index + 1} image`)
    assertExactKeys(sample.conditionPack, ["path", "sha256"], `release sample ${index + 1} conditionPack`)
    assertExactKeys(sample.contribution, ["path", "sha256"], `release sample ${index + 1} contribution`)
    resolveProjectFile(sample.image.path)
    resolveProjectFile(sample.conditionPack.path)
    resolveProjectFile(sample.contribution.path)
  })

  const { rows: expectedRows, verifiedFileCounts } = buildExpectedReleaseRows(sourceIndex, verifyReferencedFiles)
  assert.deepEqual(contract.samples, expectedRows, "released rows differ from the exact v7CapacityContributions selection")

  const splitCounts = Object.fromEntries(
    Object.keys(EXPECTED_SPLITS).map((split) => [split, contract.samples.filter((sample) => sample.split === split).length]),
  )
  assert.deepEqual(splitCounts, EXPECTED_SPLITS)
  assert.deepEqual(contract.releaseScope.splitCounts, EXPECTED_SPLITS)
  assert.equal(contract.releaseScope.sourcePackageSampleCount, 116)
  assert.equal(contract.releaseScope.releasedSampleCount, 64)
  assert.equal(contract.releaseScope.permittedPurpose, "stage4_v2_training_input_identity_only")

  const selectedSamplesSha256 = sha256Json(contract.samples)
  assert.equal(contract.canonicalization.selectedSamplesSha256, selectedSamplesSha256)
  const releasePayload = {
    sourceManifestSha256: SOURCE_MANIFEST_SHA256,
    sourceIndexSha256: SOURCE_INDEX_SHA256,
    conditionContractSha256: CONDITION_CONTRACT_SHA256,
    selectedSamplesSha256,
    splitCounts,
  }
  const datasetReleasePayloadSha256 = sha256Json(releasePayload)
  assert.equal(contract.canonicalization.datasetReleasePayloadSha256, datasetReleasePayloadSha256)
  assert.equal(
    contract.datasetReleaseIdentity,
    `ai-painter-stage4-v2-mvp64-${datasetReleasePayloadSha256}`,
    "dataset release identity does not bind the verified release payload",
  )

  assert.deepEqual(contract.releaseSemantics, {
    datasetIdentityAndSplitVerified: true,
    modelQualified: false,
    gpuQualified: false,
    trainingCompleted: false,
    checkpointQualified: false,
    capabilityReleased: false,
    runtimeEligible: false,
    worldEntryEligible: false,
  })

  return {
    datasetReleaseIdentity: contract.datasetReleaseIdentity,
    sourcePackageSampleCount: sourceIndex.samples.length,
    releasedSampleCount: contract.samples.length,
    splitCounts,
    verifiedFileCounts,
    selectedSamplesSha256,
    datasetReleasePayloadSha256,
  }
}

function expectRejected(name, mutate) {
  const candidate = structuredClone(CONTRACT)
  mutate(candidate)
  assert.throws(() => validateContract(candidate, { verifyReferencedFiles: false }), undefined, `${name} must be rejected`)
  return name
}

assert.equal(sha256File(CONTRACT_PATH), CONTRACT_SHA256, "immutable dataset release contract bytes changed")
const CONTRACT = readJson(CONTRACT_PATH)
const result = validateContract(CONTRACT)
const negativeChecks = [
  expectRejected("missing_selected_sample", (candidate) => candidate.samples.pop()),
  expectRejected("duplicate_selected_sample", (candidate) => { candidate.samples[1] = structuredClone(candidate.samples[0]) }),
  expectRejected("split_mutation", (candidate) => { candidate.samples[0].split = "validation" }),
  expectRejected("cross_source_image_injection", (candidate) => {
    candidate.samples[0].image = structuredClone(candidate.samples[1].image)
  }),
  expectRejected("latest_pointer_selection", (candidate) => {
    candidate.sourcePackage.sourceIndex.path = "data/world-samples/ai-assisted-cold-start-dataset-packages/latest.json"
  }),
  expectRejected("legacy_human_authority_field", (candidate) => {
    candidate.samples[0].ownerReviewStatus = "approved"
  }),
  expectRejected("source_index_hash_mutation", (candidate) => {
    candidate.sourcePackage.sourceIndex.sha256 = "0".repeat(64)
  }),
  expectRejected("condition_contract_substitution", (candidate) => {
    candidate.conditionContractBinding.sha256 = "0".repeat(64)
  }),
  expectRejected("source_pack_self_identity_trust", (candidate) => {
    candidate.conditionContractBinding.sourcePackSelfDeclaredCurrentIdentityTrusted = true
  }),
  expectRejected("model_qualification_escalation", (candidate) => {
    candidate.releaseSemantics.modelQualified = true
  }),
]

console.log(JSON.stringify({
  status: "passed",
  contractPath: CONTRACT_PATH,
  contractSha256: CONTRACT_SHA256,
  ...result,
  verifiedFileCounts: {
    sourceManifest: 1,
    sourceIndex: 1,
    ...result.verifiedFileCounts,
  },
  negativeChecks,
  gpuStarted: false,
  trainingStarted: false,
  checkpointRead: false,
}, null, 2))
