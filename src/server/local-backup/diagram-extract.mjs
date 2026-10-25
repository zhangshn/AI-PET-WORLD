import { need } from './contracts.mjs'
import { documentPage, metadataSearch } from './document-query.mjs'
import { diagramSourceProfiles, architectureLevels, architectureModules, textDefinitionReferences, panoramaBinding, classifyDiagram } from './diagram-catalog.mjs'

export const diagramSources=Object.freeze(diagramSourceProfiles.map(p=>p.path))
export function textDiagramKind(source,section){
  const lines=source.split('\n').filter(s=>s.trim()),first=lines[0]?.trim()??''
  if(/^(?:node |npm |pnpm |python |curl |powershell |SELECT |CREATE |(?:type|interface|export|import|const|function)\b|[\[{])/.test(first))return null
  if(/[├└]─/.test(source)||/^\s{2,}(?:\d{1,2}[ .、]|[一二三四五六七八九十]+、)/m.test(source))return'tree'
  const indents=new Set(lines.map(line=>line.match(/^\s*/)[0].length))
  if(/架构|结构|分层|总目录|蓝图/.test(section)&&!/字段|schema|命令|代码示例/i.test(section)&&lines.length>=4&&indents.size>=3&&indents.has(0)&&!/[{};=:]/.test(source))return'tree'
  return /->|→/.test(source)?'flow':null
}
export function safeDiagramSource(source) {
  need(Buffer.byteLength(source)<=65536,'diagram_size_limit',413)
  need(/^flowchart (?:TD|TB|LR|RL|BT)\s*$/m.test(source)&&!/[<&\\]|%%|---\s*$|(?:^|\n)\s*(?:click|link|style|classDef|class |direction |accDescr|config|init)\b|(?:https?:|javascript:|data:|file:|url\s*\()/i.test(source),'diagram_unsafe_source',409)
  return source
}
export function extractDiagrams(doc) {
  const result=[],lines=doc.content.split(/\r?\n/);let heading='',open=null
  for(let i=0;i<lines.length;i++) {
    if(!open&&/^#{1,6} /.test(lines[i]))heading=lines[i].replace(/^#+ /,'')
    const fence=lines[i].match(/^```([^`]*)$/)
    if(fence){if(!open)open={language:fence[1].trim(),line:i+1,heading,lines:[]};else{
      const source=open.lines.join('\n'),kind=['text','txt'].includes(open.language)?textDiagramKind(source,open.heading):null
      const type=open.language==='mermaid'?'mermaid':kind?'text':null
      if(type){need(result.length<64,'diagram_count_limit',413);need(Buffer.byteLength(source)<=65536,'diagram_size_limit',413);result.push({diagramId:`diagram-${diagramSources.indexOf(doc.relativePath)}-${doc.sha256}-${open.line}`,documentId:doc.documentId,title:open.heading||doc.title,documentTitle:doc.title,documentVersion:doc.version??null,type,sourceFormat:open.language==='mermaid'?'mermaid':kind==='tree'?'text-tree':'text-flow',sourceLanguage:open.language,...classifyDiagram(doc.relativePath,open.heading),section:open.heading,startLine:open.line+1,endLine:i,sourceDocumentSha256:doc.sha256,relativePath:doc.relativePath,authorityStatus:doc.authorityStatus,programAdoptionStatus:doc.programAdoptionStatus,historical:doc.historical,designStatus:'document_defined',implementationEvidenceStatus:'not_verified_by_this_view',source})}open=null
    }}else if(open)open.lines.push(lines[i])
  }
  return result
}
export function createDiagramQuery(reader) {
  function all(){return diagramSources.flatMap(p=>{const e=reader.registration.find(d=>d.relativePath===p);need(e&&!e.restricted&&!e.historical,'diagram_source_not_registered',409);return extractDiagrams(reader.body(e.documentId))})}
  function coverage(docs){
    const metadata=p=>{const entry=reader.registration.find(d=>d.relativePath===p);need(entry,'diagram_source_not_registered',409);return reader.metadata(entry)}
    return {complete:true,scope:'fixed_current_architecture_sources',definitionGapScope:'explicit_reviewed_references_only',registeredSourceCount:diagramSources.length,existingSources:diagramSources.map(p=>{const sample=docs.find(d=>d.relativePath===p);return{relativePath:p,documentId:sample?.documentId??metadata(p).documentId,version:sample?.documentVersion??null,count:docs.filter(d=>d.relativePath===p).length}}),textDefinitionsWithoutDiagram:textDefinitionReferences.map(item=>({...item,document:metadata(item.path)})),missingDesignDefinitions:[{module:'personality',topic:'五维性格退役替代与迁移算法',reason:'总体架构2.1只明确未来退役方向；本次未定义或实施替代迁移，不补造图。',documentId:panoramaBinding.documentId,section:panoramaBinding.section}],implementationQualification:'not_derived_from_diagrams',excluded:['retired_page_documents','full_dictionary_body','source_code_examples','field_schemas','shell_commands']}
  }
  return {
    list(search){
      const allowed=['documentId','type','q','level','module'];metadataSearch(search,allowed)
      const level=search.get('level'),moduleId=search.get('module'),type=search.get('type'),id=search.get('documentId'),q=search.get('q')?.toLowerCase()??''
      need(!level||architectureLevels.some(p=>p.id===level),'diagram_level_invalid');need(!moduleId||architectureModules.some(p=>p.id===moduleId),'diagram_module_invalid');need(!type||['mermaid','text'].includes(type),'diagram_type_invalid')
      const docs=all(),filtered=docs.filter(d=>(!id||d.documentId===id)&&(!type||d.type===type)&&(!level||d.level===level)&&(!moduleId||d.module===moduleId)&&(!q||[d.title,d.documentTitle,d.relativePath].join(' ').toLowerCase().includes(q))).map(({source,...meta})=>{void source;return meta})
      return{...documentPage(filtered,search,allowed,'diagrams:'),sources:diagramSources,sourceCount:diagramSources.length,levels:architectureLevels.map(g=>({...g,count:docs.filter(d=>d.level===g.id).length})),modules:architectureModules.map(g=>({...g,count:docs.filter(d=>d.module===g.id).length})),coverage:coverage(docs)}
    },
    detail(id){const parts=id.match(/^diagram-([0-9]{1,2})-([a-f0-9]{64})-([1-9][0-9]{0,4})$/);need(parts,'diagram_id_invalid');need(diagramSources[Number(parts[1])],'diagram_not_found',404);const entry=reader.registration.find(e=>e.relativePath===diagramSources[Number(parts[1])]);need(entry,'diagram_source_not_registered',409);const doc=reader.body(entry.documentId);need(doc.sha256===parts[2],'diagram_source_revision_conflict',409);const d=extractDiagrams(doc).find(d=>d.diagramId===id);need(d,'diagram_not_found',404);if(d.type==='mermaid')safeDiagramSource(d.source);return d},
  }
}
