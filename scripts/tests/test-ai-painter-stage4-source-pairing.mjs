import assert from 'node:assert/strict';
import test from 'node:test';
import sharp from 'sharp';
import {downsampleFiniteAverage, inspectPairingRow,
  reconstructBoundNaturalLandCover, naturalizeFirstPassLandCover,
  historicalConditionContentSha256, expectedBinaryConditionMasks,
  expectedConditionPixels, replayBoundConditions, inspectSharedStylePrior,
  inspectRetryLineage}
  from '../lib/ai-painter-stage4-source-pairing.mjs';

test('failed retry lineage binds feedback but cannot qualify generator transport', () => {
  const rows = [{sampleId: 'current-a', split: 'train', promptAtUtc: '2026-08-02T00:00:00Z',
    retryRequestPath: 'current-a/request.json',
    retryPromptBinding: {path: 'current-a/prompt.json', sha256: 'a'.repeat(64)},
    retryDeclaration: {sourceFailedRecordId: 'failed-a', sourceFailedImageSha256: 'c'.repeat(64),
      sourceFailedRgbUsedAsReference: false, failureIssueCodes: ['route_drift']}},
  {sampleId: 'current-b', split: 'validation', promptAtUtc: '2026-08-02T00:00:00Z',
    retryRequestPath: 'current-b/request.json',
    retryPromptBinding: {path: 'current-b/prompt.json', sha256: 'b'.repeat(64)},
    retryDeclaration: {reason: 'previous attempts without a bound failed record'}},
  {sampleId: 'current-c', split: 'challenge', retryDeclaration: null}];
  const files = {'data/world-samples/original-image-library/natural-home-v1/index.json':
    {records: [{recordId: 'failed-a', recordPath: 'failed/record.json'}]},
  'current-a/request.json': {outputRecordId: 'current-a',
    promptEvidencePath: 'current-a/prompt.json', promptEvidenceSha256: 'a'.repeat(64),
    retryRepairProfile: rows[0].retryDeclaration},
  'current-b/request.json': {outputRecordId: 'current-b',
    promptEvidencePath: 'current-b/prompt.json', promptEvidenceSha256: 'b'.repeat(64),
    retryRepairProfile: rows[1].retryDeclaration,
    sequenceGate: {priorRequestCount: 2}},
  'failed/record.json': {recordId: 'failed-a', status: 'rejected',
    createdAtUtc: '2026-08-01T00:00:00Z', relativeDirectory: 'failed',
    originalImage: {path: 'original.png', sha256: 'c'.repeat(64)},
    reviews: {machineReviewPath: 'failed/review.json'}},
  'failed/review.json': {recordId: 'failed-a', status: 'machine_rejected',
    issues: [{code: 'route_drift'}]}};
  const reader = {json: name => files[name], bytes: name => {
    assert.equal(name, 'failed/original.png'); return Buffer.from('bound');}};
  const result = inspectRetryLineage(reader, rows, ['current-a', 'current-b', 'current-c']);
  assert.deepEqual(result.bySplit, {train: 1, validation: 1, challenge: 0, regression: 0});
  assert.equal(result.boundFailedRecordCount, 1);
  assert.equal(result.declaredUnboundPriorAttemptCount, 1);
  assert.equal(result.declaredRetryReferenceToSelectedSampleCount, 0);
  assert.equal(result.rows[1].declaredPriorRequestCount, 2);
  assert.equal(result.historicalFeedbackPresent, true);
  assert.equal(result.generatorTransportVerified, false);
  assert.equal(result.trainingAllowed, false);
  files['failed/review.json'].issues[0].code = 'other';
  assert.throws(() => inspectRetryLineage(reader, rows, ['current-a', 'current-b', 'current-c']),
    /repair codes differ/);
  files['failed/review.json'].issues[0].code = 'route_drift';
  assert.throws(() => inspectRetryLineage(reader, rows, ['current-a', 'failed-a', 'current-c']),
    /another selected RGB record/);
});

