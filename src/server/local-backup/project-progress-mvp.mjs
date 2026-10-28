import {need} from './contracts.mjs'
import {LEGACY_MVP,MVP_SCOPE} from './mvp-acceptance-contracts.mjs'

export const MVP_SPEC='docs/LOCAL_BACKUP_AND_WORK_LEDGER_SPEC.md'
export const MVP_CHECKLIST_VERSION='mvp-acceptance-checklist-v1'
const groupIds=[...Array.from({length:8},(_,i)=>`MVP-VIS-0${i+1}`),...Array.from({length:4},(_,i)=>`WORLD-AUTO-00${i+1}`)]
const titles=['自然首区','出生与外貌','五类现实动物','生命形态与身份','行动与反馈','时序与存档','训练隔离','视觉与正式发布','服务器持续运行','模型计算演化','世界历史与记忆','自主世界整链']
export function readMvpChecklist(body){
 const section=body.split('### LB-PROGRESS-002 ')[1]?.split('\n## ')[0]
 need(section?.includes(MVP_CHECKLIST_VERSION),'progress_checklist_missing',409)
 const rows=section.split(/\r?\n/).filter(line=>/^\| (?:MVP-VIS-\d+|WORLD-AUTO-\d+) \|/.test(line))
 need(rows.length===12,'progress_checklist_count_invalid',409)
 return rows.map((line,index)=>{
  const parts=line.split('|').slice(1,-1).map(v=>v.trim()),labels=parts[1]?.split('；')
  need(parts.length===2&&parts[0]===groupIds[index]&&labels?.length===4&&labels.every(v=>v&&v.length<=120),'progress_checklist_shape_invalid',409)
  return {id:parts[0],title:titles[index],checkpoints:labels.map((label,i)=>({id:parts[0]+':'+(i+1),label}))}
 })
}
// Arithmetic accepts only the already verified, fixed 12x4 projection. It is
// not an evidence-admission interface and is never exposed as a request input.
export function summarizeMvp(groups){
 need(groups.length===12&&groups.every((g,i)=>g.id===groupIds[i]&&g.checkpoints.length===4&&g.checkpoints.every(c=>['passed','blocked','not_verified','failed','revoked','conflict'].includes(c.status))),'progress_mvp_shape_invalid',409)
 const completed=groups.reduce((n,g)=>n+g.checkpoints.filter(c=>c.status==='passed').length,0)
 need(completed<48||groups.every(g=>g.fullAcceptanceVerified===true),'progress_mvp_full_acceptance_required',409)
 return {denominator:48,completed,percentage:Math.round(completed/48*1000)/10,complete:completed===48,blocked:groups.reduce((n,g)=>n+g.checkpoints.filter(c=>['blocked','failed'].includes(c.status)).length,0),unverified:groups.reduce((n,g)=>n+g.checkpoints.filter(c=>c.status==='not_verified').length,0),revoked:groups.reduce((n,g)=>n+g.checkpoints.filter(c=>c.status==='revoked').length,0),conflicts:groups.reduce((n,g)=>n+g.checkpoints.filter(c=>c.status==='conflict').length,0)}
}
export function truthfulMvpProgress(mvp){
 const knownAcceptanceRatio=typeof mvp.percentage==='number'?mvp.percentage:mvp.knownAcceptanceRatio??null
 return {...mvp,title:'整体进度待核实',percentage:null,overallPercentage:null,knownAcceptanceRatio,knownPassed:mvp.completed,checklistTotal:48,coverageComplete:false,statisticsMethod:'已接入来源的已确认验收项计数；不是整体实现率或工时进度',checkedScope:'当前固定外部组件报告及已提交受信验收事实',unverifiedScope:'全48项已有实现、完整历史、未接入生产来源及常驻采用尚未完成全量核查',truthAudit:{status:'pending',message:'成果全量核查中',implementationTotals:null},groups:mvp.groups.map(g=>({...g,knownAcceptanceRatio:typeof g.percentage==='number'?g.percentage:g.knownAcceptanceRatio??null,percentage:null,overallPercentage:null,coverageComplete:false,knownPassed:g.completed,checkpoints:g.checkpoints.map(c=>({...c,implementationStatus:c.status==='passed'?'implemented':'insufficient_evidence',acceptanceState:c.status==='passed'?'accepted':c.status==='failed'||c.status==='blocked'?'historical_failure_in_limited_scope':'insufficient_evidence',classification:c.status==='passed'?'accepted':['failed','blocked','revoked','conflict'].includes(c.status)?'blocked':'insufficient_evidence'}))})),qualification:'覆盖不完整，无法给出整体完成率。未知不等于未实现、零进展或验收失败。'}
}
export function applyMvpAcceptance(mvp,acceptance){
 need(acceptance.scopeId===MVP_SCOPE&&acceptance.checklist.version===mvp.version&&acceptance.checklist.sha256===mvp.checklist.sha256,'mvp_projection_checklist_conflict',409)
 const {facts,heads,...publicState}=acceptance
 if(!facts.length)return truthfulMvpProgress({...mvp,legacyCompleted:mvp.completed,productionCompleted:0,acceptance:publicState,refreshScope:'只读已提交验收事实和派生索引；消费尚未启动时保留固定外部组件兼容投影。生产协议未注册的检查点保持未验证。'})
 const labels={passed:'外部组件兼容已核验',failed:'历史拒绝／受阻',revoked:'已撤销',conflict:'证据冲突',unknown:'未验证'}
 const groups=mvp.groups.map(g=>{const checkpoints=g.checkpoints.map(c=>{
  const h=heads.find(h=>h.checkpointId===c.id);need(h,'mvp_projection_head_missing',409)
  const selected=facts.filter(f=>h.factIds.includes(f.factId)),legacy=LEGACY_MVP.find(s=>s.checkpointId===c.id)
  return {...c,status:h.outcome==='unknown'?'not_verified':h.outcome,statusLabel:h.outcome==='passed'&&h.decisionClass==='production_machine_acceptance'?'机器生产验收通过':labels[h.outcome],evidenceIds:legacy&&h.factIds.length?[legacy.id]:[],reason:h.reasonCode==='unresolved_fact_conflict'?'来源谱系或适用身份存在冲突，排除分子并保留全部原事实。':h.decisionClass==='legacy_external_component'?'兼容导入冻结外部独立报告；原来源为Codex，机器验收仍unknown，不等于本地自主研发。':c.reason,decisionClass:h.decisionClass,factIds:h.factIds,workEventId:h.factIds[0]?'mvp-'+h.factIds[0]:null,originSourceCategories:[...new Set(selected.map(f=>f.origin.sourceCategory))]}
 });const completed=checkpoints.filter(c=>c.status==='passed').length;return {...g,checkpoints,completed,percentage:completed*25,fullAcceptanceVerified:false}})
 const legacyCompleted=groups.flatMap(g=>g.checkpoints).filter(c=>c.status==='passed'&&c.decisionClass==='legacy_external_component').length,productionCompleted=groups.flatMap(g=>g.checkpoints).filter(c=>c.status==='passed'&&c.decisionClass==='production_machine_acceptance').length
 return truthfulMvpProgress({...mvp,...summarizeMvp(groups),groups,legacyCompleted,productionCompleted,acceptance:publicState,refreshScope:'前台只读已提交验收事实和派生索引；原单观察器负责有界归集。当前仅支持冻结外部组件兼容，生产验收协议尚未注册，未知项不自动补通过。'})
}
export function componentProof(id,v){
 if(id==='facts098')return v?.taskId==='NATURAL-WORLD-FACTS-098'&&v.status==='facts_conditions_private_save_restore_component_accepted'&&v.hashBindingsChecked>0&&v.independentReadback?.status==='independent_readback_and_real_source_replay_passed'&&v.independentReadback.factsReplay===true&&v.independentReadback.channelCount===23
 if(id==='input102')return v?.taskId==='NATURAL-WORLD-MODEL-INPUT-102'&&v.status==='natural_world_model_input_component_accepted'&&v.bindingsChecked>0&&v.independentNativeValuesCompared>0&&v.objects>0&&/^[a-f0-9]{64}$/.test(v.descriptor?.sha256??'')
 if(id==='persistence097')return v?.status==='natural_persistence_component_accepted_with_limits'&&v.formalQualificationGranted===false&&v.worldMvpCompleted===false&&v.tests?.failed===0&&v.tests?.controllerTargetedPassed>0&&v.delivered?.includes('actual independent-process read/write and full identity/state/RNG/hash restoration')
 return false
}
export function projectMvp(checklist,values,binding,readAtUtc){
 const passedBindings={'MVP-VIS-01:1':'facts098','MVP-VIS-01:2':'input102','MVP-VIS-06:1':'persistence097'}
 const groups=checklist.map(group=>({...group,fullAcceptanceVerified:false,checkpoints:group.checkpoints.map(checkpoint=>{
  const source=passedBindings[checkpoint.id]
  if(source&&componentProof(source,values.get(source)))return {...checkpoint,status:'passed',statusLabel:'组件检查点已核验',evidenceIds:[source],reason:'绑定证据仅满足本组件检查点，不授予整组或整体MVP资格。'}
  if(checkpoint.id==='MVP-VIS-08:1'&&values.get('closure095')?.decision?.absoluteOutcome==='failed')return {...checkpoint,status:'blocked',statusLabel:'受阻',evidenceIds:['closure095',...(values.has('probe104')?['probe104']:[])],reason:'095历史候选已拒绝；104原生候选仅代理检查，完整地图与对象可读性验收仍未通过。'}
  return {...checkpoint,status:'not_verified',statusLabel:'未验证',evidenceIds:[],reason:source?'未绑定足以满足该组件检查点的实际核验证据。':'当前固定来源没有本检查点的完整适用验收证据；保留在分母。'}
 })})).map(group=>{const completed=group.checkpoints.filter(c=>c.status==='passed').length;return {...group,completed,denominator:4,percentage:completed*25}})
 return truthfulMvpProgress({version:MVP_CHECKLIST_VERSION,title:'整体MVP验收项完成率',...summarizeMvp(groups),groups,checklist:binding,computedAtUtc:readAtUtc,changeReason:binding.changeReason,formula:'已绑定证据的通过检查点 / 全部48项 × 100；每项等权，保留一位小数',refreshScope:'每15秒重新核对已登记快照与固定证据；新验收的自动归集尚未接入。',qualification:'这是验收项计数，不是工时、剩余日程或整体资格判定。'})
}
