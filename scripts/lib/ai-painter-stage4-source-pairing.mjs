import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import sharp from 'sharp';
import {createReader, explicitFile} from './ai-painter-stage4-dataset-audit.mjs';
import {deriveNaturalHydrology} from '../build-earth-geospatial-soil-hydrology.mjs';
import {rasterizePolygons, rasterizeFootprints, fillBounds}
  from './current-world-condition-raster.mjs';

const COUNTS = Object.freeze({train: 48, validation: 8, challenge: 4, regression: 4});
const WORLD_COVER_PALETTE = new Map([
  ['0,100,0', 10], ['255,187,34', 20], ['255,255,76', 30],
  ['240,150,255', 40], ['250,0,0', 50], ['180,180,180', 60],
  ['240,240,240', 70], ['0,100,200', 80], ['0,150,160', 90],
  ['0,207,117', 95], ['250,230,160', 100],
]);
const NATURAL_CLASSES = new Set([10, 20, 30, 60, 80, 90, 95, 100]);
const HUMAN_CLASSES = new Set([40, 50]);
const TERRAIN_KINDS = ['grass', 'water', 'path_ground', 'shoreline',
  'natural_boundary', 'mud_patch', 'tall_grass'];

// Recompute the existing compiler's binary geometry channels without writing a
// replacement condition pack or claiming that RGB matches those conditions.
export function expectedBinaryConditionMasks(task) {
  const {width, height} = task?.outputSize ?? {};
  assert.equal(width, 1024, 'condition replay width differs');
  assert.equal(height, 768, 'condition replay height differs');
  const layers = task.spatialLayers;
  assert(Array.isArray(layers?.terrainRegions)
    && Array.isArray(layers?.walkableRegions)
    && Array.isArray(layers?.collisionRegions)
    && Array.isArray(layers?.objectFootprints), 'condition replay geometry missing');
  const result = new Map();
  for (const kind of TERRAIN_KINDS) result.set(`terrain_${kind}`,
    rasterizePolygons(layers.terrainRegions.filter(item => item.kind === kind), width, height));
  result.set('walkable', rasterizePolygons(layers.walkableRegions, width, height));
  result.set('collision', rasterizePolygons(layers.collisionRegions, width, height));
  result.set('object_footprints', rasterizeFootprints(layers.objectFootprints, width, height));
  result.set('object_tree', rasterizeFootprints(
    layers.objectFootprints.filter(item => item.kind === 'tree'), width, height));
  result.set('object_rock', rasterizeFootprints(
    layers.objectFootprints.filter(item => item.kind === 'rock'), width, height));
  result.set('object_vegetation', rasterizeFootprints(
    layers.objectFootprints.filter(item => !['tree', 'rock'].includes(item.kind)), width, height));
  result.set('focal_area', Buffer.alloc(width * height));
  return result;
}

function distanceTransform(mask, width, height, distanceInside) {
  const distance = new Float32Array(width * height);
  const infinity = width + height, diagonal = Math.SQRT2;
  for (let index = 0; index < distance.length; index++)
    distance[index] = (mask[index] > 0) === distanceInside ? infinity : 0;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const index = y * width + x;
    if (distance[index] === 0) continue;
    if (x > 0) distance[index] = Math.min(distance[index], distance[index - 1] + 1);
    if (y > 0) distance[index] = Math.min(distance[index], distance[index - width] + 1);
    if (x > 0 && y > 0)
      distance[index] = Math.min(distance[index], distance[index - width - 1] + diagonal);
    if (x + 1 < width && y > 0)
      distance[index] = Math.min(distance[index], distance[index - width + 1] + diagonal);
  }
  for (let y = height - 1; y >= 0; y--) for (let x = width - 1; x >= 0; x--) {
    const index = y * width + x;
    if (distance[index] === 0) continue;
    if (x + 1 < width) distance[index] = Math.min(distance[index], distance[index + 1] + 1);
    if (y + 1 < height) distance[index] = Math.min(distance[index], distance[index + width] + 1);
    if (x + 1 < width && y + 1 < height)
      distance[index] = Math.min(distance[index], distance[index + width + 1] + diagonal);
    if (x > 0 && y + 1 < height)
      distance[index] = Math.min(distance[index], distance[index + width - 1] + diagonal);
  }
  return distance;
}

export function expectedConditionPixels(task) {
  const result = expectedBinaryConditionMasks(task);
  const {width, height} = task.outputSize;
  const footprints = task.spatialLayers.objectFootprints;
  const instances = Buffer.alloc(width * height);
  footprints.forEach((item, index) => fillBounds(instances, item.footprint,
    width, height, 1 + (index % 254)));
  result.set('object_instance', instances);
  for (const axis of ['x', 'y']) {
    const pixels = Buffer.alloc(width * height);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++)
      pixels[y * width + x] = Math.round(255 *
        (axis === 'x' ? x / Math.max(1, width - 1) : y / Math.max(1, height - 1)));
    result.set(`coordinate_${axis}`, pixels);
  }
  for (const [id, source] of [
    ['signed_distance_path', 'terrain_path_ground'],
    ['signed_distance_water', 'terrain_water'],
    ['signed_distance_shoreline', 'terrain_shoreline'],
    ['signed_distance_object_ground', 'object_footprints'],
    ['signed_distance_boundary', 'terrain_natural_boundary'],
  ]) {
    const mask = result.get(source);
    const inside = distanceTransform(mask, width, height, true);
    const outside = distanceTransform(mask, width, height, false);
    const pixels = Buffer.alloc(width * height);
    for (let index = 0; index < pixels.length; index++) {
      const signed = mask[index] > 0 ? Math.min(96, inside[index])
        : -Math.min(96, outside[index]);
      pixels[index] = Math.max(0, Math.min(255,
        Math.round(128 + (signed / 96) * 127)));
    }
    result.set(id, pixels);
  }
  const water = result.get('terrain_water');
  const distance = distanceTransform(water, width, height, false);
  const moisture = Buffer.alloc(width * height);
  for (let index = 0; index < moisture.length; index++)
    moisture[index] = water[index] > 0 ? 255 : Math.max(0, Math.min(255,
      Math.round(255 * (1 - Math.min(160, distance[index]) / 160))));
  result.set('moisture_proximity', moisture);
  assert.equal(result.size, 23, 'condition replay channel count differs');
  return result;
}

