import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'
import { OBSERVATION_CONTRACT, OBSERVATION_RECORD, OBSERVATION_PROGRESS, OBSERVATION_SCOPE, IMAGE_SCOPE } from '../../../src/server/ai-console/training-observation-contract.mjs'

// Synthetic CPU fixture, not a model result or a real training qualification.
export function observationFixture(t, { route = 'cpu-route-alpha', state = 'completed', partial = false, interrupted = false,
  measurements = {fullRgbMae:0.2}, multiSample=false } = {}) {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'painter-observation-fixture-'))
  t.after(()=>{if(!path.resolve(root).startsWith(path.resolve(os.tmpdir())+path.sep))throw Error('fixture_cleanup_boundary');fs.rmSync(root,{recursive:true,force:true})})
  const runId=route+'-run',outputRoot='.runtime/ai-painter/cpu-fixtures/'+runId
  const hash=b=>createHash('sha256').update(b).digest('hex')
  function put(logical,value) {
    const p=path.join(root,logical);fs.mkdirSync(path.dirname(p),{recursive:true})
    const raw=Buffer.isBuffer(value)?value:Buffer.from(JSON.stringify(value));fs.writeFileSync(p,raw)
    return {path:logical,sha256:hash(raw)}
  }
  const own=(name,value)=>put(outputRoot+'/'+name,value)
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aJ1kAAAAASUVORK5CYII=','base64')
  const image=put('data/cpu-fixture/original.png',png),sample={sampleId:'fixture-train',split:'train',image}
  const producer={path:'ml/ai-painter/fixture-recorder.py',sha256:'a'.repeat(64)}
  const plan=[{role:'prediction',sampleId:sample.sampleId,split:sample.split,optimizerStep:1,measurementScope:'fixed_sample_evaluation'},
    {role:'metrics',sampleId:sample.sampleId,split:sample.split,optimizerStep:1,measurementScope:'fixed_sample_evaluation'},
    {role:'checkpoint',optimizerStep:1}]
  const samples=[sample]
  if(multiSample) {
    samples.push({sampleId:'second-fixture-train',split:'train',image:put('data/cpu-fixture/second-original.png',png)})
    plan[2].optimizerStep=2
    for(const role of ['prediction','metrics'])plan.push({role,sampleId:samples[1].sampleId,split:'train',optimizerStep:2,measurementScope:'fixed_sample_evaluation'})
  }
  const pkg={schemaVersion:route,experimentIdentity:runId,outputRoot,programs:[producer],
    interfaceContract:{schemaVersion:OBSERVATION_CONTRACT,purpose:'observation_only',producerVersion:'training-observation-recorder-v1',
      producer,recordFile:'training-observation.json',progressFile:'progress.json',resolution:[1,1],samples,
      optimizerStepCeiling:{generator:2,discriminator:2},artifactPlan:plan}}
  const packageBinding=own('package.json',pkg)
  const at='2026-10-26T07:00:00.123456Z',clock=(scope,status=state)=>({scope,status,
    startedAtUtc:'2026-10-26T06:59:00Z',endedAtUtc:at,elapsedSeconds:60.123456})
  const counts={generator:multiSample?2:1,discriminator:multiSample?2:1}
  const metric={sampleId:sample.sampleId,step:1,optimizerSteps:{generator:1,discriminator:1},metrics:measurements,recordedAtUtc:at}
  const artifacts=[{...plan[0],binding:own('prediction.png',png),resolution:[1,1],imageTiming:clock(IMAGE_SCOPE,'completed')},
    {...plan[1],binding:own('metric.json',metric)},
    {...plan[2],binding:own('checkpoint.pt',Buffer.from('cpu fixture metadata only')),promotable:false},
    {role:'program_events',optimizerStep:1,binding:own('program-events.json',{schemaVersion:'ai-painter-observation-program-events-v1',runId,
      events:[{code:'worker_'+state,phase:'checkpoint',optimizerSteps:counts,recordedAtUtc:at,secretMustNotProject:'fixture-secret'}]})}]
  if(multiSample)artifacts.push({...plan[3],binding:own('second-prediction.png',png),resolution:[1,1],imageTiming:clock(IMAGE_SCOPE,'completed')},
    {...plan[4],binding:own('second-metric.json',{sampleId:samples[1].sampleId,step:2,optimizerSteps:counts,metrics:measurements,recordedAtUtc:at})})
  const value={schemaVersion:OBSERVATION_RECORD,runId,executionPackage:packageBinding,producerVersion:pkg.interfaceContract.producerVersion,
    recordedAtUtc:at,executionState:state,optimizerSteps:counts,qualificationGranted:false,workerTiming:clock(OBSERVATION_SCOPE),artifacts:partial?artifacts.slice(0,2):artifacts,secondaryErrors:[]}
  const terminal={schemaVersion:'ai-painter-learning-capacity-experiment-terminal-v1',runId,experimentIdentity:runId,
    packageId:runId,capabilityVersion:runId,
    executionState:state,status:state==='completed'?'experiment_completed_not_formal_qualified':'experiment_failed_closed',
    executionPackage:packageBinding,trainingObservation:own('training-observation.json',value),recordedAtUtc:at,
    actualFinalOptimizerSteps:counts,formalTrainingQualified:false,formalStageAdvanced:false,checkpointPromotable:false,worldEntryAllowed:false}
  terminal.result=own('result.json',{experimentIdentity:runId,optimizerSteps:counts,trainingObservation:terminal.trainingObservation,
    error:'fixture-private-token',elapsedSeconds:{authorization:'fixture-private-token'}})
  if(interrupted) {
    terminal.trainingObservation=null;terminal.result=null;terminal.actualFinalOptimizerSteps=null;terminal.lastConfirmedOptimizerSteps=counts
    terminal.lastWorkerProgress=own('progress.json',{schemaVersion:OBSERVATION_PROGRESS,runId,packageId:runId,capabilityVersion:runId,
      executionPackage:packageBinding,optimizerSteps:counts,workerTiming:{scope:OBSERVATION_SCOPE,status:'started',startedAtUtc:at,endedAtUtc:null,elapsedSeconds:null},
      artifacts:artifacts.filter(a=>a.role==='prediction')})
  }
  const terminalBinding=own('terminal.json',terminal)
  const capsule={schemaVersion:'ai-painter-local-task-capsule-v1',taskId:runId,integrity:{status:'verified'},
    evidence:[{...packageBinding,kind:'experiment_0',sha256Verified:true}]}
  const capsuleBinding={...own('capsule.json',capsule),taskId:runId}
  const readJson=async b=>{const raw=fs.readFileSync(path.join(root,b.path));if(hash(raw)!==b.sha256)throw Error('history_sha_mismatch');return JSON.parse(raw)}
  const registry={schemaVersion:'ai-painter-current-execution-registry-v1',registryRevision:1,eventSequence:1,
    transactionId:'fixture-tx',writerIdentity:'local_ai_capability_lifecycle_orchestrator',runId,taskId:runId,
    packageId:runId,capabilityVersion:runId,taskCapsule:capsuleBinding,terminalEvidence:{...terminalBinding,status:terminal.status},
    latestTrainingTerminal:{...terminalBinding,runId,status:terminal.status},activeExecution:null,supersedes:null}
  const REG='.runtime/ai-painter/current-execution-registry'
  const head=put(REG+'/current.json',registry)
  put(REG+'/transactions/fixture-tx/current.staged.json',registry)
  put(REG+'/transactions/fixture-tx/transaction.json',{schemaVersion:'ai-painter-current-execution-registry-transaction-v1',status:'committed',
    transactionId:'fixture-tx',registryRevision:1,eventSequence:1,currentSha256:head.sha256,previousCurrentSha256:null})
  put(REG+'/events.jsonl',Buffer.from(JSON.stringify({transactionId:'fixture-tx',registryRevision:1,eventSequence:1,
    currentSha256:head.sha256,previousCurrentSha256:null,taskId:runId,runId})+'\n'))
  const db=new DatabaseSync(path.join(root,REG,'registry.sqlite'))
  db.exec('CREATE TABLE registry_revisions(registry_revision INTEGER,event_sequence INTEGER,transaction_id TEXT,current_sha256 TEXT,task_id TEXT,run_id TEXT); CREATE TABLE registry_transactions(transaction_id TEXT,status TEXT,current_sha256 TEXT)')
  db.prepare('INSERT INTO registry_revisions VALUES(1,1,?,?,?,?)').run('fixture-tx',head.sha256,runId,runId)
  db.prepare('INSERT INTO registry_transactions VALUES(?,?,?)').run('fixture-tx','committed',head.sha256);db.close()
  function active(now=new Date().toISOString()) {
    const identity={runId,packageId:runId,capabilityVersion:runId,processId:123,processStartIdentity:'123:fixture'}
    registry.activeExecution={...identity,executionState:'executing',lock:own('execution-lock.json',{
      schemaVersion:'ai-painter-current-active-execution-lock-v1',...identity}),heartbeat:{path:outputRoot+'/heartbeat.json'}}
    own('heartbeat.json',{schemaVersion:'ai-painter-current-active-execution-heartbeat-v1',...identity,executionState:'executing',heartbeatAtUtc:now})
    const progress={schemaVersion:OBSERVATION_PROGRESS,...identity,executionPackage:packageBinding,updatedAtUtc:now,
      optimizerSteps:counts,executionState:'executing',phase:'training',workerTiming:{scope:OBSERVATION_SCOPE,status:'started',startedAtUtc:now,endedAtUtc:null,elapsedSeconds:null}}
    own('progress.json',progress);return progress
  }
  return {root,runId,outputRoot,pkg,packageBinding,terminal,terminalBinding,value,counts,artifacts,readJson,put,own,png,registry,capsule,capsuleBinding,active}
}
