import test from 'node:test'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {baselineDigest as digest} from '../lib/natural-world-baseline-proof.mjs'
import {readWorldEvolutionProgress,WORLD_EVOLUTION_SELECTION} from '../../src/server/local-backup/world-evolution-progress-reader.mjs'
const hash=b=>createHash('sha256').update(b).digest('hex'),encode=v=>Buffer.from(JSON.stringify(v))
const base='.runtime/ai-painter/controller-repair-reviews/',protocol=base+'world-evolution-loop-158-20261030',execution=base+'world-evolution-verification-159-20261030'
const fields=['PRECTOTCORR','RH2M','T2M','WS2M'],units=['mm/day','%','C','m/s'],formal='data/world-runtime/mvp-natural-owner-001/mvp-natural-world-001.json'
const feature=rows=>{const b=Buffer.alloc(224);rows.flat().forEach((x,i)=>b.writeDoubleLE(x,i*8));return hash(b)}
function fixture(){
 const files=new Map(),reads=[],put=(p,v)=>{const bytes=encode(v);files.set(p,bytes);return {path:p,sha256:hash(bytes),bytes:bytes.length}}
 const token='a'.repeat(32),run=protocol+'/run-'+token,id=Object.fromEntries(['ownerId','playerId','worldId','worldSeed','worldProfileId','regionId'].map(k=>[k,'integration158-'+k.toLowerCase()+'-'+token]))
 const archivePath=base+'world-evolution-scope-137-20261028/daily-source-pilot-v1/response.json',seedDates=Array.from({length:7},(_,i)=>'2020010'+(i+1)),archive={parameters:Object.fromEntries(fields.map((f,i)=>[f,{units:units[i]}])),properties:{parameter:Object.fromEntries(fields.map((f,j)=>[f,Object.fromEntries(seedDates.map(d=>[d,[0,60,25,2][j]]))]))}}
 const archiveRef=put(archivePath,archive),archiveReceipt=put(archivePath.replace('/response.json','/receipt.json'),{responseSha256:archiveRef.sha256,httpStatus:200})
 const checkpoint={path:base+'fixed-model/checkpoint.pt',sha256:'c'.repeat(64)},contract={fieldOrder:fields,units,checkpoint,seedDates,simulationEpochUtc:'2020-01-08T00:00:00.000Z',guards:Object.fromEntries(fields.map((f,i)=>[f,{minimum:[0,0,-50,0][i],maximum:[250,100,60,50][i]}])),archiveBindings:[archiveRef,archiveReceipt]}
 const contractRef=put(protocol+'/experiment-contract.json',contract),executionContract={taskId:'WORLD-EVOLUTION-VERIFICATION-159',budget:{cpuThreads:2,gpu:false,trainingUpdates:0,formalWorldWrites:0,newModelForwardsMaximum:5,wallSeconds:180,workerSeconds:30},experimentContract:contractRef},executionRef=put(execution+'/execution-contract.json',executionContract)
 const started='2026-10-30T07:00:00.000Z',finished='2026-10-30T07:00:14.000Z',stamp=n=>new Date(Date.parse(started)+n*1000).toISOString(),logical=n=>new Date(Date.parse(contract.simulationEpochUtc)+n*86400000).toISOString()
 const manifest={run,identity:id,executionTaskId:executionContract.taskId,protocolTaskId:'WORLD-EVOLUTION-LOOP-158',executionContractRef:executionRef,contractSha256:contractRef.sha256,startedAtUtc:started,deadlineUtc:'2026-10-30T07:03:00.000Z',sourceBindings:[checkpoint,archiveRef,archiveReceipt]}
 const manifestRef=put(run+'/manifest.json',manifest),steps=[],forwards=[],proofs=[],events=[],primaryInputs=[],outputs=[];let before={tick:0,stateVersion:0,eventCursor:0,fileSha256:'0'.repeat(64),recordContentSha256:'1'.repeat(64)},rows=seedDates.map(()=>[0,60,25,2])
 function forward(step,mode,input,values,index){
  const name=run+'/forward-'+step+'-'+mode,inputRef=put(name+'.input.json',input),output={mode,taskId:'WORLD-EVOLUTION-LOOP-158',contractSha256:contractRef.sha256,inputBytesSha256:inputRef.sha256,featureValueSha256:feature(input.window.values),checkpointSha256:checkpoint.sha256,fieldOrder:fields,units,values,pid:200+index,modelForwardRuns:1,trainingUpdates:0,worldWrites:0,productionReady:false,startedAtUtc:stamp(index),finishedAtUtc:stamp(index+0.5),elapsedSeconds:0.5}
  const outputRef=put(name+'.output.json',output),processRef=put(name+'.process.json',{exitCode:0,signal:null,failure:null,pid:output.pid,stdout:JSON.stringify(output),startedAtUtc:stamp(index-0.1),finishedAtUtc:stamp(index+0.6),elapsedMs:700}),ref={step,mode,pid:output.pid,modelForwardRuns:1,inputRef,outputRef,processRef}
  forwards.push(ref);return {output,inputRef,outputRef,processRef}
 }
 for(let n=1;n<=3;n++){
  const provenance=rows.map((_,i)=>({origin:i<8-n?'external_archival_context':'committed_fixture_event',sourceRef:i<8-n?{path:archiveRef.path,sha256:archiveRef.sha256}:{path:events[i-(8-n)].path,sha256:events[i-(8-n)].sha256},periodStartUtc:logical(n-1-(7-i)),periodEndUtc:logical(n-(7-i)),note:'Synthetic test only'}))
  const interval={logicalStartUtc:logical(n-1),logicalEndUtc:logical(n),durationSeconds:86400},input={mode:'primary',taskId:'WORLD-EVOLUTION-LOOP-158',contractSha256:contractRef.sha256,identity:id,before,window:{fieldOrder:fields,units,values:rows},provenance,interval},values=[n/10,60+n,25+n/10,2+n/10],primary=forward(n,'primary',input,values,n)
  primaryInputs.push(input);outputs.push(primary.output)
  const historyRef=put(run+'/step-'+n+'.history.json',{identity:id,selectedCount:n-1,committedHead:{cursor:n-1},events:events.map(e=>({originalEvent:e.event}))}),businessKey=digest({n})
  const event={identity:id,businessKey,cursor:n,fromTick:n-1,toTick:n,fromStateVersion:n-1,toStateVersion:n,previousEventSha256:events.at(-1)?.event.eventSha256??null,interval,before:{expectedFileSha256:before.fileSha256},evidence:{outputRef:primary.outputRef,inputRef:primary.inputRef},changes:fields.map((f,j)=>({fieldId:'environment.'+f,newValue:values[j]}))};event.eventSha256=digest(event)
  const storePath=run+'/store/'+id.ownerId+'/'+id.worldId+'.json',eventRef=put(storePath+'.evolution/'+businessKey+'.'+event.eventSha256+'.event.json',event)
  const world={...id,tick:n,stateVersion:n,eventCursor:n,worldState:{payload:{environment:{evolution:{weather:{values},commit:{eventSha256:event.eventSha256}}}}}},worldRef=put(storePath,world),after={tick:n,stateVersion:n,eventCursor:n,fileSha256:worldRef.sha256,recordContentSha256:digest(world)},receipt={identity:id,businessKey,eventSha256:event.eventSha256,...after}
  put(storePath+'.evolution/'+businessKey+'.receipt.json',receipt)
  const step={step:n,pid:100+n,identity:id,before,after,window:input.window,provenance,primary,historyRef,transaction:{ok:true,receipt},replay:{replayed:true,receipt}},receiptRef=put(run+'/step-'+n+'.json',step)
  steps.push({step:n,pid:step.pid,receiptRef});proofs.push({step:n,nodePid:step.pid,workerPid:primary.output.pid,eventSha256:event.eventSha256,values});events.push({...eventRef,event});before=after;rows=[...rows.slice(1),values]
 }
 const positive=structuredClone(primaryInputs[2]);positive.mode='history_probe';positive.window.values[5][1]++;positive.provenance[5].note+=' history';const p=forward(3,'history_probe',positive,[...outputs[2].values.slice(0,1),outputs[2].values[1]+0.1,...outputs[2].values.slice(2)],4)
 const negative=structuredClone(primaryInputs[2]);negative.mode='metadata_probe';negative.provenance[0].note+=' metadata';forward(3,'metadata_probe',negative,outputs[2].values,5)
 const review={run,taskId:executionContract.taskId,atUtc:finished,executionContractSha256:executionRef.sha256,actual:{run,proofs,lagDifference:Math.abs(p.output.values[1]-outputs[2].values[1]),metadataOutputIdentical:true},bindingChecksAfterRegression:[checkpoint],independentOriginalStoreReadback:{status:'found',verifiedCommittedReceipts:3,tick:3,stateVersion:3,eventCursor:3,fileSha256:before.fileSha256,nodePid:999}}
 const reviewRef=put(execution+'/independent-review.json',review),result={status:'private_three_step_integration_verified',executionTaskId:executionContract.taskId,protocolTaskId:'WORLD-EVOLUTION-LOOP-158',run,identity:id,realModelForwards:5,previousActualModelForwards:4,taskCumulativeModelForwards:9,trainingUpdates:0,formalWorldWrites:0,final:before,qualification:{productionReady:false,coldStartQualified:false},manifestRef,startedAtUtc:started,finishedAtUtc:finished,elapsedMs:14000,forwardEvidence:forwards,steps},resultRef=put(run+'/result.json',result)
 const formalWorldRef=put(formal,{worldId:'mvp-natural-world-001',ownerId:'mvp-natural-owner-001',tick:0}),selection={schemaVersion:'world-evolution-progress-selection-v1',deliveryId:'WORLD-BASELINE-001',run,resultRef,reviewRef,formalWorldRef};put(WORLD_EVOLUTION_SELECTION,selection)
 const read=(p,max)=>{reads.push(p);if(!files.has(p))throw Object.assign(Error('missing'),{code:'ENOENT'});const bytes=files.get(p);assert(bytes.length<=max);return {bytes,sha256:hash(bytes)}}
 const call=(readFresh=read)=>readWorldEvolutionProgress({read,readFresh,readAtUtc:finished,deliveryId:'WORLD-BASELINE-001'})
 return {files,reads,put,call,read,run,selection,result,primaryInputs}
}
test('synthetic complete chain projects3steps and distinguishes formal tick0, without disk/model writes',()=>{const f=fixture(),before=[...f.files].map(([p,b])=>[p,hash(b)]),r=f.call();assert.equal(r.status,'verified_record',r.reason);assert.deepEqual(r.steps.map(s=>s.historyEvents),[0,1,2]);assert.equal(r.formalTick,0);assert.equal(r.elapsedSeconds,14);assert.equal(r.checks.threeCommits,true);assert.equal(r.checks.historyAffectsOutput,true);assert.equal(r.scope,'private_integration');assert.deepEqual([...f.files].map(([p,b])=>[p,hash(b)]),before);assert(!f.reads.some(p=>p.endsWith('.pt')));assert(f.reads.length<=100)})
test('missing selection or incomplete output degrades only panel',()=>{for(const p of [WORLD_EVOLUTION_SELECTION,'forward-3-primary.output.json']){const f=fixture();f.files.delete(p===WORLD_EVOLUTION_SELECTION?p:f.run+'/'+p);const r=f.call();assert.equal(r.status,'unavailable');assert.deepEqual(r.steps,[]);assert.equal(r.checks,null)}})
test('tampered output bytes cannot inherit claimed successful result',()=>{const f=fixture();f.put(f.run+'/forward-1-primary.output.json',{passed:true});assert.equal(f.call().status,'conflict')})
test('foreignrun and traversal references reject before reading foreign bytes',()=>{for(const change of [s=>s.run=s.run.replace(/a{32}$/,'b'.repeat(32)),s=>s.resultRef.path='../secret.json',s=>s.reviewRef.path='C:/secret.json']){const f=fixture();change(f.selection);f.put(WORLD_EVOLUTION_SELECTION,f.selection);assert.equal(f.call().status,'conflict');assert(!f.reads.some(p=>p.includes('secret')))}})
test('mutable source changed during fresh recheck never returns historical success',()=>{const f=fixture();const r=f.call((p,max)=>p===WORLD_EVOLUTION_SELECTION?{bytes:Buffer.from('{}')}:f.read(p,max));assert.equal(r.status,'conflict');assert.equal(r.workHref,null)})
test('consistent result ref cannot hide wrong actual input values',()=>{const f=fixture(),p=f.run+'/forward-2-primary.input.json',input=structuredClone(f.primaryInputs[1]);input.window.values[6][1]+=5;f.put(p,input);assert.equal(f.call().status,'conflict')})
test('formal store changes do not become private evolution tick',()=>{const f=fixture();f.put(formal,{worldId:'mvp-natural-world-001',ownerId:'mvp-natural-owner-001',tick:3});const r=f.call();assert.equal(r.status,'conflict');assert.equal(r.formalTick,null)})
test('partial forward list remains conflict even when selection result SHA is rebound',()=>{const f=fixture();f.result.forwardEvidence.pop();f.selection.resultRef=f.put(f.run+'/result.json',f.result);f.put(WORLD_EVOLUTION_SELECTION,f.selection);assert.equal(f.call().status,'conflict')})

