import {createHash} from 'node:crypto'
import {baselineCanonical as canonical,baselineDigest as digest} from '../../../scripts/lib/natural-world-baseline-proof.mjs'

export const WORLD_EVOLUTION_SELECTION='.runtime/local-backup/project-progress/current-world-evolution.json'
const BASE='.runtime/ai-painter/controller-repair-reviews/'
const PROTOCOL=BASE+'world-evolution-loop-158-20261030',EXECUTION=BASE+'world-evolution-verification-159-20261030'
const FORMAL='data/world-runtime/mvp-natural-owner-001/mvp-natural-world-001.json'
const ARCHIVE=BASE+'world-evolution-scope-137-20261028/daily-source-pilot-v1/response.json'
const WORK='/local-backup/work/codex-a4a947d5ee0c3aa9ea8e636a9382ade1ae06167ced57ef20adce4fdacb2bfe84'
const fields=['PRECTOTCORR','RH2M','T2M','WS2M'],units=['mm/day','%','C','m/s']
const sha=b=>createHash('sha256').update(b).digest('hex'),equal=(a,b)=>canonical(a)===canonical(b)
const need=(ok,code)=>{if(!ok)throw Error('world_evolution_'+code)}
const hash=s=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s)
const stamp=s=>{need(typeof s==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(s)&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString()===s,'time');return Date.parse(s)}
const counters=(v,n)=>v?.tick===n&&v.stateVersion===n&&v.eventCursor===n
const featureSha=rows=>{need(Array.isArray(rows)&&rows.length===7&&rows.every(r=>Array.isArray(r)&&r.length===4&&r.every(Number.isFinite)),'matrix');const b=Buffer.alloc(224);rows.flat().forEach((x,i)=>b.writeDoubleLE(x,i*8));return sha(b)}
const NEXT=['把环境模型适用范围、数据来源及初始历史条件接入正式资格登记。','接入同一正式世界的服务器调度，验证用户离线持续运行与重启恢复。','地图画质与 RuntimeFrame 仍需独立验收。']
const empty=(readAtUtc,status,reason)=>({status,label:status==='unavailable'?'世界演化记录尚未接入':'世界演化记录核验冲突',reason,readAtUtc,observedAtUtc:null,runId:null,worldId:null,formalWorldId:null,formalTick:null,steps:[],checks:null,elapsedSeconds:null,completedAtUtc:null,scope:'private_integration',sources:[],next:NEXT,workHref:null})

