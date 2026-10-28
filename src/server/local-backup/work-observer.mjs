import fs from 'node:fs'
import path from 'node:path'
import { getWorkRecordingContext } from './work-producers.mjs'

const observerKey=Symbol.for('ai-pet-world.local-work-recording.observer.v1')
const implementationVersion='mvp-acceptance-observer-136-v1'
// One subscription in the existing Node runtime. No interval, directory scan,
// HTTP-triggered startup, native child or dependency on the training executor.
export function createWorkObserver(context) {
  let busy=false,pending=false,closed=false,watcher=null,scheduled=null,ready
  const startedAtUtc=new Date().toISOString()
  function schedule() {
    pending=true
    if(closed||busy||scheduled!==null)return
    scheduled=setImmediate(()=>{scheduled=null;void consume()})
  }
  async function consume() {
    if(closed)return
    if(busy){pending=true;return}
    busy=true
    try {
      // Bounded startup/event catch-up; no retry timer or spin on a failed gap.
      // New notifications received during a read are retained for the next pass.
      let moreLive=false,business=null
      for(let batch=0;batch<4&&!closed;batch++) {
        pending=false
        const result=await context.observeCommittedRegistry({limit:32})
        business=result?.coverage??null
        moreLive=result?.processed>0&&result.coverage?.liveBacklog>0&&!result.coverage.liveFailure
        if(!pending&&!moreLive)break
      }
      if(moreLive&&!closed)pending=true
      // Same existing watcher and bounded turn. No GET, timer or second runner.
      // Acceptance failure cannot repeat or change the original business.
      if(!closed&&context.consumeMvpAcceptance)try{await context.consumeMvpAcceptance({business})}catch(error){try{context.failure('mvp-acceptance-v1',error)}catch{/* A secondary acceptance receipt failure never changes the business lane. */}}
      context.saveState?.('ai-painter-registry-v1',{observerRuntime:{implementationVersion,
        processId:process.pid,startedAtUtc,observedAtUtc:new Date().toISOString(),mode:'existing_node_filesystem_watch',contextImplementationVersion:context.implementationVersion??null,acceptanceImplementation:context.mvpImplementationIdentity??null}})
    }
    catch(error){context.failure('ai-painter-registry-v1',error)}
    finally{busy=false;if(pending&&!closed)schedule()}
  }
  const directory=path.join(context.runtime,'ai-painter/current-execution-registry')
  try {
    const stat=fs.lstatSync(directory)
    if(!stat.isDirectory()||stat.isSymbolicLink())throw Error('work_registry_watch_boundary')
    watcher=fs.watch(directory,{persistent:false},(_event,filename)=>{
      const name=filename?.toString()
      if(name===undefined||name==='current.json'||name==='events.jsonl')schedule()
    })
    watcher.on('error',error=>{context.failure('ai-painter-registry-v1',error);watcher?.close();watcher=null})
    ready=consume()
  }catch(error){context.failure('ai-painter-registry-v1',error);ready=Promise.resolve()}
  return {implementationVersion,ready,dispose(){closed=true;pending=false;if(scheduled!==null)clearImmediate(scheduled);scheduled=null;watcher?.close();watcher=null},get active(){return watcher!==null&&!closed}}
}
export function startWorkObserver() {
  if(globalThis[observerKey]?.implementationVersion!==implementationVersion){globalThis[observerKey]?.dispose();globalThis[observerKey]=createWorkObserver(getWorkRecordingContext())}
  return globalThis[observerKey]
}
