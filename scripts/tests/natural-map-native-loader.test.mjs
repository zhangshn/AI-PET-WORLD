import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import test from 'node:test'

test('console native map graph resolves its shared identity helper before the guarded Store read',()=>{
  const script=`
    import fs from 'node:fs';
    import assert from 'node:assert/strict';
    import {syncBuiltinESMExports} from 'node:module';
    const original=fs.openSync, failures=[];
    let intercepted=0;
    fs.openSync=function(file,...args){
      if(String(file).replaceAll('\\\\','/').endsWith('/data/world-runtime/mvp-natural-owner-001/mvp-natural-world-001.json')){
        intercepted++;throw Object.assign(Error('guarded_store_read'),{code:'guarded_store_read'});
      }
      return original.call(this,file,...args);
    };
    syncBuiltinESMExports();
    console.error=(...args)=>failures.push(args.at(-1));
    const {naturalMapReview}=await import('./src/server/local-backup/natural-map-review.mjs');
    await assert.rejects(naturalMapReview({kind:'summary'}),{code:'natural_map_source_unavailable'});
    assert.equal(intercepted,1,'must reach original reader rather than fail while loading modules');
    assert.equal(failures.length,1);assert.equal(failures[0].code,'guarded_store_read');
    const frame=await import('./src/world/game-map-frame/natural-current-frame.mjs');
    assert.equal(typeof frame.assembleNaturalCurrentFrame,'function');
    // The scoped resolver must be removed even when later reading fails.
    await assert.rejects(import('./src/world/runtime-core/source-fact-identity'),{code:'ERR_MODULE_NOT_FOUND'});
  `
  const result=spawnSync(process.execPath,['--input-type=module','--eval',script],{
    cwd:process.cwd(),encoding:'utf8',timeout:20000,windowsHide:true,
  })
  assert.equal(result.error,undefined)
  assert.equal(result.status,0,result.stdout+result.stderr)
})

test('direct native frame import works in a fresh process without the console loader',()=>{
  const result=spawnSync(process.execPath,['--input-type=module','--eval',`
    import assert from 'node:assert/strict';
    const frame=await import('./src/world/game-map-frame/natural-current-frame.mjs');
    assert.equal(typeof frame.assembleNaturalCurrentFrame,'function');
    await assert.rejects(import('./src/world/runtime-core/source-fact-identity'),{code:'ERR_MODULE_NOT_FOUND'});
  `],{cwd:process.cwd(),encoding:'utf8',timeout:20000,windowsHide:true})
  assert.equal(result.error,undefined)
  assert.equal(result.status,0,result.stdout+result.stderr)
})
