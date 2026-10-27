import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { hash } from '../../src/server/local-backup/contracts.mjs'
import { createWorkEvidenceReader } from '../../src/server/local-backup/work-evidence.mjs'

function fixture(t){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'local-work-evidence-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}))
 const dir=path.join(root,'ai-painter/controller-repair-reviews/test');fs.mkdirSync(dir,{recursive:true})
 const logical='.runtime/ai-painter/controller-repair-reviews/test/'
 const write=(name,data)=>{const bytes=Buffer.isBuffer(data)?data:Buffer.from(JSON.stringify(data));fs.writeFileSync(path.join(dir,name),bytes);return {path:logical+name,sha256:hash(bytes)}}
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jFZkAAAAASUVORK5CYII=','base64')
 const image=write('image.png',png),result=write('result.json',{objects:[{slot:149,object:{kind:'rock',value:39},counts:{core:30,rawSupport:182,ownedSupport:182},metricsFromSavedQuantizedPngs:{current_two:{core:{mae:.0132,correlation:.979},wholeLocalCrop:{mae:.03757}}}}]})
 let ref
 const set=value=>{const b=write('assessment.json',value);ref={logicalPath:b.path,sha256:b.sha256}}
 const doc={figures:[image],findings:[{text:'<script>not executed</script>'}],result,interpretation:'Objects are not qualified'};set(doc)
 const ledger={find:id=>id==='event-1'?{eventId:id,title:'Diagnostic',sourceCategory:'codex',evidenceReferences:[ref]}:null}
 return {root,dir,logical,write,png,image,result,set,doc,reader:createWorkEvidenceReader({runtimeRoot:root,ledger})}
}
test('registered report, measurements and image remain read-only and hash bound',t=>{
 const f=fixture(t),before=fs.readdirSync(f.dir);const r=f.reader.detail('event-1','0')
 assert.equal(r.sourceCategory,'codex');assert.equal(r.findings[0],'<script>not executed</script>');assert.equal(r.measurements[0].coreAfter,.0132)
 assert.equal(r.images[0].url,'/api/local-backup/work-events/event-1/evidence/0/images/0');assert.deepEqual(f.reader.image('event-1','0','0').bytes,f.png);assert.deepEqual(fs.readdirSync(f.dir),before)
})
test('unknown event, unknown artifact and path-like indexes rejected',t=>{const f=fixture(t);for(const args of [['missing','0'],['event-1','1'],['event-1','../0'],['event-1','01']])assert.throws(()=>f.reader.detail(...args));assert.throws(()=>f.reader.image('event-1','0','1'))})
test('changed root evidence and changed image rejected independently',t=>{const f=fixture(t);fs.appendFileSync(path.join(f.dir,'image.png'),'x');assert.throws(()=>f.reader.image('event-1','0','0'),/sha_conflict/);fs.appendFileSync(path.join(f.dir,'assessment.json'),' ');assert.throws(()=>f.reader.detail('event-1','0'),/sha_conflict/)})
test('child paths cannot traverse, escape folder or use non-PNG resources',t=>{const f=fixture(t);for(const suffix of ['../other/image.png','image.svg','image.html']){f.set({...f.doc,figures:[{...f.image,path:f.logical+suffix}]});assert.throws(()=>f.reader.detail('event-1','0'),/child_scope/)}})
test('hard links and nested directory links are refused',t=>{const f=fixture(t);fs.linkSync(path.join(f.dir,'image.png'),path.join(f.dir,'second.png'));assert.throws(()=>f.reader.image('event-1','0','0'),/boundary/);fs.unlinkSync(path.join(f.dir,'second.png'));const real=path.join(f.root,'moved');fs.renameSync(f.dir,real);fs.symlinkSync(real,f.dir,'junction');assert.throws(()=>f.reader.detail('event-1','0'),/boundary/);fs.unlinkSync(f.dir)})
test('oversized JSON, figure arrays and pixel dimensions rejected',t=>{const f=fixture(t);f.set({...f.doc,figures:Array(17).fill(f.image)});assert.throws(()=>f.reader.detail('event-1','0'),/figure_limit/);f.set({text:'x'.repeat(1024*1024)});assert.throws(()=>f.reader.detail('event-1','0'),/size_limit/);const b=Buffer.from(f.png);b.writeUInt32BE(8193,16);f.set({...f.doc,figures:[f.write('image.png',b)]});assert.throws(()=>f.reader.image('event-1','0','0'),/dimensions/)})
test('HTML disguised as PNG rejected and unrecognized report stays raw',t=>{const f=fixture(t);f.set({...f.doc,figures:[f.write('image.png',Buffer.from('<html>'+'.'.repeat(80)))]});assert.throws(()=>f.reader.image('event-1','0','0'),/image_invalid/);f.set({legacy:'original evidence'});const d=f.reader.detail('event-1','0');assert.deepEqual(d.images,[]);assert.equal(JSON.parse(d.content).legacy,'original evidence')})
test('missing child evidence fails explicitly',t=>{const f=fixture(t);fs.unlinkSync(path.join(f.dir,'result.json'));assert.throws(()=>f.reader.detail('event-1','0'),/file_missing/)})
test('unrelated object arrays do not acquire training measurement semantics',t=>{const f=fixture(t);const result=f.write('result.json',{objects:[{name:'legacy object',score:42}]});f.set({...f.doc,result});assert.deepEqual(f.reader.detail('event-1','0').measurements,[])})
