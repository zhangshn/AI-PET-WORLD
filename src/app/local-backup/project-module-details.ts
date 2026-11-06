import {documentHeadings,headingSlug} from './documents/document-links'
export const architectureDocumentId='docs-architecture'
export const architecturePath='docs/ARCHITECTURE.md'
export const moduleDetailHref=(id:string)=>/^[1-9]$/.test(id)?'/local-backup/documents?'+new URLSearchParams({id:architectureDocumentId,anchor:'module-'+id}):null
export function architectureModules(content:string){
 const headings=documentHeadings(content)
 return Array.from({length:9},(_,index)=>{const id=String(index+1),matches=headings.filter(h=>h.depth===3&&new RegExp('^10\\.'+id+'\\s').test(h.title));if(matches.length!==1)throw Error('module_section_missing_or_ambiguous');return {moduleId:id,...matches[0],href:moduleDetailHref(id)!}})
}
export function documentSelection(document:{documentId:string;relativePath:string;content:string},anchor?:string){
 const headings=documentHeadings(document.content),lines=document.content.split(/\r?\n/)
 if(anchor?.startsWith('module-')){
  if(document.documentId!==architectureDocumentId||document.relativePath!==architecturePath||!/^module-[1-9]$/.test(anchor))throw Error('module_section_unknown')
  const target=architectureModules(document.content).find(h=>'module-'+h.moduleId===anchor)!
  // The module identity and source heading identity are distinct.
  const original=headings.find(h=>h.slug===target.slug)!,offset=Number(original.id.slice(8))-1
  const end=headings.find(h=>Number(h.id.slice(8))>offset+1&&h.depth<=original.depth)
  const endLine=end?Number(end.id.slice(8))-1:lines.length
  return {headings:headings.filter(h=>Number(h.id.slice(8))>offset&&Number(h.id.slice(8))<=endLine),content:lines.slice(offset,endLine).join('\n'),offset,target:original,focused:true,endLine}
 }
 const matches=anchor?headings.filter(h=>h.slug===anchor||h.id===anchor):[]
 if(anchor&&matches.length!==1)throw Error('document_section_unknown_or_ambiguous')
 return {headings,content:document.content,offset:0,target:matches[0],focused:false,endLine:lines.length}
}
export function architectureDiagramHref(document:{documentId:string;relativePath:string;sha256?:string|null;content:string},fenceLine:number){
 if(document.documentId!==architectureDocumentId||document.relativePath!==architecturePath||!document.sha256||!/^[a-f0-9]{64}$/.test(document.sha256)||document.content.split(/\r?\n/)[fenceLine-1]!=='```mermaid')return null
 return '/local-backup/diagrams?'+new URLSearchParams({documentId:document.documentId,id:`diagram-1-${document.sha256}-${fenceLine}`})
}
export const fullDocumentHref=(documentId:string,title?:string)=>'/local-backup/documents?'+new URLSearchParams({id:documentId,...(title?{anchor:headingSlug(title)}:{})})
