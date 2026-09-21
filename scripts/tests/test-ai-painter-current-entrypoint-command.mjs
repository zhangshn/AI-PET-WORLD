import assert from 'node:assert/strict';
import test from 'node:test';
import {verifyCurrentEntrypointCommand as verify} from '../lib/ai-painter-current-entrypoint-command.mjs';
const file='scripts/run-ai-painter-learning-capacity-experiment.mjs';
const prepare={packageScript:'prepare:ai-painter-learning-capacity-experiment',entryFile:file,
  role:'bounded_train_only_experiment_preparation_no_formal_qualification'};
const run={packageScript:'run:ai-painter-learning-capacity-experiment',entryFile:file,
  role:'bounded_train_only_experiment_no_formal_stage_or_publication'};
test('explicit prepare and run are different verified commands',()=>{
  const a=verify(prepare,`node ${file} prepare`),b=verify(run,`node ${file} run`);
  assert.notEqual(a.commandIdentity,b.commandIdentity);assert.deepEqual(a.args,['prepare']);assert.deepEqual(b.args,['run']);
});
for(const suffix of ['', ' run', ' prepare --unsafe', ' prepare && shutdown', ' prepare;evil'])
  test(`rejects wrong prepare suffix ${JSON.stringify(suffix)}`,()=>assert.throws(()=>verify(prepare,`node ${file}${suffix}`)));
test('role substitution cannot change action meaning',()=>assert.throws(()=>verify({...prepare,role:run.role},`node ${file} prepare`)));
test('registered action cannot point at another executable',()=>assert.throws(()=>verify({...prepare,entryFile:'scripts/other.mjs'},'node scripts/other.mjs prepare')));
test('ordinary entries still require exact argument-free commands',()=>{
  const entry={packageScript:'check:example',entryFile:'scripts/check-example.mjs',role:'check'};
  assert.deepEqual(verify(entry,'node scripts/check-example.mjs').args,[]);
  assert.throws(()=>verify(entry,'node scripts/check-example.mjs run'));
});
test('escaping or shell-bearing file paths are rejected',()=>{
  for(const entryFile of ['scripts/../outside.mjs','scripts/evil.mjs;run.mjs','C:/evil.mjs'])
    assert.throws(()=>verify({packageScript:'check:any',entryFile},`node ${entryFile}`));
});