export async function replayBoundConditions(reader, row) {
  const condition = reader.bound(row.conditionPack);
  const task = reader.json(condition.sourceBindings?.taskPackagePath);
  const pixels = expectedConditionPixels(task);
  assert.equal(condition.canvas?.width, 1024, 'condition canvas width differs');
  assert.equal(condition.canvas?.height, 768, 'condition canvas height differs');
  assert.equal(condition.channels?.length, 23, 'condition channel count differs');
  assert.deepEqual(condition.channels.map(value => value.id), [...pixels.keys()],
    'condition channel order differs');
  for (const [id, expected] of pixels) {
    const channel = condition.channels.find(value => value.id === id);
    const kind = id === 'object_instance' ? 'instance_map'
      : id.startsWith('signed_distance_') || id.startsWith('coordinate_')
      || id === 'moisture_proximity' ? 'continuous_map' : 'binary_mask';
    assert(channel && channel.kind === kind
      && JSON.stringify(channel.shape) === '[1,768,1024]',
    `condition channel binding differs: ${id}`);
    const {data, info} = await sharp(reader.bytes(channel.path, channel.sha256))
      .greyscale().raw().toBuffer({resolveWithObject: true});
    assert.deepEqual({width: info.width, height: info.height, channels: info.channels},
      {width: 1024, height: 768, channels: 1}, `condition raster shape differs: ${id}`);
    assert.deepEqual(data, expected, `condition geometry replay differs: ${row.sampleId}/${id}`);
  }
  return {sampleId: row.sampleId, verifiedChannelIds: [...pixels.keys()],
    historicalCompilerBound: false, all23ChannelsReplayed: true,
    rgbSemanticAlignmentVerified: false};
}

export function historicalConditionContentSha256(condition) {
  assert.equal(condition?.schemaVersion, 'complete-world-visual-condition-pack-v1',
    'historical condition schema differs');
  assert(condition.identityBindings === undefined,
    'historical condition canonicalization does not cover newer identity bindings');
  const canonical = JSON.parse(JSON.stringify(condition));
  delete canonical.conditionPackSha256;
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}

async function hashBoundRawFile(root, acquisition) {
  assert(acquisition?.cachePath && /^[a-f0-9]{64}$/u.test(acquisition.sha256)
    && Number.isSafeInteger(acquisition.byteSize) && acquisition.byteSize > 0,
  'raw public source binding missing');
  const file = explicitFile(root, acquisition.cachePath);
  assert.equal(fs.statSync(file).size, acquisition.byteSize, 'raw public source size differs');
  const hash = createHash('sha256');
  for await (const chunk of fs.createReadStream(file)) hash.update(chunk);
  assert.equal(hash.digest('hex'), acquisition.sha256, 'raw public source SHA differs');
  return file;
}

function decodeWorldCover(data, channels, pixelCount) {
  assert(channels >= 1 && data.length === pixelCount * channels,
    'raw WorldCover shape differs');
  if (channels === 1) return Uint8Array.from(data);
  assert(channels >= 3, 'raw WorldCover palette channels missing');
  const values = new Uint8Array(pixelCount);
  for (let index = 0; index < pixelCount; index++) {
    const offset = index * channels;
    const value = WORLD_COVER_PALETTE.get(`${data[offset]},${data[offset + 1]},${data[offset + 2]}`);
    assert(value !== undefined, `unknown WorldCover color at pixel ${index}`);
    values[index] = value;
  }
  return values;
}

export function naturalizeFirstPassLandCover(values, width, height) {
  assert(values instanceof Uint8Array && values.length === width * height
    && width > 0 && height > 0, 'invalid first-pass land-cover grid');
  const naturalized = Uint8Array.from(values);
  const removalMask = new Uint8Array(values.length);
  const queue = new Int32Array(values.length);
  let head = 0, tail = 0, removedPixelCount = 0;
  for (let index = 0; index < values.length; index++) {
    if (HUMAN_CLASSES.has(values[index])) {
      removalMask[index] = 1;
      naturalized[index] = 0;
      removedPixelCount++;
    } else if (NATURAL_CLASSES.has(values[index])) queue[tail++] = index;
  }
  assert(tail > 0, 'no first-pass natural land-cover pixels');
  while (head < tail) {
    const index = queue[head++];
    const row = Math.floor(index / width), column = index - row * width;
    for (const neighbor of [row > 0 ? index - width : -1,
      row + 1 < height ? index + width : -1,
      column > 0 ? index - 1 : -1,
      column + 1 < width ? index + 1 : -1]) {
      if (neighbor < 0 || naturalized[neighbor] !== 0) continue;
      naturalized[neighbor] = naturalized[index];
      queue[tail++] = neighbor;
    }
  }
  return {naturalized, removalMask, removedPixelCount};
}

