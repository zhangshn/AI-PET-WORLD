import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawn, execFileSync} from 'node:child_process';
import {createNativeOwnerCommand,nativeOwnerSourceIdentity} from '../lib/ai-painter-ecology-decode1-native-owner-v2.mjs';
const batchStarted=Date.now(),batchDeadline=batchStarted+120000,outputLimit=8*1024*1024;
const base=process.env.AI_PAINTER_STREAM_V2_TEST_ROOT;
assert.ok(base&&path.isAbsolute(base)&&!fs.existsSync(base),'fresh explicit private CPU root required');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const protectedPaths=['.runtime/ai-painter/owned-worker-guards/active.json','.runtime/ai-painter/current-execution-registry/current.json'].map(p=>path.resolve(p));
for(const file of protectedPaths){const relative=path.relative(path.dirname(file),base);assert.ok(relative.startsWith('..')||path.isAbsolute(relative),'test root must not enter a protected namespace');}
const protectedBefore=protectedPaths.map(file=>({file,bytes:fs.existsSync(file)?fs.readFileSync(file):null}));
const sourceBefore=nativeOwnerSourceIdentity(),cases=[],runs=[];
let serial=0,wireBytes=0;
fs.mkdirSync(base,{recursive:true});
function unchanged(){
 for(const {file,bytes} of protectedBefore)assert.deepEqual(fs.existsSync(file)?fs.readFileSync(file):null,bytes,`protected bytes changed: ${file}`);
 assert.deepEqual(nativeOwnerSourceIdentity(),sourceBefore,'native source drift during batch');
}
function directoryBytes(directory){let total=0;for(const entry of fs.readdirSync(directory,{withFileTypes:true})){
 const file=path.join(directory,entry.name);assert.ok(!entry.isSymbolicLink(),'private evidence cannot follow links');
 total+=entry.isDirectory()?directoryBytes(file):fs.statSync(file).size;
}return total;}
function nativeCase(name,body){test(name,async()=>{
 const entry={name,status:'running',startedAtUtc:new Date().toISOString()};cases.push(entry);
 try{unchanged();await body();entry.status='passed';}catch(error){entry.status='failed';entry.error=String(error.stack??error).slice(0,4096);throw error;}
 finally{entry.completedAtUtc=new Date().toISOString();unchanged();}
});}

// Block ONLY the R writer after real private Job/EOF processing. This tests
// Main's terminal wait deterministically; another case uses real pipe pressure.
function terminalBlocker(command,dir,deadline){
 const source=path.join(dir,'terminal-consumer.cs'),binary=path.join(dir,'terminal-consumer.exe');
 fs.writeFileSync(source,`using System;using System.IO;using System.Text;using System.Threading;
public class TerminalConsumer : TextWriter {
 readonly TextWriter output; public TerminalConsumer(TextWriter value){output=value;}
 public override Encoding Encoding {get{return Encoding.UTF8;}}
 public override void WriteLine(string value){if(value.StartsWith("R:")){Console.Error.WriteLine("private terminal consumer blocked");Thread.Sleep(Timeout.Infinite);}else output.WriteLine(value);}
 public override void Flush(){output.Flush();}
 public static int Main(string[] args){Console.SetOut(new TerminalConsumer(Console.Out));return EndpointCpuOwnedJob.Main(args);}
}`,{flag:'wx'});
 execFileSync(command.nativeBuild.compiler,['/nologo','/noconfig','/target:exe','/main:TerminalConsumer',`/reference:${command.executable}`,`/out:${binary}`,source],
  {windowsHide:true,timeout:Math.max(1,deadline-Date.now()),maxBuffer:65536});
 return {executable:binary,sha256:hash(fs.readFileSync(binary)),source,sourceSha256:hash(fs.readFileSync(source))};
}

