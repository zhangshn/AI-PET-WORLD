import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const checker = path.resolve('scripts/check-ai-painter-training-run-archive.mjs');
function withArchive(check) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'archive-quality-check-'));
  try {
    fs.mkdirSync(path.join(root, 'materials'));
    fs.writeFileSync(path.join(root, 'materials', 'slot.png'), 'fixture file, not an image qualification');
    fs.writeFileSync(path.join(root, 'evidence.json'), '{}');
    const evidence = 'evidence.json';
    const manifest = {
      schemaVersion: 'ai-painter-training-run-archive-v1', runId: 'private-archive-fixture', action: 'archive_existing',
      status: 'archived_existing', startedAt: '2026-11-11T00:00:00Z', finishedAt: '2026-11-11T00:00:01Z',
      referenceBaseline: {archivedImage: evidence}, inference: {archivedMaterialDir: 'materials'},
      quality: {materialPassed: true, formalVisualJudgePassed: true, formalVisualJudgeIssues: [],
        archivedMaterialQualityReport: evidence, archivedFormalVisualJudge: evidence},
      output: {archivedCompositeOutput: evidence, archivedApprovedPack: evidence,
        archivedRuntimeFrameCandidate: evidence, compositeImageMeta: {width: 1024, height: 768}},
      training: {archivedDatasetSummary: evidence, categories: {grass: {archivedSummary: evidence}, road: {archivedSummary: evidence}}},
      model: {archivedModelManifest: evidence}, visualDeltaReview: {archivedReport: evidence, priorityIssueCount: 1, targetSlots: ['tree']},
      // Existing v1 metadata only; this checker never creates an approval workflow.
      manualReview: {required: true, status: 'pending_owner_review'},
    };
    const run = () => {
      fs.writeFileSync(path.join(root, 'manifest.json'), JSON.stringify(manifest));
      const result = spawnSync(process.execPath, [checker, 'manifest.json'], {cwd: root, windowsHide: true, encoding: 'utf8', timeout: 10000});
      assert.equal(result.error, undefined);
      return {code: result.status, value: JSON.parse(result.stdout || result.stderr)};
    };
    check({root, manifest, run});
  } finally {
    assert.equal(path.dirname(fs.realpathSync(root)), fs.realpathSync(os.tmpdir()));
    assert.match(path.basename(root), /^archive-quality-check-/u);
    fs.rmSync(root, {recursive: true});
  }
}

test('complete legacy success and formal-quality failure are both inspectable archives without qualification', () => withArchive(({manifest, run}) => {
  assert.equal(run().code, 0);
  manifest.quality.formalVisualJudgePassed = false;
  manifest.quality.formalVisualJudgeIssues = ['object_shape_failed'];
  const failedQuality = run();
  assert.equal(failedQuality.code, 0, JSON.stringify(failedQuality.value));
  assert.equal(failedQuality.value.formalQualificationGranted, false);
  assert.equal(failedQuality.value.recordedQuality.formalVisualJudgePassed, false);
  manifest.quality.formalVisualJudgeIssues = [];
  assert.equal(run().code, 1);
  manifest.quality.formalVisualJudgeIssues = ['object_shape_failed'];
  manifest.quality.formalVisualJudgePassed = null;
  assert.equal(run().code, 1);
}));

test('material failure retains its own evidence and rejects contradictory success or stale outputs', () => withArchive(({manifest, run}) => {
  manifest.status = 'archived_existing_failed_material_quality';
  assert.equal(run().code, 1, 'failed-material status cannot carry materialPassed=true');
  manifest.quality.materialPassed = false;
  manifest.quality.failedSlots = [{slotId: 'tree', issues: ['shape']}];
  manifest.quality.archivedFormalVisualJudge = null;
  manifest.quality.formalVisualJudgePassed = null;
  manifest.output.archivedCompositeOutput = null;
  manifest.output.archivedRuntimeFrameCandidate = null;
  assert.equal(run().code, 0);
  manifest.output.archivedCompositeOutput = 'evidence.json';
  assert.equal(run().code, 1);
}));

test('failed visual quality cannot conceal a missing archived report', () => withArchive(({manifest, run}) => {
  manifest.quality.formalVisualJudgePassed = false;
  manifest.quality.formalVisualJudgeIssues = ['shape'];
  manifest.quality.archivedFormalVisualJudge = 'missing.json';
  const result = run();
  assert.equal(result.code, 1);
  assert(result.value.failures.some(message => message.includes('Formal VisualJudge')));
}));
