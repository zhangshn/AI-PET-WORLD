import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {retiredEntrypointCommand} from './lib/ai-painter-current-entrypoint-command.mjs';

// Read metadata only. Never import or execute the historical entryFile.
export function readRetiredEntrypointNotice(root, packageScript) {
  retiredEntrypointCommand(packageScript);
  const registry = JSON.parse(fs.readFileSync(path.join(root, 'data/ai-painter/system-governance/ai-painter-current-entrypoint-registry-v1.json'), 'utf8'));
  assert.equal(registry.schemaVersion, 'ai-painter-current-entrypoint-registry-v1');
  assert.equal(registry.status, 'active');
  assert.ok(Array.isArray(registry.currentEntrypoints));
  assert.ok(!registry.currentEntrypoints.some(entry => entry.packageScript === packageScript), 'entry remains current');
  const binding = registry.retiredEntrypointIndex;
  assert.equal(binding?.path, 'data/ai-painter/system-governance/ai-painter-retired-entrypoint-index-v1.json');
  assert.equal(binding.dispatchable, false);
  const bytes = fs.readFileSync(path.join(root, binding.path));
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), binding.sha256, 'retired index SHA mismatch');
  const index = JSON.parse(bytes);
  assert.equal(index.schemaVersion, 'ai-painter-retired-entrypoint-index-v1');
  assert.equal(binding.schemaVersion, index.schemaVersion);
  assert.equal(index.status, 'active_read_only_audit_index');
  assert.equal(index.dispatchable, false);
  assert.equal(index.resolverMaySchedule, false);
  assert.ok(Array.isArray(index.retiredEntrypoints));
  const matches = index.retiredEntrypoints.filter(entry => entry.packageScript === packageScript);
  assert.equal(matches.length, 1, 'retired entry missing or duplicated');
  const entry = matches[0];
  assert.equal(entry.retirementDisposition, 'read_only_audit_not_dispatchable');
  assert.match(entry.sourceSha256 ?? '', /^[a-f0-9]{64}$/u);
  return {schemaVersion: 'retired-ai-painter-entrypoint-notice-v1', status: 'retired_command_disabled',
    packageScript, passed: false, executionStarted: false,
    reason: '该命令已退役；未执行历史程序，也未启动替代任务。',
    historicalSource: {path: entry.entryFile, sha256: entry.sourceSha256, archiveVerification: 'not_performed_by_metadata_notice'}};
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    assert.equal(process.argv.length, 3, 'exactly one registered retired command is required');
    console.error(JSON.stringify(readRetiredEntrypointNotice(process.cwd(), process.argv[2]), null, 2));
    process.exitCode = 2;
  } catch (error) {
    console.error(JSON.stringify({schemaVersion: 'retired-ai-painter-entrypoint-notice-v1',
      status: 'retired_command_metadata_rejected', passed: false, executionStarted: false, reason: error.message}));
    process.exitCode = 1;
  }
}
