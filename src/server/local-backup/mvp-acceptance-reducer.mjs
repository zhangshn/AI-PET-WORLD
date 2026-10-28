import {need} from './contracts.mjs'
import {validateMvpFact,factHash,MVP_LIMITS,checkpointIds} from './mvp-acceptance-contracts.mjs'
export function reduceMvpFacts(facts,{checklist,scopeId}){
 need(facts.length<=MVP_LIMITS.facts&&Buffer.byteLength(JSON.stringify(facts))<=MVP_LIMITS.bytes,'mvp_fact_history_limit',409)
 const byId=new Map();for(const f of facts){validateMvpFact(f);need(!byId.has(f.factId)||factHash(byId.get(f.factId))===factHash(f),'mvp_fact_id_conflict',409);byId.set(f.factId,f)}
 const selected=[...byId.values()].filter(f=>f.scopeId===scopeId&&f.checklist.version===checklist.version&&f.checklist.sha256===checklist.sha256)
 const meaning=f=>factHash({checklist:f.checklist,scopeId:f.scopeId,checkpointId:f.checkpointId,decisionClass:f.decisionClass,origin:{sourceCategory:f.origin.sourceCategory,verifierId:f.origin.verifierId,sourceKey:f.origin.sourceKey,revision:f.origin.revision,sha256:f.origin.sha256},applicability:f.applicability,outcome:f.outcome})
 return checkpointIds.map(checkpointId=>{
  const list=selected.filter(f=>f.checkpointId===checkpointId),invalid=new Set()
  const ancestor=(a,b,seen=new Set())=>{if(seen.has(b.factId)){invalid.add(b.factId);return false}seen.add(b.factId);if(!b.predecessor)return false;const parent=byId.get(b.predecessor.factId);if(!parent||factHash(parent)!==b.predecessor.sha256||parent.checkpointId!==b.checkpointId||parent.scopeId!==b.scopeId||factHash(parent.checklist)!==factHash(b.checklist)||factHash(parent.applicability)!==factHash(b.applicability)){invalid.add(b.factId);return false}return meaning(parent)===meaning(a)||ancestor(a,parent,seen)}
  for(const f of list){if(f.predecessor)ancestor(f,f);if(f.outcome==='revoked'&&!f.predecessor)invalid.add(f.factId)}
  const rawHeads=list.filter(a=>!list.some(b=>a!==b&&(ancestor(a,b)||a.origin.sourceKey===b.origin.sourceKey&&a.origin.verifierId===b.origin.verifierId&&a.decisionClass===b.decisionClass&&a.origin.sourceCategory===b.origin.sourceCategory&&b.origin.revision>a.origin.revision&&factHash(a.applicability)===factHash(b.applicability))))
  const equivalent=new Map();for(const f of rawHeads.sort((a,b)=>a.factId.localeCompare(b.factId)))if(!equivalent.has(meaning(f)))equivalent.set(meaning(f),f)
  const heads=[...equivalent.values()]
  need(heads.length<=MVP_LIMITS.heads,'mvp_conflict_head_limit',409)
  const reusedRevision=heads.some((a,i)=>heads.some((b,j)=>i!==j&&a.origin.sourceKey===b.origin.sourceKey&&a.origin.verifierId===b.origin.verifierId&&a.origin.revision===b.origin.revision&&a.origin.sha256!==b.origin.sha256))
  const conflict=invalid.size>0||reusedRevision||new Set(heads.map(f=>f.outcome)).size>1||new Set(heads.map(f=>factHash(f.applicability))).size>1
  const outcome=conflict?'conflict':heads[0]?.outcome??'unknown',production=heads.some(f=>f.decisionClass==='production_machine_acceptance')
  return {checkpointId,outcome,decisionClass:heads.length?(production?'production_machine_acceptance':'legacy_external_component'):null,factIds:heads.map(f=>f.factId).sort(),reasonCode:conflict?'unresolved_fact_conflict':heads[0]?.reasonCode??'no_qualified_evidence'}
 })
}
