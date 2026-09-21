// Test fixture only. Never restore these historical bytes into the working tree.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

export const FROZEN_COMPILER = Object.freeze({
  commit: '542c1c05e7ab75123db85b656725ec96ac4eb003',
  path: 'scripts/compile-current-world-visual-conditions.mjs',
  sha256: 'ec3caf37b3169cf50342cccc4ade2b8277903e77dc3a70cee3a60d886e136447',
});

export function readFrozenCompilerFixture(root) {
  return readPinned(root, FROZEN_COMPILER);
}

// The other two extraction-baseline comparisons in the same hydrology suite
// must not silently turn into current-code-versus-itself after a Git commit.
export function readFrozenHydrologyFixture(root, kind) {
  const bindings = {
    corridor: { path: 'scripts/build-earth-geospatial-complete-map-conditions.mjs',
      sha256: '45e678640a4f4a12d7008569175dc64e5504f963cab57202cd0915bd26478da2' },
    novelty: { path: 'scripts/lib/ai-assisted-pre-rgb-condition-guide-novelty.mjs',
      sha256: '5c198da690e7fe099a7bdb6270f290d802f37d1ab1c3f8384acf8a0cd5c1c214' },
  };
  assert.ok(Object.hasOwn(bindings, kind), 'unknown historical fixture');
  return readPinned(root, {commit: FROZEN_COMPILER.commit, ...bindings[kind]});
}

function readPinned(root, binding) {
  const bytes = execFileSync('git', ['show', `${binding.commit}:${binding.path}`],
    { cwd: root, windowsHide: true, timeout: 10000, maxBuffer: 1024 * 1024 });
  assert.equal(createHash('sha256').update(bytes).digest('hex'), binding.sha256,
    'pinned historical fixture hash mismatch');
  return bytes;
}
