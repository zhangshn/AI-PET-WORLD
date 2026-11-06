import {need} from './contracts.mjs'
import {documentRegistration} from './document-catalog.mjs'
import {extractDiagrams} from './diagram-extract.mjs'
import {readCurrentWorldBaseline} from './natural-world-baseline-reader.mjs'
import {readBaselineAndCurrentHead} from '../../../scripts/lib/natural-world-current-head-baseline.mjs'
import {readWorldEvolutionProgress} from './world-evolution-progress-reader.mjs'
import {readNativeStage0TrainingProgress} from './native-stage0-training-progress.mjs'

const GUIDE='docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md'
const text=v=>typeof v==='string'&&v.trim().length>0&&v.length<=4000&&!v.includes('\0')
const texts=v=>Array.isArray(v)&&v.length<=24&&v.every(text)
export function validateCurrentDelivery(delivery,items){
 if(delivery===undefined)return
 need(delivery&&/^WORLD-[A-Z0-9-]{1,80}$/.test(delivery.id)&&['title','objective'].every(k=>text(delivery[k]))&&texts(delivery.scope)&&texts(delivery.nonGoals)&&texts(delivery.next),'current_delivery_shape',409)
 need(Array.isArray(delivery.steps)&&delivery.steps.length>0&&delivery.steps.length<=12&&new Set(delivery.steps.map(s=>s.id)).size===delivery.steps.length,'current_delivery_steps',409)
 for(const step of delivery.steps){
  need(text(step.id)&&step.id.startsWith(delivery.id+'-')&&['title','deliverable','doneWhen'].every(k=>text(step[k]))&&texts(step.actions)&&step.actions.length>0&&texts(step.planItemIds)&&step.planItemIds.length>0&&new Set(step.planItemIds).size===step.planItemIds.length&&step.planItemIds.every(id=>items.some(item=>item.id===id)),'current_delivery_step_reference',409)
 }
 need(Array.isArray(delivery.documents)&&delivery.documents.length>0&&delivery.documents.length<=12&&delivery.documents.every(d=>text(d.section)&&text(d.label)&&documentRegistration.some(r=>r.relativePath===d.path&&!r.historical&&!r.restricted)),'current_delivery_documents',409)
 need(delivery.diagram?.path===GUIDE&&text(delivery.diagram.section),'current_delivery_diagram',409)
}
export function projectCurrentDelivery(plan,{projectRoot=process.cwd(),guideBody,guideSha256,readAtUtc,read,readFresh}){
 const delivery=plan.currentDelivery;if(!delivery)return undefined
 validateCurrentDelivery(delivery,plan.items)
 const registration=p=>documentRegistration.find(r=>r.relativePath===p)
 const document=registration(GUIDE),diagrams=extractDiagrams({content:guideBody,sha256:guideSha256,relativePath:GUIDE,documentId:document.documentId,title:'唯一模块计划表',version:null,historical:false,authorityStatus:'active-module-plan',programAdoptionStatus:null})
 const matching=diagrams.filter(d=>d.type==='mermaid'&&d.section===delivery.diagram.section)
 need(matching.length===1,'current_delivery_diagram_missing_or_ambiguous',409)
 const worldBaseline=readBaselineAndCurrentHead({projectRoot,read,readFresh,readAtUtc,deliveryId:delivery.id},readCurrentWorldBaseline)
 return {...delivery,nativeTraining:readNativeStage0TrainingProgress(projectRoot),steps:delivery.steps.map(step=>({...step,planItems:step.planItemIds.map(id=>plan.items.find(item=>item.id===id))})),documents:delivery.documents.map(d=>({...d,documentId:registration(d.path).documentId,href:'/local-backup/documents?id='+encodeURIComponent(registration(d.path).documentId)})),diagram:{...delivery.diagram,documentId:document.documentId,diagramId:matching[0].diagramId,sourceDocumentSha256:guideSha256,href:'/local-backup/diagrams?documentId='+encodeURIComponent(document.documentId)+'&q='+encodeURIComponent(delivery.diagram.section)+'&id='+encodeURIComponent(matching[0].diagramId)},planSource:{path:GUIDE,sha256:guideSha256,version:plan.version,readAtUtc},worldBaseline,worldEvolution:readWorldEvolutionProgress({worldBaseline,read,readFresh,readAtUtc,deliveryId:delivery.id})}
}
