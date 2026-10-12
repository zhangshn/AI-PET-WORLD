import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawn} from 'node:child_process';
import {createNativeOwnerCommand,nativeOwnerSourceIdentity} from '../lib/ai-painter-ecology-decode1-native-owner-v2.mjs';
const base=process.env.AI_PAINTER_STREAM_V2_TEST_ROOT;
assert.ok(base&&path.isAbsolute(base)&&!fs.existsSync(base),'fresh explicit private CPU root required');
fs.mkdirSync(base,{recursive:true});
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const guardPath=path.resolve('.runtime/ai-painter/owned-worker-guards/active.json');
const originalGuard=fs.existsSync(guardPath)?fs.readFileSync(guardPath):null;
let serial=0;
async function run(source,{pauseMs=0,wallMs=10000}={}){
 const id=crypto.randomUUID(),dir=path.join(base,String(++serial));fs.mkdirSync(dir);
 const record={identity:id,startedEvidence:path.join(dir,'started.json'),nativeOwnerSource:nativeOwnerSourceIdentity(),fixtureKind:'private_cpu_stream_only'};
 const command=createNativeOwnerCommand(process.execPath,['-e',source],process.cwd(),Date.now()+wallMs,1000,record,JSON.stringify(record));
 const env={...process.env};delete env.AI_PET_WORLD_OPERATOR_SESSION_SECRET;
 const began=Date.now(),child=spawn(command.executable,command.args,{cwd:process.cwd(),env,windowsHide:true,stdio:['pipe','pipe','pipe']});
 let pending='',stderr='',proof=null,stdoutBytes=0,stderrBytes=0,stdoutHash=crypto.createHash('sha256'),stderrHash=crypto.createHash('sha256');
 child.stdout.on('data',chunk=>{
  pending+=chunk.toString('ascii');let at;
  while((at=pending.indexOf('\n'))>=0){const line=pending.slice(0,at).trimEnd();pending=pending.slice(at+1);
   assert.ok(line.length<65536,'bounded native frame');
   if(line.startsWith('R:')){assert.equal(proof,null);proof=JSON.parse(Buffer.from(line.slice(2),'base64'));}
   else {assert.ok(line.startsWith('O:')||line.startsWith('E:'));const raw=Buffer.from(line.slice(2),'base64');assert.equal(raw.toString('base64'),line.slice(2));
    if(line.startsWith('O:')){stdoutBytes+=raw.length;stdoutHash.update(raw);}else{stderrBytes+=raw.length;stderrHash.update(raw);}
    assert.ok(stdoutBytes+stderrBytes<=2*1024*1024,'private fixture stream cap');}
  }assert.ok(pending.length<65536,'bounded pending native framing');
 });
 child.stderr.on('data',b=>{stderr+=b.toString();assert.ok(Buffer.byteLength(stderr)<=8192)});
 if(pauseMs){child.stdout.pause();setTimeout(()=>child.stdout.resume(),pauseMs);}
 const timer=setTimeout(()=>child.kill(),wallMs+3000);
 const [exitCode,signal]=await new Promise(resolve=>child.once('close',(...v)=>resolve(v)));clearTimeout(timer);
 const result={exitCode,signal,elapsedMs:Date.now()-began,proof,stdoutBytes,stderrBytes,stdoutHash:stdoutHash.digest('hex'),stderrHash:stderrHash.digest('hex'),ownerError:stderr,
  privateOnly:true,gpuCalls:0,modelCalls:0,trainingCalls:0,qualified:false,nativeSource:record.nativeOwnerSource};
 fs.writeFileSync(path.join(dir,'result.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});
 assert.deepEqual(fs.existsSync(guardPath)?fs.readFileSync(guardPath):null,originalGuard,'production guard must not change');
 return result;
}
function closed(r){assert.equal(r.exitCode,0,r.ownerError);assert.equal(r.proof.streamClosureVersion,'bounded-stream-capture-v2');
 for(const field of ['stdoutClosed','stderrClosed','transportCompleted','assignedBeforeResume','killOnJobClose'])assert.equal(r.proof[field],true,field);
 for(const field of ['streamCaptureError','streamTransportError','cleanupError','observationError'])assert.equal(r.proof[field],null,field);
 assert.equal(r.proof.activeProcessesAfterCleanup,0);assert.equal(r.proof.stdoutBytes,r.stdoutBytes);assert.equal(r.proof.stderrBytes,r.stderrBytes);
}
test('native v2 normal exit captures both streams and actual EOF',async()=>{const r=await run("process.stdout.write('stdout-v2');process.stderr.write('stderr-v2');");closed(r);assert.equal(r.proof.exitCode,0);assert.equal(r.stdoutHash,hash(Buffer.from('stdout-v2')));assert.equal(r.stderrHash,hash(Buffer.from('stderr-v2')));});
test('native v2 delayed consumer does not couple capture EOF to forwarding',async()=>{const r=await run("const fs=require('fs');fs.writeSync(1,Buffer.alloc(524288,65));fs.writeSync(2,Buffer.alloc(524288,66));",{pauseMs:1600});closed(r);assert.equal(r.stdoutHash,hash(Buffer.alloc(524288,65)));assert.equal(r.stderrHash,hash(Buffer.alloc(524288,66)));});
test('native v2 preserves nonzero child exit; clean streams do not mean task success',async()=>{const r=await run("require('fs').writeSync(2,Buffer.from('expected-fixture-error'));process.exit(7);");closed(r);assert.equal(r.proof.exitCode,7);assert.equal(r.stderrHash,hash(Buffer.from('expected-fixture-error')));});
test('native v2 deadline stops own child and reports failure reason without changing guard',async()=>{const r=await run("setInterval(()=>{},1000);",{wallMs:700});closed(r);assert.equal(r.proof.stopReason,'wall_timeout');assert.notEqual(r.proof.exitCode,0);assert.ok(r.elapsedMs<4000);});
test('native v2 cleans descendants before closure proof',async()=>{const r=await run("require('child_process').spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'inherit',windowsHide:true});setTimeout(()=>process.exit(0),100);");closed(r);assert.ok(r.proof.totalProcesses>=2);});
