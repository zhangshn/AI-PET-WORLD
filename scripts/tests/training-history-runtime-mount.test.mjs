import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {spawnSync} from 'node:child_process'
import test from 'node:test'

test('configured deployed runtime works outside F: while another mount and traversal fail', (t) => {
  const parent = fs.realpathSync(os.tmpdir())
  const fixture = fs.mkdtempSync(path.join(parent, 'history-mount-'))
  const root = path.join(fixture, 'project'), data = path.join(fixture, 'external-data')
  const runtime = path.join(data, 'hot/runtime'), outside = path.join(fixture, 'unregistered')
  t.after(() => {
    assert.equal(path.dirname(fixture),parent)
    assert(path.basename(fixture).startsWith('history-mount-'))
    assert(!fs.lstatSync(fixture).isSymbolicLink())
    assert.equal(fs.realpathSync(fixture),fixture)
    for(const [link,target] of [[path.join(root,'another/.runtime'),runtime],[path.join(root,'.runtime'),runtime],[path.join(runtime,'escape'),outside]]) {
      const stat=fs.lstatSync(link,{throwIfNoEntry:false})
      if(!stat)continue
      assert(stat.isSymbolicLink())
      assert.equal(fs.realpathSync(target),target)
      assert.equal(fs.realpathSync(link),target)
      fs.unlinkSync(link)
      assert(fs.existsSync(target))
    }
    fs.rmSync(fixture,{recursive:true})
  })
  for (const p of [root, runtime, outside]) fs.mkdirSync(p, {recursive:true})
  fs.writeFileSync(path.join(runtime, 'bound.json'), '{"bound":true}')
  fs.writeFileSync(path.join(outside, 'foreign.json'), '{}')
  fs.symlinkSync(runtime, path.join(root, '.runtime'), process.platform === 'win32' ? 'junction' : 'dir')
  fs.symlinkSync(outside, path.join(runtime, 'escape'), process.platform === 'win32' ? 'junction' : 'dir')
  const moduleUrl = new URL('../../src/server/ai-console/training-history-safe-bytes.mjs', import.meta.url).href
  const source = `
    import assert from 'node:assert/strict';
    import fs from 'node:fs';
    import path from 'node:path';
    const {safePath,bytes}=await import(${JSON.stringify(moduleUrl)});
    const root=process.cwd();
    assert.equal((await bytes(root,'.runtime/bound.json',1024)).value.toString(),'{"bound":true}');
    await assert.rejects(safePath(root,'.runtime/escape/foreign.json'),/history_symlink_escape/);
    await assert.rejects(safePath(root,'.runtime/../foreign.json'),/history_path_outside_root/);
    const another=path.join(root,'another');fs.mkdirSync(another);
    fs.symlinkSync(process.env.AI_PET_WORLD_DATA_ROOT+'/hot/runtime',path.join(another,'.runtime'),process.platform==='win32'?'junction':'dir');
    await assert.rejects(safePath(another,'.runtime/bound.json'),/history_unregistered_mount/);
  `
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', source], {
    cwd:root, env:{...process.env, AI_PET_WORLD_DATA_ROOT:data}, encoding:'utf8', timeout:15000, windowsHide:true,
  })
  assert.equal(result.status, 0, result.stderr)
})
