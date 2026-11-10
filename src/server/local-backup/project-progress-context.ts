import {runtimeWorkingDirectory,resolveRuntimePath} from '../../../scripts/lib/runtime-working-directory.mjs'
import 'server-only'
import path from 'node:path'
import {readProjectProgress} from './project-progress.mjs'
import {createWorkProducers} from './work-producers.mjs'
import {applyMvpAcceptance} from './project-progress-mvp.mjs'
import {verifyFrozenMvpBindings} from './mvp-acceptance-contracts.mjs'
import {readProjectWorkPlan} from './project-progress-work-plan.mjs'
import {readProjectProgressTruth} from './project-progress-truth.mjs'
export function projectProgress(){
 const runtimeRoot=resolveRuntimePath(process.env.AI_PET_WORLD_DATA_ROOT??(process.platform==='win32'?'D:/AI-PET-WORLD-DATA':'.ai-pet-world-data'),'hot/runtime')
 let result
 try{result=readProjectProgress({projectRoot:runtimeWorkingDirectory(),runtimeRoot});verifyFrozenMvpBindings(result.projection.evidence)}
 catch(error){
  const evidenceFailures=['progress_fixed_source_missing','progress_plan_sha_conflict','progress_checklist_binding_conflict','progress_evidence_sha_conflict','progress_json_invalid','progress_snapshot_shape','progress_snapshot_schema','progress_snapshot_time_invalid','progress_unknown_producer','progress_mixed_revision']
  if(!(error instanceof Error)||!evidenceFailures.includes(error.message))throw error
  const workPlan=readProjectWorkPlan({projectRoot:runtimeWorkingDirectory(),runtimeRoot})
  if(!workPlan.currentDelivery||!workPlan.definition)throw error
  return {dataStatus:'partial',reasonCode:error.message,projection:{schemaVersion:'local-backup-formal-plan-projection-v1',projectionKind:'formal_plan_only',plan:workPlan.definition,workPlan,readAtUtc:workPlan.readAtUtc,live:false,dynamicEvidence:{status:'unverifiable',reasonCode:error.message,message:'动态说明快照或证据不可核验；当前正式计划独立读取，未返回旧MVP状态或默认完成比例。'}}}
 }
 let mvp
 try{mvp=applyMvpAcceptance(result.projection.mvp,createWorkProducers().readMvpAcceptance())}
 catch(error){
  if(!(error instanceof Error)||error.message!=='mvp_legacy_fact_conflict')throw error
  // Current-spec fixed component originals were independently verified above.
  // Incompatible immutable ledger facts remain historical and are not promoted.
  mvp={...result.projection.mvp,legacyCompleted:result.projection.mvp.completed,productionCompleted:0,acceptance:{dataStatus:'unknown_or_stale',reasonCode:'mvp_legacy_fact_conflict',watermarks:{committedFactSequence:null,derivedSequence:null,consumerSequence:null},coverage:{runtimeAdoption:'not_verified',productionAcceptance:'not_verified',historicalCoverageComplete:false}},refreshScope:'现行规格已更新，旧验收事实适用身份冲突，未计为当前机器通过；限定组件说明来自按当前固定源SHA独立核验的外部组件原件。'}
 }
 const truthAudit=readProjectProgressTruth({projectRoot:runtimeWorkingDirectory(),runtimeRoot,planSha256:result.projection.plan.sha256,specificationSha256:mvp.checklist.sha256})
 const workPlan=readProjectWorkPlan({projectRoot:runtimeWorkingDirectory(),runtimeRoot,planSha256:result.projection.plan.sha256,specificationSha256:mvp.checklist.sha256,modules:result.projection.plan.modules})
 return {...result,projection:{...result.projection,workPlan,mvp:{...mvp,truthAudit}}}
}