function boundMeasurementManifest(reader, sourcePlan) {
  const evidence = sourcePlan.sourceEvidence;
  const root = path.posix.dirname(path.posix.dirname(evidence.reconstructedNaturalLandCoverPath));
  const manifest = reader.json(`${root}/naturalized-world-fact-run.json`);
  const lineage = reader.bound({path: manifest.lineagePath, sha256: manifest.lineageSha256});
  const measurementBinding = lineage.sourceArtifacts?.find(item => item.role === 'measurement_window');
  assert(measurementBinding, 'bound measurement window absent');
  const measurement = reader.bound(measurementBinding);
  assert.equal(measurement.rasterWindows?.elevation?.outputPath,
    evidence.elevationPath, 'bound elevation path differs');
  assert.equal(measurement.rasterWindows.elevation.outputSha256,
    evidence.elevationSha256, 'bound elevation SHA differs');
  return measurement;
}

// Replays present raw-source bytes, not historical execution or geographic crop authorization.
export async function replayBoundRawMeasurement(root, reader, sourcePlan) {
  const measurement = boundMeasurementManifest(reader, sourcePlan);
  const {width, height} = measurement.canvasNormalization ?? {};
  assert.equal(width, 1024, 'measurement width differs');
  assert.equal(height, 768, 'measurement height differs');
  const inputReceipts = [];
  let firstPassPixelCount = 0;
  for (const [kind, kernel, depth] of [
    ['elevation', sharp.kernel.cubic, 'float'],
    ['landCover', sharp.kernel.nearest, 'uchar'],
  ]) {
    const raster = measurement.rasterWindows?.[kind];
    const acquisition = measurement.sourceAcquisitions?.find(item => item.sourceId === raster?.sourceId);
    assert(acquisition && raster?.sourcePixelWindow && raster?.outputPath && raster?.outputSha256,
      `${kind} raw-source binding missing`);
    const file = await hashBoundRawFile(root, acquisition);
    const metadata = await sharp(file, {limitInputPixels: false, sequentialRead: true}).metadata();
    assert.deepEqual({width: metadata.width, height: metadata.height, format: metadata.format,
      depth: metadata.depth, channels: metadata.channels}, raster.sourceMetadata,
    `${kind} raw-source metadata differs`);
    const window = raster.sourcePixelWindow;
    assert(Object.values(window).every(value => Number.isInteger(value) && value >= 0)
      && window.width > 0 && window.height > 0
      && window.left + window.width <= metadata.width
      && window.top + window.height <= metadata.height,
    `${kind} raw-source window invalid`);
    const {data, info} = await sharp(file, {limitInputPixels: false, sequentialRead: true})
      .extract(window).resize(width, height, {kernel, fit: 'fill'})
      .raw({depth}).toBuffer({resolveWithObject: true});
    assert.equal(info.width, width, `${kind} replay width differs`);
    assert.equal(info.height, height, `${kind} replay height differs`);
    let replay;
    if (kind === 'elevation') {
      assert.equal(data.length, width * height * info.channels * 4,
        'raw elevation channel length differs');
      replay = Buffer.alloc(width * height * 4);
      for (let index = 0; index < width * height; index++)
        replay.writeFloatLE(data.readFloatLE(index * info.channels * 4), index * 4);
    } else replay = Buffer.from(decodeWorldCover(data, info.channels, width * height));
    const bound = gunzipSync(reader.bytes(raster.outputPath, raster.outputSha256),
      {maxOutputLength: width * height * (kind === 'elevation' ? 4 : 1)});
    assert.deepEqual(replay, bound, `${kind} raw-source replay differs`);
    if (kind === 'landCover') {
      const firstPass = naturalizeFirstPassLandCover(replay, width, height);
      const humanRemoval = measurement.humanRemoval;
      assert.deepEqual(Buffer.from(firstPass.naturalized),
        gunzipSync(reader.bytes(humanRemoval.naturalizedLandCoverPath,
          humanRemoval.naturalizedLandCoverSha256), {maxOutputLength: width * height}),
      'first-pass natural land-cover replay differs');
      assert.deepEqual(Buffer.from(firstPass.removalMask),
        gunzipSync(reader.bytes(humanRemoval.removalMaskPath,
          humanRemoval.removalMaskSha256), {maxOutputLength: width * height}),
      'first-pass human-removal mask replay differs');
      assert.equal(firstPass.removedPixelCount, humanRemoval.removedPixelCount,
        'first-pass removed-pixel count differs');
      firstPassPixelCount = firstPass.removedPixelCount;
    }
    await hashBoundRawFile(root, acquisition);
    inputReceipts.push({path: acquisition.cachePath, sha256: acquisition.sha256,
      bytes: acquisition.byteSize, sourceId: acquisition.sourceId});
  }
  return {status: 'current_program_reproduces_bound_raw_raster_and_first_pass',
    measurementRunId: measurement.runId, firstPassRemovedPixelCount: firstPassPixelCount,
    inputReceipts, historicalProgramAttested: false, geographicCropPolicyAttested: false,
    crossSampleFeedbackExcluded: false, downstreamConditionsReplayed: false};
}

export function downsampleFiniteAverage(source, width, height, targetWidth, targetHeight) {
  assert(source instanceof Float32Array && source.length === width * height
    && Number.isInteger(width) && Number.isInteger(height)
    && Number.isInteger(targetWidth) && Number.isInteger(targetHeight)
    && width >= targetWidth && height >= targetHeight
    && targetWidth > 0 && targetHeight > 0, 'invalid public elevation grid');
  const result = new Float32Array(targetWidth * targetHeight);
  for (let y = 0; y < targetHeight; y++) {
    const y0 = Math.floor(y * height / targetHeight);
    const y1 = Math.max(y0 + 1, Math.floor((y + 1) * height / targetHeight));
    for (let x = 0; x < targetWidth; x++) {
      const x0 = Math.floor(x * width / targetWidth);
      const x1 = Math.max(x0 + 1, Math.floor((x + 1) * width / targetWidth));
      let sum = 0, count = 0;
      for (let sy = y0; sy < y1; sy++) for (let sx = x0; sx < x1; sx++) {
        const value = source[sy * width + sx];
        if (!Number.isFinite(value)) continue;
        sum += value;
        count++;
      }
      result[y * targetWidth + x] = count ? sum / count : 0;
    }
  }
  return result;
}