function styleFixture() {
  const sourceIds = Array.from({length: 22}, (_, i) => `prior-${i}`);
  const selectedIds = Array.from({length: 64}, (_, i) => `selected-${i}`);
  const checkedRows = selectedIds.map((sampleId, index) => ({sampleId,
    imageSha256: index.toString(16).padStart(64, '0'), styleDeclaration: {
    path: 'style.json', sha256: 'a'.repeat(64), sourceRecordIds: sourceIds,
    directImageReferenceCount: 0, directRecordReferenceCount: 0,
    historicalImageReferencesUsed: false, priorRgbExcludedClaim: true,
    promptAtUtc: '2026-08-01T00:00:00Z'}}));
  const standard = {schemaVersion: 'foundational-complete-map-visual-standard-v2',
    sourceRecordCount: 22, createdAtUtc: '2026-07-23T00:00:00Z',
    compositionStatistics: {aggregateOnly: true, sourceSpatialMasksPersisted: false},
    directSourceImagePathsExposedToGenerator: false,
    historicalCompleteMapRgbReferenceCount: 0,
    sourceEvidence: sourceIds.map(id => ({recordId: id, recordPath: `${id}/record.json`,
      recordSha256: 'b'.repeat(64), imageSha256: 'c'.repeat(64),
      ownerReviewPath: `${id}/review.json`, ownerReviewSha256: 'd'.repeat(64)}))};
  const reader = {bound: ({path}) => path === 'style.json' ? standard : {
    recordId: path.split('/')[0], relativeDirectory: path.split('/')[0],
    originalImage: {path: 'image.png', sha256: 'c'.repeat(64)},
    reviews: {ownerReviewPath: `${path.split('/')[0]}/review.json`}},
  bytes: () => Buffer.from('bound')};
  return {sourceIds, selectedIds, checkedRows, standard, reader};
}

test('shared image-derived style prior is bound without granting data qualification', () => {
  const f = styleFixture();
  const result = inspectSharedStylePrior(f.reader, f.checkedRows, f.selectedIds);
  assert.equal(result.sourceRecordCount, 22);
  assert.equal(result.projectImageDerivedAggregate, true);
  assert.equal(result.generatorTransportVerified, false);
  assert.equal(result.dataQualificationGranted, false);
});

test('shared style audit rejects selected-source overlap and prompt drift', () => {
  const f = styleFixture();
  f.selectedIds[0] = f.sourceIds[0];
  assert.throws(() => inspectSharedStylePrior(f.reader, f.checkedRows, f.selectedIds),
    /selected sample directly contributed/);
  f.selectedIds[0] = 'selected-0';
  f.checkedRows[0].imageSha256 = 'c'.repeat(64);
  assert.throws(() => inspectSharedStylePrior(f.reader, f.checkedRows, f.selectedIds),
    /selected RGB bytes directly contributed/);
  f.checkedRows[0].imageSha256 = '0'.repeat(64);
  f.checkedRows[1].styleDeclaration.directImageReferenceCount = 1;
  assert.throws(() => inspectSharedStylePrior(f.reader, f.checkedRows, f.selectedIds),
    /direct style image reference/);
  f.checkedRows[1].styleDeclaration.directImageReferenceCount = 0;
  f.checkedRows[1].styleDeclaration.sha256 = 'e'.repeat(64);
  assert.throws(() => inspectSharedStylePrior(f.reader, f.checkedRows, f.selectedIds),
    /different style prior bytes/);
});

