import { BASELINE_IDENTITY, BASELINE_CODE_FILES, BASELINE_SOURCE_PRODUCERS, baselineQualification,
  baselineNeed as need, baselineSha256 as sha, baselineCanonical as canonical, baselineJson,
  baselineLogicalPath, verifyNaturalWorldBaselineProof } from './natural-world-baseline-proof.mjs'

export const COMPAT_SCHEMA = 'natural-world-baseline-compatibility-selection-v1'
export const COMPAT_ROOT = '.runtime/ai-painter/controller-repair-reviews/world-runtime-transaction-157-20261030/'
export const COMPAT_CODES = Object.freeze([...new Set([...BASELINE_CODE_FILES,
  'src/world/runtime/world-evolution-transaction.ts', 'scripts/lib/natural-world-baseline-compatibility.mjs',
  'scripts/run-natural-world-baseline-compatibility.mjs', 'src/server/local-backup/natural-world-baseline-reader.mjs'])])
const same = (a,b) => canonical(a) === canonical(b)
const exact = (v, names) => need(v && typeof v === 'object' && !Array.isArray(v) &&
  same(Object.keys(v).sort(), [...names].sort()), 'compat_fields')
export function compatibilityBound(read, ref, max = 4*1024*1024) {
  exact(ref,['path','sha256','bytes']); baselineLogicalPath(ref.path)
  need(/^[a-f0-9]{64}$/.test(ref.sha256) && Number.isSafeInteger(ref.bytes) && ref.bytes>0 && ref.bytes<=max,'compat_ref')
  const b=read(ref.path,max); need(Buffer.isBuffer(b)&&b.length===ref.bytes&&sha(b)===ref.sha256,'compat_digest')
  return b
}
/** Archive substitutions are restricted to the complete original proof's code set. Data stays live. */
export function verifyHistoricalBaselineArchive({previousSelectionRef,archiveManifestRef,read}) {
  need(previousSelectionRef.path===COMPAT_ROOT+'previous-selection.json' &&
    archiveManifestRef.path===COMPAT_ROOT+'prior-source-manifest.json','compat_archive_location')
  const previousSelection=baselineJson(compatibilityBound(read,previousSelectionRef))
  const manifest=baselineJson(compatibilityBound(read,archiveManifestRef))
  need(same(manifest.priorSelection,previousSelection),'compat_previous_selection')
  const old=baselineJson(compatibilityBound(read,previousSelection.proofRef))
  const expected=[...new Set([...BASELINE_CODE_FILES,...BASELINE_SOURCE_PRODUCERS])].sort()
  need(Array.isArray(old.codeBindings)&&same(old.codeBindings.map(x=>x.path).sort(),expected),'compat_historical_code_set')
  need(Array.isArray(manifest.sources)&&manifest.sources.length===expected.length,'compat_archive_set')
  const mappings=new Map()
  for(const source of manifest.sources){
    exact(source,['originalPath','sha256','bytes','snapshotPath'])
    const original=old.codeBindings.find(x=>x.path===source.originalPath)
    need(original&&!mappings.has(source.originalPath)&&source.sha256===original.sha256&&source.bytes===original.bytes&&
      source.snapshotPath===COMPAT_ROOT+'prior-source-by-sha/'+source.sha256+'.txt','compat_archive_binding')
    const bytes=compatibilityBound(read,{path:source.snapshotPath,sha256:source.sha256,bytes:source.bytes})
    mappings.set(source.originalPath,bytes)
  }
  const historical=verifyNaturalWorldBaselineProof({selection:previousSelection,
    read:(logical,max)=>mappings.has(logical)?mappings.get(logical):read(logical,max)})
  return {historical,previousSelection}
}
/** This is historical evidence validation plus a current reader proof, never generation replay. */
export function verifyNaturalWorldBaselineCompatibility({selection,read}) {
  exact(selection,['schemaVersion','deliveryId','identity','proofRef','selectedAtUtc'])
  need(selection.schemaVersion===COMPAT_SCHEMA&&selection.deliveryId==='WORLD-BASELINE-001'&&same(selection.identity,BASELINE_IDENTITY),'compat_selection')
  need(new RegExp('^'+COMPAT_ROOT.replaceAll('.','\\.')+'compat-[a-f0-9]{32}/result\\.json$').test(selection.proofRef.path),'compat_proof_location')
  const p=baselineJson(compatibilityBound(read,selection.proofRef))
  exact(p,['schemaVersion','previousSelectionRef','archiveManifestRef','readerRef','processRef','currentCodeBindings','qualification','startedAtUtc','finishedAtUtc'])
  need(p.schemaVersion==='natural-world-baseline-compatibility-proof-v1'&&same(p.qualification,baselineQualification()),'compat_schema')
  const {historical}=verifyHistoricalBaselineArchive({...p,read})
  need(Array.isArray(p.currentCodeBindings)&&same(p.currentCodeBindings.map(r=>r.path).sort(),[...COMPAT_CODES].sort()),'compat_current_code_set')
  for(const ref of p.currentCodeBindings) compatibilityBound(read,ref)
  const runRoot=selection.proofRef.path.slice(0,-'result.json'.length)
  need(p.readerRef.path===runRoot+'reader.json'&&p.processRef.path===runRoot+'process.json','compat_reader_location')
  const r=baselineJson(compatibilityBound(read,p.readerRef)),o=baselineJson(compatibilityBound(read,p.processRef))
  exact(r,['schemaVersion','pid','identity','storeRef','digests','currentCodeBindings','startedAtUtc','finishedAtUtc'])
  exact(o,['schemaVersion','pid','parentPid','exitCode','signal','startedAtUtc','finishedAtUtc','elapsedMs','stdout','stderr','failure','readerRef'])
  need(r.schemaVersion==='natural-world-baseline-current-reader-v1'&&o.schemaVersion==='natural-world-baseline-current-reader-process-v1'&&
    Number.isSafeInteger(r.pid)&&r.pid>0&&r.pid===o.pid&&Number.isSafeInteger(o.parentPid)&&o.parentPid>0&&o.parentPid!==o.pid&&
    o.exitCode===0&&o.signal===null&&o.failure===null&&typeof o.stdout==='string'&&typeof o.stderr==='string'&&
    Number.isFinite(o.elapsedMs)&&o.elapsedMs>=0&&o.elapsedMs<=30000&&Buffer.byteLength(o.stdout+o.stderr)<=65536&&
    same(o.readerRef,p.readerRef)&&same(r.identity,BASELINE_IDENTITY)&&same(r.currentCodeBindings,p.currentCodeBindings),'compat_process')
  need(same(baselineJson(Buffer.from(o.stdout),65536),r),'compat_process_stdout')
  const stamps=[p.startedAtUtc,o.startedAtUtc,r.startedAtUtc,r.finishedAtUtc,o.finishedAtUtc,p.finishedAtUtc,selection.selectedAtUtc].map(Date.parse)
  need(stamps.every((x,i)=>Number.isFinite(x)&&(i===0||x>=stamps[i-1])),'compat_time')
  const ref={path:historical.store.path,sha256:historical.store.sha256,bytes:historical.store.bytes}
  need(same(r.storeRef,ref),'compat_same_world'); const record=baselineJson(compatibilityBound(read,ref))
  const digests=Object.fromEntries(['worldFactsPayloadSha256','statePayloadSha256','recordContentSha256','tick','stateVersion','eventCursor'].map(k=>[k,record[k]]))
  need(same(r.digests,digests),'compat_readback')
  return {...historical,proofRef:selection.proofRef,compatibility:{historicalProofRef:historical.proofRef,
    currentReaderRef:p.readerRef,processRef:p.processRef,readerAtUtc:r.finishedAtUtc,sourceReplay:false},
    verificationScope:'historical_generation_evidence_and_current_store_read_compatibility_only',qualification:baselineQualification()}
}
