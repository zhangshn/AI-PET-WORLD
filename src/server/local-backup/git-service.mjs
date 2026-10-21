import { performance } from 'node:perf_hooks'
import { hash, need, fields, ModuleError, pageQuery, identity } from './contracts.mjs'
import { createRepository } from './git-repository.mjs'
import { createGitStore } from './git-store.mjs'
import { guardClosure, prepareGuard } from './git-trusted-guard.mjs'

const bindings = snapshot => ({root:snapshot.root,branch:snapshot.branch,head:snapshot.head,indexSha:snapshot.indexSha,target:snapshot.target,pushTargetSha256:hash(snapshot.pushUrl),remoteAlias:snapshot.remoteAlias,coreFilemode:snapshot.coreFilemode})
const unselectedIndex = (entries,selected) => hash(entries.filter(line=>!selected.some(file=>line.slice(line.indexOf('\t')+1)===file)))
function observedOperation(value) {
  if(value.push.status==='executing')return{...value,recordedStatus:value.status,status:'push_unknown',push:{...value.push,status:'unknown'},failureCode:'git_push_incomplete_record'}
  if(value.commit.status==='executing')return{...value,recordedStatus:value.status,status:'operation_unknown',commit:{...value.commit,status:'unknown'},failureCode:'git_commit_incomplete_record'}
  if(['preflight','commit_verified'].includes(value.status))return{...value,recordedStatus:value.status,status:'operation_unknown',failureCode:'git_operation_incomplete_record'}
  return value
}
export function createGitService(projectRoot,stateRoot,options={}) {
  const store=createGitStore(stateRoot)
  need(!options.hooks||options.privateFixture===true,'git_test_hooks_not_allowed',409)
  const repo=()=>createRepository(projectRoot,{privateFixture:options.privateFixture===true})
  function preview(input,search=new URLSearchParams()) {
    fields(input,['files']);need(Array.isArray(input.files)&&input.files.length<=32&&input.files.every(f=>typeof f==='string')&&new Set(input.files).size===input.files.length,'git_selection_invalid')
    const repository=repo(),snapshot=repository.guard()
    const revision=hash([bindings(snapshot),snapshot.records])
    const page=pageQuery(search,[],0,revision)
    if(!input.files.length) {
      return{dataStatus:'connected',mode:'discovery',repository:bindings(snapshot),observedAtUtc:new Date().toISOString(),candidateRevision:revision,records:snapshot.records.slice(page.offset,page.offset+page.limit),total:snapshot.records.length,nextCursor:page.offset+page.limit<snapshot.records.length?page.next(page.offset+page.limit):null,selection:[]}
    }
    need([...search.keys()].length===0,'git_selection_query_not_allowed')
    for(const file of input.files)need(snapshot.records.some(r=>r.path===file&&r.allowed),'git_selection_not_candidate',409)
    const selected=input.files.slice().sort().map(file=>repository.capture(file,snapshot))
    need(selected.reduce((sum,x)=>sum+x.sizeBytes,0)<=8*1024*1024,'git_selection_byte_limit',409)
    const expectedChanges=repository.expectedChanges(selected);need(expectedChanges.length>0,'git_selection_no_effect',409)
    const value={schemaVersion:'local_backup_git_preview_v1',revision:1,createdAtUtc:new Date().toISOString(),repository:bindings(snapshot),selected,selectedStatuses:snapshot.records.filter(r=>input.files.includes(r.path)),expectedChanges,guardClosure:guardClosure(),unselectedIndexSha256:unselectedIndex(snapshot.indexEntries,input.files),executionLimits:{maxSelectedFiles:32,maxFileBytes:2*1024*1024,maxTotalBytes:8*1024*1024,maxGuardInterpreterBytes:256*1024*1024,maxCommandOutputBytes:1024*1024,maxSubprocessMs:30000,maxOperationMs:60000,concurrentPublish:1}}
    // Recheck HEAD/index and selected capture immediately before persisting the preview.
    const verified=repository.guard();need(hash(bindings(verified))===hash(value.repository),'git_preview_changed',409)
    need(hash(selected)===hash(input.files.slice().sort().map(file=>repository.capture(file,verified))),'git_preview_changed',409)
    const previewId=hash(value)
    store.put('previews',previewId,value)
    return{dataStatus:'connected',mode:'preview',previewId,operationId:hash(previewId),preview:value}
  }
  function operation(operationId) {const value=store.read('operations',operationId);need(value,'git_operation_not_found',404);return observedOperation(value)}
  function operationBinding(operationId) {
    const value=store.read('operations',operationId)
    need(value,'git_operation_not_found',404)
    if(!['succeeded','failed','push_failed','push_unknown'].includes(value.status))return null
    return{operationId,revision:value.revision,sha256:hash(value)}
  }
  function publish(input) {
    fields(input,['previewId','expectedRevision','idempotencyKey','message'])
    need(/^[0-9a-f]{64}$/.test(input.previewId),'git_preview_identity_invalid');identity(input.idempotencyKey)
    need(Number.isSafeInteger(input.expectedRevision)&&input.expectedRevision>0,'invalid_revision')
    need(typeof input.message==='string'&&input.message.trim().length>0&&input.message.length<=2000&&!/[\0\r]/.test(input.message)&&!/(?:gh[pousr]_|github_pat_|sk-proj-)[a-zA-Z0-9_]{16,}|-----BEGIN .*PRIVATE KEY-----|(?:password|secret|api[_-]?key|access[_-]?token)\s*[:=]\s*["'][^"'\s]{12,}["']/i.test(input.message),'git_message_invalid')
    const preview=store.read('previews',input.previewId);need(preview,'git_preview_not_found',404);need(input.expectedRevision===preview.revision,'git_preview_revision_conflict',409)
    const operationId=hash(input.previewId),requestSha256=hash(input)
    const existing=store.read('operations',operationId)
    if(existing){need(existing.requestSha256===requestSha256,'git_idempotency_conflict',409);return{dataStatus:'connected',replayed:true,operation:observedOperation(existing)}}
    const unlock=store.lock()
    let result={schemaVersion:'local_backup_git_operation_v1',operationId,previewId:input.previewId,requestSha256,revision:0,status:'preflight',createdAtUtc:new Date().toISOString(),repository:preview.repository,selectedFiles:preview.selected.map(x=>x.path),preparation:{status:'not_started'},commit:{status:'not_started'},push:{status:'not_started'},failureCode:null,events:[]}
    const save=()=>{result.revision++;result.events.push({sequence:result.revision,atUtc:new Date().toISOString(),status:result.status,commitStatus:result.commit.status,pushStatus:result.push.status,failureCode:result.failureCode});store.put('operations',operationId,result,result.revision>1)}
    let repository
    try {
      const concurrent=store.read('operations',operationId)
      if(concurrent){need(concurrent.requestSha256===requestSha256,'git_idempotency_conflict',409);return{dataStatus:'connected',replayed:true,operation:observedOperation(concurrent)}}
      save();repository=repo();options.hooks?.beforePreflight?.()
      const snapshot=repository.guard()
      need(hash(guardClosure())===hash(preview.guardClosure),'git_guard_source_changed',409)
      need(hash(bindings(snapshot))===hash(preview.repository),'git_preview_stale',409)
      const files=preview.selected.map(x=>x.path)
      const captures=files.map(file=>repository.capture(file,snapshot))
      need(hash(captures)===hash(preview.selected)&&hash(snapshot.records.filter(r=>files.includes(r.path)))===hash(preview.selectedStatuses),'git_preview_stale',409)
      options.hooks?.afterPreflight?.()
      const newFiles=preview.selected.filter(x=>x.newFile).map(x=>x.path)
      result.preparation={status:'not_needed',indexBeforeSha256:snapshot.indexSha,indexAfterSha256:snapshot.indexSha}
      if(newFiles.length){result.preparation.status='preparing_selected_new_files';save();repository.git(['add','--intent-to-add','--',...newFiles]);result.preparation={status:'selected_new_files_prepared',files:newFiles,indexBeforeSha256:snapshot.indexSha,indexAfterSha256:repository.guard().indexSha};save()}
      const ready=repository.guard()
      need(ready.head===preview.repository.head&&hash(ready.pushUrl)===preview.repository.pushTargetSha256&&hash(ready.target)===hash(preview.repository.target)&&ready.branch===preview.repository.branch,'git_preview_stale',409)
      need(ready.indexSha===result.preparation.indexAfterSha256&&unselectedIndex(ready.indexEntries,files)===preview.unselectedIndexSha256,'git_index_concurrent_change',409)
      need(hash(files.map(file=>repository.capture(file,ready)))===hash(preview.selected),'git_preview_stale',409)
      result.status='committing';result.commit={status:'executing',startedAtUtc:new Date().toISOString()};save()
      options.hooks?.beforeNativeCommit?.()
      const commitStart=performance.now(),commitResult=repository.git(['commit','--only','--file=-','--',...files],{input:Buffer.from(input.message),timeout:20000,allowFailure:true})
      result.commit.finishedAtUtc=new Date().toISOString();result.commit.elapsedMs=performance.now()-commitStart
      result.commit.processId=commitResult.processId;result.commit.invocationStartedAtUtc=commitResult.invocationStartedAtUtc;result.commit.commandIdentitySha256=commitResult.commandIdentitySha256
      const actualHead=repository.text(['rev-parse','HEAD'])
      if(commitResult.error||commitResult.status!==0) {
        result.commit.status=actualHead!==preview.repository.head?'created_unverified':'failed';result.commit.commitSha=actualHead!==preview.repository.head?actualHead:null
        throw new ModuleError(commitResult.error?'git_commit_unknown':'git_commit_rejected',409)
      }
      result.commit.status='created_unverified';result.commit.commitSha=actualHead;save()
      options.hooks?.afterCommit?.()
      repository.verifyCommit(preview.repository.head,actualHead,preview.expectedChanges)
      const beforePush=repository.guard()
      need(beforePush.head===actualHead&&beforePush.branch===preview.repository.branch&&hash(beforePush.pushUrl)===preview.repository.pushTargetSha256&&hash(beforePush.target)===hash(preview.repository.target),'git_branch_changed_after_commit',409)
      need(unselectedIndex(beforePush.indexEntries,files)===preview.unselectedIndexSha256,'git_index_concurrent_change',409)
      result.commit.status='verified';result.status='commit_verified';save()
      const publication={root:beforePush.root,targetUrl:beforePush.pushUrl}
      const guard=prepareGuard(stateRoot,preview.guardClosure,actualHead,preview.repository.branch,publication)
      options.hooks?.beforePush?.()
      // Verify installed/source bytes again immediately before selecting the operation-scoped hook.
      prepareGuard(stateRoot,preview.guardClosure,actualHead,preview.repository.branch,publication)
      result.status='pushing';result.push={status:'executing',commitSha:actualHead,branch:preview.repository.branch,remoteAlias:'origin',startedAtUtc:new Date().toISOString()};save()
      const pushStart=performance.now()
      // Pin the one verified location rather than resolve a mutable multi-valued alias.
      // The native hook also checks its actual argv and live origin/hook configuration.
      const pushed=options.privateFixture&&options.hooks?.pushResult?options.hooks.pushResult():repository.git(['-c',`core.hooksPath=${guard.directory}`,'push','--porcelain','--no-follow-tags','--recurse-submodules=no',beforePush.pushUrl,`${actualHead}:refs/heads/${preview.repository.branch}`],{timeout:30000,allowFailure:true,guardEnvironment:guard.environment})
      result.push.finishedAtUtc=new Date().toISOString();result.push.elapsedMs=performance.now()-pushStart
      result.push.processId=pushed.processId??null;result.push.invocationStartedAtUtc=pushed.invocationStartedAtUtc??null;result.push.commandIdentitySha256=pushed.commandIdentitySha256??null
      if(!pushed.error&&pushed.status===0){result.push.status='succeeded';result.status='succeeded'}
      else {
        const output=Buffer.concat([pushed.stdout??Buffer.alloc(0),pushed.stderr??Buffer.alloc(0)]).toString('utf8')
        const guardFailure=output.match(/local_backup_pre_push_rejected:(guard_[a-z_]+)/)?.[1]
        if(guardFailure)result.push.guardFailureCode=guardFailure
        const rejected=!pushed.error&&/\[rejected\]|non-fast-forward|fetch first|authentication failed|permission denied|remote rejected|local_backup_pre_push_rejected:/i.test(output)
        result.push.status=rejected?'failed':'unknown';result.status=rejected?'push_failed':'push_unknown';result.failureCode=rejected?'git_push_rejected':'git_push_result_unknown'
      }
      save()
    }catch(error){
      result.failureCode=error instanceof ModuleError?error.message:'git_operation_failed'
      result.status=result.push.status==='executing'?'push_unknown':'failed'
      if(result.push.status==='executing')result.push.status='unknown'
      if(result.commit.status==='executing')result.commit.status='unknown'
      save()
    }finally{unlock()}
    return{dataStatus:'connected',replayed:false,operation:result}
  }
  return{preview,publish,operation,operationBinding}
}
