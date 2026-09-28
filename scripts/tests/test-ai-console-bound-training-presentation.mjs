import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {readBoundTrainingPresentation} from '../../src/server/ai-console/bound-training-presentation.mjs';

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'aic-training-summary-'));
  t.after(() => fs.rm(root, {recursive:true, force:true}));
  await fs.mkdir(path.join(root,'.runtime','run'),{recursive:true});
  const pkg = {schemaVersion:'ai-painter-learning-capacity-experiment-package-v1', evidenceContractVersion:1,
    experimentIdentity:'owned', scope:'train_only', resolution:[256,192],
    training:{epochs:48,maxGeneratorOptimizerSteps:2304}};
  const binding = {path:'.runtime/run/package.json',sha256:''};
  async function write(value = pkg) {
    const bytes = JSON.stringify(value); await fs.writeFile(path.join(root,binding.path),bytes);
    binding.sha256 = createHash('sha256').update(bytes).digest('hex');
  }
  await write();
  const registry = {runId:'owned',activeExecution:null};
  const capsule = {evidence:[binding]};
  const terminal = {runId:'owned',actualFinalOptimizerSteps:{generator:1761,discriminator:1761}};
  return {root,pkg,binding,write,registry,capsule,terminal,
    read:()=>readBoundTrainingPresentation(root,registry,capsule,terminal)};
}
test('bound plan and ended actual counts are distinct; no guessed completed epoch', async t => {
  const f = await fixture(t), value = await f.read();
  assert.equal(value.availability,'available'); assert.deepEqual(value.resolution,{width:256,height:192});
  assert.equal(value.targetEpochs,48); assert.equal(value.targetOptimizerSteps,2304);
  assert.deepEqual(value.actualOptimizerSteps,{generator:1761,critic:1761}); assert.equal(value.completedEpochs,null);
  f.registry.activeExecution = {processId:123};
  assert.equal((await f.read()).actualOptimizerSteps,null);
});
test('new bound plans are not hardcoded; missing plan fields remain unknown', async t => {
  const f = await fixture(t); f.pkg.resolution=[128,96];f.pkg.training={epochs:7,maxGeneratorOptimizerSteps:2000};
  await f.write();const value = await f.read(); assert.equal(value.targetEpochs,7);assert.equal(value.resolution.width,128);
  delete f.pkg.training;await f.write();const missing=await f.read();assert.equal(missing.targetEpochs,null);
  assert.equal(missing.reasonCode,'training_plan_fields_unavailable');
});
test('foreign, duplicate, missing and unsupported binding cannot substitute history', async t => {
  const f = await fixture(t); f.pkg.experimentIdentity='foreign';await f.write();
  assert.equal((await f.read()).reasonCode,'training_package_run_mismatch');
  f.pkg.experimentIdentity='owned';f.pkg.schemaVersion='future';await f.write();
  assert.equal((await f.read()).reasonCode,'training_package_schema_unsupported');
  f.capsule.evidence.push({...f.binding});assert.equal((await f.read()).availability,'unavailable');
  f.capsule.evidence=[];assert.equal((await f.read()).availability,'unavailable');
});
test('changed bytes, oversized package and lexical escape fail closed summary', async t => {
  const f = await fixture(t); await fs.appendFile(path.join(f.root,f.binding.path),' ');
  assert.equal((await f.read()).reasonCode,'training_package_sha256_mismatch');
  await f.write('x'.repeat(2*1024*1024+1));assert.equal((await f.read()).reasonCode,'training_package_size_limit');
  f.binding.path='../outside/package.json';assert.equal((await f.read()).reasonCode,'training_package_binding_invalid');
});
test('terminal limits and compact facts are checked; foreign terminal not projected', async t => {
  const f = await fixture(t);f.terminal.completedEpochs=36;f.terminal.errorCode='progress_write_failed';
  assert.equal((await f.read()).completedEpochs,36);assert.equal((await f.read()).errorCode,'progress_write_failed');
  f.terminal.actualFinalOptimizerSteps.generator=2305;
  assert.equal((await f.read()).reasonCode,'training_terminal_step_limit_conflict');
  f.terminal.runId='foreign';assert.equal((await f.read()).actualOptimizerSteps,null);
});
test('real path junction outside project is refused, not read', async t => {
  const f = await fixture(t);
  const outside = await fs.mkdtemp(path.join(os.tmpdir(),'aic-training-outside-'));
  t.after(() => fs.rm(outside,{recursive:true,force:true}));
  await fs.writeFile(path.join(outside,'package.json'),JSON.stringify(f.pkg));
  await fs.symlink(outside,path.join(f.root,'.runtime','linked'),process.platform === 'win32' ? 'junction' : 'dir');
  f.binding.path='.runtime/linked/package.json';
  assert.equal((await f.read()).reasonCode,'training_package_boundary_violation');
});
