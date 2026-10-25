import fs from 'node:fs'
import path from 'node:path'
import { hash, need, ModuleError } from './contracts.mjs'
import { documentRegistration } from './document-catalog.mjs'

const signature=s=>[s.dev,s.ino,s.size,s.mtimeMs,s.ctimeMs,s.nlink].join(':')
const outside=p=>p==='..'||p.startsWith('..'+path.sep)||path.isAbsolute(p)
export function createDocumentReader(root=process.cwd(),registration=documentRegistration) {
  const base=path.resolve(root)
  function locate(entry) {
    need(entry&&(entry.relativePath==='README.md'||entry.relativePath==='AGENTS.md'||/^docs\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_.-]+\.md$/.test(entry.relativePath)),'document_registration_invalid',409)
    need(!fs.lstatSync(base).isSymbolicLink()&&path.resolve(fs.realpathSync.native(base))===base,'document_root_conflict',409)
    let current=base
    const components=entry.relativePath.split('/'),chain=[]
    for(let i=0;i<components.length;i++) {
      current=path.join(current,components[i]);const s=fs.lstatSync(current)
      need(!s.isSymbolicLink()&&(i===components.length-1?s.isFile()&&s.nlink===1:s.isDirectory()),'document_link_or_type_rejected',409)
      need(!outside(path.relative(base,fs.realpathSync.native(current))),'document_path_boundary',409)
      chain.push({path:current,signature:signature(s)})
    }
    return {file:current,chain,stat:fs.lstatSync(current)}
  }
  function bounded(entry,full=false) {
    try {
      const found=locate(entry),cap=full?512*1024:8192
      if(full)need(!entry.restricted,'document_body_restricted',403)
      if(full)need(found.stat.size<=cap,'document_size_limit',413)
      const fd=fs.openSync(found.file,'r')
      try {
        need(signature(fs.fstatSync(fd))===signature(found.stat),'document_revision_conflict',409)
        const bytes=Buffer.alloc(Math.min(found.stat.size,cap));let used=0
        // Restricted entries are metadata only: no read call and no content hash.
        if(!entry.restricted)while(used<bytes.length){const n=fs.readSync(fd,bytes,used,bytes.length-used,used);if(!n)break;used+=n}
        need(signature(fs.fstatSync(fd))===signature(found.stat),'document_revision_conflict',409)
        const again=locate(entry)
        need(again.chain.length===found.chain.length&&again.chain.every((v,i)=>v.signature===found.chain[i].signature),'document_revision_conflict',409)
        const content=bytes.subarray(0,used),header=content.subarray(0,8192).toString('utf8')
        const value=key=>header.match(new RegExp('^'+key+'[：:]\\s*`?([^`\\r\\n]+)','m'))?.[1]?.trim()??null
        const meta={documentId:entry.documentId,relativePath:entry.relativePath,category:entry.category,historical:entry.historical,restricted:entry.restricted,title:entry.restricted?'世界视觉数据字典完整打印版（仅索引）':header.match(/^#\s+(.+)$/m)?.[1]?.trim()??path.basename(entry.relativePath),version:value('文档版本'),authorityStatus:value('文档状态')??value('状态'),programAdoptionStatus:value('程序符合状态'),bytes:found.stat.size,sha256:null,availability:entry.restricted?'restricted':'readable',metadataRevision:hash([signature(found.stat),entry.restricted?null:hash(content.subarray(0,8192))])}
        if(!full)return meta
        need(used===found.stat.size,'document_read_incomplete',409)
        let text
        try{text=new TextDecoder('utf-8',{fatal:true}).decode(content)}catch{throw new ModuleError('document_encoding_invalid',409)}
        return {...meta,sha256:hash(content),content:text}
      }finally{fs.closeSync(fd)}
    }catch(e){if(e instanceof ModuleError)throw e;throw new ModuleError(e.code==='ENOENT'?'document_file_missing':'document_read_unavailable',503)}
  }
  const byId=id=>{need(typeof id==='string'&&/^[a-z0-9-]{1,128}$/.test(id),'document_id_invalid');const entry=registration.find(x=>x.documentId===id);need(entry,'document_not_found',404);return entry}
  return {registration,metadata:entry=>bounded(entry),body:(id,revision)=>{const entry=byId(id);need(!entry.restricted,'document_body_restricted',403);const doc=bounded(entry,true);if(revision!==null&&revision!==undefined)need(revision===doc.metadataRevision,'document_revision_conflict',409);return doc},byId}
}
