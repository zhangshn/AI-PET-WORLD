import assert from 'node:assert/strict';

// Compatibility for the two already registered actions sharing one CLI.
// No arbitrary suffix, shell expression, or caller-provided argument is accepted.
const EXPERIMENT_ACTIONS = Object.freeze({
  'prepare:ai-painter-learning-capacity-experiment': {
    mode: 'prepare', role: 'bounded_train_only_experiment_preparation_no_formal_qualification',
  },
  'run:ai-painter-learning-capacity-experiment': {
    mode: 'run', role: 'bounded_train_only_experiment_no_formal_stage_or_publication',
  },
});

export function verifyCurrentEntrypointCommand(entry, command) {
  assert.match(entry.entryFile ?? '', /^scripts\/[a-zA-Z0-9._/-]+\.mjs$/u, 'invalid current entry file');
  assert.ok(!entry.entryFile.split('/').includes('..'), 'current entry file escapes project');
  let args = [];
  if (Object.hasOwn(EXPERIMENT_ACTIONS, entry.packageScript)) {
    const action = EXPERIMENT_ACTIONS[entry.packageScript];
    assert.equal(entry.entryFile, 'scripts/run-ai-painter-learning-capacity-experiment.mjs', 'experiment entry file conflict');
    assert.equal(entry.role, action.role, 'experiment action role conflict');
    args = [action.mode];
  }
  const expected = ['node', entry.entryFile, ...args].join(' ');
  assert.equal(command, expected, `current package entry mismatch: ${entry.packageScript}`);
  return { commandIdentity: expected, args };
}