function float32Le(bytes, count) {
  assert.equal(bytes.length, count * 4, 'public elevation byte length differs');
  const result = new Float32Array(count);
  for (let index = 0; index < count; index++) result[index] = bytes.readFloatLE(index * 4);
  return result;
}

export function replayBoundPublicHydrology(reader, sourcePlan) {
  const evidence = sourcePlan.sourceEvidence;
  assert(evidence?.elevationPath && evidence?.elevationSha256
    && evidence?.slopePath && evidence?.slopeSha256
    && evidence?.drainageLikelihoodPath && evidence?.drainageLikelihoodSha256,
  'public hydrology source bindings missing');
  const elevation = float32Le(gunzipSync(reader.bytes(evidence.elevationPath,
    evidence.elevationSha256), {maxOutputLength: 1024 * 768 * 4}), 1024 * 768);
  const analysis = downsampleFiniteAverage(elevation, 1024, 768, 256, 192);
  const result = deriveNaturalHydrology(analysis, 256, 192);
  const slope = gunzipSync(reader.bytes(evidence.slopePath, evidence.slopeSha256),
    {maxOutputLength: 256 * 192 * 4});
  const drainage = gunzipSync(reader.bytes(evidence.drainageLikelihoodPath,
    evidence.drainageLikelihoodSha256), {maxOutputLength: 256 * 192});
  assert.deepEqual(Buffer.from(result.slope.buffer, result.slope.byteOffset,
    result.slope.byteLength), slope, 'public slope replay differs');
  assert.deepEqual(Buffer.from(result.drainageLikelihood.buffer,
    result.drainageLikelihood.byteOffset, result.drainageLikelihood.byteLength), drainage,
  'public drainage replay differs');
  return {status: 'current_program_reproduces_bound_numeric_outputs',
    sourcePlanRunId: sourcePlan.runId, width: 256, height: 192,
    historicalProgramAttested: false, upstreamRasterResamplingAttested: false,
    downstreamWorldFactsAndConditionsReplayed: false};
}

export function reconstructBoundNaturalLandCover(values, removalMask, width, height) {
  assert(values instanceof Uint8Array && removalMask instanceof Uint8Array
    && values.length === width * height && removalMask.length === values.length,
  'invalid natural land-cover grids');
  const output = Uint8Array.from(values);
  const distance = new Int32Array(values.length).fill(-1);
  const queue = new Int32Array(values.length);
  let head = 0, tail = 0, reconstructedPixelCount = 0;
  for (let index = 0; index < values.length; index++) if (!removalMask[index] && values[index] > 0) {
    distance[index] = 0;
    queue[tail++] = index;
  }
  assert(tail > 0, 'no natural land-cover source pixels');
  while (head < tail) {
    const index = queue[head++], x = index % width;
    for (const offset of [-width, 1, width, -1]) {
      const next = index + offset;
      if (next < 0 || next >= values.length || distance[next] >= 0
        || offset === 1 && x === width - 1 || offset === -1 && x === 0) continue;
      distance[next] = distance[index] + 1;
      output[next] = output[index];
      queue[tail++] = next;
      if (removalMask[next]) reconstructedPixelCount++;
    }
  }
  assert.equal(reconstructedPixelCount,
    removalMask.reduce((count, value) => count + (value ? 1 : 0), 0),
  'natural land-cover reconstruction incomplete');
  return {values: output, reconstructedPixelCount};
}

export function replayBoundNaturalLandCover(reader, sourcePlan) {
  const evidence = sourcePlan.sourceEvidence;
  assert(evidence?.reconstructedNaturalLandCoverPath
    && evidence?.reconstructedNaturalLandCoverSha256
    && evidence?.combinedHumanRemovalMaskPath && evidence?.combinedHumanRemovalMaskSha256,
  'natural land-cover output bindings missing');
  const root = path.posix.dirname(path.posix.dirname(evidence.reconstructedNaturalLandCoverPath));
  const manifest = reader.json(`${root}/naturalized-world-fact-run.json`);
  assert.equal(manifest.reconstructedNaturalLandCoverSha256,
    evidence.reconstructedNaturalLandCoverSha256, 'natural land-cover manifest differs');
  assert.equal(manifest.combinedHumanRemovalMaskSha256,
    evidence.combinedHumanRemovalMaskSha256, 'human-removal manifest differs');
  const measurement = boundMeasurementManifest(reader, sourcePlan);
  const firstPass = measurement.humanRemoval;
  const values = gunzipSync(reader.bytes(firstPass.naturalizedLandCoverPath,
    firstPass.naturalizedLandCoverSha256), {maxOutputLength: 1024 * 768});
  const mask = gunzipSync(reader.bytes(evidence.combinedHumanRemovalMaskPath,
    evidence.combinedHumanRemovalMaskSha256), {maxOutputLength: 1024 * 768});
  const expected = gunzipSync(reader.bytes(evidence.reconstructedNaturalLandCoverPath,
    evidence.reconstructedNaturalLandCoverSha256), {maxOutputLength: 1024 * 768});
  assert.equal(values.length, 1024 * 768, 'first-pass land-cover shape differs');
  assert.equal(mask.length, values.length, 'human-removal mask shape differs');
  assert.equal(expected.length, values.length, 'natural land-cover output shape differs');
  const result = reconstructBoundNaturalLandCover(values, mask, 1024, 768);
  assert.deepEqual(Buffer.from(result.values), expected, 'natural land-cover replay differs');
  return {status: 'current_program_reproduces_bound_reconstruction',
    reconstructedPixelCount: result.reconstructedPixelCount,
    historicalProgramAttested: false, firstPassGenerationReplayed: false,
    crossSampleFeedbackExcluded: false, downstreamConditionsReplayed: false};
}

