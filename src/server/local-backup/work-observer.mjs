import fs from 'node:fs'
import path from 'node:path'
import { getWorkRecordingContext } from './work-producers.mjs'

const observerKey=Symbol.for('ai-pet-world.local-work-recording.observer.v1')
// One subscription in the existing Node runtime. No interval, directory scan,
// HTTP-triggered startup, native child or dependency on the training executor.
export function createWorkObserver(context) {
  let busy=false,pending=false,closed=false,watcher=null,ready
  async function consume() {
    if(closed)return
    if(busy){pending=true;return}
    busy=true
    try{await context.observeCommittedRegistry({limit:32})}
    catch(error){context.failure('ai-painter-registry-v1',error)}
    finally{busy=false;if(pending&&!closed){pending=false;setImmediate(()=>{void consume()})}}
  }
  const directory=path.join(context.runtime,'ai-painter/current-execution-registry')
  try {
    const stat=fs.lstatSync(directory)
    if(!stat.isDirectory()||stat.isSymbolicLink())throw Error('work_registry_watch_boundary')
    watcher=fs.watch(directory,{persistent:false},(_event,filename)=>{
      const name=filename?.toString()
      if(name===undefined||name==='current.json'||name==='events.jsonl')void consume()
    })
    watcher.on('error',error=>{context.failure('ai-painter-registry-v1',error);watcher?.close();watcher=null})
    ready=consume()
  }catch(error){context.failure('ai-painter-registry-v1',error);ready=Promise.resolve()}
  return {ready,dispose(){closed=true;pending=false;watcher?.close();watcher=null},get active(){return watcher!==null&&!closed}}
}
export function startWorkObserver() {
  if(!globalThis[observerKey])globalThis[observerKey]=createWorkObserver(getWorkRecordingContext())
  return globalThis[observerKey]
}
