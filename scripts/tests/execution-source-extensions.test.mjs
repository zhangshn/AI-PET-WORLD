import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {collectActualExecutionSources as supportCollect} from '../lib/ai-painter-execution-source-closure-v1.mjs';
import {collectActualExecutionSources as decodeCollect} from '../lib/ai-painter-decode1-entry-weight-quality-source-closure-v1.mjs';

for (const [name, collect] of [['support', supportCollect], ['decode', decodeCollect]]) {
  for (const [extension, source] of [
    ['jsx', 'import "./child.cjs"; export const view = <section />;'],
    ['mts', 'import "./child.cjs"; export const value: number = 1;'],
    ['cts', 'const child = require("./child.cjs"); const value: number = 1;'],
  ]) {
    test(`${name}: .${extension} binds transitive dependencies and rejects a missing child without evaluation`, () => {
      const root = fs.mkdtempSync(path.join(os.tmpdir(), 'execution-extension-'));
      try {
        const entry = 'main.' + extension;
        fs.writeFileSync(path.join(root, entry), source + '\nthrow new Error("entry must never execute");\n');
        fs.writeFileSync(path.join(root, 'child.cjs'), 'require("./leaf.mjs"); throw new Error("child must never execute");\n');
        fs.writeFileSync(path.join(root, 'leaf.mjs'), 'throw new Error("leaf must never execute");\n');
        const input = {root, required: {entry}, bind: relative => ({path: relative,
          sha256: crypto.createHash('sha256').update(fs.readFileSync(path.join(root, relative))).digest('hex')})};
        const result = collect(input);
        assert.deepEqual(Object.values(result).map(row => row.path).sort(), ['child.cjs', 'leaf.mjs', entry].sort());
        fs.writeFileSync(path.join(root, entry), source.replaceAll('./child.cjs', './missing.cjs'));
        assert.throws(() => collect(input), /unresolved static execution dependency/u);
      } finally {
        assert.equal(path.dirname(fs.realpathSync(root)), fs.realpathSync(os.tmpdir()));
        assert.match(path.basename(root), /^execution-extension-/u);
        fs.rmSync(root, {recursive: true});
      }
    });
  }
}