function fixture() {
  const row = {sampleId: 'sample-a', split: 'train', capacitySlotId: 'slot-a',
    grouping: {worldId: 'world-a'},
    sourceRecord: {path: 'record'}, conditionPack: {path: 'run/task/compiled-conditions/condition-pack.json'},
    regionSource: {path: 'region', sha256: 'region-bytes', contentSha256: 'region-content'},
    image: {path: 'image', sha256: 'image-hash'}};
  const files = {
    record: {recordId: 'sample-a', status: 'ai_assisted_cold_start_eligible',
      aiAssistedColdStartEligible: true, independentTrainingEligible: false,
      source: {normalizationManifestPath: 'normalization', rawGeneratedImagePath: 'raw',
        rawGeneratedImageSha256: 'raw-hash'},
      originalImage: {sha256: 'image-hash'},
      reviews: {machineReviewPath: 'machine-review'},
      conditionBinding: {conditionPackPath: row.conditionPack.path,
        conditionPackSha256: 'condition-id', worldId: 'world-a', taskSha256: 'task-id'},
      createdAtUtc: '2026-08-01T00:30:00Z'},
    [row.conditionPack.path]: {schemaVersion: 'complete-world-visual-condition-pack-v1',
      conditionPackSha256: 'condition-id', worldId: 'world-a',
      worldProfileId: 'profile-a', taskId: 'task-a', taskSha256: 'task-id',
      sourceBindings: {taskPackagePath: 'task'}},
    task: {worldId: 'world-a', taskId: 'task-a', taskSha256: 'task-id',
      sourceBindings: {naturalizedWorldFactsPath: 'facts',
        naturalizedWorldFactsSha256: 'facts-hash',
        realEarthRegionSourcePackagePath: 'region',
        realEarthRegionSourcePackageSha256: 'region-content'}},
    facts: {v7SlotBinding: {slotId: 'slot-a'}, worldProfileId: 'profile-a'},
    region: {packageId: 'region-id', sourceProvenance: {
      measurementWindowPlanPath: 'window-plan', measurementWindowPlanSha256: 'plan-hash'}},
    'window-plan': {assignments: [{slotId: 'slot-a', measurementBounds: {
      west: 1, east: 2, south: 3, north: 4}}]},
    'run/task/condition-lineage.json': {createdAtUtc: '2026-07-31T23:00:00Z',
      realEarthRegionSourcePackagePath: 'region',
      realEarthRegionSourcePackageArtifactSha256: 'region-bytes',
      realEarthRegionSourcePackageSha256: 'region-content',
      realEarthRegionSourcePackageId: 'region-id'},
    normalization: {promptEvidencePath: 'prompt', promptEvidenceSha256: 'prompt-hash',
      normalizedImageSha256: 'image-hash', rawGeneratedImageSha256: 'raw-hash',
      transformation: 'nearest_neighbor_downsample_exact_four_three_to_1024x768',
      createdAtUtc: '2026-08-01T00:20:00Z'},
    prompt: {conditionPackPath: row.conditionPack.path, conditionPackSha256: 'condition-id',
      createdAtUtc: '2026-08-01T00:10:00Z'},
    'generation-result.json': {
      schemaVersion: 'ai-assisted-conditional-rgb-generation-request-v1',
      outputRecordId: 'sample-a', originalImageRecordPath: 'record',
      promptEvidencePath: 'prompt', promptEvidenceSha256: 'prompt-hash',
      generatedImageSourceSha256: 'raw-hash', normalizedImageSha256: 'image-hash',
      transformation: 'nearest_neighbor_downsample_exact_four_three_to_1024x768',
      intakeResult: {rawGeneratedImageSha256: 'raw-hash',
        normalizedImageSha256: 'image-hash'}},
    'machine-review': {recordId: 'sample-a', imageSha256: 'image-hash',
      semanticConditionAudit: {conditionPackPath: row.conditionPack.path,
        conditionPackFileSha256: 'condition-artifact-hash', passed: true,
        formalConditionalTrainingEligible: false, method: 'historical-method'}},
  };
  const condition = files[row.conditionPack.path];
  condition.conditionPackSha256 = historicalConditionContentSha256(condition);
  files.prompt.conditionPackSha256 = condition.conditionPackSha256;
  files.record.conditionBinding.conditionPackSha256 = condition.conditionPackSha256;
  row.conditionPack.sha256 = 'condition-artifact-hash';
  const reader = {bound: binding => files[binding.path], json: name => files[name],
    bytes: name => {assert(['image', 'raw'].includes(name)); return Buffer.from(name);}};
  row.grouping.sourceWindow = {west: 1, east: 2, south: 3, north: 4};
  return {row, files, reader};
}

test('bound sample, region, RGB and chronology are consistent', () => {
  const {row, reader} = fixture();
  const result = inspectPairingRow(reader, row);
  assert.equal(result.sampleId, 'sample-a');
  assert.equal(result.gapMs, 70 * 60 * 1000);
  assert.equal(result.conditionContentMatchesPrompt, true);
  assert.equal(result.generationResultBound, true);
  assert.equal(result.generatorTransportVerified, false);
  assert.notEqual(result.conditionContentSha256, result.conditionArtifactSha256);
  assert.deepEqual(result.historicalSemanticAudit, {passed: true,
    formalConditionalTrainingEligible: false, method: 'historical-method'});
});

test('generation intake disagreement cannot be treated as a bound original RGB', () => {
  const {row, files, reader} = fixture();
  files['generation-result.json'].intakeResult.rawGeneratedImageSha256 = 'changed';
  assert.throws(() => inspectPairingRow(reader, row), /generation intake raw RGB differs/);
});

test('historical condition canonical signature detects changed content', () => {
  const {row, files, reader} = fixture();
  files[row.conditionPack.path].worldId = 'changed';
  assert.throws(() => inspectPairingRow(reader, row), /historical condition self-signature differs/);
});

test('public float grid average ignores invalid cells and keeps deterministic shape', () => {
  assert.deepEqual([...downsampleFiniteAverage(
    new Float32Array([1, 3, NaN, 7]), 2, 2, 1, 1)], [Math.fround(11 / 3)]);
  assert.throws(() => downsampleFiniteAverage(new Float32Array(3), 2, 2, 1, 1),
    /invalid public elevation grid/);
});