function timestamp(value, label) {
  const parsed = Date.parse(value);
  assert(Number.isFinite(parsed) && /Z$/u.test(value), `${label} UTC timestamp missing`);
  return parsed;
}

export function inspectPairingRow(reader, row) {
  const record = reader.bound(row.sourceRecord);
  const condition = reader.bound(row.conditionPack);
  const canonicalConditionSha256 = historicalConditionContentSha256(condition);
  assert.equal(condition.conditionPackSha256, canonicalConditionSha256,
    'historical condition self-signature differs');
  const region = reader.bound(row.regionSource);
  const planBinding = {path: region.sourceProvenance?.measurementWindowPlanPath,
    sha256: region.sourceProvenance?.measurementWindowPlanSha256};
  const plan = reader.bound(planBinding);
  const assignment = plan.assignments?.find(item => item.slotId === row.capacitySlotId);
  assert(assignment, 'capacity slot absent from bound window plan');
  assert.deepEqual(assignment.measurementBounds, row.grouping?.sourceWindow,
    'sample source window differs from bound plan');
  const lineagePath = path.posix.join(path.posix.dirname(path.posix.dirname(row.conditionPack.path)),
    'condition-lineage.json');
  const lineage = reader.json(lineagePath);
  const normalization = reader.json(record.source?.normalizationManifestPath);
  const prompt = reader.json(normalization.promptEvidencePath, normalization.promptEvidenceSha256);
  const generationResultPath = path.posix.join(
    path.posix.dirname(normalization.promptEvidencePath), 'generation-result.json');
  const generationResult = reader.json(generationResultPath);
  const machineReview = reader.json(record.reviews?.machineReviewPath);
  const task = reader.json(condition.sourceBindings?.taskPackagePath);
  const facts = reader.bound({path: task.sourceBindings?.naturalizedWorldFactsPath,
    sha256: task.sourceBindings?.naturalizedWorldFactsSha256});
  reader.bytes(row.image.path, row.image.sha256);
  reader.bytes(record.source.rawGeneratedImagePath, record.source.rawGeneratedImageSha256);
  assert.equal(record.recordId, row.sampleId, 'registered sample differs');
  assert.equal(machineReview.recordId, row.sampleId, 'machine review sample differs');
  assert.equal(machineReview.imageSha256, row.image.sha256,
    'machine review RGB differs');
  assert.equal(machineReview.semanticConditionAudit?.conditionPackPath,
    row.conditionPack.path, 'historical semantic condition path differs');
  assert.equal(machineReview.semanticConditionAudit?.conditionPackFileSha256,
    row.conditionPack.sha256, 'historical semantic condition bytes differ');
  assert.equal(record.status, 'ai_assisted_cold_start_eligible', 'source record not eligible');
  assert.equal(record.aiAssistedColdStartEligible, true, 'AI-assisted source eligibility missing');
  assert.equal(record.independentTrainingEligible, false, 'source lane differs');
  assert.equal(row.regionSource.path, lineage.realEarthRegionSourcePackagePath,
    'region source lineage path differs');
  assert.equal(row.regionSource.sha256, lineage.realEarthRegionSourcePackageArtifactSha256,
    'region source lineage bytes differ');
  assert.equal(row.regionSource.contentSha256, lineage.realEarthRegionSourcePackageSha256,
    'region source lineage content differs');
  assert.equal(region.packageId, lineage.realEarthRegionSourcePackageId,
    'region source identity differs');
  assert.equal(row.image.sha256, record.originalImage?.sha256, 'registered RGB differs');
  assert.equal(normalization.normalizedImageSha256, row.image.sha256, 'normalized RGB differs');
  assert.equal(normalization.rawGeneratedImageSha256, record.source.rawGeneratedImageSha256,
    'raw RGB differs');
  // This is a local intake/result linkage, not a receipt from the image
  // generator proving which inputs it actually consumed.
  assert.equal(generationResult.schemaVersion,
    'ai-assisted-conditional-rgb-generation-request-v1',
    'generation result schema differs');
  assert.equal(generationResult.outputRecordId, row.sampleId,
    'generation result sample differs');
  assert.equal(generationResult.originalImageRecordPath, row.sourceRecord.path,
    'generation result record differs');
  assert.equal(generationResult.promptEvidencePath, normalization.promptEvidencePath,
    'generation result prompt path differs');
  assert.equal(generationResult.promptEvidenceSha256, normalization.promptEvidenceSha256,
    'generation result prompt bytes differ');
  assert.equal(generationResult.generatedImageSourceSha256,
    record.source.rawGeneratedImageSha256, 'generation result raw RGB differs');
  assert.equal(generationResult.normalizedImageSha256, row.image.sha256,
    'generation result normalized RGB differs');
  assert.equal(generationResult.intakeResult?.rawGeneratedImageSha256,
    record.source.rawGeneratedImageSha256, 'generation intake raw RGB differs');
  assert.equal(generationResult.intakeResult?.normalizedImageSha256,
    row.image.sha256, 'generation intake normalized RGB differs');
  assert.equal(generationResult.transformation, normalization.transformation,
    'generation result normalization method differs');
  assert.equal(prompt.conditionPackPath, row.conditionPack.path, 'prompt condition path differs');
  assert.equal(prompt.conditionPackSha256, condition.conditionPackSha256,
    'prompt condition identity differs');
  assert.equal(record.conditionBinding?.conditionPackPath, row.conditionPack.path,
    'record condition path differs');
  assert.equal(record.conditionBinding?.conditionPackSha256, condition.conditionPackSha256,
    'record condition identity differs');
  assert.equal(condition.worldId, row.grouping?.worldId, 'condition world differs');
  assert.equal(record.conditionBinding?.worldId, condition.worldId, 'record world differs');
  assert.equal(task.worldId, condition.worldId, 'task world differs');
  assert.equal(task.taskId, condition.taskId, 'task identity differs');
  assert.equal(task.taskSha256, condition.taskSha256, 'task content identity differs');
  assert.equal(record.conditionBinding?.taskSha256, task.taskSha256,
    'record task identity differs');
  assert.equal(facts.v7SlotBinding?.slotId, row.capacitySlotId, 'WorldFacts slot differs');
  assert.equal(facts.worldProfileId, condition.worldProfileId, 'WorldFacts profile differs');
  assert.equal(task.sourceBindings?.realEarthRegionSourcePackagePath, row.regionSource.path,
    'WorldFacts task region path differs');
  assert.equal(task.sourceBindings?.realEarthRegionSourcePackageSha256,
    row.regionSource.contentSha256, 'WorldFacts task region content differs');
  const times = [timestamp(lineage.createdAtUtc, 'condition'),
    timestamp(prompt.createdAtUtc, 'prompt'),
    timestamp(normalization.createdAtUtc, 'normalization'),
    timestamp(record.createdAtUtc, 'record')];
  assert(times.every((value, index) => index === 0 || value >= times[index - 1]),
    `source sequence reversed: ${row.sampleId}`);
  return {sampleId: row.sampleId, split: row.split, planBinding,
    generationResultPath, generationResultBound: true,
    generatorTransportVerified: false,
    retryDeclaration: prompt.retryRepairProfile ?? null,
    retryRequestPath: path.posix.join(path.posix.dirname(normalization.promptEvidencePath),
      'request.json'),
    retryPromptBinding: {path: normalization.promptEvidencePath,
      sha256: normalization.promptEvidenceSha256},
    historicalSemanticAudit: {
      passed: machineReview.semanticConditionAudit.passed === true,
      formalConditionalTrainingEligible:
        machineReview.semanticConditionAudit.formalConditionalTrainingEligible === true,
      method: machineReview.semanticConditionAudit.method,
    },
    styleDeclaration: {
      path: prompt.foundationalVisualStandardPath,
      sha256: prompt.foundationalVisualStandardSha256,
      sourceRecordIds: prompt.foundationalVisualStandardSourceRecordIds,
      directImageReferenceCount: prompt.styleReferences?.length,
      directRecordReferenceCount: prompt.styleReferenceRecordIds?.length,
      historicalImageReferencesUsed: prompt.historicalCompleteMapImageReferencesUsed,
      priorRgbExcludedClaim: prompt.allHistoryGenerationInputBoundary
        ?.allPriorRgbExcludedFromGenerator,
      promptAtUtc: prompt.createdAtUtc,
    },
    conditionContentSha256: canonicalConditionSha256,
    conditionArtifactSha256: row.conditionPack.sha256,
    conditionContentMatchesPrompt: true,
    gapMs: times[1] - times[0],
    conditionAtUtc: lineage.createdAtUtc, promptAtUtc: prompt.createdAtUtc,
    normalizationAtUtc: normalization.createdAtUtc, recordAtUtc: record.createdAtUtc};
}

