import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { randomUUID } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'
import { createStore } from './store.mjs'
import { createWorkLedger, workTimestamp, validateWorkReport } from './work-ledger.mjs'
import { hash, need, fields, identity, ModuleError } from './contracts.mjs'
import { readCurrentExecutionRegistry } from '../ai-painter-current-execution-registry.mjs'
import { trainingTerminalKind, describeTrainingTerminal } from './training-work-report.mjs'
import { readSingleMapWorkEvidence } from './single-map-work-evidence.mjs'
import { createRegistryWorkConsumer } from './work-registry-consumer.mjs'
import { readTrainingWorkObservation } from './training-work-observation.mjs'
import { readTwoMapPostReviewWorkEvidence } from './two-map-post-review-work-evidence.mjs'

const PLAN='docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md'
const SPEC='docs/LOCAL_BACKUP_AND_WORK_LEDGER_SPEC.md'
const REG='.runtime/ai-painter/current-execution-registry'
const SOURCES=['ai-painter-registry-v1','git-operations-v1','backup-runs-v1','codex-records-v1','training-history-index-v1']
export const CODEX_REPORTERS=Object.freeze([
  Object.freeze({id:'codex-controller',name:'总控|文档、调度与验收2',threadId:'01a16ccd-a67b-7ae0-b614-a0415398ae0b'}),
  Object.freeze({id:'codex-migration',name:'能力迁移｜本地连续执行',threadId:'01a094ed-39ee-7e60-a949-d726cdda7e09'}),
  Object.freeze({id:'codex-training',name:'训练｜256×192质量改进',threadId:'01a094ed-39ee-7e60-a949-d7183f57a7ce'}),
  Object.freeze({id:'codex-console',name:'控制台｜状态、图像与证据',threadId:'01a07f58-6ad4-77f2-be64-5e470aee4dea'}),
  Object.freeze({id:'codex-training-interfaces',name:'训练接口｜记录与控制台闭环',threadId:'01a06c76-0c98-7e62-a132-d8035ccbdab0'}),
  Object.freeze({id:'codex-backup',name:'存储备份｜同步、手动备份与查询',threadId:'01a15f92-889e-7772-a395-e8b9e7fe4b5a'})
])
const MAX_JSON=1024*1024
const MAX_MIXED_PACKAGE_JSON=4*1024*1024
const knownReason=e=>/^[a-z][a-z0-9_]{0,159}$/.test(e?.message??'')?e.message:/^[A-Z][A-Z0-9_]{0,63}$/.test(e?.code??'')?'work_recording_'+e.code.toLowerCase():'work_recording_unavailable'
const absent=file=>{try{fs.lstatSync(file);return false}catch(e){if(e.code==='ENOENT')return true;throw e}}
const same=(a,b)=>path.resolve(a).toLowerCase()===path.resolve(b).toLowerCase()
const contextKey=Symbol.for('ai-pet-world.local-work-recording.context.v1')
const implementationVersion='bounded-mixed-package-068-v1'
function fixtureScope(root) {
  const real=fs.realpathSync(root)
  need(same(path.dirname(real),fs.realpathSync(os.tmpdir()))&&/^local-backup-work-[A-Za-z0-9]+$/.test(path.basename(real)),'work_fixture_scope_required',409)
  need(fs.readFileSync(path.join(real,'.local-work-private-fixture'),'utf8')==='local-work-test-only','work_fixture_marker_required',409)
  return real
}
function buildContext(projectRoot, providedStore, testReader, privateFixture) {
  projectRoot=fs.realpathSync(projectRoot)
  const runtime=fs.realpathSync(path.join(projectRoot,'.runtime'))
  if(!privateFixture) {
    const expected=path.resolve(process.env.AI_PET_WORLD_DATA_ROOT??(process.platform==='win32'?'D:/AI-PET-WORLD-DATA':path.join(projectRoot,'.ai-pet-world-data')),'hot/runtime')
    need(same(runtime,fs.realpathSync(expected)),'runtime_mapping_conflict',409)
  }
  const moduleRoot=path.join(runtime,'local-backup'),stateRoot=path.join(moduleRoot,'work-recording')
  const store=providedStore??createStore(moduleRoot)
  function physical(logical) {
    need(typeof logical==='string'&&logical.length<=512&&!logical.includes('\\')&&!logical.startsWith('/')&&!/[:\0]/.test(logical)&&logical.split('/').every(x=>x&&x!=='.'&&x!=='..'),'work_evidence_path_invalid',409)
    const inRuntime=logical.startsWith('.runtime/')
    const base=inRuntime?runtime:projectRoot,parts=(inRuntime?logical.slice(9):logical).split('/')
    let cursor=base
    for(const part of parts) {
      cursor=path.join(cursor,part)
      const s=fs.lstatSync(cursor)
      need(!s.isSymbolicLink()&&(s.isDirectory()||(s.isFile()&&s.nlink===1)),'work_evidence_boundary',409)
    }
    return cursor
  }
  function read(logical,expected=null,max=MAX_JSON) {
    const file=physical(logical),before=fs.lstatSync(file)
    const mixedSource=/^\.runtime\/ai-painter\/learning-capacity-experiments\/[A-Za-z0-9-]+\/package\.json$/.test(logical)
    const programSnapshot=/^\.runtime\/local-backup\/work-recording\/evidence\/program\/[a-f0-9]{64}\.json$/.test(logical)
    const extended=max===MAX_JSON&&/^[a-f0-9]{64}$/.test(expected??'')&&(mixedSource||programSnapshot)
    const ceiling=extended?MAX_MIXED_PACKAGE_JSON:max
    need(before.isFile()&&before.size<=ceiling,'work_evidence_limit',409)
    const bytes=fs.readFileSync(file),after=fs.lstatSync(file),sha256=hash(bytes)
    need(before.ino===after.ino&&before.dev===after.dev&&before.size===after.size&&before.mtimeMs===after.mtimeMs,'work_evidence_changed',409)
    if(expected!==null)need(sha256===expected,'work_evidence_sha_conflict',409)
    let value
    try{value=JSON.parse(bytes.toString('utf8'))}catch{throw new ModuleError('work_evidence_json_invalid',409)}
    if(bytes.length>max){
      need(extended&&value.schemaVersion==='mixed-train-rehearsal-package-v1'
        &&Array.isArray(value.selectedSampleIds)&&value.selectedSampleIds.length===48
        &&new Set(value.selectedSampleIds).size===48
        &&value.training?.pairs===448&&value.qualificationGranted===false
        &&typeof value.experimentIdentity==='string'
        &&value.outputRoot==='.runtime/ai-painter/learning-capacity-experiments/'+value.experimentIdentity
        &&(programSnapshot||logical===value.outputRoot+'/package.json'),'work_large_package_identity_invalid',409)
      if(programSnapshot)need(path.basename(logical)===expected+'.json','work_snapshot_digest_name_conflict',409)
    }
    return {logicalPath:logical,sha256,bytes,value}
  }
  function ensureDirectory(directory) {
    need(same(path.dirname(stateRoot),moduleRoot),'work_state_scope_invalid',409)
    const relative=path.relative(moduleRoot,directory)
    need(relative&&!relative.startsWith('..')&&!path.isAbsolute(relative),'work_state_scope_invalid',409)
    let cursor=moduleRoot
    for(const part of relative.split(path.sep)) {
      cursor=path.join(cursor,part)
      if(absent(cursor))fs.mkdirSync(cursor)
      const s=fs.lstatSync(cursor);need(s.isDirectory()&&!s.isSymbolicLink(),'work_state_boundary',409)
    }
  }
  function put(file,value) {
    ensureDirectory(path.dirname(file))
    const bytes=Buffer.from(JSON.stringify(value)+'\n')
    need(bytes.length<=64*1024,'work_state_limit',409)
    const temporary=file+'.'+randomUUID()+'.next'
    fs.writeFileSync(temporary,bytes,{flag:'wx'})
    if(!absent(file)){const s=fs.lstatSync(file);need(s.isFile()&&!s.isSymbolicLink()&&s.nlink===1,'work_state_boundary',409)}
    fs.renameSync(temporary,file)
  }
  function getState(id) {
    need(SOURCES.includes(id),'work_source_unknown')
    const file=path.join(stateRoot,'sources',id+'.json')
    if(absent(file))return {sourceId:id,status:'not_connected',reasonCode:'producer_not_started',cursor:0,liveCursor:null,coverage:{complete:false}}
    const logical='.runtime/local-backup/work-recording/sources/'+id+'.json'
    const envelope=read(logical).value
    need(envelope.sha256===hash(envelope.value),'work_state_integrity_conflict',409)
    return envelope.value
  }
  function saveState(id,value) {
    const previous=getState(id)
    // A slower duplicate runtime cannot intentionally rewind persisted cursors.
    const next={...previous,...value,sourceId:id,cursor:Math.max(previous.cursor??0,value.cursor??0),
      liveCursor:value.liveCursor===undefined?(previous.liveCursor??null):value.liveCursor===null?(previous.liveCursor??null):Math.max(previous.liveCursor??0,value.liveCursor),
      updatedAtUtc:new Date().toISOString()}
    put(path.join(stateRoot,'sources',id+'.json'),{value:next,sha256:hash(next)})
    return next
  }
  function failure(sourceId,error) {
    const reasonCode=knownReason(error)
    const relative=typeof error?.path==='string'?path.relative(runtime,error.path):null
    const diagnostic={errorName:typeof error?.name==='string'?error.name.slice(0,80):null,errorCode:typeof error?.code==='string'?error.code.slice(0,80):null,logicalPath:relative&&!relative.startsWith('..')&&!path.isAbsolute(relative)?'.runtime/'+relative.replaceAll('\\','/'):null}
    try{put(path.join(stateRoot,'failures',sourceId+'-'+randomUUID()+'.json'),{schemaVersion:'local_work_recording_failure_v1',sourceId,reasonCode,diagnostic,recordedAtUtc:new Date().toISOString(),businessRetried:false})}catch{/* Original business outcome never depends on this secondary receipt. */}
    try{saveState(sourceId,{status:'stale',reasonCode,coverage:{...getState(sourceId).coverage,complete:false}})}catch{/* An unavailable store remains unavailable, never fake an empty day. */}
    return {recorded:false,replayed:false,eventIds:[],reasonCode}
  }
  function planReference(moduleId) {
    const bytes=fs.readFileSync(path.join(projectRoot,PLAN))
    return {authorityPath:PLAN,documentVersion:null,documentSha256:hash(bytes),moduleOrRequirementId:moduleId==='local-backup'?'module-9':moduleId==='capability-migration'?'module-3':moduleId==='ai-console'?'module-8':'module-2'}
  }
  function verifyPlan(p) {
    try {
      need([PLAN,SPEC].includes(p.authorityPath)&&/^[a-f0-9]{64}$/.test(p.documentSha256),'work_plan_path_invalid')
      const bytes=fs.readFileSync(physical(p.authorityPath))
      if(hash(bytes)!==p.documentSha256)return false
      if(p.documentVersion!==null&&!bytes.toString('utf8').includes(p.documentVersion))return false
      if(p.authorityPath===PLAN)return /^module-[1-9][0-9]*$/.test(p.moduleOrRequirementId)&&new RegExp('\\| '+p.moduleOrRequirementId.slice(7)+' \\|').test(bytes.toString('utf8'))
      return typeof p.moduleOrRequirementId==='string'&&bytes.toString('utf8').includes(p.moduleOrRequirementId)
    }catch{return false}
  }
  function verifyEvidence(e) {
    try {
      need(e.logicalPath.startsWith('.runtime/ai-painter/')||e.logicalPath.startsWith('.runtime/local-backup/'),'work_evidence_scope_invalid')
      need(!/(?:^|\/)(?:\.env[^/]*|[^/]*(?:credential|cookie|csrf|secret)[^/]*)$/i.test(e.logicalPath),'work_evidence_secret_refused')
      read(e.logicalPath,e.sha256);return true
    }catch{return false}
  }
  const producer=(id,sourceCategory,reporter)=>Object.freeze({id,sourceCategory,reporter,canAccept:false,allowUnresolvedPlan:true,verifyEvidence,verifyPlan})
  const producers={registry:producer('ai-painter-work-v1','local_program',{id:'local-ai-painter',name:'本地训练与审核程序',threadId:null}),git:producer('local-git-work-v1','local_program',{id:'local-git-service',name:'本地 Git 操作程序',threadId:null}),backup:producer('local-backup-work-v1','local_program',{id:'local-backup-service',name:'本地备份程序',threadId:null})}
  const codexProducers=Object.fromEntries(CODEX_REPORTERS.map(r=>[r.id,producer('codex-work-'+r.id,'codex',r)]))
  const allProducers=[...Object.values(producers),...Object.values(codexProducers)]
  function readCoverage({date=null}={}) {
    const sources=SOURCES.map(id=>{try{return getState(id)}catch(e){return {sourceId:id,status:'stale',reasonCode:knownReason(e),coverage:{complete:false}}}})
    const reportDate=date??new Date(Date.now()+28800000).toISOString().slice(0,10)
    const registeredReporters=CODEX_REPORTERS.map(reporter=>{try{const logical='.runtime/local-backup/work-recording/reporters/'+reporter.id+'/'+reportDate+'.json';const file=path.join(runtime,logical.slice(9));if(absent(file))return {...reporter,coverageStatus:'no_report_recorded',knownReportCount:null,reasonCode:'not_reported_is_not_zero_work'};const v=read(logical).value;return {...reporter,coverageStatus:'reported_partial',knownReportCount:v.eventIds.length,lastReceivedAtUtc:v.lastReceivedAtUtc}}catch{return {...reporter,coverageStatus:'unknown',knownReportCount:null,reasonCode:'reporter_state_unreadable'}}})
    return {complete:false,producerCount:allProducers.length,sources,registeredReporters,reportDate,
      missingCapabilities:['complete_all_day_history','independent_machine_acceptance','machine_validation_reports','production_backup_execution','training_history_index_source'],
      note:'Counts describe recorded known events only; source gaps are not zero work.'}
  }
  const ledger=createWorkLedger(store,allProducers,{readCoverage})
  function snapshot(readResult,kind) {
    const logical='.runtime/local-backup/work-recording/evidence/'+kind+'/'+readResult.sha256+'.json'
    const file=path.join(runtime,logical.slice(9))
    ensureDirectory(path.dirname(file))
    if(absent(file))fs.writeFileSync(file,readResult.bytes,{flag:'wx'})
    else {const stat=fs.lstatSync(file);need(stat.isFile()&&!stat.isSymbolicLink()&&stat.nlink===1,'work_snapshot_boundary',409);need(hash(fs.readFileSync(file))===readResult.sha256,'work_snapshot_conflict',409)}
    return {logicalPath:logical,sha256:readResult.sha256}
  }
  const baseEvent=(eventId,moduleId,taskId,runId,eventKind,executionResult)=>({
    eventId,moduleId,taskId,runId,eventKind,executionResult,validationStatus:'unknown',acceptanceStatus:'unknown',
    evidenceReferences:[],originalStartedAtUtc:null,originalFinishedAtUtc:null,monotonicElapsedMs:null,originalEventAtUtc:null,planReference:null,
    title:'',completedText:'',nextStepsText:'',reasonCode:null
  })
  function describeSource(input) {
    return {title:input.title,objective:'记录原程序真实保存的'+input.title,reason:'自动归集工作事实；不要求用户填写日报，也不改变原业务结果。',actions:['读取固定来源绑定并核对实际字节摘要。','保留原始起止时间和实际耗时；缺失项保持未知。'],changes:input.evidenceReferences.map(e=>({path:e.logicalPath,description:'保存或引用本次来源证据；不改写原训练、Git或备份产物。'})),checks:[{command:null,status:'passed',description:'本地来源与摘要核验通过；不是重新运行原业务或签发机器验收。'},{command:null,status:'not_run',description:'本台账未执行训练、Git提交推送或真实备份。'}],results:[input.completedText||input.title,'原执行结果：'+input.executionResult+'；机器验证与验收未从执行结束推导。'],issues:[input.reasonCode??'全日历史、独立机器验收及未接入来源仍有明确覆盖缺口。'],nextSteps:['根据原始证据处理后续工作；本建议不是执行授权。'],planComparison:'关联唯一模块计划表的真实字节摘要；不补造历史计划版本或改变正式范围。'}
  }
  function appendSource(producer,input) {
    const previous=ledger.find(input.eventId)
    if(previous)return {recorded:true,replayed:true,eventIds:[input.eventId]}
    input.planReference??=planReference(input.moduleId)
    input.reporter=producer.reporter
    input.workReport??=describeSource(input)
    const result=ledger.appendProduced(producer,input)
    return {recorded:true,replayed:result.replayed,eventIds:[input.eventId]}
  }
  function nativeTiming(terminal,readResult) {
    if(terminal.workerExecutionTiming?.path) {
      const v=read(terminal.workerExecutionTiming.path,terminal.workerExecutionTiming.sha256).value
      need(v.runId===terminal.runId&&v.packageId===terminal.packageId&&v.executionPackage?.sha256===terminal.executionPackage?.sha256,'work_timing_identity_conflict',409)
      return {originalStartedAtUtc:v.startedAtUtc??null,originalFinishedAtUtc:v.endedAtUtc??null,
        monotonicElapsedMs:Number.isFinite(v.elapsedSeconds)?v.elapsedSeconds*1000:null,originalEventAtUtc:terminal.recordedAtUtc??v.endedAtUtc??null}
    }
    if(terminal.nativeOwnedReceipt?.path) {
      const receipt=read(terminal.nativeOwnedReceipt.path,terminal.nativeOwnedReceipt.sha256).value
      const proof=receipt.proof??{}
      return {originalStartedAtUtc:proof.startedAtUtc??null,originalFinishedAtUtc:proof.endedAtUtc??null,
        monotonicElapsedMs:Number.isFinite(proof.elapsedMs)?proof.elapsedMs:null,originalEventAtUtc:proof.endedAtUtc??null}
    }
    void readResult
    return {originalEventAtUtc:terminal.recordedAtUtc??null}
  }
  function terminalEvent(binding,snapshotValue) {
    if(!binding?.path||!binding.sha256)return null
    need(binding.path.startsWith('.runtime/ai-painter/'),'work_terminal_scope_invalid',409)
    const original=read(binding.path,binding.sha256),v=original.value,schema=v.schema??v.schemaVersion
    const postReview=readTwoMapPostReviewWorkEvidence({terminal:v,read})
    if(postReview) {
      const eventId='program-post-review-v1-'+hash([binding.path,binding.sha256])
      if(ledger.find(eventId))return {recorded:true,replayed:true,eventIds:[eventId]}
      const input=baseEvent(eventId,'ai-painter','review-'+v.runId,v.runId,'execution_finished',postReview.executionResult)
      Object.assign(input,{title:'本地训练后视觉审核（执行与画质分别记录）',originalEventAtUtc:v.recordedAtUtc,
        originalStartedAtUtc:v.startedAtUtc??null,originalFinishedAtUtc:v.recordedAtUtc,
        monotonicElapsedMs:Number.isFinite(v.elapsedSeconds)?v.elapsedSeconds*1000:null,
        reasonCode:v.visualOutcome==='failed'?'visual_review_failed':postReview.executionResult==='failed'?'review_execution_failed':null,
        sourceReference:{kind:'review_terminal',originId:v.runId,revision:null},
        evidenceReferences:[original,postReview.pkg,postReview.source,...(postReview.report?[postReview.report]:[])].map(r=>snapshot(r,'program'))})
      input.workReport={title:input.title,objective:'读取已完成训练的权重，独立检查两张固定训练图和八张验证图。',reason:'训练完成不代表画质通过；后继只读审核独立留档。',
        actions:['核验来源绑定并执行有界只读推理和视觉组件审核。'],changes:[],
        checks:[{command:'本地训练后视觉审核',status:postReview.executionResult==='succeeded'?'passed':'failed',description:'表示审核执行状态；画质结论另列。'}],
        results:['来源训练Run：'+v.sourceRunId,'画质分项结论：'+v.visualOutcome,'失败样本数：'+(postReview.failedSamples??'未知'),'未授予正式资格，未启动下一轮训练。'],
        issues:postReview.issueCodes,nextSteps:['按真实失败项核对对象范围及跨图表现；没有自动重训。'],planComparison:'模块2的训练后只读审核；原训练终态保持。'}
      return appendSource(producers.registry,input)
    }
    const observed=readTrainingWorkObservation({terminal:v,registry:snapshotValue,read})
    if(observed) {
      const runId=v.runId;identity(runId)
      const eventId='program-observation-v1-'+hash([binding.path,binding.sha256])
      if(ledger.find(eventId))return {recorded:true,replayed:true,eventIds:[eventId]}
      const kind={type:'training',result:observed.completed?'succeeded':'failed'}
      const input=baseEvent(eventId,'ai-painter','training-'+runId,runId,'execution_finished',kind.result)
      const timing=observed.value?.workerTiming??observed.interruptedTiming
      Object.assign(input,{title:'本地训练执行结果（资格另列）',originalEventAtUtc:v.recordedAtUtc??null,
        originalStartedAtUtc:timing?.startedAtUtc??null,originalFinishedAtUtc:timing?.endedAtUtc??null,
        monotonicElapsedMs:Number.isFinite(timing?.elapsedSeconds)?timing.elapsedSeconds*1000:null,
        completedText:'按统一观测合同接收本地终态；模型资格与观测完整度分别记录。',
        reasonCode:observed.gap??(observed.completed?null:v.status),sourceReference:{kind:'training_terminal',originId:runId,revision:null},
        evidenceReferences:[original,observed.pkg,...(observed.observation?[observed.observation]:[])].map(r=>snapshot(r,'program'))})
      input.workReport=describeTrainingTerminal({input,terminal:{...v,optimizerSteps:observed.value?.optimizerSteps},kind,
        supplementGaps:observed.gap?[observed.gap]:[]})
      input.workReport.results.push('计时范围：'+(timing?.scope??'未记录；不推算'),
        '观测制品登记数：'+(observed.value?.artifacts.length??'未知')+'；工作事件不代替逐图片字节核验或模型审核。')
      return appendSource(producers.registry,input)
    }
    const single=readSingleMapWorkEvidence({terminal:v,binding,registry:snapshotValue,read,need})
    if(single) {
      const runId=v.runId;identity(runId)
      const eventId='program-single-map-v1-'+hash([binding.path,binding.sha256])
      if(ledger.find(eventId))return {recorded:true,replayed:true,eventIds:[eventId]}
      const kind={type:'training',result:single.completed?'succeeded':'failed'}
      const input=baseEvent(eventId,'ai-painter','training-'+runId,runId,'execution_finished',kind.result)
      Object.assign(input,{title:single.completed?'单图训练执行完成（未授予画质资格）':'单图训练失败关闭',
        originalEventAtUtc:v.recordedAtUtc,originalFinishedAtUtc:v.recordedAtUtc,
        // The worker monotonic interval is not the controller start/end interval.
        monotonicElapsedMs:null,completedText:'固定训练样本的实验结果已保存；训练输出和逐步指标可在控制台训练历史按Run查看。',
        reasonCode:single.completed?null:v.status,sourceReference:{kind:'training_terminal',originId:runId,revision:null},
        evidenceReferences:[original,single.capsule,single.pkg,single.result].map(r=>snapshot(r,'program'))})
      input.workReport=describeTrainingTerminal({input,terminal:{...v,optimizerSteps:single.steps,checkpointReloadVerified:single.checkpointReloadExact},kind})
      input.workReport.results.push('实验worker原始单调耗时：'+single.elapsedSeconds+'秒；不冒充控制器全程耗时。',
        '优化器初始化原记录：'+single.optimizerInitialization+'；只表示固定训练样本拟合，不证明验证集迁移。')
      return appendSource(producers.registry,input)
    }
    const kind=trainingTerminalKind(v)
    if(!kind)return {unsupported:true,schema:schema??'unknown'}
    const {type,result,title}=kind
    const runId=v.runId??binding.runId;identity(runId)
    need(v.runId===runId&&v.packageId&&(!binding.runId||binding.runId===runId),'work_terminal_identity_conflict',409)
    need(v.executionPackage?.path?.startsWith('.runtime/ai-painter/')&&/^[a-f0-9]{64}$/.test(v.executionPackage.sha256),'work_terminal_package_missing',409)
    const executionPackage=read(v.executionPackage.path,v.executionPackage.sha256).value
    need(executionPackage.schemaVersion==='ai-painter-autonomous-closed-loop-package-v1'&&executionPackage.packageIdentity===v.packageId,'work_terminal_package_conflict',409)
    if(type==='review') {
      const workerBinding=kind.core?snapshotValue?.latestTrainingTerminal:v.workerTerminal
      need(workerBinding?.path?.startsWith('.runtime/ai-painter/')&&/^[a-f0-9]{64}$/.test(workerBinding.sha256),'work_review_worker_missing',409)
      const worker=read(workerBinding.path,workerBinding.sha256).value
      need(worker.runId===runId&&worker.packageId===v.packageId&&worker.executionPackage?.sha256===v.executionPackage.sha256,'work_review_worker_identity_conflict',409)
      if(kind.audit)need(worker.schema==='object-support-structure-quality-worker-terminal-v1'&&worker.status==='training_completed_review_pending'&&worker.executionState==='completed','work_review_worker_not_completed',409)
    }
    // Existing events are immutable. Append a detailed version under the same
    // task/Run identity; aggregate sets deduplicate execution counts on upgrade.
    const eventId='program-detail-v2-'+hash([type,binding.path,binding.sha256])
    if(ledger.find(eventId))return {recorded:true,replayed:true,eventIds:[eventId]}
    const input=baseEvent(eventId,'ai-painter',type+'-'+runId,runId,'execution_finished',result)
    const supplementGaps=[]
    let timing={originalEventAtUtc:v.recordedAtUtc??null}
    try{timing=nativeTiming(v,original)}catch{supplementGaps.push('原始计时证据不可核对；起止与耗时保持未知，不用其他时间推算。')}
    Object.assign(input,timing,{title,completedText:type==='training'?'训练执行结果已由本地程序保存；不代表画质、Stage4或发布资格。':kind.audit?'本地审核原报告已保存；原结论与执行成功分别记录，不授予能力资格。':'保留原始审核程序失败；不将其混为训练失败或视觉拒绝。',
      reasonCode:result==='failed'?v.status:null,evidenceReferences:[snapshot(original,'program')],
      sourceReference:{kind:type+'_terminal',originId:runId,revision:null}})
    const supplement=(ref,validate,label)=>{
      if(!ref){supplementGaps.push(label+'：未绑定，详细覆盖未知。');return null}
      try {
        need(ref.path?.startsWith('.runtime/ai-painter/')&&/^[a-f0-9]{64}$/.test(ref.sha256),'work_terminal_supplement_scope',409)
        const r=read(ref.path,ref.sha256);need(validate(r.value),'work_terminal_supplement_identity',409)
        input.evidenceReferences.push(snapshot(r,'program'));return r.value
      }catch{supplementGaps.push(label+'：证据缺失、超限、摘要或身份不一致；保留首错，不冒称已核对。');return null}
    }
    const preview=type==='training'?supplement(v.trainingPreviewManifest,p=>p.schemaVersion==='training-preview-diagnostic-manifest-v1'&&p.runId===runId&&p.packageId===v.packageId,'预览次错证据'):null
    const core=kind.core?v:kind.audit?supplement(v.core,c=>c.schema==='object-support-structure-machine-audit-core-v1'&&c.runId===runId&&c.packageId===v.packageId&&c.executionPackage?.sha256===v.executionPackage.sha256&&c.status===v.status,'机器审核结论'):null
    input.workReport=describeTrainingTerminal({input,terminal:v,kind,preview,core,supplementGaps})
    return appendSource(producers.registry,input)
  }
  // Historical terminal facts do not prove that an execution is still alive.
  // Only the activity-liveness failure may use this narrower durable verifier;
  // every published byte/transaction/SQLite/event binding must still agree.
  function readDurableHead(activityReason) {
    need(activityReason==='registry_active_execution_process_not_active','work_registry_unverified',409)
    const original=read(REG+'/current.json'),head=original.value
    need(head.schemaVersion==='ai-painter-current-execution-registry-v1'&&head.writerIdentity==='local_ai_capability_lifecycle_orchestrator'&&Number.isSafeInteger(head.registryRevision)&&head.registryRevision>0&&Number.isSafeInteger(head.eventSequence)&&head.eventSequence>0,'work_registry_head_invalid',409)
    identity(head.transactionId)
    const tx=read(REG+'/transactions/'+head.transactionId+'/transaction.json').value
    need(tx.schemaVersion==='ai-painter-current-execution-registry-transaction-v1'&&tx.status==='committed'&&tx.transactionId===head.transactionId&&tx.registryRevision===head.registryRevision&&tx.eventSequence===head.eventSequence&&tx.currentSha256===original.sha256,'work_registry_transaction_conflict',409)
    read(REG+'/transactions/'+head.transactionId+'/current.staged.json',original.sha256)
    const db=new DatabaseSync(physical(REG+'/registry.sqlite'),{readOnly:true})
    try {
      const row=db.prepare('SELECT * FROM registry_revisions WHERE registry_revision=?').get(head.registryRevision)
      const transaction=db.prepare('SELECT * FROM registry_transactions WHERE transaction_id=?').get(head.transactionId)
      need(row?.transaction_id===head.transactionId&&row.event_sequence===head.eventSequence&&row.current_sha256===original.sha256&&row.run_id===head.runId&&transaction?.status==='committed'&&transaction.current_sha256===original.sha256,'work_registry_database_conflict',409)
    }finally{db.close()}
    const file=physical(REG+'/events.jsonl'),before=fs.lstatSync(file)
    need(before.isFile()&&before.size<=MAX_JSON,'work_registry_events_limit',409)
    const bytes=fs.readFileSync(file),after=fs.lstatSync(file)
    need(bytes.length<=MAX_JSON&&before.ino===after.ino&&before.size===after.size&&before.mtimeMs===after.mtimeMs,'work_registry_events_changed',409)
    const matches=bytes.toString('utf8').split('\n').filter(Boolean).map(line=>JSON.parse(line)).filter(e=>e.eventSequence===head.eventSequence)
    need(matches.length===1&&matches[0].schemaVersion==='ai-painter-current-execution-registry-event-v1'&&matches[0].registryRevision===head.registryRevision&&matches[0].transactionId===head.transactionId&&matches[0].currentSha256===original.sha256&&matches[0].runId===head.runId,'work_registry_event_conflict',409)
    read(REG+'/current.json',original.sha256)
    return {ok:true,status:'verified',registry:head,activityStatus:'unknown_or_stale',activityReasonCode:activityReason}
  }
  const observeCommittedRegistry=createRegistryWorkConsumer({
    readHead:async()=>{
      const current=await (testReader??(()=>readCurrentExecutionRegistry(projectRoot)))()
      return current?.ok===true?current:readDurableHead(current?.errorCode)
    },
    physical,read,terminalEvent,getState,saveState,failure
  })
  async function recordGitOperation(input) {
    const id='git-operations-v1'
    try {
      fields(input,['operationId','revision','sha256']);need(/^[a-f0-9]{64}$/.test(input.operationId)&&Number.isSafeInteger(input.revision)&&input.revision>0&&/^[a-f0-9]{64}$/.test(input.sha256),'work_git_binding_invalid')
      const original=read('.runtime/local-backup/git/operations/'+input.operationId+'.json',null,128*1024),envelope=original.value,v=envelope.value
      need(v&&envelope.sha256===hash(v)&&envelope.sha256===input.sha256&&v.operationId===input.operationId&&v.revision===input.revision&&v.schemaVersion==='local_backup_git_operation_v1','work_git_binding_conflict',409)
      need(['succeeded','failed','push_failed','push_unknown'].includes(v.status),'work_git_not_terminal',409)
      const eventIds=[];let allReplayed=true
      for(const phase of ['commit','push']) {
        const stage=v[phase]
        if(!stage||stage.status==='not_started')continue
        const outcome=phase==='commit'?(stage.status==='verified'?'succeeded':stage.status==='failed'?'failed':'unknown'):(stage.status==='succeeded'?'succeeded':stage.status==='failed'?'failed':'unknown')
        const e=baseEvent('git-'+hash([input.operationId,input.revision,phase,input.sha256]),'local-backup','git-'+input.operationId,input.operationId,'execution_finished',outcome)
        Object.assign(e,{title:phase==='commit'?'Git 本地提交结果':'Git 推送结果',completedText:'按原生阶段结果记录；提交成功与推送成功分别计量。',reasonCode:v.failureCode??null,
          originalStartedAtUtc:stage.startedAtUtc??null,originalFinishedAtUtc:stage.finishedAtUtc??null,monotonicElapsedMs:Number.isFinite(stage.elapsedMs)?stage.elapsedMs:null,originalEventAtUtc:stage.finishedAtUtc??null,
          sourceReference:{kind:'git_'+phase,originId:input.operationId,revision:input.revision},evidenceReferences:[snapshot(original,'git')]})
        const r=appendSource(producers.git,e);eventIds.push(...r.eventIds);allReplayed&&=r.replayed
      }
      if(!eventIds.length) {
        const e=baseEvent('git-'+hash([input.operationId,input.revision,'operation',input.sha256]),'local-backup','git-'+input.operationId,input.operationId,'execution_finished',v.status==='failed'?'failed':'unknown')
        Object.assign(e,{title:'Git 操作结束',completedText:'保留原始预检或未知结果，不推断提交或推送完成。',reasonCode:v.failureCode??null,sourceReference:{kind:'git_operation',originId:input.operationId,revision:input.revision},evidenceReferences:[snapshot(original,'git')]})
        const r=appendSource(producers.git,e);eventIds.push(...r.eventIds);allReplayed=r.replayed
      }
      saveState(id,{status:'partial',reasonCode:'work_git_history_not_backfilled',coverage:{complete:false,scope:'new_final_operation_callbacks_only'},lastSuccessAtUtc:new Date().toISOString()})
      return {recorded:true,replayed:allReplayed,eventIds}
    }catch(error){return failure(id,error)}
  }
  async function recordBackupRun(input) {
    const id='backup-runs-v1'
    try {
      fields(input,['backupId','sha256']);identity(input.backupId);need(/^[a-f0-9]{64}$/.test(input.sha256),'work_backup_binding_invalid')
      const original=read('.runtime/local-backup/runs/'+input.backupId+'/terminal.json',input.sha256),v=original.value
      need(v.schemaVersion==='local_backup_run_terminal_v1'&&v.backupId===input.backupId&&['completed','failed','interrupted'].includes(v.state),'work_backup_terminal_invalid',409)
      const e=baseEvent('backup-'+hash([input.backupId,input.sha256]),'local-backup','backup-'+input.backupId,input.backupId,v.state==='interrupted'?'interrupted':'execution_finished',v.state==='completed'?'succeeded':v.state)
      Object.assign(e,{title:'本地备份执行结果',completedText:'执行结束不自动表示全量覆盖或独立恢复验证通过。',reasonCode:v.failureCode??null,originalStartedAtUtc:v.startedAtUtc??null,originalFinishedAtUtc:v.finishedAtUtc??null,originalEventAtUtc:v.finishedAtUtc??null,monotonicElapsedMs:Number.isFinite(v.elapsedMs)?v.elapsedMs:null,evidenceReferences:[snapshot(original,'backup')],sourceReference:{kind:'backup_terminal',originId:input.backupId,revision:null}})
      const r=appendSource(producers.backup,e)
      saveState(id,{status:'partial',reasonCode:'work_backup_scope_partial',coverage:{complete:false,scope:'bound_run_terminal_only'},lastSuccessAtUtc:new Date().toISOString()});return r
    }catch(error){return failure(id,error)}
  }
  async function recordCodex(input,reporterId) {
    const id='codex-records-v1'
    try {
      need(Object.hasOwn(codexProducers,reporterId),'work_codex_reporter_unknown')
      const producer=codexProducers[reporterId]
      const required=['eventId','moduleId','taskId','runId','eventKind','executionResult','workReport','attributedClaims','evidenceReferences','originalStartedAtUtc','originalFinishedAtUtc','monotonicElapsedMs','originalEventAtUtc','planReference']
      fields(input,required);need(['ai-painter','capability-migration','local-backup','ai-console'].includes(input.moduleId),'work_module_unknown')
      validateWorkReport(input.workReport)
      need(input.planReference!==null,'work_codex_plan_required')
      let taskBound=false
      for(const ref of input.evidenceReferences) {
        need(ref.logicalPath.startsWith('.runtime/ai-painter/controller-repair-reviews/')||ref.logicalPath.startsWith('.runtime/local-backup/work-recording/'),'work_codex_evidence_scope')
        const v=read(ref.logicalPath,ref.sha256).value
        const binds=value=>value&&[value.task,value.taskId,value.workOrderId,value.workOrder].includes(input.taskId)
        if(binds(v)||(Array.isArray(v.reports)&&v.reports.length<=64&&v.reports.some(binds)))taskBound=true
      }
      if(input.executionResult==='succeeded'||input.attributedClaims.validationStatus!=='unknown'||input.attributedClaims.acceptanceStatus!=='unknown')need(taskBound,'work_task_evidence_mismatch',409)
      const eventId='codex-'+hash([reporterId,input.eventId])
      const r=ledger.appendProduced(producer,{...input,eventId,reporter:producer.reporter,title:input.workReport.title,validationStatus:'unknown',acceptanceStatus:'unknown'})
      const date=input.originalEventAtUtc===null?'unknown':new Date(Date.parse(workTimestamp(input.originalEventAtUtc))+28800000).toISOString().slice(0,10)
      const reporterFile=path.join(stateRoot,'reporters',reporterId,date+'.json')
      const old=absent(reporterFile)?{eventIds:[]}:read('.runtime/local-backup/work-recording/reporters/'+reporterId+'/'+date+'.json').value
      const eventIds=[...new Set([...old.eventIds,r.event.eventId])];need(eventIds.length<=512,'work_reporter_day_limit')
      put(reporterFile,{reporter:producer.reporter,date,eventIds,lastReceivedAtUtc:r.event.receivedAtUtc,complete:false})
      saveState(id,{status:'partial',reasonCode:'external_codex_records_only',coverage:{complete:false,scope:'explicit_attributed_codex_submissions_only'},lastSuccessAtUtc:new Date().toISOString()})
      return {recorded:true,replayed:r.replayed,eventIds:[r.event.eventId]}
    }catch(error){return failure(id,error)}
  }
  return {implementationVersion,projectRoot,runtime,moduleRoot,stateRoot,ledger,ledgerForStore:queryStore=>createWorkLedger(queryStore,allProducers,{readCoverage}),readCoverage,getState,saveState,failure,observeCommittedRegistry,recordGitOperation,recordBackupRun,recordCodex,planReference}
}
export function createWorkProducers({projectRoot=process.cwd(),store}={}) {return buildContext(projectRoot,store,null,false)}
export function createWorkProducersForIsolatedTests({projectRoot,store,readRegistry}={}) {return buildContext(fixtureScope(projectRoot),store,readRegistry,true)}
export function getWorkRecordingContext() {
  const scope=globalThis
  if(scope[contextKey]?.implementationVersion!==implementationVersion)scope[contextKey]=createWorkProducers()
  return scope[contextKey]
}
export async function recordGitOperation(operationBinding) {
  try{return await getWorkRecordingContext().recordGitOperation(operationBinding)}catch(e){return {recorded:false,replayed:false,eventIds:[],reasonCode:knownReason(e)}}
}
export async function recordBackupRun(runBinding) {
  try{return await getWorkRecordingContext().recordBackupRun(runBinding)}catch(e){return {recorded:false,replayed:false,eventIds:[],reasonCode:knownReason(e)}}
}
