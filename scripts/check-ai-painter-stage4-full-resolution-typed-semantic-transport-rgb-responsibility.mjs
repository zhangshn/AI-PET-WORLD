import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const contractPath = "data/ai-painter/system-governance/stage4-full-resolution-typed-semantic-transport-rgb-responsibility-contract-v2.json";
const contract = readJson(contractPath);
const conditionContract = readJson(contract.conditionContract.path);
const datasetRelease = readJson(contract.datasetBinding.path);
const trainerLossContract = readJson(contract.lossContract.path);
const reviewThresholdContract = readJson(contract.reviewThresholdContract.path);
const foundationAssetContract = readJson(contract.foundationAssetBinding.path);

assert.equal(contract.schemaVersion, "stage4-full-resolution-typed-semantic-transport-rgb-responsibility-contract-v2");
assert.equal(contract.status, "cpu_supported_inactive");
assert.equal(contract.authority, "local_ai_pet_world_program");
assert.equal(contract.architectureId, "stage4_full_resolution_typed_semantic_transport_rgb_responsibility_v2");
assert.equal(contract.predecessor.disposition, "rejected_read_only_not_valid_for_new_work");
assert.equal(contract.predecessor.checkpointReusable, false);
assert.equal(contract.responsibilityImplementationMode, "declared_shared_substrate");
assert.equal(contract.conditionContract.identity, "ai-painter-complete-map-23-channel-condition-v1");
assert.equal(conditionContract.conditionContractIdentity, contract.conditionContract.identity);
assert.equal(sha256File(resolveInside(contract.conditionContract.path)), contract.conditionContract.sha256);
assert.equal(contract.conditionContract.legacyLatestPointerFallbackAllowed, false);
assert.equal(
  datasetRelease.datasetReleaseIdentity,
  contract.datasetBinding.datasetReleaseIdentity,
  "dataset release identity mismatch",
);
assert.equal(sha256File(resolveInside(contract.datasetBinding.path)), contract.datasetBinding.sha256);
assert.equal(datasetRelease.releaseScope.releasedSampleCount, contract.datasetBinding.sampleCount);
assert.deepEqual(datasetRelease.releaseScope.splitCounts, contract.datasetBinding.splitCounts);
assert.equal(datasetRelease.sourcePackage.manifest.path, contract.datasetBinding.sourceManifest.path);
assert.equal(datasetRelease.sourcePackage.manifest.sha256, contract.datasetBinding.sourceManifest.sha256);
assert.equal(datasetRelease.sourcePackage.sourceIndex.path, contract.datasetBinding.sourceIndex.path);
assert.equal(datasetRelease.sourcePackage.sourceIndex.sha256, contract.datasetBinding.sourceIndex.sha256);
assert.equal(
  datasetRelease.conditionContractBinding.conditionContractIdentity,
  contract.conditionContract.identity,
);
assert.equal(datasetRelease.conditionContractBinding.path, contract.conditionContract.path);
assert.equal(datasetRelease.conditionContractBinding.sha256, contract.conditionContract.sha256);
assert.equal(datasetRelease.conditionContractBinding.compatibilityEstablishedByReleaseChecker, true);
assert.equal(datasetRelease.conditionContractBinding.sourcePackSelfDeclaredCurrentIdentityTrusted, false);
assert.equal(contract.datasetBinding.sampleCount, 64);
assert.deepEqual(contract.datasetBinding.splitCounts, {
  train: 48,
  validation: 8,
  challenge: 4,
  regression: 4,
});
assert.equal(contract.datasetBinding.legacyLatestPointerFallbackAllowed, false);
assert.equal(contract.datasetBinding.historicalHumanAuthorizationFieldsTrusted, false);
assert.equal(trainerLossContract.contractId, contract.lossContract.identity);
assert.equal(sha256File(resolveInside(contract.lossContract.path)), contract.lossContract.sha256);
assert.equal(trainerLossContract.architectureId, contract.architectureId);
assert.equal(trainerLossContract.objectiveMappingId, contract.lossContract.objectiveMappingId);
assert.equal(contract.lossContract.newWeightedLossAllowed, false);
assert.equal(contract.lossContract.machineReviewThresholdAsTrainingTargetAllowed, false);
assert.equal(reviewThresholdContract.contractId, contract.reviewThresholdContract.identity);
assert.equal(
  sha256File(resolveInside(contract.reviewThresholdContract.path)),
  contract.reviewThresholdContract.sha256,
);
assert.equal(reviewThresholdContract.architectureId, contract.architectureId);
assert.equal(contract.reviewThresholdContract.formalRunnerDispatchableNow, false);
assert.equal(contract.reviewThresholdContract.thresholdOverrideAllowed, false);
assert.equal(contract.reviewThresholdContract.historicalRunEvidenceAllowed, false);
assert.equal(foundationAssetContract.assetIdentity, contract.foundationAssetBinding.identity);
assert.equal(
  sha256File(resolveInside(contract.foundationAssetBinding.path)),
  contract.foundationAssetBinding.sha256,
);
assert.equal(foundationAssetContract.architectureId, contract.architectureId);
assert.equal(foundationAssetContract.assetRole, contract.foundationAssetBinding.role);
assert.equal(contract.foundationAssetBinding.checkpointWeightsReadableDuringCpuAcceptance, false);
assert.equal(contract.foundationAssetBinding.checkpointFileHashVerificationRequired, true);
assert.equal(contract.foundationAssetBinding.futureRuntimeStateAndOptimizerEvidenceRequired, true);
assert.equal(contract.inputContract.conditionChannels, 23);
assert.equal(contract.inputContract.conditionChannelOrder.length, 23);
assert.equal(contract.inputContract.discrete.length, 15);
assert.equal(contract.inputContract.continuous.length, 8);
assert.equal(contract.inputContract.discreteResize, "nearest");
assert.equal(contract.inputContract.continuousResize, "bilinear_align_corners_false");
assert.deepEqual(contract.inputContract.conditionChannelOrder, conditionContract.tensorContract.channelOrder);
assert.deepEqual(contract.inputContract.discrete, conditionContract.tensorContract.typePartitions.discrete);
assert.deepEqual(contract.inputContract.continuous, conditionContract.tensorContract.typePartitions.continuous);
assert.equal(contract.derivedDimensions.autoencoderBaseChannels, 48);
assert.equal(contract.derivedDimensions.denoiserBaseChannels, 64);
assert.equal(contract.derivedDimensions.responsibilitySemanticChannels, 64);
assert.equal(contract.derivedDimensions.latentChannels, 12);
assert.equal(contract.derivedDimensions.latentDownsampleFactor, 4);
assert.equal(contract.derivedDimensions.timeEmbeddingChannels, 256);
assert.equal(contract.derivedDimensions.responsibilityTransportKernel, "3x3_9_neighbors");
assert.equal(contract.responsibilityIsolation.declaredSharedSubstrateAllowed, true);
assert.ok(contract.responsibilityIsolation.sharedSubstrateParameterNamespaces.length > 0);
assert.deepEqual(contract.responsibilityIsolation.responsibilityOwnedParameterNamespaces, [
  "denoiser.responsibility_paths.<responsibilityId>",
  "denoiser.rgb_responsibility_heads.<responsibilityId>",
]);
assert.equal(contract.responsibilityIsolation.responsibilityOwnedParameterSharingAllowed, false);
assert.equal(contract.responsibilityIsolation.sharedSubstrateCannotSubstituteResponsibilityEvidence, true);
assert.equal(contract.responsibilityIsolation.maskOutsideRgbMutationAllowed, false);
assert.equal(contract.autoencoderBoundary.requiresGrad, false);
for (const value of Object.values(contract.trainingPrerequisites)) assert.equal(value, true);
for (const value of Object.values(contract.activationGates)) assert.equal(value, false);

