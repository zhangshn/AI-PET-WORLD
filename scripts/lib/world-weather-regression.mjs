import assert from 'node:assert/strict'
import {createEvolutionInputReader} from './natural-world-evolution-input.mjs'
import {baselineJson, baselineSha256} from './natural-world-baseline-proof.mjs'
import {
  ENVIRONMENT_EVIDENCE_MANIFEST, ENVIRONMENT_EVIDENCE_MANIFEST_SHA, recomputeEnvironmentHoldout,
} from './world-environment-evidence.mjs'
import {verifyWeatherDatasetRelease} from './world-weather-dataset-release.mjs'

// Predictive quality depends on the fixed checkpoint and held-out observations.
// The live world, current registry revision and installation of a runtime have separate checks.
export function verifyWeatherRegression(root = process.cwd()) {
  const {read} = createEvolutionInputReader(root)
  const manifestBytes = read(ENVIRONMENT_EVIDENCE_MANIFEST, 65536)
  assert.equal(baselineSha256(manifestBytes), ENVIRONMENT_EVIDENCE_MANIFEST_SHA, 'unrecognized numerical evidence inventory')
  const manifest = baselineJson(manifestBytes)
  const refs = new Map(manifest.refs.map(ref => [ref.path, ref]))
  const verified = new Map()
  function readBound(logicalPath) {
    const ref = refs.get(logicalPath)
    assert(ref && ref.bytes > 0 && ref.bytes <= 4 * 1024 * 1024, 'missing or oversized numerical evidence')
    const raw = read(logicalPath, ref.bytes)
    assert.equal(raw.length, ref.bytes, logicalPath)
    assert.equal(baselineSha256(raw), ref.sha256, logicalPath)
    verified.set(logicalPath, ref)
    return raw
  }
  function evidence(key) { return baselineJson(readBound(manifest.roots[key])) }
  function verifyReference(ref) {
    // A historical Python run recorded two artifacts with the original checkout prefix.
    const prefix = 'F:\\ai-pet-world\\'
    const logical = ref.path.startsWith(prefix) ? ref.path.slice(prefix.length).replaceAll('\\','/') : ref.path
    const raw = readBound(logical)
    assert.equal(ref.sha256, refs.get(logical).sha256)
    if (ref.bytes !== undefined) assert.equal(ref.bytes, raw.length)
  }
  const contract = evidence('evaluationContract'), result = evidence('evaluationResult')
  const training = evidence('modelResult'), trainingContract = evidence('modelContract')
  const dataset = evidence('dataset'), source = evidence('source'), receipt = evidence('sourceReceipt')
  const rights = evidence('sourceQualification')
  for (const ref of [contract.candidateCheckpoint, contract.parentCheckpoint, training.checkpoint,
    training.trainingDataset, trainingContract.trainingDataset, result.predictions, result.rollouts,
    ...contract.codeBindings, ...result.codeBindings, ...Object.values(dataset.sourceBinding),
    rights.sourceRef, rights.rightsRef]) verifyReference(ref)
  const digestOf = key => refs.get(manifest.roots[key]).sha256
  assert.equal(receipt.responseSha256, digestOf('source'))
  assert.equal(result.contractSha256, digestOf('evaluationContract'))
  assert.equal(result.datasetSha256, digestOf('dataset'))
  assert.equal(dataset.contractSha256, result.contractSha256)
  assert.equal(contract.candidateCheckpoint.trainingContractSha256, digestOf('modelContract'))
  assert.equal(training.contractSha256, digestOf('modelContract'))
  assert.equal(contract.candidateCheckpoint.trainingDatasetSha256, digestOf('trainingDataset'))
  const release = verifyWeatherDatasetRelease(root)
  assert.equal(release.checkpointSha256, contract.candidateCheckpoint.sha256)
  assert.equal(release.trainingDatasetSha256, contract.candidateCheckpoint.trainingDatasetSha256)
  const metrics = recomputeEnvironmentHoldout({contract, source, receipt, dataset,
    trainingDataset: evidence('trainingDataset'), result, predictions: evidence('predictions'), rollouts: evidence('rollouts')})
  assert(Object.values(metrics.conditions).every(v => v === true), 'weather checkpoint failed frozen numerical regression')
  return {scope:'sakaerat_fixed_checkpoint_predictive_regression', modelSha256:release.checkpointSha256,
    datasetReleaseIdentity:release.datasetReleaseIdentity, manifestSha256:ENVIRONMENT_EVIDENCE_MANIFEST_SHA,
    sourcePeriod:[contract.source.start,contract.source.end], evaluationWindows:dataset.windows.length,
    sourceFields:contract.source.fields, metrics, bindings:[...verified.values()]}
}
