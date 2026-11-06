import {verifyNaturalWorldBaselineProof} from '../../../scripts/lib/natural-world-baseline-proof.mjs'
import {COMPAT_SCHEMA,verifyNaturalWorldBaselineCompatibility} from '../../../scripts/lib/natural-world-baseline-compatibility.mjs'

export const CURRENT_WORLD_BASELINE='.runtime/local-backup/project-progress/current-world-baseline.json'
// Exact measured-source artifacts required by bootstrap contract v2; large original rasters are not GET inputs.
export const CURRENT_WORLD_BASELINE_SOURCE_PATHS=Object.freeze([
 ".runtime/ai-painter/earth-geospatial-v7-mvp-slot-condition-runs/earth-geospatial-v7-slot-condition-v7-capacity-slot-146-2026-07-31T14-45-28-337Z/complete-map-condition-task/real-earth-region-source-package.json",
 ".runtime/ai-painter/earth-geospatial-v7-mvp-window-plans/earth-geospatial-v7-mvp-window-plan-2026-07-28T20-07-38-419Z/candidate-windows.json",
 ".runtime/ai-painter/earth-geospatial-naturalized-world-fact-runs/earth-geospatial-naturalized-world-facts-2026-07-28T20-07-32-194Z/naturalized-world-facts.json",
 ".runtime/ai-painter/earth-geospatial-naturalization-runs/earth-geospatial-naturalization-2026-07-28T20-06-59-669Z/measurement-window-manifest.json",
 ".runtime/ai-painter/earth-geospatial-soil-hydrology-runs/earth-geospatial-soil-hydrology-2026-07-28T20-07-07-498Z/soil-hydrology-manifest.json",
 ".runtime/ai-painter/earth-geospatial-engineered-removal-runs/earth-geospatial-engineered-removal-2026-07-28T20-07-18-804Z/engineered-removal-manifest.json",
 ".runtime/ai-painter/earth-geospatial-soil-hydrology-runs/earth-geospatial-soil-hydrology-2026-07-28T20-07-07-498Z/raw-soilgrids/clay-0-5cm-q50.tif",
 ".runtime/ai-painter/earth-geospatial-soil-hydrology-runs/earth-geospatial-soil-hydrology-2026-07-28T20-07-07-498Z/raw-soilgrids/sand-0-5cm-q50.tif",
 ".runtime/ai-painter/earth-geospatial-soil-hydrology-runs/earth-geospatial-soil-hydrology-2026-07-28T20-07-07-498Z/raw-soilgrids/phh2o-0-5cm-q50.tif",
 ".runtime/ai-painter/earth-geospatial-soil-hydrology-runs/earth-geospatial-soil-hydrology-2026-07-28T20-07-07-498Z/raw-soilgrids/wv0010-0-5cm-q50.tif",
 ".runtime/ai-painter/earth-geospatial-engineered-removal-runs/earth-geospatial-engineered-removal-2026-07-28T20-07-18-804Z/raw-osm/overpass-response.json",
 ".runtime/ai-painter/earth-geospatial-naturalization-runs/earth-geospatial-naturalization-2026-07-28T20-06-59-669Z/normalized/elevation-f32-le.bin.gz",
 ".runtime/ai-painter/earth-geospatial-naturalized-world-fact-runs/earth-geospatial-naturalized-world-facts-2026-07-28T20-07-32-194Z/naturalization-evidence/reconstructed-natural-land-cover-u8.bin.gz",
 ".runtime/ai-painter/earth-geospatial-naturalized-world-fact-runs/earth-geospatial-naturalized-world-facts-2026-07-28T20-07-32-194Z/naturalization-evidence/combined-human-removal-mask-u8.bin.gz",
 ".runtime/ai-painter/earth-geospatial-soil-hydrology-runs/earth-geospatial-soil-hydrology-2026-07-28T20-07-07-498Z/natural-hydrology/slope-normalized-f32-le.bin.gz",
 ".runtime/ai-painter/earth-geospatial-soil-hydrology-runs/earth-geospatial-soil-hydrology-2026-07-28T20-07-07-498Z/natural-hydrology/natural-drainage-likelihood-u8.bin.gz"
])
const message={not_registered:'本轮世界基线尚未登记',unverifiable:'本轮世界基线证据不可核验'}
const errorCode=error=>[error?.code,error?.message].find(value=>typeof value==='string'&&/^(?:natural_world_baseline|baseline|work_plan)_[a-z_]+$/.test(value))

/** Read an already produced proof through the work-plan reader's existing limits. */
export function readCurrentWorldBaseline({read,readFresh,readAtUtc,deliveryId}){
 let selected
 try{selected=read(CURRENT_WORLD_BASELINE,64*1024)}catch(error){
  const missing=error?.code==='ENOENT'
  return {status:missing?'not_registered':'unverifiable',label:message[missing?'not_registered':'unverifiable'],worldId:null,percentage:null,readAtUtc,reason:missing?'已查询本轮固定选择记录，尚未登记可核验的世界基线；不代表其他世界不存在。':'固定选择记录读取失败；未返回历史或默认世界。',reasonCode:missing?'natural_world_baseline_selection_missing':errorCode(error)??'natural_world_baseline_selection_unreadable'}
 }
 try{
  const selection=JSON.parse(selected.bytes.toString('utf8'))
  if(selection?.deliveryId!==deliveryId)throw Error('natural_world_baseline_delivery_conflict')
  const compatible=selection.schemaVersion===COMPAT_SCHEMA
  const result=(compatible?verifyNaturalWorldBaselineCompatibility:verifyNaturalWorldBaselineProof)({selection,read:(logical,max)=>read(logical,max).bytes})
  if(result.status!=='verified_bound_machine_readback')throw Error('natural_world_baseline_verifier_result')
  if(readFresh(CURRENT_WORLD_BASELINE,64*1024).sha256!==selected.sha256)throw Error('natural_world_baseline_selection_changed')
  if(readFresh(result.proofRef.path,2*1024*1024).sha256!==result.proofRef.sha256)throw Error('natural_world_baseline_proof_changed')
  return {...result,status:'baseline_verified',label:'本轮世界初始基线已绑定机器读回证据',worldId:result.identity.worldId,percentage:null,readAtUtc,
   reason:'已读取并核对本轮机器生成、保存及独立进程读回的绑定证据。这是初始世界基线；正式画面尚未发布，世界演化尚未接入，不代表世界持续运行或完整MVP通过。',
   readVerification:compatible
    ?'已核对历史生成证据及当时完整源码归档，并核对当前Store独立进程读取同一存档的兼容证据。没有重新执行历史生成算法，没有推进世界。'
    :result.readCoverage?.rawSourceBytesRehashed===false
    ?'本次GET核对存档、条件、小型侧车的实际字节及独立读回记录；未重新读取大栅格来源原件，来源完整核验依据所列机器独立读回证据。不重新运行来源生产、条件计算或保存恢复实验。'
    :'本次GET核对已登记制品实际字节与绑定身份、存档摘要及独立读回记录；不重新运行来源生产、条件计算或保存恢复实验。'}
 }catch(error){
  const code=errorCode(error)
  return {status:'unverifiable',label:message.unverifiable,worldId:null,percentage:null,readAtUtc,reason:'本轮选择或其机器证据未通过身份、内容或读取边界核验；不沿用旧通过结论。',reasonCode:code??'natural_world_baseline_evidence_invalid'}
 }
}
