import { DatabaseSync } from 'node:sqlite'
import { performance } from 'node:perf_hooks'
import fs from 'node:fs'
import { hash, need, identity } from './contracts.mjs'

const REG='.runtime/ai-painter/current-execution-registry'
const SOURCE='ai-painter-registry-v1',MAX_BATCH=32

// Consume only exact committed registry transactions. Terminal interpretation
// stays in work-producers; this helper owns delivery/checkpoints, not a protocol.
export function createRegistryWorkConsumer({readHead,physical,read,terminalEvent,getState,saveState,failure}) {
  return async function observeCommittedRegistry({limit=MAX_BATCH,replayRevisions=[]}={}) {
    need(Number.isSafeInteger(limit)&&limit>0&&limit<=MAX_BATCH,'work_batch_limit')
    need(Array.isArray(replayRevisions)&&replayRevisions.length<=limit&&new Set(replayRevisions).size===replayRevisions.length
      &&replayRevisions.every(n=>Number.isSafeInteger(n)&&n>0),'work_replay_revision_invalid')
    const began=performance.now(),eventIds=new Set(),replayed=[],verified=new Map(),errors={}
    let database,current,state,historyCursor,liveCursor,liveStartRevision,latestConfirmedRevision,processed=0,unsupported=0
    const deadline=()=>need(performance.now()-began<=8000,'work_observation_time_limit',409)
    const receipt=(lane,revision,error)=>{
      const result=failure(SOURCE,error)
      errors[lane]={revision,reasonCode:result.reasonCode}
    }
    try {
      current=await readHead()
      need(current?.ok===true&&current.status==='verified'&&current.registry,'work_registry_unverified',409)
      const head=current.registry,published=head.registryRevision
      need(Number.isSafeInteger(published)&&published>0,'work_registry_head_invalid',409)
      need(replayRevisions.every(n=>n<=published),'work_replay_revision_invalid')
      const eventsPath=physical(REG+'/events.jsonl'),before=fs.lstatSync(eventsPath)
      need(before.isFile()&&!before.isSymbolicLink()&&before.size<=1024*1024,'work_registry_events_limit',409)
      const eventBytes=fs.readFileSync(eventsPath),after=fs.lstatSync(eventsPath)
      need(eventBytes.length<=1024*1024&&before.ino===after.ino&&before.size===after.size&&before.mtimeMs===after.mtimeMs,'work_registry_events_changed',409)
      const events=new Map()
      const lines=eventBytes.toString('utf8').split('\n').filter(Boolean)
      need(lines.length<=4096,'work_registry_events_limit',409)
      for(const line of lines){const event=JSON.parse(line);const group=events.get(event.registryRevision)??[];group.push(event);events.set(event.registryRevision,group)}
      state=getState(SOURCE);historyCursor=state.cursor??0;liveCursor=state.liveCursor??null
      liveStartRevision=state.liveStartRevision??null;latestConfirmedRevision=state.latestConfirmedRevision??null
      need(historyCursor<=published&&(liveCursor===null||liveCursor<=published)
        &&(latestConfirmedRevision===null||latestConfirmedRevision<=published),'work_registry_published_revision_regressed',409)
      database=new DatabaseSync(physical(REG+'/registry.sqlite'),{readOnly:true})
      // LEFT JOIN exposes missing/conflicting transaction rows instead of silently
      // dropping them and advancing a watermark over an unconsumed revision.
      const query=database.prepare('SELECT r.*,t.status AS transaction_status,t.current_sha256 AS transaction_sha FROM registry_revisions r LEFT JOIN registry_transactions t ON t.transaction_id=r.transaction_id WHERE r.registry_revision=?')
      function verifiedSnapshot(revision) {
        deadline()
        if(verified.has(revision))return verified.get(revision)
        const rows=query.all(revision)
        need(rows.length===1,'work_registry_revision_gap',409)
        const row=rows[0]
        need(row.transaction_status==='committed','work_registry_transaction_uncommitted',409);identity(row.transaction_id)
        const tx=read(REG+'/transactions/'+row.transaction_id+'/transaction.json').value
        need(tx.schemaVersion==='ai-painter-current-execution-registry-transaction-v1'&&tx.status==='committed'&&tx.transactionId===row.transaction_id
          &&tx.currentSha256===row.current_sha256&&row.transaction_sha===row.current_sha256
          &&tx.registryRevision===row.registry_revision&&tx.eventSequence===row.event_sequence,'work_registry_transaction_conflict',409)
        const snap=read(REG+'/transactions/'+row.transaction_id+'/current.staged.json',row.current_sha256).value
        need(snap.registryRevision===row.registry_revision&&snap.transactionId===row.transaction_id&&snap.runId===row.run_id
          &&snap.eventSequence===row.event_sequence&&snap.schemaVersion==='ai-painter-current-execution-registry-v1'
          &&snap.writerIdentity==='local_ai_capability_lifecycle_orchestrator'&&snap.taskId===row.task_id,'work_registry_snapshot_conflict',409)
        identity(snap.taskId)
        const matches=events.get(revision)??[],event=matches[0]
        need(matches.length===1&&event.schemaVersion==='ai-painter-current-execution-registry-event-v1'
          &&event.eventSequence===row.event_sequence&&event.transactionId===row.transaction_id
          &&event.currentSha256===row.current_sha256&&event.runId===snap.runId&&event.taskId===snap.taskId
          &&(event.previousCurrentSha256??null)===(snap.supersedes?.currentSha256??null)
          &&(tx.previousCurrentSha256??null)===(snap.supersedes?.currentSha256??null),'work_registry_event_conflict',409)
        verified.set(revision,snap);return snap
      }
      const consumed=new Set()
      function consume(revision,count=true) {
        if(consumed.has(revision))return
        const snap=verifiedSnapshot(revision)
        for(const binding of [snap.latestTrainingTerminal,snap.terminalEvidence]) {
          deadline()
          const result=terminalEvent(binding,snap)
          if(result?.unsupported)unsupported++
          else if(result)for(const id of result.eventIds)eventIds.add(id)
        }
        consumed.add(revision);if(count)processed++
      }
      const checkpoint=()=>saveState(SOURCE,{cursor:historyCursor,liveCursor,liveStartRevision,latestConfirmedRevision,
        coverage:{...state.coverage,complete:false,publishedRevision:published,historyThroughRevision:historyCursor,
          liveThroughRevision:liveCursor,liveStartRevision,latestConfirmedRevision}})
      // Head delivery has priority even if an earlier live transaction is blocked.
      // It is independently confirmed, never a claim that the gap was consumed.
      try {
        need(hash(verifiedSnapshot(published))===hash(head),'work_registry_head_snapshot_conflict',409)
        if(liveCursor===null||liveStartRevision===null) {
          liveStartRevision=published;liveCursor=Math.max(liveCursor??0,published-1)
          // Persist the initial boundary before appending: a failed first delivery
          // must still be retried if a newer head arrives before restart.
          saveState(SOURCE,{liveStartRevision,liveCursor,
            ...(state.liveCursor!==null&&state.liveCursor!==undefined&&state.liveStartRevision==null
              ?{legacyLiveBoundary:{previousLiveCursor:state.liveCursor,newLiveStartRevision:published,historyThroughRevision:historyCursor,
                reasonCode:'legacy_live_start_not_recorded_no_history_inherited'}}:{})})
        }
        consume(published,false);latestConfirmedRevision=published
      }catch(error){receipt('head',published,error)}
      checkpoint()

      // A lane advances only after every source event for that revision committed.
      // Failure in history cannot roll back/erase confirmed live delivery.
      function drain(lane,cursor) {
        while(cursor<published&&processed<limit) {
          // Yield a bounded catch-up slice before the next transaction instead
          // of treating a scheduling budget as a corrupt source revision.
          if(performance.now()-began>=7500)break
          const revision=cursor+1
          try{consume(revision);cursor=revision}
          catch(error){receipt(lane,revision,error);break}
        }
        return cursor
      }
      for(const revision of replayRevisions) {
        try{consume(revision);replayed.push(revision)}
        catch(error){receipt('replay',revision,error);break}
      }
      if(liveCursor!==null)liveCursor=drain('live',liveCursor)
      checkpoint()
      historyCursor=drain('history',historyCursor)
      const priorHistory=state.coverage?.historyFailure??null
      const historyFailure=errors.history??(priorHistory&&historyCursor<priorHistory.revision?priorHistory:null)
      const coverage={complete:false,publishedRevision:published,historyThroughRevision:historyCursor,liveThroughRevision:liveCursor,
        liveStartRevision,latestConfirmedRevision,unsupportedSchemasObserved:unsupported,
        currentActivityStatus:current.activityStatus??'verified',currentActivityReasonCode:current.activityReasonCode??null,
        historyBacklog:published-historyCursor,liveBacklog:liveCursor===null?null:published-liveCursor,
        historyCoverageStatus:historyFailure?'incomplete_source_evidence':'partial',historyFailure,
        liveFailure:errors.live??errors.head??null,replayFailure:errors.replay??null,exactReplayRevisions:replayed,
        scope:'verified_committed_registry_and_explicit_terminals_only'}
      const blocking=errors.head??errors.live??errors.replay
      const reasonCode=blocking?.reasonCode??(unsupported?'work_terminal_schemas_not_connected':historyFailure?'work_history_source_evidence_gap':'work_history_coverage_partial')
      saveState(SOURCE,{status:blocking?'stale':'partial',reasonCode,cursor:historyCursor,liveCursor,liveStartRevision,latestConfirmedRevision,coverage,
        consumerImplementationVersion:'training-interface-038-v1',
        ...(consumed.size?{lastSuccessAtUtc:new Date().toISOString()}:{})})
      return {recorded:!blocking,eventIds:[...eventIds],processed,coverage,...(blocking?{replayed:false,reasonCode}:{})}
    }catch(error) {
      // Event IDs survive even a failed checkpoint; immutable ledger IDs make
      // recovery safe when a process stops between append and watermark save.
      return {...failure(SOURCE,error),eventIds:[...eventIds]}
    }finally{database?.close()}
  }
}