// Bind historical failed attempts mentioned in the selected prompts. Their
// review feedback is part of generation lineage, even when failed RGB bytes
// were declared not to be supplied as a reference image. This is not proof of
// the actual generator transport or of an independent model holdout.
export function inspectRetryLineage(reader, checkedRows, selectedSampleIds) {
  const retries = checkedRows.filter(row => row.retryDeclaration);
  const selected = new Set(selectedSampleIds);
  const library = reader.json('data/world-samples/original-image-library/natural-home-v1/index.json');
  const history = new Map(library.records.map(row => [row.recordId, row]));
  const rows = [];
  for (const row of retries) {
    const repair = row.retryDeclaration;
    const request = reader.json(row.retryRequestPath);
    assert.equal(request.outputRecordId, row.sampleId, 'retry request sample differs');
    assert.equal(request.promptEvidencePath, row.retryPromptBinding.path,
      'retry request prompt path differs');
    assert.equal(request.promptEvidenceSha256, row.retryPromptBinding.sha256,
      'retry request prompt bytes differ');
    assert.deepEqual(request.retryRepairProfile, repair,
      'retry request repair profile differs');
    const failedId = repair.sourceFailedRecordId ?? null;
    if (!failedId) {
      assert(Number.isSafeInteger(request.sequenceGate?.priorRequestCount)
        && request.sequenceGate.priorRequestCount > 0,
      'unbound retry prior request count missing');
      rows.push({sampleId: row.sampleId, split: row.split,
        failedRecordId: null, declaredPriorAttemptsNotBound: true,
        declaredPriorRequestCount: request.sequenceGate.priorRequestCount,
        generatorTransportVerified: false});
      continue;
    }
    assert(!selected.has(failedId), 'selected retry depends on another selected RGB record');
    assert.equal(repair.sourceFailedRgbUsedAsReference, false,
      'retry declares failed RGB supplied as reference');
    const indexed = history.get(failedId);
    assert(indexed?.recordPath, 'retry failed record absent from library');
    const failed = reader.json(indexed.recordPath);
    assert.equal(failed.recordId, failedId, 'retry failed record identity differs');
    assert.equal(failed.status, 'rejected', 'retry source not rejected');
    assert.equal(failed.originalImage?.sha256, repair.sourceFailedImageSha256,
      'retry failed RGB identity differs');
    assert(timestamp(failed.createdAtUtc, 'failed record')
      < timestamp(row.promptAtUtc, 'retry prompt'), 'retry source does not predate prompt');
    reader.bytes(path.posix.join(failed.relativeDirectory, failed.originalImage.path),
      repair.sourceFailedImageSha256);
    const review = reader.json(failed.reviews?.machineReviewPath);
    assert.equal(review.recordId, failedId, 'retry failure review identity differs');
    assert.equal(review.status, 'machine_rejected', 'retry failure review not rejected');
    assert.deepEqual([...new Set(repair.failureIssueCodes ?? [])].sort(),
      [...new Set((review.issues ?? []).map(item => item.code))].sort(),
    'retry repair codes differ from failed review');
    rows.push({sampleId: row.sampleId, split: row.split,
      failedRecordId: failedId, failedImageSha256: repair.sourceFailedImageSha256,
      failedRecordInSelected64: false, failedRgbReferenceDeclared: false,
      failureReviewBound: true, generatorTransportVerified: false});
  }
  return {retryCount: retries.length, boundFailedRecordCount: rows.filter(row =>
    row.failureReviewBound).length, declaredUnboundPriorAttemptCount: rows.filter(row =>
    row.declaredPriorAttemptsNotBound).length,
  bySplit: Object.fromEntries(Object.keys(COUNTS).map(split =>
    [split, retries.filter(row => row.split === split).length])),
  rows, declaredRetryReferenceToSelectedSampleCount: 0,
  historicalFeedbackPresent: rows.some(row => row.failureReviewBound),
  generatorTransportVerified: false, trainingAllowed: false};
}

