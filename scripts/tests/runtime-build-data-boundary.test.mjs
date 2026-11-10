import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {execFileSync} from 'node:child_process'
import {createRequire} from 'node:module'
import test from 'node:test'

const require = createRequire(import.meta.url)
const {nodeFileTrace} = require('next/dist/compiled/@vercel/nft')

test('build traces static assets while deployment data is read from each real runtime root', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'runtime-build-boundary-'))
  fs.copyFileSync(new URL('../lib/runtime-working-directory.mjs', import.meta.url), path.join(root, 'runtime-paths.mjs'))
  fs.writeFileSync(path.join(root, 'static.txt'), 'bundled-static-asset')
  fs.writeFileSync(path.join(root, 'entry.mjs'), `
import fs from 'node:fs';
import {resolveRuntimePath,runtimeWorkingDirectory} from './runtime-paths.mjs';
const staticAsset=fs.readFileSync(new URL('./static.txt',import.meta.url),'utf8');
const runtimeAsset=fs.readFileSync(resolveRuntimePath(runtimeWorkingDirectory(),'evidence.txt'),'utf8');
console.log(JSON.stringify({staticAsset,runtimeAsset}));
`)
  const trace = await nodeFileTrace([path.join(root, 'entry.mjs')], {base: root, processCwd: root})
  assert.ok(trace.fileList.has('static.txt'), 'static assets must remain in the trace')
  assert.ok(trace.fileList.has('runtime-paths.mjs'), 'runtime helper code must remain in the trace')
  assert.ok(!trace.fileList.has('evidence.txt'), 'mutable deployment evidence must not be bundled')
  // The evidence appears after compilation. Two actual deployments must read
  // their own data, not a build-time snapshot or another deployment's root.
  for (const [name, contents] of [['deployment-a','first-world'], ['deployment-b','second-world']]) {
    const cwd = path.join(root, name)
    fs.mkdirSync(cwd)
    fs.writeFileSync(path.join(cwd, 'evidence.txt'), contents)
    const result = JSON.parse(execFileSync(process.execPath, [path.join(root, 'entry.mjs')],
      {cwd, encoding:'utf8', windowsHide:true}))
    assert.deepEqual(result, {staticAsset:'bundled-static-asset', runtimeAsset:contents})
  }
  assert.throws(() => execFileSync(process.execPath, [path.join(root,'entry.mjs')],
    {cwd:root, windowsHide:true, stdio:'pipe'}), /ENOENT/)
})
