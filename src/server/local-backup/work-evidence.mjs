import fs from 'node:fs'
import path from 'node:path'
import { hash, need, identity, ModuleError } from './contracts.mjs'

const signature = s => [s.dev,s.ino,s.size,s.mtimeMs,s.ctimeMs,s.nlink].join(':')
const outside = p => p==='..'||p.startsWith('..'+path.sep)||path.isAbsolute(p)
const index = value => { need(typeof value==='string'&&/^(0|[1-9][0-9]?)$/.test(value),'work_evidence_index_invalid'); return Number(value) }
// The root is resolved by the existing local-backup context, including its hot-tier mapping check.
export function createWorkEvidenceReader({runtimeRoot,ledger}) {
  const root=fs.realpathSync(runtimeRoot)
  function read(binding,maxBytes,extension) {
    const logical=binding?.logicalPath??binding?.path
    need(typeof logical==='string'&&logical.length<=512&&logical.startsWith('.runtime/ai-painter/controller-repair-reviews/')&&!/[\\:\0]/.test(logical)&&logical.split('/').every(p=>p&&p!=='.'&&p!=='..')&&logical.endsWith(extension),'work_evidence_scope_invalid',409)
    need(/^[a-f0-9]{64}$/.test(binding.sha256),'work_evidence_hash_invalid',409)
    need(!/(?:^|\/)(?:\.env[^/]*|[^/]*(?:credential|cookie|csrf|secret)[^/]*)$/i.test(logical),'work_evidence_scope_invalid',409)
    const locate=()=>{
      let current=root;const chain=[]
      const parts=logical.slice(9).split('/')
      for(let i=0;i<parts.length;i++) {
        current=path.join(current,parts[i]);const s=fs.lstatSync(current)
        need(!s.isSymbolicLink()&&(i===parts.length-1?s.isFile()&&s.nlink===1:s.isDirectory())&&!outside(path.relative(root,fs.realpathSync(current))),'work_evidence_boundary',409)
        chain.push(signature(s))
      }
      return {file:current,stat:fs.lstatSync(current),chain}
    }
    try {
      const before=locate();need(before.stat.size<=maxBytes,'work_evidence_size_limit',413)
      const fd=fs.openSync(before.file,'r')
      try {
        need(signature(fs.fstatSync(fd))===signature(before.stat),'work_evidence_changed',409)
        const bytes=Buffer.alloc(before.stat.size);let used=0
        while(used<bytes.length){const n=fs.readSync(fd,bytes,used,bytes.length-used,used);if(!n)break;used+=n}
        const after=locate()
        need(used===bytes.length&&signature(fs.fstatSync(fd))===signature(before.stat)&&JSON.stringify(before.chain)===JSON.stringify(after.chain),'work_evidence_changed',409)
        need(hash(bytes)===binding.sha256,'work_evidence_sha_conflict',409)
        return {bytes,logicalPath:logical,sha256:binding.sha256}
      }finally{fs.closeSync(fd)}
    }catch(e){if(e instanceof ModuleError)throw e;throw new ModuleError(e.code==='ENOENT'?'work_evidence_file_missing':'work_evidence_read_unavailable',503)}
  }
  function json(binding){const r=read(binding,1024*1024,'.json');try{return {...r,value:JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(r.bytes))}}catch{throw new ModuleError('work_evidence_json_invalid',409)}}
  function bound(eventId,evidenceIndex){identity(eventId);const event=ledger.find(eventId);need(event,'work_event_not_found',404);const ref=event.evidenceReferences?.[index(evidenceIndex)];need(ref,'work_evidence_not_found',404);return {event,document:json(ref)}}
  function child(parent,binding,extension){const logical=binding?.path;need(typeof logical==='string'&&path.posix.dirname(logical)===path.posix.dirname(parent.logicalPath)&&logical.endsWith(extension),'work_evidence_child_scope',409);return binding}
  function figures(document){const list=document.value?.figures??[];need(Array.isArray(list)&&list.length<=16,'work_evidence_figure_limit',409);return list.map(b=>child(document,b,'.png'))}
  function detail(eventId,evidenceIndex) {
    const {event,document}=bound(eventId,evidenceIndex),v=document.value
    const images=figures(document).map((b,i)=>({name:path.posix.basename(b.path),sha256:b.sha256,url:`/api/local-backup/work-events/${encodeURIComponent(eventId)}/evidence/${evidenceIndex}/images/${i}`}))
    const findings=Array.isArray(v?.findings)?v.findings.filter(f=>typeof f?.text==='string'&&f.text.length<=4000).slice(0,64).map(f=>f.text):[]
    const conclusions=[v?.interpretation,...(Array.isArray(v?.limitations)?v.limitations:[])].filter(x=>typeof x==='string'&&x.length<=4000).slice(0,20)
    let measurements=[]
    if(v?.result?.path&&Array.isArray(v?.figures)&&Array.isArray(v?.findings)) {
      const result=json(child(document,v.result,'.json')).value
      if(Array.isArray(result?.objects)&&result.objects.length<=64)measurements=result.objects.filter(o=>o?.metricsFromSavedQuantizedPngs&&(o.metricsFromSavedQuantizedPngs.parent_single||o.metricsFromSavedQuantizedPngs.current_two)).map(o=>{
        const a=o?.metricsFromSavedQuantizedPngs?.parent_single,b=o?.metricsFromSavedQuantizedPngs?.current_two
        const finite=n=>typeof n==='number'&&Number.isFinite(n)?n:null
        return {sample:typeof o?.slot==='number'?o.slot:null,object:typeof o?.object?.kind==='string'?o.object.kind.slice(0,40):'unknown',value:finite(o?.object?.value),core:finite(o?.counts?.core),rawSupport:finite(o?.counts?.rawSupport),ownedSupport:finite(o?.counts?.ownedSupport),coreBefore:finite(a?.core?.mae),coreAfter:finite(b?.core?.mae),cropBefore:finite(a?.wholeLocalCrop?.mae),cropAfter:finite(b?.wholeLocalCrop?.mae),correlation:finite(b?.core?.correlation)}
      })
    }
    return {dataStatus:'connected',title:event.title??'工作证据',eventId,sourceCategory:event.sourceCategory,logicalPath:document.logicalPath,sha256:document.sha256,findings,conclusions,images,measurements,content:document.bytes.toString('utf8')}
  }
  function image(eventId,evidenceIndex,imageIndex) {
    const {document}=bound(eventId,evidenceIndex),binding=figures(document)[index(imageIndex)];need(binding,'work_evidence_image_not_found',404)
    const r=read(binding,8*1024*1024,'.png'),b=r.bytes
    need(b.length>=33&&b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))&&b.readUInt32BE(8)===13&&b.toString('ascii',12,16)==='IHDR','work_evidence_image_invalid',409)
    const width=b.readUInt32BE(16),height=b.readUInt32BE(20)
    need(width>0&&height>0&&width<=8192&&height<=8192&&width*height<=16*1024*1024,'work_evidence_image_dimensions',413)
    return r
  }
  return {detail,image}
}