const programBindings = {};
for (const [identity, binding] of Object.entries(contract.programBindings)) {
  const absolute = resolveInside(binding.path);
  assert.ok(fs.existsSync(absolute), `${identity} path does not exist: ${binding.path}`);
  const actualSha256 = sha256File(absolute);
  assert.equal(actualSha256, binding.sha256, `${identity} SHA-256 mismatch`);
  programBindings[identity] = { ...binding, actualSha256 };
}

const python = resolvePython();
const expectedPrerequisites = {
  condition_contract: contract.conditionContract,
  dataset_release: contract.datasetBinding,
  trainer_loss_support: contract.lossContract,
  machine_review_threshold: contract.reviewThresholdContract,
  foundation_autoencoder_lineage: contract.foundationAssetBinding,
};
assert.deepEqual(
  Object.keys(contract.prerequisiteBindings).sort(),
  Object.keys(expectedPrerequisites).sort(),
  "the frozen prerequisite set changed",
);
const prerequisiteRegressions = {};
for (const [id, binding] of Object.entries(contract.prerequisiteBindings)) {
  assert.equal(binding.id, id);
  assert.equal(binding.required, true);
  assert.equal(binding.executionClass, "cpu_readonly");
  assert.equal(binding.path, expectedPrerequisites[id].path);
  assert.equal(binding.sha256, expectedPrerequisites[id].sha256);
  assert.equal(sha256File(resolveInside(binding.path)), binding.sha256);
  assert.deepEqual(binding.safety, {
    gpuAllowed: false,
    optimizerAllowed: false,
    backwardAllowed: false,
    checkpointWeightsReadAllowed: false,
    checkpointFileHashVerificationAllowed: true,
    weightMutationAllowed: false,
    trainingAllowed: false,
  });
  const checker = binding.checkerCommand;
  assert.ok(checker && typeof checker === "object" && !Array.isArray(checker));
  assert.equal(Array.isArray(checker.args), true);
  assert.equal(checker.args.length, 1);
  const checkerPath = checker.args[0];
  const checkerAbsolute = resolveInside(checkerPath);
  assert.ok(fs.statSync(checkerAbsolute).isFile(), `${id} checker is missing`);
  let command;
  if (checker.command === "node") {
    assert.match(checkerPath, /^scripts\/check-[a-z0-9._-]+\.mjs$/u);
    command = process.execPath;
  } else {
    assert.equal(checker.command, "python");
    assert.match(checkerPath, /^ml\/ai-painter\/scripts\/check_[a-z0-9._-]+\.py$/u);
    command = python.command;
  }
  const result = spawnSync(command, [checkerAbsolute], {
    cwd: root,
    encoding: "utf8",
    windowsHide: true,
    timeout: 180_000,
    env: {
      ...process.env,
      CUDA_VISIBLE_DEVICES: "-1",
      NVIDIA_VISIBLE_DEVICES: "none",
      AI_PAINTER_CPU_ONLY: "1",
      AI_PAINTER_ALLOW_GPU: "0",
    },
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  assert.equal(result.status, 0, `${id} checker failed with exit code ${result.status}`);
  prerequisiteRegressions[id] = {
    checkerPath,
    status: "passed",
    stdout: (result.stdout ?? "").trim(),
  };
}

const testModules = [
  "ml.ai-painter.tests.test_stage4_semantic_transport_v2",
  "ml.ai-painter.tests.test_stage4_semantic_transport_v2_trainer_support",
  "ml.ai-painter.tests.test_stage4_joint_condition_local_transport",
  "ml.ai-painter.tests.test_stage4_full_backbone_spatial_affine_conditioned_denoiser"
];
const regression = spawnSync(python.command, [...python.prefix, "-m", "unittest", ...testModules], {
  cwd: root,
  encoding: "utf8",
  windowsHide: true,
  timeout: 180_000
});
if (regression.status !== 0) {
  process.stderr.write(regression.stdout ?? "");
  process.stderr.write(regression.stderr ?? "");
  process.exit(regression.status ?? 1);
}

process.stdout.write(`${JSON.stringify({
  status: "passed",
  contract: { path: contractPath, sha256: sha256File(resolveInside(contractPath)) },
  architectureId: contract.architectureId,
  predecessorDisposition: contract.predecessor.disposition,
  programBindings,
  prerequisiteRegressions,
  datasetRelease: {
    identity: datasetRelease.datasetReleaseIdentity,
    sampleCount: datasetRelease.releaseScope.releasedSampleCount,
    splitCounts: datasetRelease.releaseScope.splitCounts,
    regressionStatus: prerequisiteRegressions.dataset_release.status,
  },
  python: python.identity,
  regression: { testModules, stdout: regression.stdout.trim(), stderr: regression.stderr.trim() },
  activationGatesRemainFalse: true,
  gpuStarted: false,
  trainingStarted: false
}, null, 2)}\n`);

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(resolveInside(relativePath), "utf8"));
}

function resolveInside(relativePath) {
  const absolute = path.resolve(root, relativePath);
  assert.ok(absolute.startsWith(`${path.resolve(root)}${path.sep}`), `path escapes project: ${relativePath}`);
  return absolute;
}

function sha256File(absolutePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(absolutePath)).digest("hex");
}

function resolvePython() {
  const candidates = process.platform === "win32"
    ? [
        process.env.AI_PAINTER_PYTHON,
        path.join(root, "ml", "ai-painter", ".venv", "Scripts", "python.exe"),
        "python"
      ]
    : [process.env.AI_PAINTER_PYTHON, "python3", "python"];
  for (const command of candidates.filter(Boolean)) {
    const probe = spawnSync(command, ["--version"], { cwd: root, encoding: "utf8", windowsHide: true });
    if (probe.status === 0) return { command, prefix: [], identity: `${command}: ${(probe.stdout || probe.stderr).trim()}` };
  }
  throw new Error("No Python interpreter is available for the Stage4 CPU contract regression");
}
