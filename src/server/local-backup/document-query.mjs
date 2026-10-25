import { hash, need, pageQuery } from './contracts.mjs'

export function metadataSearch(search,allowed) {
  need(search.toString().length<=4096,'document_query_limit')
  need([...search.keys()].every(k=>['limit','cursor',...allowed].includes(k)),'invalid_query')
  need([...new Set(search.keys())].every(k=>search.getAll(k).length===1),'duplicate_query')
  for(const key of allowed){const value=search.get(key);if(value!==null)need(value.length<=160&&!/[\x00-\x1f]/.test(value),'document_query_invalid')}
}
export function documentPage(records,search,allowed,context) {
  metadataSearch(search,allowed)
  const revision=hash(records),scope=allowed.map(k=>[k,search.get(k)])
  const page=pageQuery(search,allowed,revision,context+JSON.stringify(scope))
  return {dataStatus:'connected',reasonCode:'registered_document_scope',records:records.slice(page.offset,page.offset+page.limit),knownRecordCount:records.length,revision,nextCursor:page.offset+page.limit<records.length?page.next(page.offset+page.limit):null,previousCursor:page.offset>0?page.next(Math.max(0,page.offset-page.limit)):null,coverage:{complete:true,scope:'fixed_registration_only',unregisteredFiles:'not_discovered',dictionaryBody:'restricted',runtimeAndData:'not_read'}}
}
export function queryDocuments(reader,search) {
  metadataSearch(search,['category','status','q'])
  const category=search.get('category'),status=search.get('status'),q=search.get('q')?.toLowerCase()??''
  need(reader.registration.length<=64,'document_registration_limit',409)
  const all=reader.registration.map(entry=>{try{return reader.metadata(entry)}catch(e){return{documentId:entry.documentId,relativePath:entry.relativePath,category:entry.category,historical:entry.historical,restricted:entry.restricted,title:entry.relativePath,version:null,authorityStatus:null,programAdoptionStatus:null,bytes:null,sha256:null,metadataRevision:null,availability:'unavailable',reasonCode:e.message}}})
  const filtered=all.filter(d=>(!category||d.category===category)&&(!status||status===(d.historical?'historical':d.restricted?'restricted':'current'))&&(!q||[d.title,d.relativePath,d.version].join(' ').toLowerCase().includes(q)))
  return {...documentPage(filtered,search,['category','status','q'],'documents:'),registeredCount:all.length,categories:[...new Set(all.map(d=>d.category))],links:all.map(({documentId,relativePath})=>({documentId,relativePath}))}
}
