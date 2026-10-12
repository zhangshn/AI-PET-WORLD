import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { runOwnedWorker } from './ai-painter-owned-worker-v1.mjs';

export const SHADOW_ROOT = '.runtime/ai-painter/generalization-evidence-shadow-m-d1-01';
export const RUN_ID = 'mvp256-dry-v27-v3-43ec72f180bd1a412baf3aa8de15a36de9730f65bebf8117';
export const DIAGNOSTIC_ROOT = `.runtime/ai-painter/stage4-mvp256-dry-v27-v3-executions/${RUN_ID}/dry-review/diagnostics/generalization-034fbef2a60847e3e2b7d9ec6a7c830dee89e1c11a1e77fbf306fc86bae13e72`;
export const REPORT = Object.freeze({path: `${DIAGNOSTIC_ROOT}/report.json`, sha256: '4639d25a8c0f0bc2f60592c15b23971de3a17b131124ea54df52568c4139a09e'});
export const ROLES = ['object_footprints', 'object_tree', 'object_rock', 'object_vegetation'];
export const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
export function hashFile(file) {
  const hash = crypto.createHash('sha256'), fd = fs.openSync(file, 'r'), buffer = Buffer.alloc(1024 * 1024);
  try { let n; while ((n = fs.readSync(fd, buffer, 0, buffer.length, null))) hash.update(buffer.subarray(0, n)); }
  finally { fs.closeSync(fd); }
  return hash.digest('hex');
}
export function inside(root, relative) {
  assert.equal(typeof relative, 'string');
  assert(relative.length && !relative.includes('\\') && !relative.includes(':') && !path.isAbsolute(relative));
  assert(!relative.split('/').some(p => p === '..' || p === '.' || !p));
  const result = path.resolve(root, relative);
  assert(result.startsWith(path.resolve(root) + path.sep), 'path escapes root');
  return result;
}
export function put(file, value) {
  const bytes = Buffer.from(JSON.stringify(value, null, 2) + '\n');
  assert(bytes.length <= 2 * 1024 * 1024, 'artifact byte budget exceeded');
  fs.mkdirSync(path.dirname(file), {recursive: true});
  const fd = fs.openSync(file, 'wx');
  try { fs.writeFileSync(fd, bytes); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  return {path: file, sha256: digest(bytes)};
}
const binding = b => ({path: b.path, sha256: b.sha256});
const sameBinding = (a, b) => assert.deepEqual(binding(a), binding(b), 'cross-file binding mismatch');
const mean = a => a.reduce((s, v) => s + v, 0) / a.length;
const sorted = v => Array.isArray(v) ? v.map(sorted) : v && typeof v === 'object'
  ? Object.fromEntries(Object.keys(v).sort().map(k => [k,sorted(v[k])])) : v;
function close(a, b, abs = 1e-12, rel = 1e-12) {
  assert(typeof a === 'number' && typeof b === 'number' && Number.isFinite(a) && Number.isFinite(b));
  assert(Math.abs(a - b) <= Math.max(abs, rel * Math.max(Math.abs(a), Math.abs(b))), 'numeric evidence mismatch');
}
function compare(actual, expected) {
  if (typeof expected === 'number') return close(actual, expected);
  if (expected === null || typeof expected !== 'object') return assert.equal(actual, expected);
  assert.deepEqual(Object.keys(actual).sort(), Object.keys(expected).sort(), 'evidence fields differ');
  for (const key of Object.keys(expected)) compare(actual[key], expected[key]);
}
export function summarize(rows) {
  for (const r of rows) {
    assert(Number.isFinite(r.rgbMae) && r.rgbMae >= 0 && r.rgbMae <= 1, 'invalid RGB');
    assert.deepEqual(Object.keys(r.correlations).sort(), [...ROLES].sort());
    for (const v of Object.values(r.correlations)) assert(v === null || (Number.isFinite(v) && v >= -1 && v <= 1), 'invalid correlation');
  }
  return {sampleCount: rows.length, meanRgbMae: mean(rows.map(r => r.rgbMae)), roles: Object.fromEntries(ROLES.map(role => {
    const a = rows.map(r => r.correlations[role]).filter(v => v !== null).sort((a,b) => a-b), n = a.length;
    return [role, {applicableCount: n, mean: n ? mean(a) : null, median: n ? (a[Math.floor((n-1)/2)] + a[Math.floor(n/2)]) / 2 : null,
      minimum: n ? a[0] : null, nonpositiveCount: a.filter(v => v <= 0).length}];
  }))};
}
export function classify(summaries) {
  const roles = Object.fromEntries(ROLES.map(role => {
    const a = summaries.train.roles[role].mean, b = summaries.validation.roles[role].mean;
    return [role, {trainMeanMinusValidationMean: a === null || b === null ? null : a-b}];
  }));
  return {roles, pattern: Object.values(roles).every(v => v.trainMeanMinusValidationMean !== null && v.trainMeanMinusValidationMean > 0)
    ? 'train_higher_on_all_applicable_roles' : 'mixed_or_insufficient_evidence',
    causalRootCause: 'not_identified_by_split_statistics', nextDiagnosticTarget: 'condition_target_alignment_and_distribution',
    trainingRestartRecommended: false, qualificationGranted: false};
}
function distribution(rows, channels) {
  const splits = Object.fromEntries(['train','validation'].map(split => {
    const group = rows.filter(r => r.split === split), kinds = {};
    for (const r of group) for (const [k,v] of Object.entries(r.census.objectKinds)) kinds[k] = (kinds[k] ?? 0) + v;
    return [split, {channelMeanRanges: Object.fromEntries(channels.map(name => {
      const a = group.map(r => r.census.channelMeans[name]);
      assert(a.every(v => Number.isFinite(v) && v >= 0 && v <= 1), 'invalid channel mean');
      return [name, {minimum: Math.min(...a), maximum: Math.max(...a), mean: mean(a)}];
    })), positiveWaterSampleCount: group.filter(r => r.census.channelMeans.terrain_water > 0).length, objectKinds: kinds}];
  }));
  const outside = [], duplicates = [];
  for (const r of rows.filter(r => r.split === 'validation')) {
    for (const [channel, value] of Object.entries(r.census.channelMeans)) {
      const range = splits.train.channelMeanRanges[channel];
      if (value < range.minimum || value > range.maximum) outside.push({sampleId: r.sampleId, channel, mean: value});
    }
    for (const t of rows.filter(t => t.split === 'train')) if (t.census.conditionTensorSha256 === r.census.conditionTensorSha256)
      duplicates.push({trainSampleId: t.sampleId, validationSampleId: r.sampleId, sameRgbTarget: t.census.rgbTargetTensorSha256 === r.census.rgbTargetTensorSha256});
  }
  return {splits, validationChannelMeanOutsideTrainRange: outside, exactCrossSplitConditionTensorMatches: duplicates,
    limitation: 'channel averages and exact matches do not prove coverage, leakage freedom or conditional identifiability'};
}

// No image decoding, checkpoint loading, Python imports, training, or model calls.
// Mutable current.json and guide files are never substitutes for historical bytes.
export function verifyEvidence(config) {
  const observed = new Map();
  function read(b, json = true) {
    assert(b && /^[a-f0-9]{64}$/.test(b.sha256), 'invalid SHA binding');
    const file = inside(config.sourceRoot, b.path);
    assert.equal(hashFile(file), b.sha256, `SHA mismatch: ${b.path}`);
    if (observed.has(b.path)) assert.equal(observed.get(b.path), b.sha256, 'conflicting input binding');
    observed.set(b.path, b.sha256);
    if (!json) return;
    assert(fs.statSync(file).size <= 8 * 1024 * 1024, 'JSON input too large');
    const bytes = fs.readFileSync(file);
    assert.equal(digest(bytes), b.sha256, 'input changed during read');
    return JSON.parse(bytes);
  }
  const r = read(config.report);
  assert.equal(r.schemaVersion, 'ai-painter-mvp256-dry-v27-generalization-diagnostic-v1');
  assert.equal(r.status, 'diagnostic_complete_not_formal_qualified');
  assert.equal(r.runId, RUN_ID, 'run identity mismatch');
  assert(Array.isArray(r.inputBindings) && r.inputBindings.length > 0);
  const direct = new Map(r.inputBindings.map(b => [b.path, b.sha256]));
  assert.equal(direct.size, r.inputBindings.length, 'duplicate direct input binding');
  const directRead = (b, json = true) => { assert.equal(direct.get(b.path), b.sha256, 'missing direct binding'); return read(b, json); };
  for (const b of r.inputBindings) read(b, false);
  const train = read(r.inputs.trainingTerminal), review = read(r.inputs.reviewTerminal), cpu = read(r.cpuComparison);
  const pkg = read(train.executionPackage), manifest = read(r.datasetManifest), source = read(manifest.sourceIndex);
  for (const v of [train, review, cpu, pkg]) {
    assert.equal(v.runId, r.runId, 'upstream run mismatch');
    assert.equal(v.packageId, train.packageId, 'upstream package mismatch');
  }
  assert.equal(train.status, 'training_completed_review_pending');
  assert.equal(review.status, 'dry_single_world_review_failed_closed');
  assert.equal(review.executionState, 'failed_closed');
  assert.equal(review.routeDecision, 'close_shared_hidden_route_no_automatic_retry');
  assert.equal(r.inputs.reviewTerminal.status, review.status);
  assert.equal(cpu.status, 'cpu_comparison_completed_visual_review_pending');
  for (const v of [train, review, cpu]) sameBinding(v.selectedCheckpoint, r.inputs.selectedCheckpoint);
  for (const v of [review, cpu]) sameBinding(v.trainingTerminal, r.inputs.trainingTerminal);
  sameBinding(review.cpuComparison, r.cpuComparison); sameBinding(cpu.executionPackage, train.executionPackage);
  sameBinding(cpu.measurements.v27.checkpoint, r.inputs.selectedCheckpoint);
  assert.equal(train.selectedEpoch, cpu.selectedEpoch); assert.equal(train.selectedEpoch, 48);
  sameBinding(pkg.datasetManifest, r.datasetManifest);
  for (const b of [r.inputs.selectedCheckpoint, r.inputs.program, r.inputs.tests]) read(b, false);
  for (const b of Object.values(pkg.programBindings)) read(b, false);
  const policy = read(pkg.candidateContract), acceptance = read(pkg.cpuAcceptance);
  sameBinding(policy.cpuAcceptance, pkg.cpuAcceptance);
  // These observations actually occur upstream; report.inputBindings has neither.
  const h = policy.historicalRegistryObservation, transaction = read(h.transaction), snapshot = read(h.snapshot), event = read(h.event);
  assert.equal(transaction.status, 'committed'); assert(transaction.committedAtUtc);
  assert.equal(transaction.transactionId, event.transactionId);
  assert.equal(transaction.registryRevision, h.observed.registryRevision);
  assert.equal(snapshot.registryRevision, transaction.registryRevision);
  assert.equal(snapshot.transactionId, transaction.transactionId);
  assert.equal(snapshot.eventSequence, transaction.eventSequence);
  assert.equal(event.registryRevision, transaction.registryRevision);
  assert.equal(event.eventSequence, transaction.eventSequence);
  assert.equal(transaction.currentSha256, h.observed.sha256);
  assert.equal(event.currentSha256, h.observed.sha256);
  assert.equal(h.snapshot.sha256, h.observed.sha256);
  assert(h.snapshot.path.endsWith('/' + transaction.transactionId + '/current.staged.json'));
  sameBinding(transaction.currentStaged, h.snapshot); sameBinding(transaction.registryEventStaged, h.event);
  assert.equal(snapshot.activeExecution, h.observed.activeExecution);
  const guideSnapshot = {path: `${DIAGNOSTIC_ROOT}/execution-guide-at-diagnosis.bin`, sha256: acceptance.executionGuide.sha256};
  read(guideSnapshot, false);
  assert.equal(acceptance.executionGuide.path, 'docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md');
  const ids = [], channels = manifest.identityPayload.channelOrder;
  assert.equal(channels.length, 23); assert.equal(new Set(channels).size, 23);
  assert.equal(r.rows.length, 56);
  const byId = new Map(source.samples.map(row => [row.sampleId, row]));
  assert.equal(byId.size, source.samples.length);
  for (const [split, count] of [['train',48], ['validation',8]]) {
    sameBinding(pkg[split + 'Split'], r[split + 'Split']); sameBinding(manifest.splits[split], r[split + 'Split']);
    const membership = directRead(r[split + 'Split']), rows = r.rows.filter(row => row.split === split);
    assert.equal(membership.split, split); assert.equal(membership.sampleIds.length, count);
    assert.equal(rows.length, count); assert.equal(manifest.splitCounts[split], count);
    assert.deepEqual(rows.map(row => row.sampleId), membership.sampleIds, 'split membership or order mismatch');
    ids.push(...membership.sampleIds);
    rows.forEach((row, ordinal) => {
      const id = row.identity, sample = byId.get(row.sampleId);
      assert(sample); assert.equal(sample.split, split);
      assert.equal(row.ordinal, ordinal);
      // The source loader records identity.ordinal=0; ordered report rows carry the split ordinal.
      assert.equal(id.ordinal, 0);
      for (const v of [row,id]) { assert.equal(v.split, split); assert.equal(v.sampleId, row.sampleId); }
      sameBinding(id.image, sample.image); sameBinding(id.conditionPack, sample.conditionPack);
      assert.equal(id.worldId, sample.grouping.worldId);
      directRead(id.image, false);
      const condition = directRead(id.conditionPack), task = directRead(id.taskPackage), visual = directRead(id.visualFactManifestFile);
      for (const v of [condition,task,visual]) { assert.equal(v.worldId, id.worldId); assert.equal(v.tick, id.tick); }
      assert.equal(task.sourceBindings.naturalizedWorldFactsSha256, id.factHash);
      assert.equal(condition.sourceBindings.taskPackagePath, id.taskPackage.path);
      assert.equal(condition.sourceBindings.visualFactManifestPath, id.visualFactManifestFile.path);
      assert.equal(condition.visualFactManifestSha256, id.visualFactManifestContentSha256);
      assert.equal(visual.manifestSha256, id.visualFactManifestContentSha256);
      assert.equal(condition.objectInstanceTable.length, id.objectCount);
      assert.equal(digest(JSON.stringify(sorted(condition.objectInstanceTable))), id.objectTableSha256);
      assert.deepEqual(id.channels.map(c => c.id), channels);
      assert.deepEqual(condition.channels.map(c => ({id:c.id,path:c.path,sha256:c.sha256})), id.channels);
      for (const c of id.channels) directRead(c, false);
      assert.deepEqual(Object.keys(row.census.channelMeans), channels);
      assert.deepEqual(row.census.modelInputs, ['conditions','objectInstanceTable']); assert.equal(row.census.rgbTargetPassedToModel, false);
      for (const key of ['conditionTensorSha256','rgbTargetTensorSha256']) assert(/^[a-f0-9]{64}$/.test(row.census[key]));
      const kinds = {};
      for (const item of condition.objectInstanceTable) kinds[item.kind] = (kinds[item.kind] ?? 0) + 1;
      assert.deepEqual(row.census.objectKinds, kinds);
      const shapes = Object.fromEntries(Object.keys(kinds).sort().map(kind => {
        const group = condition.objectInstanceTable.filter(item => item.kind === kind);
        return [kind,{count:group.length,nativeWidths:[...new Set(group.map(i=>i.footprint.width))].sort((a,b)=>a-b),
          nativeHeights:[...new Set(group.map(i=>i.footprint.height))].sort((a,b)=>a-b)}];
      }));
      assert.deepEqual(row.census.footprintShapes, shapes);
      assert.deepEqual(row.census.objectTableFields,[...new Set(condition.objectInstanceTable.flatMap(Object.keys))].sort());
    });
    compare(r.summaries[split], summarize(rows));
  }
  assert.equal(new Set(ids).size, 56, 'split overlap');
  assert.deepEqual(r.rows.map(row => row.sampleId), ids);
  const validation = r.rows.filter(row => row.split === 'validation'), saved = cpu.measurements.v27.rows;
  assert.deepEqual(cpu.validationSampleIds, validation.map(row => row.sampleId));
  assert.deepEqual(saved.map(row => row.sampleId), validation.map(row => row.sampleId));
  validation.forEach((row,i) => {
    const old = saved[i].observation;
    assert.equal(old.sampleId, row.sampleId); assert.equal(old.split, 'validation'); assert.equal(old.epoch, train.selectedEpoch);
    close(row.rgbMae, old.fullRgbMae, 1e-7, 1e-6);
    for (const role of ROLES) {
      if (row.correlations[role] === null || old.objectCorrelations[role] === null) assert.equal(row.correlations[role], old.objectCorrelations[role]);
      else close(row.correlations[role], old.objectCorrelations[role], 1e-7, 1e-6);
    }
  });
  const summaries = Object.fromEntries(['train','validation'].map(s => [s, summarize(r.rows.filter(row => row.split === s))]));
  const classification = classify(summaries); compare(r.splitComparison, classification); compare(r.conditionDistribution, distribution(r.rows, channels));
  assert.equal(r.boundary.modelForwardCalls, 56);
  for (const key of ['gpuStarted','weightsModified','checkpointSelectionModified','registryModified','challengeContentRead','regressionContentRead','stage4Advanced']) assert.equal(r.boundary[key], false);
  for (const [p,h] of observed) assert.equal(hashFile(inside(config.sourceRoot,p)), h, 'input changed during verification');
  return {schemaVersion: 'ai-painter-generalization-evidence-verification-v1', status: 'verified_descriptive_evidence_only', report: config.report,
    runId: r.runId, directBindingCount: direct.size, verifiedBindingCount: observed.size,
    bindingsSha256: digest(JSON.stringify([...observed].sort())), summaries, classification,
    historicalRegistry: {revision: transaction.registryRevision, transaction: h.transaction, snapshot: h.snapshot, event: h.event},
    historicalGuide: {observed: acceptance.executionGuide, snapshot: guideSnapshot},
    boundary: {modelForwardCalls: 0, gpuStarted: false, trainingStarted: false, imagesDecoded: 0, qualificationGranted: false,
      registryModified: false, checkpointPromoted: false, automaticRepairImplemented: false, productionAutoDispatchImplemented: false}};
}

function configFor(context) {
  const b = context.inputEvidence.find(b => b.path === 'shadow-input.json'); assert(b);
  const p = inside(context.projectRoot, b.path); assert.equal(hashFile(p), b.sha256);
  const config = JSON.parse(fs.readFileSync(p));
  assert.equal(path.resolve(config.projectRoot), context.projectRoot);
  assert(context.projectRoot.startsWith(path.resolve(config.sourceRoot, SHADOW_ROOT) + path.sep));
  assert(Number.isInteger(config.timeoutMs) && config.timeoutMs > 0 && config.timeoutMs <= 170000);
  return config;
}
const output = (context, name) => inside(context.projectRoot, context.outputRoot + '/' + name);
function passed(context, name, data) { return {status: 'passed', artifact: put(output(context,name), data)}; }
export function preflight(context) {
  const c = configFor(context); assert.equal(hashFile(inside(c.sourceRoot,c.report.path)), c.report.sha256, 'report SHA mismatch');
  return passed(context, 'preflight.json', {report: c.report, retries: 0, cpuThreads: 2, modelForwardCalls: 0});
}
export async function execute(context) {
  const c = configFor(context), worker = inside(context.projectRoot,c.worker.path);
  assert.equal(hashFile(worker), c.worker.sha256, 'worker SHA mismatch');
  try {
    const result = await runOwnedWorker(process.execPath, [worker, '--verify-worker', context.projectRoot], {
      cwd: context.projectRoot, env: {...process.env, OMP_NUM_THREADS: '2', MKL_NUM_THREADS: '2', OPENBLAS_NUM_THREADS: '2', UV_THREADPOOL_SIZE: '2', CUDA_VISIBLE_DEVICES: ''}, timeout: c.timeoutMs,
    });
    put(output(context,'worker-receipt.json'), result.ownedReceipt);
    assert.equal(result.ownedReceipt.cleanupConfirmed, true);
    return {status: 'passed', artifact: {path: output(context,'verified.json'), sha256: hashFile(output(context,'verified.json'))}};
  } catch (error) {
    put(output(context,'worker-failure.json'), {code: error.code ?? null, message: String(error.message), stderr: String(error.stderr ?? '').slice(0,8192), ownedReceipt: error.ownedReceipt ?? null});
    return {status: 'failed', failureKind: 'program', failureCode: error.code === 'ETIMEDOUT' ? 'hard_timeout' : 'evidence_worker_failed', detail: String(error.message)};
  }
}
export function validate(context) {
  configFor(context);
  const v = JSON.parse(fs.readFileSync(output(context,'verified.json')));
  assert.equal(v.status, 'verified_descriptive_evidence_only'); assert.equal(v.boundary.modelForwardCalls, 0);
  return passed(context,'validation.json',{verified: {path: output(context,'verified.json'), sha256: hashFile(output(context,'verified.json'))}, qualificationGranted: false});
}
export function review(context) {
  const v = JSON.parse(fs.readFileSync(output(context,'verified.json')));
  compare(v.classification, classify(v.summaries));
  return passed(context,'review.json',{status: 'evidence_consistency_review_passed', semanticApprovalGranted: false, causalRootCause: 'unknown'});
}
export function adjudicate(context) {
  const v = JSON.parse(fs.readFileSync(output(context,'verified.json')));
  return passed(context,'classification.json',{...v.classification, report: v.report, causalConclusion: 'unknown',
    positiveWaterAndShorelineCapability: 'unverified_not_passed', formalStage4QualificationGranted: false, checkpointPromotionEligible: false});
}
function physicalShadowPath(root, target) {
  const realRoot = fs.realpathSync(root);
  let existing = target;
  while (!fs.existsSync(existing)) existing = path.dirname(existing);
  const real = fs.realpathSync(existing);
  assert(real === realRoot || real.startsWith(realRoot + path.sep), 'index path escapes physical shadow root');
}
function artifactIdentity(row) {
  return {logicalPath: row.logical_path, physicalUri: row.physical_uri, storageLayer: row.storage_layer,
    runId: row.run_id, artifactType: row.artifact_type, byteSize: row.byte_size,
    modifiedAtUtc: row.modified_at_utc, sha256: row.sha256, migrationId: row.migration_id};
}
function exactJson(file, value) {
  if (!fs.existsSync(file)) return put(file,value);
  assert.deepEqual(JSON.parse(fs.readFileSync(file)),value,'immutable index record conflict');
  return {path:file,sha256:hashFile(file)};
}

// Only the three files named by the original intent may be re-indexed. This
// function never invokes verifyEvidence, phase execution, Python or model code.
export async function commitShadowIndex(context, {recover = false, expectedIntentSha256 = null, _testHooks = null} = {}) {
  const c = configFor(context), catalogRoot = path.join(context.projectRoot,'catalog-data');
  const directory = path.dirname(output(context,'index-intent.json'));
  physicalShadowPath(context.projectRoot,directory); physicalShadowPath(context.projectRoot,catalogRoot);
  assert(!fs.existsSync(path.join(context.projectRoot,'.runtime/ai-painter/owned-worker-guards/active.json')), 'unknown owned worker guard blocks indexing');
  if (recover) assert(!fs.existsSync(path.join(context.executionRoot,'execution-runner-lease')), 'unknown execution lease blocks index recovery');
  const lock = path.join(directory,'index-transaction.lock');
  fs.mkdirSync(lock); // Never inspect/remove/take over a pre-existing unknown lock.
  const owner={token:crypto.randomUUID(),pid:process.pid};
  put(path.join(lock,'owner.json'),owner);
  try {
    const intentPath = output(context,'index-intent.json');
    const expectedFiles = [
      {logicalPath:context.outputRoot+'/verified.json',physicalUri:output(context,'verified.json'),artifactType:'generalization_evidence'},
      {logicalPath:context.outputRoot+'/classification.json',physicalUri:output(context,'classification.json'),artifactType:'generalization_evidence'},
      {logicalPath:c.report.path,physicalUri:inside(c.sourceRoot,c.report.path),artifactType:'source_diagnostic'},
    ];
    let intent;
    if (recover || fs.existsSync(intentPath)) {
      assert(fs.existsSync(intentPath),'index intent missing; recovery cannot create one');
      if (recover) {
        assert(/^[a-f0-9]{64}$/.test(expectedIntentSha256 ?? ''),'recovery requires original intent SHA');
        assert.equal(hashFile(intentPath),expectedIntentSha256,'index intent SHA mismatch');
      }
      intent = JSON.parse(fs.readFileSync(intentPath));
    } else {
      const artifacts = expectedFiles.map(p=>{
        const stat=fs.statSync(p.physicalUri);
        return {...p,storageLayer:'hot',runId:context.packageIdentity,byteSize:stat.size,
          modifiedAtUtc:stat.mtime.toISOString(),sha256:hashFile(p.physicalUri),migrationId:null};
      });
      const identity = {schemaVersion:'ai-painter-shadow-index-intent-v1',packageIdentity:context.packageIdentity,
        inputEvidence:context.inputEvidence,catalogPath:path.join(catalogRoot,'catalog/ai-pet-world-catalog.sqlite'),artifacts};
      intent={...identity,transactionId:'shadow-index-'+digest(JSON.stringify(sorted(identity)))};
      put(intentPath,intent);
    }
    const {transactionId,...identity} = intent;
    assert.equal(transactionId,'shadow-index-'+digest(JSON.stringify(sorted(identity))),'index transaction identity mismatch');
    assert.equal(intent.schemaVersion,'ai-painter-shadow-index-intent-v1');
    assert.equal(intent.packageIdentity,context.packageIdentity,'index package mismatch');
    assert.deepEqual(intent.inputEvidence,context.inputEvidence,'index inputs mismatch');
    assert.equal(intent.catalogPath,path.join(catalogRoot,'catalog/ai-pet-world-catalog.sqlite'));
    assert.equal(intent.artifacts.length,3);
    assert.equal(new Set(intent.artifacts.map(a=>a.logicalPath)).size,3,'duplicate index artifact');
    intent.artifacts.forEach((a,i)=>{
      for(const k of ['logicalPath','physicalUri','artifactType'])assert.equal(a[k],expectedFiles[i][k],'index artifact target mismatch');
      assert.equal(a.runId,context.packageIdentity);assert.equal(a.storageLayer,'hot');assert.equal(a.migrationId,null);
      assert.equal(hashFile(a.physicalUri),a.sha256,'indexed file changed');
      const stat=fs.statSync(a.physicalUri);assert.equal(stat.size,a.byteSize);assert.equal(stat.mtime.toISOString(),a.modifiedAtUtc);
    });
    assert.equal(intent.artifacts[2].sha256,c.report.sha256,'source report identity mismatch');
    physicalShadowPath(context.projectRoot,intent.catalogPath);
    const intentSha256=hashFile(intentPath);
    const receipt={status:'isolated_catalog_committed',transactionId,intent:{path:intentPath,sha256:intentSha256},
      catalogPath:intent.catalogPath,indexedFileCount:3,qualificationGranted:false,productionCatalogModified:false};
    const receiptPath=output(context,'index-commit.json');
    if(fs.existsSync(receiptPath))assert.deepEqual(JSON.parse(fs.readFileSync(receiptPath)),receipt,'index receipt conflict');
    const event={id:transactionId,timestamp:intent.artifacts[0].modifiedAtUtc,action:'commit_shadow_evidence_index',
      runId:context.packageIdentity,kind:'shadow_index_commit',status:'committed',evidencePath:intentPath,
      intentSha256,artifactSetSha256:digest(JSON.stringify(sorted(intent.artifacts)))};
  // Dynamic import is deliberately after isolation is asserted, before first open.
  process.env.AI_PET_WORLD_DATA_ROOT = catalogRoot;
  const storage = await import('./ai-pet-world-storage.mjs');
  assert.equal(storage.dataRoot, catalogRoot, 'production catalog access refused');
  const catalog = await import('./ai-pet-world-storage-catalog.mjs');
  let db;
  try {
    db = catalog.openStorageCatalog(); db.exec('BEGIN IMMEDIATE');
    const existingEvent=db.prepare('SELECT * FROM program_events WHERE event_id=?').get(transactionId);
    const rows=intent.artifacts.map(a=>db.prepare('SELECT * FROM artifacts WHERE logical_path=?').get(a.logicalPath));
    rows.forEach((row,i)=>{if(row)assert.deepEqual(artifactIdentity(row),intent.artifacts[i],'index artifact identity conflict');});
    if(existingEvent) {
      assert.equal(existingEvent.event_json,JSON.stringify(event),'index event identity conflict');
      for(const [column,key] of [['timestamp_utc','timestamp'],['action','action'],['run_id','runId'],['kind','kind'],['status','status'],['evidence_path','evidencePath']])
        assert.equal(existingEvent[column],event[key],'index event column conflict');
      assert(rows.every(Boolean),'committed index event has missing artifact');
    } else {
      assert(!fs.existsSync(receiptPath),'index receipt has no committed transaction');
      for(let i=0;i<rows.length;i++)if(!rows[i])catalog.indexArtifact(intent.artifacts[i]);
      catalog.indexProgramEvent(event);
    }
    for(const a of intent.artifacts)assert.deepEqual(artifactIdentity(db.prepare('SELECT * FROM artifacts WHERE logical_path=?').get(a.logicalPath)),a);
    assert.equal(db.prepare('SELECT event_json FROM program_events WHERE event_id=?').get(transactionId).event_json,JSON.stringify(event));
    db.exec('COMMIT');
    _testHooks?.afterCommit?.();
    for(const a of intent.artifacts){assert.equal(hashFile(a.physicalUri),a.sha256);assert.deepEqual(artifactIdentity(db.prepare('SELECT * FROM artifacts WHERE logical_path=?').get(a.logicalPath)),a);}
    return exactJson(receiptPath,receipt);
  } catch (error) { if (db?.isTransaction) db.exec('ROLLBACK'); throw error; }
  finally { catalog.closeStorageCatalog(); }
  } catch(error) {
    put(output(context,'index-failures/'+crypto.randomUUID()+'.json'),{status:'index_failed_preserved',recover,
      expectedIntentSha256,error:String(error.stack??error),recordedAtUtc:new Date().toISOString()});
    throw error;
  } finally {
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(lock,'owner.json'))),owner,'index lock ownership changed');
    fs.unlinkSync(path.join(lock,'owner.json')); fs.rmdirSync(lock);
  }
}
export async function finalize(context) {
  return {status:'passed',artifact:await commitShadowIndex(context)};
}
