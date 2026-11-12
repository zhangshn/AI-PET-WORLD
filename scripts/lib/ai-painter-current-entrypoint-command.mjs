import assert from 'node:assert/strict';

export function retiredEntrypointCommand(packageScript) {
  assert.match(packageScript ?? '', /^[a-z][a-z0-9:-]{0,159}$/u, 'invalid retired package script');
  return `node scripts/retired-ai-painter-entrypoint.mjs ${packageScript}`;
}

// This audits literal package-command references, not arbitrary shell programs.
const normalizeCommand = command => command.replaceAll('\\', '/').replace(/["']/gu, '').toLowerCase();

export function verifyRetiredCommandExposure(scripts, retiredEntries) {
  assert.ok(scripts && typeof scripts === 'object' && !Array.isArray(scripts));
  assert.ok(Array.isArray(retiredEntries));
  for (const [commandName, command] of Object.entries(scripts)) {
    assert.equal(typeof command, 'string');
    const normalized = normalizeCommand(command);
    for (const entry of retiredEntries) {
      assert.match(entry.entryFile ?? '', /^scripts\/[a-zA-Z0-9._/-]+\.mjs$/u);
      assert.ok(!entry.entryFile.split('/').includes('..'));
      const basename = entry.entryFile.toLowerCase().split('/').at(-1);
      assert.ok(!normalized.includes(basename), `undeclared retired source reference in ${commandName}: ${entry.entryFile}`);
    }
  }
  return [];
}

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