// A common style aggregate is not a direct RGB reference and is not by itself
// a must-link between selected samples. The historical generator transport is
// outside this audit and remains unverified.
export function inspectSharedStylePrior(reader, checkedRows, selectedSampleIds) {
  assert.equal(checkedRows.length, 64, 'shared style audit requires all 64 samples');
  const selected = new Set(selectedSampleIds);
  assert.equal(selected.size, 64, 'selected sample identities differ');
  const selectedImageHashes = new Set(checkedRows.map(row => row.imageSha256));
  assert.equal(selectedImageHashes.size, 64, 'selected RGB identities differ');
  const first = checkedRows[0].styleDeclaration;
  assert(first?.path && /^[a-f0-9]{64}$/u.test(first.sha256),
    'shared style binding missing');
  for (const row of checkedRows) {
    const value = row.styleDeclaration;
    assert.equal(value.path, first.path, 'selected prompts use different style priors');
    assert.equal(value.sha256, first.sha256, 'selected prompts use different style prior bytes');
    assert.equal(value.directImageReferenceCount, 0, 'direct style image reference declared');
    assert.equal(value.directRecordReferenceCount, 0, 'direct style record reference declared');
    assert.equal(value.historicalImageReferencesUsed, false,
      'historical RGB reference declared');
    assert.equal(value.priorRgbExcludedClaim, true,
      'prompt historical RGB exclusion claim missing');
  }
  const standard = reader.bound({path: first.path, sha256: first.sha256});
  assert.equal(standard.schemaVersion, 'foundational-complete-map-visual-standard-v2');
  assert.equal(standard.sourceRecordCount, 22, 'style source count differs');
  assert.equal(standard.sourceEvidence?.length, 22, 'style source evidence incomplete');
  assert.equal(standard.compositionStatistics?.aggregateOnly, true,
    'style composition is not aggregate-only');
  assert.equal(standard.compositionStatistics?.sourceSpatialMasksPersisted, false,
    'style source spatial masks persisted');
  assert.equal(standard.directSourceImagePathsExposedToGenerator, false,
    'style source image paths exposed');
  assert.equal(standard.historicalCompleteMapRgbReferenceCount, 0,
    'style standard declares direct RGB references');
  const sourceIds = standard.sourceEvidence.map(item => item.recordId);
  assert.equal(new Set(sourceIds).size, 22, 'duplicate style source record');
  for (const row of checkedRows) {
    assert.deepEqual(row.styleDeclaration.sourceRecordIds, sourceIds,
      'prompt style source list differs from bound aggregate');
    assert(timestamp(row.styleDeclaration.promptAtUtc, 'prompt')
      > timestamp(standard.createdAtUtc, 'style standard'),
    'style aggregate created after prompt');
  }
  assert(sourceIds.every(id => !selected.has(id)),
    'selected sample directly contributed to common style prior');
  assert(standard.sourceEvidence.every(item => !selectedImageHashes.has(item.imageSha256)),
    'selected RGB bytes directly contributed to common style prior');
  for (const item of standard.sourceEvidence) {
    const record = reader.bound({path: item.recordPath, sha256: item.recordSha256});
    assert.equal(record.recordId, item.recordId, 'style source record identity differs');
    assert.equal(record.originalImage?.sha256, item.imageSha256,
      'style source RGB identity differs');
    assert.equal(record.reviews?.ownerReviewPath, item.ownerReviewPath,
      'style source review binding differs');
    reader.bytes(path.posix.join(record.relativeDirectory, record.originalImage.path),
      item.imageSha256);
    reader.bytes(item.ownerReviewPath, item.ownerReviewSha256);
  }
  return {status: 'declared_common_style_prior_verified_no_selected_identity_or_byte_overlap',
    binding: {path: first.path, sha256: first.sha256},
    selectedSampleCount: selected.size, sourceRecordCount: sourceIds.length,
    sourceRecordIds: sourceIds, projectImageDerivedAggregate: true,
    selectedRecordIdentityOverlap: false, selectedExactRgbByteOverlap: false,
    directHistoricalRgbReferencesDeclared: false,
    generatorTransportVerified: false, crossSampleFeedbackExcluded: false,
    dataQualificationGranted: false};
}

