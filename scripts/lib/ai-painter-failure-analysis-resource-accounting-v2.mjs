import fs from "node:fs"
import path from "node:path"
import crypto from "node:crypto"

// Read-only accounting, spec 9.6.36. V1 preserved. This component cannot grant production
// eligibility, prove live process cleanup, release a guard, or invent a quota.
export const RESOURCE_ACCOUNTING_V2_TEST_ENTRY = "scripts/tests/ai-painter-failure-analysis-resource-accounting-v2.test.mjs"
export const DIAGNOSTIC_LIMITS = Object.freeze({ outputBytes:8388608, jsonBytes:2097152, failureReserveBytes:65536 })
export const FROZEN_HELPERS = Object.freeze({
  runner:"0e15284e320123e361b49d8b28731559b31f45e3057ac8a6deac99d951672af6",
  native:"da0db8c80b008ade0e3d7b993d955354d23a4d73596a7290dfc54ff2d35f09d2",
  owner:"542b690b20459c445da801f17f3dc974904f35a0c81048c49bb97c04e2d2d353",
})
const hash=raw=>crypto.createHash("sha256").update(raw).digest("hex")
const ordered=v=>Array.isArray(v)?v.map(ordered):v&&typeof v==="object"
  ?Object.fromEntries(Object.keys(v).sort().map(k=>[k,ordered(v[k])])):v
const encode=v=>Buffer.from(JSON.stringify(ordered(v),null,2)+"\n")
const demand=(condition,reason)=>{if(!condition)throw new Error(reason)}
const stamp=s=>[s.dev,s.ino,s.size,s.mtimeNs,s.ctimeNs].map(String).join(":")
const identity=s=>({device:String(s.dev),fileId:String(s.ino)})
function safeParts(p) {
  demand(typeof p==="string"&&!p.split(/[\\/]/u).some(s=>/^latest(?:\.json)?$/u.test(s)),"latest_selection_forbidden")
}
function relative(p) {
  safeParts(p)
  demand(p&&!path.isAbsolute(p)&&!p.includes("\\")&&!/^[A-Za-z]:/u.test(p)
    &&p.split("/").every(s=>s&&s!=="."&&s!==".."),"unsafe_relative_path")
  return p
}
function scope(root) {
  safeParts(root)
  root=path.resolve(root)
  const stat=fs.statSync(root,{bigint:true})
  demand(stat.isDirectory()&&stat.dev>0n&&stat.ino>0n,"directory_identity_unavailable")
  return {root,physical:fs.realpathSync(root),identity:identity(stat)}
}
function scopedFile(s,p) {
  relative(p)
  const file=path.join(s.root,...p.split("/"))
  let current=s.root
  for(const part of p.split("/")) {
    current=path.join(current,part)
    if(fs.existsSync(current))demand(!fs.lstatSync(current).isSymbolicLink(),"unregistered_redirect")
  }
  if(fs.existsSync(file))demand(fs.realpathSync(file).toLowerCase()===path.join(s.physical,...p.split("/")).toLowerCase(),"unregistered_redirect")
  return file
}
function inventory(s) {
  const rows=[]
  let bytes=0,metadataBytes=0
  function visit(prefix) {
    for(const d of fs.readdirSync(path.join(s.root,prefix),{withFileTypes:true})) {
      const p=(prefix?prefix+"/":"")+d.name
      metadataBytes+=Buffer.byteLength(p)+4
      demand(metadataBytes<=DIAGNOSTIC_LIMITS.jsonBytes,"inventory_metadata_read_limit")
      scopedFile(s,p)
      if(d.isDirectory())visit(p)
      else {demand(d.isFile(),"non_regular_evidence")
        bytes+=fs.statSync(path.join(s.root,p)).size
        demand(bytes<=DIAGNOSTIC_LIMITS.outputBytes,"diagnostic_output_limit")
        rows.push(p)}
    }
  }
  visit("")
  return rows.sort()
}
function boundFile(file,expected,{json=false}={}) {
  safeParts(file)
  demand(typeof expected==="string"&&/^[a-f0-9]{64}$/u.test(expected),"invalid_sha_binding")
  const before=fs.statSync(file,{bigint:true})
  demand(before.isFile(),"non_regular_evidence")
  // Bound memory/read transport; this is not an RSS guarantee or a new quota.
  if(json)demand(before.size<=BigInt(DIAGNOSTIC_LIMITS.jsonBytes),"single_json_limit")
  demand(!fs.lstatSync(file).isSymbolicLink(),"unregistered_redirect")
  const fd=fs.openSync(file,"r")
  try {
    demand(stamp(fs.fstatSync(fd,{bigint:true}))===stamp(before),"changed_during_read")
    // Hash arbitrary binary helper artifacts in bounded chunks; their size is
    // reported, never constrained by the diagnostic output quota.
    const hasher=crypto.createHash("sha256"),chunk=Buffer.alloc(65536)
    let count=0,got
    const chunks=[]
    while((got=fs.readSync(fd,chunk,0,chunk.length,null))>0) {
      hasher.update(chunk.subarray(0,got));count+=got
      if(json)chunks.push(Buffer.from(chunk.subarray(0,got)))
    }
    const raw=json?Buffer.concat(chunks):null,actual=hasher.digest("hex")
    demand(actual===expected,"sha_mismatch")
    demand(stamp(fs.fstatSync(fd,{bigint:true}))===stamp(before),"changed_during_read")
    demand(stamp(fs.statSync(file,{bigint:true}))===stamp(before),"changed_during_read")
    // Semantic parsing is deliberately performed separately after byte binding.
    return {path:path.resolve(file),sha256:actual,bytes:count,identity:identity(before),stamp:stamp(before),raw}
  } finally {fs.closeSync(fd)}
}
const publicRow=({raw,...row})=>row
// Both name.json.pending-ID and name.json.ID.pending are JSON witnesses.
const isJson=p=>/\.json(?:\.pending(?:-.*)?|\.[a-f0-9-]+\.pending)?$/u.test(p)

