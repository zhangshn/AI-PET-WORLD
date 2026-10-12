import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import crypto from "node:crypto"
import {accountFailureAnalysisResources as account,serializeResourceLedger,DIAGNOSTIC_LIMITS as L,FROZEN_HELPERS} from "../lib/ai-painter-failure-analysis-resource-accounting-v1.mjs"
const root=path.resolve(import.meta.dirname,"../..")
const evidence=path.resolve(process.env.AI_PAINTER_ACCOUNTING_TEST_ROOT)
const sha=b=>crypto.createHash("sha256").update(b).digest("hex")
function put(file,raw) {fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,raw,{flag:"wx"});return {path:file,sha256:sha(Buffer.from(raw))}}
function fixture() {
  const base=path.join(evidence,"synthetic-"+crypto.randomBytes(8).toString("hex")),diagnosticRoot=path.join(base,"diagnostic")
  fs.mkdirSync(diagnosticRoot,{recursive:true})
  const files=["request.json","intent.json","claim.json","report.json.pending-witness","cleanup.json","failure.json","summary.json"]
  const diagnosticBindings=files.map(p=>({path:p,sha256:put(path.join(diagnosticRoot,p),"{}\n").sha256}))
  return {base,diagnosticRoot,diagnosticBindings}
}
function shared(f) {
  const id="12345678-abcd-abcd-abcd-123456789abc",guardRoot=path.join(f.base,"helper"),native=path.join(guardRoot,id+"-native")
  const helperBindings=Object.entries({runner:"scripts/lib/ai-painter-owned-worker-v1.mjs",native:"scripts/lib/ai-painter-owned-worker-native-v1.mjs",owner:"scripts/windows/ai-painter-owned-worker-owner.cs"})
    .map(([role,p])=>({role,path:path.join(root,p),sha256:FROZEN_HELPERS[role]}))
  const owner=helperBindings.find(b=>b.role==="owner")
  const source=put(path.join(native,"owner.cs"),fs.readFileSync(owner.path))
  const binary=put(path.join(native,"owner.exe"),"synthetic non-executable bytes")
  const rows=[{role:"nativeSource",...source},{role:"nativeBinary",...binary},
    {role:"build",...put(path.join(native,"build.json"),JSON.stringify({source:owner,snapshot:source.path,binary:binary.path,binarySha256:binary.sha256}))},
    {role:"stdout",...put(path.join(native,"stdout.bin"),"synthetic stdout")},
    {role:"stderr",...put(path.join(native,"stderr.bin"),"synthetic stderr")},
    {role:"observation",...put(path.join(native,"cleanup-observation.json"),JSON.stringify({verified:true,activeProcessesAfterCleanup:0}))}]
  const guardPath=path.join(guardRoot,id+"-started.json")
  const guard=put(guardPath,JSON.stringify({identity:id,startedEvidence:guardPath,commandSha256:"a".repeat(64),helperSha256:FROZEN_HELPERS.runner,nativeOwnerSource:owner,verified:true}))
  return {...f,invocation:{identity:id,guard,verified:true},helperBindings,sharedEvidence:rows.map(b=>({...b,invocationIdentity:id,verified:true}))}
}
const rejects=(r,reason)=>{assert.equal(r.ledger.status,"rejected");assert.ok(r.ledger.errors.some(e=>e.includes(reason)),JSON.stringify(r.ledger.errors));assert.equal(r.ledger.completeSharedResourceClosureVerified,false)}