/** Bounded read-only historical projection. It never loads model weights or invokes producers. */
export function readWorldEvolutionProgress({read,readFresh,readAtUtc,deliveryId,worldBaseline}){
 let selected
 try{selected=read(WORLD_EVOLUTION_SELECTION,16*1024)}catch(error){return empty(readAtUtc,error?.code==='ENOENT'?'unavailable':'conflict',error?.code==='ENOENT'?'固定选择记录不存在；没有推断运行结果。':'固定选择记录读取失败。')}
 try{
  let total=0;const cache=new Map(),sources=[]
  function get(ref,expected,max=128*1024){
   need(ref&&ref.path===expected&&hash(ref.sha256)&&!/[\\:\0]/.test(expected)&&expected.split('/').every(p=>p&&p!=='.'&&p!=='..'),'source_path')
   if(cache.has(expected)){const value=cache.get(expected);need(value.sha256===ref.sha256,'mixed_ref');return value.value}
   need(cache.size<60,'file_budget');const raw=read(expected,max)
   need(Buffer.isBuffer(raw.bytes)&&raw.bytes.length<=max&&(total+=raw.bytes.length)<=2*1024*1024&&sha(raw.bytes)===ref.sha256,'source_sha')
   const value=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(raw.bytes));canonical(value)
   cache.set(expected,{value,bytes:raw.bytes,sha256:ref.sha256,max});sources.push({path:expected,sha256:ref.sha256});return value
  }
  const selectedSha=sha(selected.bytes),s=JSON.parse(selected.bytes.toString('utf8'))
  need(s.schemaVersion==='world-evolution-progress-selection-v1'&&s.deliveryId===deliveryId,'selection_identity')
  need(typeof s.run==='string'&&s.run.startsWith(PROTOCOL+'/run-')&&/^[a-f0-9]{32}$/.test(s.run.slice((PROTOCOL+'/run-').length)),'run_path')
  const run=s.run,token=run.split('/').at(-1).slice(4),id=Object.fromEntries(['ownerId','playerId','worldId','worldSeed','worldProfileId','regionId'].map(k=>[k,'integration158-'+k.toLowerCase()+'-'+token]))
  const result=get(s.resultRef,run+'/result.json'),review=get(s.reviewRef,EXECUTION+'/independent-review.json')
  need(result.status==='private_three_step_integration_verified'&&result.executionTaskId==='WORLD-EVOLUTION-VERIFICATION-159'&&result.protocolTaskId==='WORLD-EVOLUTION-LOOP-158'&&result.run===run&&equal(result.identity,id),'result_identity')
  need(result.realModelForwards===5&&result.previousActualModelForwards===4&&result.taskCumulativeModelForwards===9&&result.trainingUpdates===0&&result.formalWorldWrites===0&&counters(result.final,3),'result_counters')
  need(result.qualification&&Object.values(result.qualification).every(v=>v===false),'qualification')
  const manifest=get(result.manifestRef,run+'/manifest.json')
  need(manifest.run===run&&equal(manifest.identity,id)&&manifest.executionTaskId===result.executionTaskId&&manifest.protocolTaskId===result.protocolTaskId,'manifest_identity')
  const execution=get(manifest.executionContractRef,EXECUTION+'/execution-contract.json')
  need(execution.taskId===result.executionTaskId&&execution.budget.cpuThreads===2&&execution.budget.gpu===false&&execution.budget.trainingUpdates===0&&execution.budget.formalWorldWrites===0&&execution.budget.newModelForwardsMaximum===5&&execution.budget.wallSeconds===180&&execution.budget.workerSeconds===30,'cpu_budget')
  const contract=get(execution.experimentContract,PROTOCOL+'/experiment-contract.json')
  need(manifest.contractSha256===execution.experimentContract.sha256&&equal(contract.fieldOrder,fields)&&equal(contract.units,units),'protocol')
  const start=stamp(result.startedAtUtc),finish=stamp(result.finishedAtUtc)
  need(start===stamp(manifest.startedAtUtc)&&stamp(manifest.deadlineUtc)-start===180000&&finish>=start&&finish-start<=180000&&Number.isFinite(result.elapsedMs)&&result.elapsedMs>=0&&result.elapsedMs<=180000&&Math.abs(result.elapsedMs-(finish-start))<1000,'elapsed')
  need(review.run===run&&review.taskId===result.executionTaskId&&review.executionContractSha256===manifest.executionContractRef.sha256&&review.actual?.run===run&&review.actual.proofs?.length===3,'review_identity')
  need(Array.isArray(manifest.sourceBindings)&&manifest.sourceBindings.length<=48,'source_catalog')
  const sourceRef=p=>{const refs=manifest.sourceBindings.filter(r=>r.path===p);need(refs.length===1&&hash(refs[0].sha256),'source_ref');return refs[0]}
  need(sourceRef(contract.checkpoint.path).sha256===contract.checkpoint.sha256&&review.bindingChecksAfterRegression.some(r=>r.path===contract.checkpoint.path&&r.sha256===contract.checkpoint.sha256),'model_identity')
  const archive=get(sourceRef(ARCHIVE),ARCHIVE)
  need(contract.archiveBindings[0].path===ARCHIVE&&contract.archiveBindings[0].sha256===sourceRef(ARCHIVE).sha256,'archive_identity')
  const archiveReceipt=get(sourceRef(ARCHIVE.replace('/response.json','/receipt.json')),ARCHIVE.replace('/response.json','/receipt.json'))
  need(archiveReceipt.responseSha256===sourceRef(ARCHIVE).sha256&&archiveReceipt.httpStatus===200,'archive_receipt')
  let rows=contract.seedDates.map(date=>fields.map((field,j)=>{need(archive.parameters[field].units===units[j],'source_units');return archive.properties.parameter[field][date]}))
  featureSha(rows)
  need(Array.isArray(result.forwardEvidence)&&result.forwardEvidence.length===5&&Array.isArray(result.steps)&&result.steps.length===3,'partial_output')
  const forwards=[]
  for(const [index,[step,mode]] of [[1,'primary'],[2,'primary'],[3,'primary'],[3,'history_probe'],[3,'metadata_probe']].entries()){
   const f=result.forwardEvidence[index],base=run+'/forward-'+step+'-'+mode
   need(f.step===step&&f.mode===mode&&f.modelForwardRuns===1,'forward_order')
   const input=get(f.inputRef,base+'.input.json'),output=get(f.outputRef,base+'.output.json'),process=get(f.processRef,base+'.process.json')
   need(input.mode===mode&&output.mode===mode&&equal(input.identity,id)&&input.taskId===result.protocolTaskId&&output.taskId===result.protocolTaskId&&input.contractSha256===manifest.contractSha256&&output.contractSha256===manifest.contractSha256,'forward_identity')
   need(output.inputBytesSha256===f.inputRef.sha256&&output.featureValueSha256===featureSha(input.window.values)&&output.checkpointSha256===contract.checkpoint.sha256&&equal(output.fieldOrder,fields)&&equal(output.units,units)&&equal(input.window.fieldOrder,fields)&&equal(input.window.units,units),'forward_binding')
   need(Array.isArray(output.values)&&output.values.length===4&&output.values.every((v,j)=>Number.isFinite(v)&&v>=contract.guards[fields[j]].minimum&&v<=contract.guards[fields[j]].maximum),'output_values')
   need(process.exitCode===0&&process.signal===null&&process.failure===null&&output.pid===process.pid&&output.pid===f.pid&&Number.isSafeInteger(output.pid)&&output.pid>0&&equal(JSON.parse(process.stdout),output)&&output.modelForwardRuns===1&&output.trainingUpdates===0&&output.worldWrites===0&&output.productionReady===false,'process')
   need(stamp(process.startedAtUtc)>=start&&stamp(process.finishedAtUtc)<=finish&&stamp(output.startedAtUtc)>=stamp(process.startedAtUtc)&&stamp(output.finishedAtUtc)<=stamp(process.finishedAtUtc)&&stamp(output.finishedAtUtc)>=stamp(output.startedAtUtc)&&Number.isFinite(output.elapsedSeconds)&&output.elapsedSeconds>=0&&output.elapsedSeconds<=30&&process.elapsedMs<=30000,'worker_time')
   forwards.push({input,output,ref:f})
  }
  need(new Set(forwards.map(f=>f.output.pid)).size===5,'worker_reuse')
  const steps=[],events=[];let previousAfter=null,previousEvent=null
  for(let n=1;n<=3;n++){
   const r=result.steps[n-1],step=get(r.receiptRef,run+'/step-'+n+'.json'),f=forwards[n-1],input=f.input,output=f.output
   need(r.step===n&&step.step===n&&r.pid===step.pid&&equal(step.identity,id)&&counters(step.before,n-1)&&counters(step.after,n)&&equal(input.before,step.before)&&equal(input.window.values,rows)&&equal(step.window,input.window)&&equal(step.provenance,input.provenance),'step_identity')
   need(!previousAfter||equal(previousAfter,step.before),'state_chain');previousAfter=step.after
   const begin=stamp(contract.simulationEpochUtc)+(n-1)*86400000
   need(stamp(input.interval.logicalStartUtc)===begin&&stamp(input.interval.logicalEndUtc)===begin+86400000&&input.interval.durationSeconds===86400,'logical_time')
   need(equal(step.primary.output,output)&&equal(step.primary.outputRef,f.ref.outputRef)&&equal(step.primary.inputRef,f.ref.inputRef)&&equal(step.primary.processRef,f.ref.processRef),'step_forward')
   const receipt=step.transaction?.receipt
   need(step.transaction.ok===true&&step.replay?.replayed===true&&equal(step.replay.receipt,receipt)&&equal(receipt.identity,id)&&counters(receipt,n)&&receipt.fileSha256===step.after.fileSha256&&hash(receipt.businessKey)&&hash(receipt.eventSha256),'commit_receipt')
   const store=run+'/store/'+id.ownerId+'/'+id.worldId+'.json',eventPath=store+'.evolution/'+receipt.businessKey+'.'+receipt.eventSha256+'.event.json'
   const receiptPath=store+'.evolution/'+receipt.businessKey+'.receipt.json',receiptRaw=read(receiptPath,64*1024)
   need(equal(get({path:receiptPath,sha256:sha(receiptRaw.bytes)},receiptPath,64*1024),receipt),'saved_receipt')
   // Event's content digest differs from its raw file digest; read only this exact derived path.
   const eventRaw=read(eventPath,64*1024),event=get({path:eventPath,sha256:sha(eventRaw.bytes)},eventPath,64*1024)
   const content=Object.fromEntries(Object.entries(event).filter(([k])=>k!=='eventSha256'))
   need(digest(content)===receipt.eventSha256&&event.eventSha256===receipt.eventSha256&&equal(event.identity,id)&&event.previousEventSha256===previousEvent&&event.cursor===n&&event.fromTick===n-1&&event.toTick===n&&event.fromStateVersion===n-1&&event.toStateVersion===n&&equal(event.interval,input.interval),'event_chain')
   need(event.before.expectedFileSha256===step.before.fileSha256&&event.evidence.outputRef.sha256===f.ref.outputRef.sha256&&event.evidence.inputRef.sha256===f.ref.inputRef.sha256&&event.changes.length===4&&event.changes.every((v,j)=>v.fieldId==='environment.'+fields[j]&&v.newValue===output.values[j]),'event_values')
   const history=get(step.historyRef,run+'/step-'+n+'.history.json')
   need(history.selectedCount===n-1&&history.events.length===n-1&&equal(history.identity,id)&&history.committedHead.cursor===n-1&&history.events.every((v,i)=>equal(v.originalEvent,events[i].event)),'history')
   need(input.provenance.length===7,'provenance')
   input.provenance.forEach((p,i)=>{
    const t=begin-(7-i)*86400000;need(stamp(p.periodStartUtc)===t&&stamp(p.periodEndUtc)===t+86400000,'source_period')
    if(i<8-n)need(p.origin==='external_archival_context'&&p.sourceRef.path===ARCHIVE&&p.sourceRef.sha256===sourceRef(ARCHIVE).sha256,'archive_provenance')
    else{const prior=events[i-(8-n)];need(p.origin==='committed_fixture_event'&&p.sourceRef.path===prior.path&&p.sourceRef.sha256===prior.sha256&&equal(rows[i],prior.values),'event_provenance')}
   })
   const proof=review.actual.proofs[n-1];need(proof.step===n&&proof.nodePid===step.pid&&proof.workerPid===output.pid&&proof.eventSha256===receipt.eventSha256&&equal(proof.values,output.values),'review_step')
   events.push({path:eventPath,sha256:sha(eventRaw.bytes),values:output.values,event});previousEvent=receipt.eventSha256;rows=[...rows.slice(1),output.values]
   steps.push({step:n,logicalStartUtc:input.interval.logicalStartUtc,logicalEndUtc:input.interval.logicalEndUtc,values:{precipitation:output.values[0],humidity:output.values[1],temperature:output.values[2],windSpeed:output.values[3]},historyEvents:n-1,committed:true})
  }
  need(equal(previousAfter,result.final)&&new Set(result.steps.map(s=>s.pid)).size===3,'three_commits')
  const privatePath=run+'/store/'+id.ownerId+'/'+id.worldId+'.json',privateWorld=get({path:privatePath,sha256:result.final.fileSha256},privatePath,256*1024)
  need(counters(privateWorld,3)&&privateWorld.worldId===id.worldId&&privateWorld.ownerId===id.ownerId&&equal(privateWorld.worldState.payload.environment.evolution.weather.values,forwards[2].output.values)&&privateWorld.worldState.payload.environment.evolution.commit.eventSha256===previousEvent,'private_store')
  const primary=forwards[2],positive=forwards[3],negative=forwards[4],normalize=i=>{const v=structuredClone(i);delete v.mode;v.provenance.forEach(p=>delete p.note);return v}
  const changed=normalize(positive.input),base=normalize(primary.input),delta=changed.window.values[5][1]-base.window.values[5][1]
  need(Math.abs(delta)===1,'probe_change');changed.window.values[5][1]=base.window.values[5][1]
  const difference=Math.max(...primary.output.values.map((v,i)=>Math.abs(v-positive.output.values[i])))
  need(equal(changed,base)&&equal(normalize(negative.input),base)&&equal(primary.output.values,negative.output.values)&&difference>1e-9&&difference===review.actual.lagDifference&&review.actual.metadataOutputIdentical===true,'probes')
  const readback=review.independentOriginalStoreReadback
  need(readback?.status==='found'&&readback.verifiedCommittedReceipts===3&&counters(readback,3)&&readback.fileSha256===result.final.fileSha256&&Number.isSafeInteger(readback.nodePid)&&!result.steps.some(s=>s.pid===readback.nodePid),'independent_readback')
  let formal
  if(worldBaseline?.status==='baseline_verified'&&worldBaseline.currentHead){
   const archive=worldBaseline.genesisArchive,head=worldBaseline.currentHead
   need(s.formalWorldRef.path===FORMAL&&archive?.sha256===s.formalWorldRef.sha256&&
     archive.path.startsWith(FORMAL+'.evolution/')&&new RegExp('^[a-f0-9]{64}\\.'+archive.sha256+'\\.before\\.json$').test(archive.path.slice((FORMAL+'.evolution/').length)),'formal_archive')
   const initial=get(archive,archive.path,256*1024)
   need(initial.tick===0&&initial.worldId===worldBaseline.worldId,'formal_genesis')
   if(!head.pendingTransaction)need(sha(readFresh(FORMAL,256*1024).bytes)===head.fileSha256,'formal_head_changed')
   formal={worldId:worldBaseline.worldId,ownerId:worldBaseline.identity.ownerId,tick:head.tick}
  }else formal=get(s.formalWorldRef,FORMAL,256*1024)
  need(formal.worldId==='mvp-natural-world-001'&&formal.ownerId==='mvp-natural-owner-001'&&Number.isSafeInteger(formal.tick)&&formal.tick>=0,'formal_world')
  // Recheck the fixed selection and every small consumed source, avoiding mixed-time success.
  need(sha(readFresh(WORLD_EVOLUTION_SELECTION,16*1024).bytes)===selectedSha,'selection_changed')
  for(const [p,v] of cache)need(sha(readFresh(p,v.max).bytes)===v.sha256,'source_changed')
  return {status:'verified_record',label:'历史实验世界：三步演化记录已核验',reason:'已核对真实输入、模型输出、提交事件及独立读回。这里只回放私有实验的三个逻辑日；不表示正式世界已持续运行，未重新读取模型权重或执行模型。',readAtUtc,observedAtUtc:review.atUtc,runId:run.split('/').at(-1),worldId:id.worldId,formalWorldId:formal.worldId,formalTick:formal.tick,steps,checks:{threeCommits:true,historyAffectsOutput:true,metadataUnchanged:true,independentReadback:true},elapsedSeconds:result.elapsedMs/1000,completedAtUtc:result.finishedAtUtc,scope:'private_integration',sources:[{path:WORLD_EVOLUTION_SELECTION,sha256:selectedSha},...sources],next:worldBaseline?.currentHead?.scheduled?['正式世界的最新进度见同页服务器存档及天气履历。','游戏画面发布与地图质量由视觉审核和 RuntimeFrame 验收。']:NEXT,workHref:WORK}
 }catch(error){const code=/^world_evolution_[a-z_]+$/.test(error?.message??'')?error.message:'world_evolution_evidence_unreadable';return empty(readAtUtc,error?.code==='ENOENT'?'unavailable':'conflict','记录缺失、内容冲突或超出读取边界，未返回通过结果。'+code)}
}