test('natural land-cover reconstruction is deterministic and rejects missing sources', () => {
  const result = reconstructBoundNaturalLandCover(
    new Uint8Array([10, 0, 30]), new Uint8Array([0, 1, 0]), 3, 1);
  assert.deepEqual([...result.values], [10, 10, 30]);
  assert.equal(result.reconstructedPixelCount, 1);
  assert.throws(() => reconstructBoundNaturalLandCover(
    new Uint8Array([0]), new Uint8Array([1]), 1, 1), /no natural land-cover source/);
});

test('first-pass human land-cover removal follows bound natural-neighbor order', () => {
  const result = naturalizeFirstPassLandCover(
    new Uint8Array([10, 40, 30, 50, 80, 60]), 3, 2);
  assert.deepEqual([...result.removalMask], [0, 1, 0, 1, 0, 0]);
  assert.deepEqual([...result.naturalized], [10, 10, 30, 10, 80, 60]);
  assert.equal(result.removedPixelCount, 2);
  assert.throws(() => naturalizeFirstPassLandCover(new Uint8Array([40]), 1, 1),
    /no first-pass natural/);
});

test('all 23 bound conditions replay exact task pixels and reject geometry drift', async () => {
  const task = {outputSize: {width: 1024, height: 768}, spatialLayers: {
    terrainRegions: [], walkableRegions: [], collisionRegions: [], objectFootprints: []}};
  const masks = expectedBinaryConditionMasks(task);
  assert.equal(masks.size, 14);
  const pixels = expectedConditionPixels(task);
  assert.equal(pixels.size, 23);
  const pngs = new Map();
  for (const [id, data] of pixels) pngs.set(id, await sharp(data,
    {raw: {width: 1024, height: 768, channels: 1}}).toColourspace('b-w').png().toBuffer());
  const condition = {canvas: {width: 1024, height: 768},
    sourceBindings: {taskPackagePath: 'task'},
    channels: [...pixels.keys()].map(id => ({id, kind: id === 'object_instance'
      ? 'instance_map' : id.startsWith('signed_distance_')
      || id.startsWith('coordinate_') || id === 'moisture_proximity'
        ? 'continuous_map' : 'binary_mask',
      shape: [1, 768, 1024], path: id, sha256: 'bound'}))};
  const reader = {bound: () => condition, json: () => task, bytes: id => pngs.get(id)};
  const row = {sampleId: 'sample-a', conditionPack: {path: 'condition', sha256: 'bound'}};
  const replay = await replayBoundConditions(reader, row);
  assert.equal(replay.verifiedChannelIds.length, 23);
  assert.equal(replay.all23ChannelsReplayed, true);
  task.spatialLayers.terrainRegions.push({kind: 'grass', polygon: [
    {x: 0, y: 0}, {x: 2, y: 0}, {x: 2, y: 2}]});
  await assert.rejects(replayBoundConditions(reader, row),
    /condition geometry replay differs: sample-a\/terrain_grass/);
});

for (const [label, mutate, message] of [
  ['wrong sample', f => {f.files.record.recordId = 'sample-b';}, 'registered sample differs'],
  ['reversed chronology', f => {f.files.prompt.createdAtUtc = '2026-07-31T22:00:00Z';},
    'source sequence reversed'],
  ['changed raw image', f => {f.files.normalization.rawGeneratedImageSha256 = 'wrong';},
    'raw RGB differs'],
  ['changed condition', f => {f.files.prompt.conditionPackSha256 = 'wrong';},
    'prompt condition identity differs'],
  ['wrong region source', f => {f.files.region.packageId = 'other';},
    'region source identity differs'],
  ['ineligible record', f => {f.files.record.status = 'blocked_source';},
    'source record not eligible'],
  ['wrong WorldFacts slot', f => {f.files.facts.v7SlotBinding.slotId = 'slot-b';},
    'WorldFacts slot differs'],
  ['wrong task', f => {f.files.task.taskId = 'task-b';}, 'task identity differs'],
  ['wrong source window', f => {f.files['window-plan'].assignments[0].measurementBounds.west = 0;},
    'sample source window differs'],
  ['wrong semantic review binding', f => {
    f.files['machine-review'].semanticConditionAudit.conditionPackFileSha256 = 'wrong';
  }, 'historical semantic condition bytes differ'],
]) test(label + ' fails closed', () => {
  const f = fixture(); mutate(f);
  assert.throws(() => inspectPairingRow(f.reader, f.row), new RegExp(message));
});
