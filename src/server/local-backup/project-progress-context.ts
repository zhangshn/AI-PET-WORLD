import 'server-only'
import path from 'node:path'
import {readProjectProgress} from './project-progress.mjs'
import {createWorkProducers} from './work-producers.mjs'
import {applyMvpAcceptance} from './project-progress-mvp.mjs'
import {verifyFrozenMvpBindings} from './mvp-acceptance-contracts.mjs'
import {readProjectWorkPlan} from './project-progress-work-plan.mjs'
import {readProjectProgressTruth} from './project-progress-truth.mjs'
export function projectProgress(){
 const runtimeRoot=path.resolve(process.env.AI_PET_WORLD_DATA_ROOT??(process.platform==='win32'?'D:/AI-PET-WORLD-DATA':'.ai-pet-world-data'),'hot/runtime')
 const result=readProjectProgress({projectRoot:process.cwd(),runtimeRoot})
 verifyFrozenMvpBindings(result.projection.evidence)
 let mvp
 try{mvp=applyMvpAcceptance(result.projection.mvp,createWorkProducers().readMvpAcceptance())}
 catch(error){
  if(!(error instanceof Error)||error.message!=='mvp_legacy_fact_conflict')throw error
  // Current-spec fixed component originals were independently verified above.
  // Incompatible immutable ledger facts remain historical and are not promoted.
  mvp={...result.projection.mvp,legacyCompleted:result.projection.mvp.completed,productionCompleted:0,acceptance:{dataStatus:'unknown_or_stale',reasonCode:'mvp_legacy_fact_conflict',watermarks:{committedFactSequence:null,derivedSequence:null,consumerSequence:null},coverage:{runtimeAdoption:'not_verified',productionAcceptance:'not_verified',historicalCoverageComplete:false}},refreshScope:'现行规格已更新，旧验收事实适用身份冲突，未计为当前机器通过；限定组件说明来自按当前固定源SHA独立核验的外部组件原件。'}
 }
 const truthAudit=readProjectProgressTruth({projectRoot:process.cwd(),runtimeRoot,planSha256:result.projection.plan.sha256,specificationSha256:mvp.checklist.sha256})
 const workPlan=readProjectWorkPlan({projectRoot:process.cwd(),runtimeRoot,planSha256:result.projection.plan.sha256,specificationSha256:mvp.checklist.sha256,modules:result.projection.plan.modules})
 return {...result,projection:{...result.projection,workPlan,mvp:{...mvp,truthAudit}}}
}