async function run(source,{pauseMs=0,wallMs=10000,resumeAfterWorkMs=null,pauseUntilExit=false,expiredWork=false,blockTerminal=false}={}){
 assert.ok(Date.now()+wallMs+1000<batchDeadline,'insufficient total batch time; case not started');
 const began=Date.now(),workDeadline=began+wallMs,dir=path.join(base,String(++serial));fs.mkdirSync(dir);
 const record={identity:crypto.randomUUID(),startedEvidence:path.join(dir,'started.json'),nativeOwnerSource:sourceBefore,fixtureKind:'private_cpu_stream_only'};
 let command,wrapper=null;
 try{
  command=createNativeOwnerCommand(process.execPath,['-e',source],process.cwd(),workDeadline,1000,record,JSON.stringify(record));
  if(blockTerminal)wrapper=terminalBlocker(command,path.dirname(command.executable),workDeadline);
 }catch(error){
  const failure={dir,phase:'compile',status:'failed',error:String(error).slice(0,4096),nativeEOFVerified:false,jobEmptyVerifiedFromLiveProof:false};runs.push(failure);
  fs.writeFileSync(path.join(dir,'compile-result.json'),JSON.stringify(failure,null,2)+'\n',{flag:'wx'});throw error;
 }
 // Negative CLI input in a new private case, not a production plan/reused run.
 if(expiredWork)command.args[2]=String(Date.now()-100);
 const deadline=Number(command.args[2]),forceAt=deadline+1000-250;
 const env={...process.env,CUDA_VISIBLE_DEVICES:'-1',NVIDIA_VISIBLE_DEVICES:'none',AI_PAINTER_CPU_ONLY:'1',AI_PAINTER_ALLOW_GPU:'0'};
 delete env.AI_PET_WORLD_OPERATOR_SESSION_SECRET;
 const child=spawn(wrapper?.executable??command.executable,command.args,{cwd:process.cwd(),env,windowsHide:true,stdio:['pipe','pipe','pipe']});
 let pending='',ownerError='',proof=null,stdoutBytes=0,stderrBytes=0,protocolError=null,forced=false,exitAt=null,stdoutEof=false,stderrEof=false;
 const stdoutHash=crypto.createHash('sha256'),stderrHash=crypto.createHash('sha256');
 child.stdin.on('error',error=>{protocolError??=`control stream: ${error.code??error.message}`;});
 child.stdout.on('data',chunk=>{
  wireBytes+=chunk.length;
  try{
   assert.ok(wireBytes<outputLimit-65536,'batch transport output cap');pending+=chunk.toString('ascii');let at;
   while((at=pending.indexOf('\n'))>=0){const line=pending.slice(0,at).trimEnd();pending=pending.slice(at+1);
    assert.ok(line.length<65536,'bounded native frame');
    if(line.startsWith('R:')){assert.equal(proof,null);proof=JSON.parse(Buffer.from(line.slice(2),'base64'));}
    else {assert.equal(proof,null,'output after terminal R');assert.ok(line.startsWith('O:')||line.startsWith('E:'));
     const raw=Buffer.from(line.slice(2),'base64');assert.equal(raw.toString('base64'),line.slice(2));
     if(line.startsWith('O:')){stdoutBytes+=raw.length;stdoutHash.update(raw);}else{stderrBytes+=raw.length;stderrHash.update(raw);}
     assert.ok(stdoutBytes+stderrBytes<=2*1024*1024,'private fixture stream cap');}
   }assert.ok(pending.length<65536,'bounded pending native framing');
  }catch(error){protocolError??=String(error);child.kill();}
 });
 child.stdout.once('end',()=>{stdoutEof=true;});
 child.stderr.on('data',chunk=>{wireBytes+=chunk.length;ownerError+=chunk.toString();if(Buffer.byteLength(ownerError)>8192){protocolError??='owner stderr cap';child.kill();}});
 child.stderr.once('end',()=>{stderrEof=true;});
 let resumeTimer=null;
 if(pauseMs||resumeAfterWorkMs!==null||pauseUntilExit){child.stdout.pause();
  if(!pauseUntilExit)resumeTimer=setTimeout(()=>child.stdout.resume(),Math.max(0,resumeAfterWorkMs===null?pauseMs:deadline+resumeAfterWorkMs-Date.now()));}
 child.once('exit',()=>{exitAt=Date.now();if(pauseUntilExit)child.stdout.resume();});
 // Exact production force cutoff: no old +3000ms rescue window or late kill.
 const timer=setTimeout(()=>{if(exitAt===null){forced=true;child.kill();}child.stdout.resume();},Math.max(0,forceAt-Date.now()));
 let exitCode,signal;
 try{[exitCode,signal]=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',(...values)=>resolve(values));});}
 finally{clearTimeout(timer);if(resumeTimer)clearTimeout(resumeTimer);}
 if(pending.trim())protocolError??='incomplete native frame';
 const nativeEOFVerified=!!proof&&proof.stdoutClosed===true&&proof.stderrClosed===true&&stdoutEof&&stderrEof&&!protocolError&&!forced;
 const jobEmptyVerifiedFromLiveProof=nativeEOFVerified&&proof.activeProcessesAfterCleanup===0&&proof.assignedBeforeResume===true&&proof.killOnJobClose===true;
 const result={dir,phase:'native',compile:'passed',exitCode,signal,elapsedMs:Date.now()-began,workDeadline:deadline,forceAt,exitAt,forced,
  proof,stdoutBytes,stderrBytes,stdoutHash:stdoutHash.digest('hex'),stderrHash:stderrHash.digest('hex'),ownerError,protocolError,stdoutEof,stderrEof,
  nativeEOFVerified,jobEmptyVerifiedFromLiveProof,privateOnly:true,qualified:false,historicalCleanupCertified:false,nativeSource:sourceBefore,wrapper};
 runs.push(result);fs.writeFileSync(path.join(dir,'result.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});
 unchanged();assert.ok(Date.now()<batchDeadline,'total native batch deadline');
 assert.ok(directoryBytes(base)+wireBytes+runs.reduce((sum,r)=>sum+(r.stdoutBytes??0)+(r.stderrBytes??0),0)<outputLimit-65536,'all output/evidence cap');
 return result;
}
function closed(r){
 assert.equal(r.forced,false,'must finish before unchanged production force');assert.equal(r.protocolError,null);
 assert.equal(r.exitCode,0,r.ownerError);assert.ok(r.proof,'live R required; disk observation is not a substitute');
 assert.equal(r.proof.streamClosureVersion,'bounded-stream-capture-v2');
 for(const field of ['stdoutClosed','stderrClosed','transportCompleted','assignedBeforeResume','killOnJobClose'])assert.equal(r.proof[field],true,field);
 for(const field of ['streamCaptureError','streamTransportError','cleanupError','observationError'])assert.equal(r.proof[field],null,field);
 assert.equal(r.nativeEOFVerified,true);assert.equal(r.jobEmptyVerifiedFromLiveProof,true);
 assert.equal(r.proof.stdoutBytes,r.stdoutBytes);assert.equal(r.proof.stderrBytes,r.stderrBytes);assert.ok(r.exitAt<r.forceAt,'R and exit must precede force');
}
nativeCase('normal exit: live R, real EOF and stream counts match',async()=>{const r=await run("process.stdout.write('stdout-v2');process.stderr.write('stderr-v2');");closed(r);assert.equal(r.proof.exitCode,0);assert.equal(r.stdoutHash,hash(Buffer.from('stdout-v2')));assert.equal(r.stderrHash,hash(Buffer.from('stderr-v2')));});
nativeCase('delayed consumer: large stdout and stderr are complete and byte-identical',async()=>{const r=await run("const fs=require('fs');fs.writeSync(1,Buffer.alloc(524288,65));fs.writeSync(2,Buffer.alloc(524288,66));",{pauseMs:1600});closed(r);assert.equal(r.stdoutHash,hash(Buffer.alloc(524288,65)));assert.equal(r.stderrHash,hash(Buffer.alloc(524288,66)));});
nativeCase('nonzero task exit cannot become success from clean streams',async()=>{const r=await run("require('fs').writeSync(2,Buffer.from('expected-fixture-error'));process.exit(7);");closed(r);assert.equal(r.proof.exitCode,7);});
nativeCase('700ms work deadline: stop reason and live cleanup/EOF R survive',async()=>{const r=await run("setInterval(()=>{},1000);",{wallMs:700});closed(r);assert.equal(r.proof.stopReason,'wall_timeout');assert.notEqual(r.proof.exitCode,0);});
nativeCase('already expired work deadline: only original 1000ms reserve can deliver R',async()=>{const r=await run("setInterval(()=>{},1000);",{expiredWork:true});closed(r);assert.equal(r.proof.stopReason,'wall_timeout');assert.equal(r.stdoutBytes+r.stderrBytes,0);});
nativeCase('work timeout plus late consumer drains large streams before force',async()=>{const r=await run("const fs=require('fs');fs.writeSync(1,Buffer.alloc(262144,65));fs.writeSync(2,Buffer.alloc(262144,66));setInterval(()=>{},1000);",{wallMs:2000,resumeAfterWorkMs:50});closed(r);assert.equal(r.proof.stopReason,'wall_timeout');assert.equal(r.stdoutHash,hash(Buffer.alloc(262144,65)));assert.equal(r.stderrHash,hash(Buffer.alloc(262144,66)));});
nativeCase('deadline cleans descendants and inherited pipe handles before live EOF proof',async()=>{const r=await run("const fs=require('fs');fs.writeSync(1,'root-out');fs.writeSync(2,'root-err');require('child_process').spawn(process.execPath,['-e',\"const fs=require('fs');fs.writeSync(1,'leaf-out');fs.writeSync(2,'leaf-err');setInterval(()=>{},1000);\"],{stdio:'inherit',windowsHide:true});setInterval(()=>{},1000);",{wallMs:1200,resumeAfterWorkMs:50});closed(r);assert.equal(r.proof.stopReason,'wall_timeout');assert.ok(r.proof.totalProcesses>=2);assert.equal(r.stdoutHash,hash(Buffer.from('root-outleaf-out')));assert.equal(r.stderrHash,hash(Buffer.from('root-errleaf-err')));});
nativeCase('real blocked pipe consumer: bounded owner exit without invented R/EOF proof',async()=>{const r=await run("const fs=require('fs');fs.writeSync(1,Buffer.alloc(131072,65));fs.writeSync(2,Buffer.alloc(131072,66));",{wallMs:700,pauseUntilExit:true});assert.equal(r.forced,false,r.ownerError);assert.notEqual(r.exitCode,0);assert.equal(r.proof,null);assert.equal(r.nativeEOFVerified,false);assert.equal(r.jobEmptyVerifiedFromLiveProof,false);assert.ok(r.exitAt<r.forceAt);});
nativeCase('terminal-only blocked writer: R cannot hold owner past its force-safe slice',async()=>{const r=await run("process.exit(0);",{wallMs:2000,blockTerminal:true});assert.match(r.ownerError,/private terminal consumer blocked/);assert.equal(r.forced,false);assert.equal(r.exitCode,1);assert.equal(r.proof,null);assert.equal(r.nativeEOFVerified,false);assert.equal(r.jobEmptyVerifiedFromLiveProof,false);assert.ok(r.exitAt<r.forceAt);});
after(()=>{
 unchanged();const fileBytes=directoryBytes(base),rootStreamBytes=runs.reduce((sum,r)=>sum+(r.stdoutBytes??0)+(r.stderrBytes??0),0);
 const summaryRuns=runs.map(({proof,...entry})=>({...entry,proof:proof?Object.fromEntries(['stopReason','exitCode','stdoutClosed','stderrClosed','transportCompleted','activeProcessesAfterCleanup','totalProcesses','stdoutBytes','stderrBytes','streamCaptureError','streamTransportError','cleanupError','observationError'].map(key=>[key,proof[key]])):null}));
 const result={startedAtUtc:new Date(batchStarted).toISOString(),completedAtUtc:new Date().toISOString(),elapsedMs:Date.now()-batchStarted,
  status:cases.length===9&&cases.every(c=>c.status==='passed')?'passed':'failed',cases,runs:summaryRuns,
  limits:{wallMs:120000,cpuLogicalProcessors:2,inheritedAffinityRequired:true,outputBytes:outputLimit,automaticRetries:0,cleanupMs:1000,forceReserveMs:250},
  output:{fileBytes,wireBytes,rootStreamBytes,terminalReserveBytes:65536},nativeSource:sourceBefore,
  protectedBytesUnchanged:true,protectedBindings:protectedBefore.map(({file,bytes})=>({file,sha256:bytes===null?null:hash(bytes)})),
  qualified:false,historicalCleanupCertified:false,productionJobStarted:false};
 const raw=JSON.stringify(result,null,2)+'\n';assert.ok(Buffer.byteLength(raw)<65536,'bounded final batch receipt');
 assert.ok(fileBytes+wireBytes+rootStreamBytes+Buffer.byteLength(raw)<=outputLimit,'all batch output cap');
 fs.writeFileSync(path.join(base,'batch.json'),raw,{flag:'wx'});assert.ok(result.elapsedMs<120000,'total batch wall cap');
});