test('verified same-world genesis archive permits the historical audit alongside the live world; false old/current bytes fail',()=>{
 const f=fixture(),origin=f.files.get(formal),originSha=hash(origin),archive=formal+'.evolution/'+'5'.repeat(64)+'.'+originSha+'.before.json'
 f.files.set(archive,origin)
 const live=f.put(formal,{worldId:'mvp-natural-world-001',ownerId:'mvp-natural-owner-001',tick:30})
 const baseline={status:'baseline_verified',worldId:'mvp-natural-world-001',identity:{ownerId:'mvp-natural-owner-001'},
   genesisArchive:{path:archive,sha256:originSha},currentHead:{tick:30,fileSha256:live.sha256}}
 const inspect=()=>readWorldEvolutionProgress({read:f.read,readFresh:f.read,readAtUtc:new Date().toISOString(),deliveryId:'WORLD-BASELINE-001',worldBaseline:baseline})
 const good=inspect();assert.equal(good.status,'verified_record',good.reason);assert.equal(good.steps.length,3);assert.equal(good.formalTick,30)
 assert(good.sources.some(s=>s.path===archive))
 baseline.currentHead.fileSha256=originSha;assert.equal(inspect().status,'conflict')
 baseline.currentHead.fileSha256=live.sha256;f.files.set(archive,Buffer.from('{}'));assert.equal(inspect().status,'conflict')
})
