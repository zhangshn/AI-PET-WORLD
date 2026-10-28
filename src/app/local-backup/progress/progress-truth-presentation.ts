import type {MvpGroup,TruthAudit,TruthRow} from './progress-types'

export const implementationLabels:Record<string,string>={implemented:'已实现（核查范围内）',partial:'部分实现',confirmed_not_implemented:'限定范围确认未实现',insufficient_evidence:'实现证据不足'}
export const acceptanceLabels:Record<string,string>={accepted:'已核验通过（报告限定范围）',failed:'有证据的真实失败',not_verified:'未取得完整适用验收',insufficient_evidence:'验收证据不足'}
export function currentTruthRow(audit:TruthAudit,id:string){return audit.rows?.find(row=>row.checkpointId===id)}
export function presentTruthRow(row?:TruthRow){
 if(!row)return {implementation:'缺少本检查点源码与测试核查证据',acceptance:'缺少完整适用验收证据',reason:'当前绑定报告没有本检查点的可用结论；不能据此认定未实现或失败。',current:false}
 if(row.currentSourceState!=='matched')return {implementation:'来源已变化，当前实现证据需重新核验',acceptance:'当前验收适用性未确认',reason:'原核查时点结论：'+row.reason,current:false}
 return {implementation:implementationLabels[row.implementationStatus]??'实现状态未提供',acceptance:acceptanceLabels[row.acceptanceStatus]??'验收状态未提供',reason:row.reason,current:true}
}
export function groupTruthSummary(group:MvpGroup,audit:TruthAudit){
 const rows=group.checkpoints.map(c=>currentTruthRow(audit,c.id)),current=rows.filter((r):r is TruthRow=>!!r&&r.currentSourceState==='matched')
 const count=(s:string)=>current.filter(r=>r.implementationStatus===s).length
 const parts=[count('implemented')&&`已实现${count('implemented')}项`,count('partial')&&`部分实现${count('partial')}项`,count('confirmed_not_implemented')&&`限定范围确认缺项${count('confirmed_not_implemented')}项`,(count('insufficient_evidence')+rows.length-current.length)&&`实现证据不足${count('insufficient_evidence')+rows.length-current.length}项`].filter(Boolean)
 const blocked=current.filter(r=>r.classification==='blocked').length
 if(blocked)parts.push(`报告受阻${blocked}项`)
 return parts.join(' · ')
}
export function overallTruthConclusion(audit:TruthAudit){
 const unmet=(audit.rows??[]).filter(r=>r.currentSourceState==='matched'&&['blocked','confirmed_not_implemented'].includes(r.classification))
 return {title:unmet.length?'整体MVP尚未通过验收':'缺少整体适用验收证据',unmet}
}
