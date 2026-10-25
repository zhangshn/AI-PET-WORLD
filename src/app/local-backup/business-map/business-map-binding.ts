import type { ArchitectureDiagram } from '../diagrams/diagram-types'
export const businessMapSection='2.1 全业务线与子系统导航'
export function selectBusinessMap(records:ArchitectureDiagram[],knownCount:number,nextCursor:string|null){
 const matches=records.filter(d=>d.documentId==='docs-architecture'&&d.section===businessMapSection&&d.type==='mermaid')
 return records.length===1&&knownCount===1&&matches.length===1&&!nextCursor?matches[0]:null
}