// This verifies immutable current bytes and the recorded per-sample sequence.
// It does not reconstruct the historical source program or grant data eligibility.
export async function inspectSourcePairing(root, manifestBinding, sourcePlanBinding) {
  const reader = createReader(root);
  reader.bytes('scripts/lib/ai-painter-stage4-source-pairing.mjs');
  reader.bytes('scripts/lib/ai-painter-stage4-dataset-audit.mjs');
  reader.bytes('scripts/inspect-ai-painter-stage4-source-pairing.mjs');
  reader.bytes('scripts/audit-ai-painter-stage4-split-release.mjs');
  reader.bytes('scripts/build-earth-geospatial-soil-hydrology.mjs');
  reader.bytes('scripts/build-earth-geospatial-naturalized-world-facts.mjs');
  reader.bytes('scripts/lib/current-world-condition-raster.mjs');
  assert(sourcePlanBinding?.path && sourcePlanBinding?.sha256,
    'exact source plan binding required');
  const sourcePlan = reader.bound(sourcePlanBinding);
  const manifest = reader.bound(manifestBinding);
  assert.equal(manifest.schemaVersion, 'ai-painter-stage4-regrouped64-review-candidate-v1');
  assert.equal(manifest.qualification?.trainingAllowed, false);
  const source = reader.bound(manifest.sourceIndex);
  assert.equal(source.sampleCount, 64);
  assert.equal(source.samples?.length, 64);
  const ids = new Set(source.samples.map(row => row.sampleId));
  assert.equal(ids.size, 64, 'duplicate source sample');
  assert.equal(new Set(source.samples.map(row => row.image?.sha256)).size, 64,
    'duplicate training RGB');
  for (const [split, count] of Object.entries(COUNTS)) {
    const membership = reader.bound(manifest.splits[split]);
    assert.equal(membership.split, split);
    const expected = source.samples.filter(row => row.split === split).map(row => row.sampleId);
    assert.equal(expected.length, count);
    assert.deepEqual(membership.sampleIds, expected);
  }
  let shortestGapMs = Infinity;
  const rows = [];
  const styleDeclarations = [];
  const retryDeclarations = [];
  const conditionReplays = [];
  for (const row of source.samples) {
    const checked = inspectPairingRow(reader, row);
    shortestGapMs = Math.min(shortestGapMs, checked.gapMs);
    const {gapMs, styleDeclaration, retryDeclaration, ...record} = checked;
    rows.push(record);
    styleDeclarations.push({sampleId: row.sampleId, imageSha256: row.image.sha256,
      styleDeclaration});
    retryDeclarations.push({sampleId: row.sampleId, split: row.split,
      promptAtUtc: checked.promptAtUtc, retryDeclaration,
      retryRequestPath: checked.retryRequestPath,
      retryPromptBinding: checked.retryPromptBinding});
    conditionReplays.push(await replayBoundConditions(reader, row));
  }
  const sharedStylePrior = inspectSharedStylePrior(reader, styleDeclarations, ids);
  const retryLineage = inspectRetryLineage(reader, retryDeclarations, ids);
  const historicalSemanticAudit = {
    sampleCount: rows.length,
    historicalPassedCount: rows.filter(row => row.historicalSemanticAudit.passed).length,
    formalTrainingEligibleCount: rows.filter(row =>
      row.historicalSemanticAudit.formalConditionalTrainingEligible).length,
    methods: [...new Set(rows.map(row => row.historicalSemanticAudit.method))],
    currentFullSemanticAlignmentVerified: false,
  };
  const planBindings = [...new Map(rows.map(row =>
    [row.planBinding.path, row.planBinding])).values()];
  for (const binding of planBindings) {
    const plan = reader.bound(binding);
    assert.equal(sourcePlan.candidateWindowsPath, plan.candidateWindowsPath,
      'public source plan uses a different candidate pool');
    assert.equal(sourcePlan.candidateWindowsSha256, plan.candidateWindowsSha256,
      'public source plan candidate bytes differ');
    if (plan.parentWindowPlanPath) {
      const parent = reader.bound({path: plan.parentWindowPlanPath,
        sha256: plan.parentWindowPlanSha256});
      assert.equal(parent.candidateWindowsSha256, plan.candidateWindowsSha256,
        'replacement plan parent candidate bytes differ');
    }
  }
  const publicHydrologyReplay = replayBoundPublicHydrology(reader, sourcePlan);
  const publicLandCoverReplay = replayBoundNaturalLandCover(reader, sourcePlan);
  const rawMeasurementReplay = await replayBoundRawMeasurement(root, reader, sourcePlan);
  reader.verifyStable();
  return {schemaVersion: 'ai-painter-stage4-source-pairing-observation-v1',
    status: 'per_sample_pairing_verified_source_qualification_pending',
    manifest: manifestBinding, counts: COUNTS, sampleCount: rows.length,
    shortestConditionToPromptGapMs: shortestGapMs, rows, sourcePlanBinding,
    publicHydrologyReplay, publicLandCoverReplay, rawMeasurementReplay,
    conditionReplays, sharedStylePrior, retryLineage, historicalSemanticAudit,
    sampleWindowPlanBindings: planBindings,
    qualifications: {historicalProgramBound: false, crossSampleFeedbackExcluded: false,
      fullSemanticAlignmentVerified: false, trainingAllowed: false, gpuAllowed: false},
    inputReceipts: reader.receipts()};
}