/** Explicit diagnostic root+complete relative bindings; explicit invocation
 * started-guard and helper evidence only. Shared files must belong to this
 * guard's exact identity-native directory. No global guard/history discovery.
 * Planned report/pending are measured from their actual canonical serialization.
 * Omitted pendingValue explicitly means the same serialized value; a different
 * actual pending payload must be supplied separately. Nothing is saved here.
 * All shared closure remains incomplete until a separately adopted contract and
 * live execution guarantees exist; booleans and on-disk receipts cannot supply it.
 */
export function accountFailureAnalysisResources({diagnosticRoot,diagnosticBindings,
  invocation,sharedEvidence=[],helperBindings=[],planned=[]}={}) {
  const ledger={schemaVersion:"ai-painter-failure-analysis-resource-accounting-v2",
    diagnostic:{status:"incomplete",limits:DIAGNOSTIC_LIMITS,files:[],planned:[],actualBytes:0,plannedBytes:0},
    shared:{status:"incomplete",files:[],programs:[],bytesByRole:{},applicableCaps:{stdout:8388608,stderr:8388608,observation:65536,ownerProtocolFrame:65536},
      aggregateCap:null,capAuthority:"frozen runner source, each stream separately"},
    semantic:{status:"incomplete",files:[],errors:[]},resourceInventoryVerified:false,semanticEvidenceVerified:false,
    gaps:[],errors:[],completeSharedResourceClosureVerified:false,productionEligible:false,
    liveCleanupVerified:false,qualificationGranted:false}
  const observed=[],seen=new Set(),semanticValues=new Map()
  let diagnosticSemanticsComplete=false
  function read(file,binding,options) {
    const key=path.resolve(file).toLowerCase()
    demand(!seen.has(key),"duplicate_evidence_path");seen.add(key)
    const row=boundFile(file,binding.sha256,options);observed.push(publicRow(row))
    if(options?.json) {
      let error=null
      try {semanticValues.set(row.path,JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(row.raw)))}
      catch(problem) {error=String(problem.message).slice(0,2048);ledger.semantic.errors.push({path:row.path,sha256:row.sha256,reason:error})}
      ledger.semantic.files.push({path:row.path,sha256:row.sha256,bytes:row.bytes,verified:error===null,error})
    }
    return row
  }
  try {
    const d=scope(diagnosticRoot)
    ledger.diagnostic.root={path:d.root,physical:d.physical,identity:d.identity}
    demand(Array.isArray(diagnosticBindings),"complete_diagnostic_bindings_required")
    const before=inventory(d)
    const declared=diagnosticBindings.map(b=>relative(b.path)).sort()
    demand(new Set(declared).size===declared.length,"duplicate_diagnostic_binding")
    demand(JSON.stringify(before)===JSON.stringify(declared),"diagnostic_inventory_omitted_or_extra")
    for(const b of diagnosticBindings) {
      const row=read(scopedFile(d,b.path),b,{json:isJson(b.path)})
      ledger.diagnostic.files.push({...publicRow(row),relativePath:b.path})
      ledger.diagnostic.actualBytes+=row.bytes
      demand(ledger.diagnostic.actualBytes<=DIAGNOSTIC_LIMITS.outputBytes,"diagnostic_output_limit")
    }
    demand(ledger.diagnostic.actualBytes<=DIAGNOSTIC_LIMITS.outputBytes,"diagnostic_output_limit")
    diagnosticSemanticsComplete=true
    const destinations=new Set(before)
    for(const p of planned) {
      // Fail on silent JSON coercions (NaN/undefined/function/BigInt/cycles).
      const check=v=>{demand(v!==undefined&&typeof v!=="function"&&typeof v!=="symbol","invalid_planned_json");
        if(typeof v==="number")demand(Number.isFinite(v),"invalid_planned_json");
        if(v&&typeof v==="object")for(const item of Object.values(v))check(item)}
      check(p.value)
      const raw=encode(p.value),pendingRaw=Object.hasOwn(p,"pendingValue")?encode(p.pendingValue):raw
      if(Object.hasOwn(p,"pendingValue"))check(p.pendingValue)
      demand(raw.length<=DIAGNOSTIC_LIMITS.jsonBytes&&pendingRaw.length<=DIAGNOSTIC_LIMITS.jsonBytes,"single_json_limit")
      demand(p.pendingPath!==undefined,"pending_witness_required")
      for(const [destination,bytes] of [[p.path,raw],[p.pendingPath,pendingRaw]]) {
        relative(destination);scopedFile(d,destination)
        demand(!destinations.has(destination),"duplicate_planned_or_existing_path")
        destinations.add(destination)
        ledger.diagnostic.planned.push({relativePath:destination,bytes:bytes.length,sha256:hash(bytes),serialized:true})
        ledger.diagnostic.plannedBytes+=bytes.length
      }
    }
    demand(ledger.diagnostic.actualBytes+ledger.diagnostic.plannedBytes
      <=DIAGNOSTIC_LIMITS.outputBytes-DIAGNOSTIC_LIMITS.failureReserveBytes,"failure_reserve_exhausted")
    demand(JSON.stringify(inventory(d))===JSON.stringify(before),"changed_during_inventory")
    ledger.diagnostic.status="verified"
    if(!invocation)ledger.gaps.push("invocation_binding_missing")
    else {
      demand(typeof invocation.identity==="string"&&/^[a-f0-9-]{16,64}$/u.test(invocation.identity),"invalid_invocation_identity")
      const guardPath=path.resolve(invocation.guard.path)
      demand(path.basename(guardPath)===invocation.identity+"-started.json","cross_invocation_guard")
      const guard=read(guardPath,invocation.guard,{json:true}),record=semanticValues.get(guard.path)
      demand(record?.identity===invocation.identity,"cross_invocation_guard_or_invalid_semantic_record")
      demand(typeof record.commandSha256==="string"&&/^[a-f0-9]{64}$/u.test(record.commandSha256),"command_binding_missing")
      demand(path.resolve(record.startedEvidence)===guardPath,"guard_path_binding_changed")
      ledger.shared.invocation={identity:record.identity,commandSha256:record.commandSha256,guard:publicRow(guard)}
      ledger.shared.files.push({...publicRow(guard),role:"guard"})
      ledger.shared.bytesByRole.guard=guard.bytes
      const native=path.join(path.dirname(guardPath),record.identity+"-native")
      const roles=new Set(),sharedRows=new Map()
      for(const b of sharedEvidence) {
        demand(b.invocationIdentity===record.identity,"cross_invocation_evidence")
        demand(["nativeSource","nativeBinary","build","stdout","stderr","observation","cleanup"].includes(b.role),"unknown_shared_role")
        demand(!roles.has(b.role),"duplicate_shared_role");roles.add(b.role)
        const expectedNames={nativeSource:"owner.cs",nativeBinary:"owner.exe",build:"build.json",
          stdout:"stdout.bin",stderr:"stderr.bin",observation:"cleanup-observation.json",cleanup:record.identity+"-terminal.json"}
        demand(path.basename(b.path)===expectedNames[b.role],"shared_role_path_changed")
        const sharedRoot=b.role==="cleanup"?path.dirname(guardPath):native
        const rel=path.relative(sharedRoot,path.resolve(b.path)).replaceAll("\\","/")
        const ns=scope(sharedRoot),file=scopedFile(ns,rel)
        demand(!path.resolve(file).toLowerCase().startsWith(d.root.toLowerCase()+path.sep),"shared_evidence_in_diagnostic_root")
        const row=read(file,b,{json:isJson(rel)})
        sharedRows.set(b.role,row)
        ledger.shared.files.push({...publicRow(row),role:b.role})
        ledger.shared.bytesByRole[b.role]=row.bytes
      }
      if(sharedRows.has("nativeSource"))demand(sharedRows.get("nativeSource").sha256===record.nativeOwnerSource?.sha256,"native_source_binding_changed")
      if(sharedRows.has("build")) {
        const build=semanticValues.get(sharedRows.get("build").path)
        demand(build?.source?.sha256===record.nativeOwnerSource?.sha256,"build_source_binding_changed")
        demand(path.resolve(build.snapshot)===path.join(native,"owner.cs")
          &&path.resolve(build.binary)===path.join(native,"owner.exe"),"cross_invocation_build")
        if(sharedRows.has("nativeBinary"))demand(build.binarySha256===sharedRows.get("nativeBinary").sha256,"native_binary_binding_changed")
      }
      const programRoles=new Set()
      for(const b of helperBindings) {
        demand(Object.hasOwn(FROZEN_HELPERS,b.role)&&!programRoles.has(b.role),"duplicate_or_unknown_helper_binding")
        programRoles.add(b.role)
        demand(b.sha256===FROZEN_HELPERS[b.role],"unfrozen_helper_binding")
        const row=read(path.resolve(b.path),b)
        ledger.shared.programs.push({...publicRow(row),role:b.role})
        if(b.role==="runner")demand(row.sha256===record.helperSha256,"helper_guard_binding_changed")
        if(b.role==="owner")demand(row.sha256===record.nativeOwnerSource?.sha256
          &&path.resolve(b.path)===path.resolve(record.nativeOwnerSource.path),"owner_guard_binding_changed")
      }
      for(const role of Object.keys(FROZEN_HELPERS))if(!programRoles.has(role))ledger.gaps.push("frozen_helper_binding_missing:"+role)
      for(const role of ["nativeSource","nativeBinary","build","observation","stdout","stderr"])
        if(!roles.has(role))ledger.gaps.push("shared_evidence_missing:"+role)
      if(programRoles.has("runner"))for(const role of ["stdout","stderr"])
        demand((ledger.shared.bytesByRole[role]??0)<=ledger.shared.applicableCaps[role],"shared_stream_limit")
      if(programRoles.has("owner"))demand((ledger.shared.bytesByRole.observation??0)<=ledger.shared.applicableCaps.observation,"shared_observation_limit")
      ledger.shared.capBindingsVerified={streamCaps:programRoles.has("runner"),observationCap:programRoles.has("owner"),ownerProtocolFrameCap:programRoles.has("runner")}
    }
    // Recheck every read file after all dependent reads, including programs.
    for(const row of observed) {
      demand(stamp(fs.statSync(row.path,{bigint:true}))===row.stamp,"changed_during_accounting")
      demand(boundFile(row.path,row.sha256).stamp===row.stamp,"changed_during_accounting")
    }
    ledger.resourceInventoryVerified=true
    ledger.gaps.push("shared_aggregate_cap_missing","guard_build_caps_missing",
      "live_process_resource_enforcement_unproven","stream_transport_not_proven_by_saved_bytes",
      "disk_receipt_is_not_live_cleanup_authority")
  } catch(error) {
    ledger.diagnostic.status=ledger.diagnostic.status==="verified"?"verified":"rejected"
    ledger.shared.status="rejected"
    ledger.errors.push(String(error.message).slice(0,2048))
  }
  ledger.semanticEvidenceVerified=diagnosticSemanticsComplete&&ledger.resourceInventoryVerified&&ledger.semantic.errors.length===0
  ledger.semantic.status=ledger.semantic.errors.length?"rejected":ledger.semanticEvidenceVerified?"verified":"incomplete"
  ledger.status=ledger.errors.length||!ledger.semanticEvidenceVerified?"rejected":"incomplete"
  // The component's own report AND its pending witness are real output too.
  // Settle exact serialization length including these counters before checking.
  ledger.diagnostic.ledgerReportBytes=0
  ledger.diagnostic.ledgerReportAndPendingBytes=0
  ledger.diagnostic.ledgerReportSaved=false
  ledger.diagnostic.ledgerPendingSaved=false
  function settle() {
    for(let i=0;i<12;i++) {
      const n=encode(ledger).length
      if(n===ledger.diagnostic.ledgerReportBytes)return encode(ledger)
      ledger.diagnostic.ledgerReportBytes=n;ledger.diagnostic.ledgerReportAndPendingBytes=n*2
    }
    throw new Error("ledger_serialization_not_stable")
  }
  let raw=settle()
  if(ledger.diagnostic.actualBytes+ledger.diagnostic.plannedBytes+raw.length*2
    >DIAGNOSTIC_LIMITS.outputBytes-DIAGNOSTIC_LIMITS.failureReserveBytes&&!ledger.errors.includes("failure_reserve_exhausted")) {
    ledger.errors.push("failure_reserve_exhausted");ledger.status="rejected";ledger.diagnostic.status="rejected";ledger.resourceInventoryVerified=false;ledger.semanticEvidenceVerified=false;ledger.semantic.status=ledger.semantic.errors.length?"rejected":"incomplete";raw=settle()
  }
  demand(raw.length<=DIAGNOSTIC_LIMITS.jsonBytes,"ledger_json_limit")
  return {ledger,binding:{sha256:hash(raw),bytes:raw.length}}
}

export function serializeResourceLedger(result) {
  const raw=encode(result.ledger)
  demand(hash(raw)===result.binding.sha256&&raw.length===result.binding.bytes,"ledger_binding_changed")
  return raw
}