test("complete diagnostic inventory counts every actual pending and metadata byte and binds stable serialization",()=>{
  const f=fixture(),a=account(f),b=account(f)
  assert.equal(a.ledger.diagnostic.status,"verified")
  assert.equal(a.ledger.diagnostic.actualBytes,21)
  assert.equal(a.ledger.diagnostic.files.length,7)
  assert.deepEqual(a,b)
  const raw=serializeResourceLedger(a)
  assert.equal(sha(raw),a.binding.sha256)
  assert.equal(a.ledger.diagnostic.ledgerReportBytes,raw.length)
  assert.equal(a.ledger.diagnostic.ledgerReportAndPendingBytes,raw.length*2)
  put(path.join(f.base,"resource-ledger.json"),raw)
})
test("report and pending use exact UTF8 serialization bytes and preserve failure reserve",()=>{
  const f=fixture(),value={report:"中文",n:1},plan={path:"future.json",pendingPath:"future.json.pending",value}
  const r=account({...f,planned:[plan]})
  const n=Buffer.byteLength(JSON.stringify({n:1,report:"中文"},null,2)+"\n")
  assert.equal(r.ledger.diagnostic.plannedBytes,n*2)
  assert.equal(r.ledger.diagnostic.planned[0].sha256,sha(Buffer.from(JSON.stringify({n:1,report:"中文"},null,2)+"\n")))
  assert.ok(r.ledger.diagnostic.actualBytes+n*2+r.binding.bytes*2<=L.outputBytes-L.failureReserveBytes)
})
test("exact singleJSON capacity is accepted; one extra byte is rejected",()=>{
  const f=fixture(),value="x".repeat(L.jsonBytes-3)
  const r=account({...f,planned:[{path:"a.json",pendingPath:"a.json.pending",value}]})
  assert.equal(r.ledger.diagnostic.planned[0].bytes,L.jsonBytes)
  assert.equal(r.ledger.diagnostic.status,"verified")
  rejects(account({...f,planned:[{path:"a.json",pendingPath:"a.json.pending",value:value+"x"}]}),"single_json_limit")
})
test("diagnostic capacity includes both planned witnesses, ledger witnesses and 64KiB reserve",()=>{
  const f=fixture(),value="x".repeat(L.jsonBytes-3)
  rejects(account({...f,planned:[{path:"a.json",pendingPath:"a.json.pending",value},{path:"b.json",pendingPath:"b.json.pending",value}]}),"failure_reserve_exhausted")
  const small=account({...f,planned:[{path:"a.json",pendingPath:"a.json.pending",value:value.slice(0,-40000)},{path:"b.json",pendingPath:"b.json.pending",value:value.slice(0,-40000)}]})
  assert.equal(small.ledger.diagnostic.status,"verified")
})
test("missing pending and repeated destinations cannot hide bytes",()=>{
  const f=fixture()
  rejects(account({...f,planned:[{path:"p.json",value:{}}]}),"pending_witness_required")
  rejects(account({...f,planned:[{path:"p.json",pendingPath:"p.json",value:{}}]}),"duplicate_planned_or_existing_path")
})
test("omitted, duplicate and nonexistent diagnostic bindings fail closed",()=>{
  const f=fixture()
  rejects(account({...f,diagnosticBindings:f.diagnosticBindings.slice(1)}),"inventory_omitted_or_extra")
  rejects(account({...f,diagnosticBindings:[...f.diagnosticBindings,f.diagnosticBindings[0]]}),"duplicate_diagnostic_binding")
  rejects(account({...f,diagnosticBindings:[...f.diagnosticBindings,{path:"absent.json",sha256:"a".repeat(64)}]}),"inventory_omitted_or_extra")
})
test("cross root, latest selection and changed digest are rejected",()=>{
  const f=fixture()
  rejects(account({...f,diagnosticBindings:[{path:"../other.json",sha256:"a".repeat(64)}]}),"unsafe_relative_path")
  rejects(account({...f,diagnosticBindings:[{path:"latest.json",sha256:"a".repeat(64)}]}),"latest_selection_forbidden")
  rejects(account({...f,diagnosticBindings:f.diagnosticBindings.map((b,i)=>i?b:{...b,sha256:"a".repeat(64)})}),"sha_mismatch")
})
test("unregistered directory redirect is rejected without following external history",()=>{
  const f=fixture(),other=path.join(f.base,"outside");fs.mkdirSync(other)
  put(path.join(other,"other.json"),"{}")
  fs.symlinkSync(other,path.join(f.diagnosticRoot,"redirect"),"junction")
  rejects(account(f),"unregistered_redirect")
})
test("change during an actual read is detected",()=>{
  const f=fixture(),original=fs.readSync;let changed=false
  fs.readSync=function(...args) {const n=original.apply(this,args);if(!changed&&n){changed=true;fs.appendFileSync(path.join(f.diagnosticRoot,"claim.json")," ")}return n}
  try {const r=account(f);assert.equal(r.ledger.status,"rejected");assert.ok(r.ledger.errors.some(e=>/changed|sha_mismatch/u.test(e)))} finally {fs.readSync=original}
})
test("hardlinked pending witnesses count each actual directory entry",()=>{
  const f=fixture(),file=path.join(f.diagnosticRoot,"request.json")
  fs.linkSync(file,path.join(f.diagnosticRoot,"request.json.pending"))
  const r=account({...f,diagnosticBindings:[...f.diagnosticBindings,{path:"request.json.pending",sha256:sha(fs.readFileSync(file))}]})
  assert.equal(r.ledger.diagnostic.actualBytes,24)
})
test("full synthetic helper evidence is separately verified but no shared cap or live guarantee is invented",()=>{
  const f=shared(fixture()),r=account(f)
  assert.equal(r.ledger.diagnostic.actualBytes,21)
  assert.equal(r.ledger.shared.files.length,7)
  assert.equal(r.ledger.shared.programs.length,3)
  assert.equal(r.ledger.errors.length,0)
  assert.equal(r.ledger.shared.aggregateCap,null)
  assert.equal(r.ledger.completeSharedResourceClosureVerified,false)
  assert.equal(r.ledger.liveCleanupVerified,false)
  assert.equal(r.ledger.productionEligible,false)
  assert.ok(r.ledger.gaps.includes("shared_aggregate_cap_missing"))
  assert.ok(r.ledger.gaps.includes("live_process_resource_enforcement_unproven"))
})
test("caller verified booleans, caps and formatted SHA cannot create closure",()=>{
  const f=fixture(),r=account({...f,verified:true,completeSharedResourceClosureVerified:true,sharedCap:8388608})
  assert.equal(r.ledger.completeSharedResourceClosureVerified,false)
  assert.ok(r.ledger.gaps.includes("invocation_binding_missing"))
  const bad=shared(fixture());bad.helperBindings[0].sha256="a".repeat(64)
  rejects(account(bad),"unfrozen_helper_binding")
})
test("cross invocation and duplicated helper roles fail closed",()=>{
  const f=shared(fixture())
  rejects(account({...f,sharedEvidence:f.sharedEvidence.map((b,i)=>i?b:{...b,invocationIdentity:"other"})}),"cross_invocation_evidence")
  rejects(account({...f,sharedEvidence:[...f.sharedEvidence,f.sharedEvidence[0]]}),"duplicate_shared_role")
  rejects(account({...f,helperBindings:[...f.helperBindings,f.helperBindings[0]]}),"duplicate_or_unknown_helper_binding")
})
test("shared path and binary binding changes are rejected",()=>{
  const f=shared(fixture())
  rejects(account({...f,sharedEvidence:f.sharedEvidence.map(b=>b.role==="nativeBinary"?{...b,path:path.join(f.base,"owner.exe")}:b)}),"unsafe_relative_path")
  fs.appendFileSync(f.sharedEvidence.find(b=>b.role==="nativeBinary").path,"changed")
  rejects(account(f),"sha_mismatch")
})
test("missing native build evidence is incomplete and diagnostic-only",()=>{
  const f=shared(fixture()),r=account({...f,sharedEvidence:f.sharedEvidence.filter(b=>b.role!=="nativeBinary")})
  assert.equal(r.ledger.status,"incomplete")
  assert.ok(r.ledger.gaps.includes("shared_evidence_missing:nativeBinary"))
})
test("ledger mutation invalidates its real serialization binding",()=>{
  const r=account(fixture());r.ledger.diagnostic.actualBytes++
  assert.throws(()=>serializeResourceLedger(r),/ledger_binding_changed/u)
})
test("different report and pending values are measured independently",()=>{
  const f=fixture(),r=account({...f,planned:[{path:"new.json",pendingPath:"new.json.pending",value:{a:1},pendingValue:{larger:"字节"}}]})
  const n=Buffer.byteLength(JSON.stringify({a:1},null,2)+"\n")+Buffer.byteLength(JSON.stringify({larger:"字节"},null,2)+"\n")
  assert.equal(r.ledger.diagnostic.plannedBytes,n)
  assert.equal(r.ledger.diagnostic.ledgerReportSaved,false)
})
test("over-limit root is rejected before any file content reads",()=>{
  const f=fixture(),originalStat=fs.statSync,originalRead=fs.readSync;let reads=0
  fs.statSync=function(file,options){const s=originalStat.call(this,file,options);if(String(file).endsWith("claim.json")&&!options?.bigint)s.size=L.outputBytes+1;return s}
  fs.readSync=function(...args){reads++;return originalRead.apply(this,args)}
  try {rejects(account(f),"diagnostic_output_limit");assert.equal(reads,0)} finally {fs.statSync=originalStat;fs.readSync=originalRead}
})
test("real frozen default production guard remains in place without executing its runner",()=>{
  const source=fs.readFileSync(path.join(root,"scripts/run-ai-painter-appearance-regime-gradient-failure-capture.mjs"))
  assert.equal(sha(source),"332556a4100df2cb6e439f238cc642625a425d6700d21aa13dc3578cccf3e5cf")
  assert.match(source.toString(),/ownedAnalysis === runOwnedWorker\) reason = "production_owned_resource_budget_unverified"/u)
})
test("random ID JSON pending witnesses retain the exact 2MiB JSON limit",()=>{
  const f=fixture(),name="report.json."+"a".repeat(32)+".pending"
  const exact=Buffer.from(JSON.stringify("x".repeat(L.jsonBytes-3))+"\n")
  const binding=put(path.join(f.diagnosticRoot,name),exact)
  const input={...f,diagnosticBindings:[...f.diagnosticBindings,{path:name,sha256:binding.sha256}]}
  assert.equal(account(input).ledger.diagnostic.status,"verified")
  const over=fixture(),oversized=put(path.join(over.diagnosticRoot,name),Buffer.concat([exact,Buffer.from(" ")]))
  rejects(account({...over,diagnosticBindings:[...over.diagnosticBindings,{path:name,sha256:oversized.sha256}]}),"single_json_limit")
})
