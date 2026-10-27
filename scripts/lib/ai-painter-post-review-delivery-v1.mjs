import assert from 'node:assert/strict'
import {readCurrentExecutionRegistry} from '../../src/server/ai-painter-current-execution-registry.mjs'
import {getWorkRecordingContext} from '../../src/server/local-backup/work-producers.mjs'

// Reuse the verified registry consumer. No caller-supplied event or verdict,
// no new daemon, and no need for an older console process to reload itself.
export async function deliverPostReviewRecords({projectRoot=process.cwd(),replayRevisions=[]}={}){
 const current=await readCurrentExecutionRegistry(projectRoot)
 assert.ok(current.ok&&current.registry.activeExecution===null,'post-review delivery requires a completed local task')
 assert.equal(current.registry.taskKind,'readonly_post_training_visual_review')
 const result=await getWorkRecordingContext().observeCommittedRegistry({limit:32,replayRevisions})
 return {recorded:result.recorded,eventIds:result.eventIds,reasonCode:result.reasonCode??null,coverage:result.coverage}
}

export async function reviewThenDeliver(run,deliver,onDelivery=()=>{}) {
 let result,primary
 try { result=await run() } catch(error) { primary=error }
 let delivery
 try { delivery=await deliver() }
 catch(error) { delivery={recorded:false,reasonCode:'post_review_work_delivery_failed',error:String(error.message)} }
 onDelivery(delivery)
 if(primary)throw primary
 return result
}
