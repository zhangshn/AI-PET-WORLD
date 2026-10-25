import 'server-only'
import { createDocumentReader } from './document-reader.mjs'
import { queryDocuments } from './document-query.mjs'
import { createDiagramQuery } from './diagram-extract.mjs'

export const documents = () => {
  const reader=createDocumentReader()
  return {list:(search:URLSearchParams)=>queryDocuments(reader,search),detail:(id:string,revision:string|null)=>reader.body(id,revision)}
}
export const diagrams = () => createDiagramQuery(createDocumentReader())
