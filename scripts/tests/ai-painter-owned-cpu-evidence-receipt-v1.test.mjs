import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {deliverOwnedCpuEvidence as deliver,EVIDENCE_LIMITS as L} from "../lib/ai-painter-owned-cpu-evidence-receipt-v1.mjs";
assert.ok(process.env.AI_PAINTER_OWNED_RECEIPT_TEST_ROOT,"explicit fresh synthetic evidence root required");
const evidence=path.resolve(process.env.AI_PAINTER_OWNED_RECEIPT_TEST_ROOT);
const sha=raw=>crypto.createHash("sha256").update(raw).digest("hex");
function fixture() {
  const base=path.join(evidence,"synthetic-"+crypto.randomBytes(8).toString("hex")),root=path.join(base,"output");
  fs.mkdirSync(root,{recursive:true});return {base,root};
}
function put(file,raw) {fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,raw,{flag:"wx"});}
// Pure synthetic private-Job-shaped bytes. No process/Job is launched and no
// live cleanup proof is claimed. Preserve a FILETIME larger than safe JS ints.
function receipt(extra={}) {
  const value={argv:["synthetic-never-executed"],jobName:"Local\\ai-painter-snapshot-synthetic",pid:123,
    assignedBeforeResume:true,killOnJobClose:true,cleanupConfirmed:true,activeProcessesAfterCleanup:0,
    totalProcesses:1,exitCode:0,elapsedSeconds:.1,timedOut:false,...extra};
  return Buffer.from(JSON.stringify(value).replace(/}$/,',"processCreationFileTime":134358468540618394}')+"\n");
}
function storedBytes(root) {
  let bytes=0;
  for(const d of fs.readdirSync(root,{withFileTypes:true})) {
    const p=path.join(root,d.name),s=fs.lstatSync(p);
    if(s.isSymbolicLink())continue;
    if(s.isDirectory())bytes+=storedBytes(p);else bytes+=s.size;
  }
  return bytes;
}
function unqualified(r) {
  assert.equal(r.cleanupQualification,"unknown");assert.equal(r.liveCleanupVerified,false);
  assert.equal(r.productionEligible,false);assert.equal(r.qualificationGranted,false);
}

test("exact original receipt and pending persist before optional review throws",()=>{
  const f=fixture(),original=receipt();let reviewed=false;
  const r=deliver({evidenceRoot:f.root,receiptBytes:original,reviewInventory:(inventory,{receipt:bound})=>{
    reviewed=true;assert.deepEqual(fs.readFileSync(bound.path),original);
    assert.deepEqual(fs.readFileSync(bound.pendingPath),original);
    assert.equal(bound.sha256,sha(original));throw Error("optional audit failed "+"x".repeat(50000));
  }});
  assert.equal(reviewed,true);assert.equal(r.status,"rejected");
  assert.deepEqual(fs.readFileSync(r.receipt.path),original);
  assert.equal(sha(fs.readFileSync(r.inventory.path)),r.inventory.sha256);
  const summary=JSON.parse(fs.readFileSync(r.summary.path));
  assert.equal(summary.inventory.sha256,r.inventory.sha256);assert.ok(r.summary.bytes<=L.summaryBytes);
  assert.equal(Object.hasOwn(summary,"files"),false);assert.equal(r.actualStoredBytes,storedBytes(f.root));unqualified(r);
});
test("explicit logical root junction maps to real physical directory identity",()=>{
  const f=fixture(),alias=path.join(f.base,"logical-root");fs.symlinkSync(f.root,alias,"junction");
  const r=deliver({evidenceRoot:alias,receiptBytes:receipt()});
  const inventory=JSON.parse(fs.readFileSync(r.inventory.path));
  assert.equal(inventory.root.physical,fs.realpathSync(alias));
  assert.equal(inventory.root.fileId,String(fs.statSync(f.root,{bigint:true}).ino));
  assert.equal(r.receiptStatus,"recorded");unqualified(r);
});
test("known negative fixture junction uses physical paths and is never followed",()=>{
  const f=fixture(),base=path.join(f.root,"fixtures","synthetic-a123"),diagnostic=path.join(base,"diagnostic"),outside=path.join(base,"outside");
  fs.mkdirSync(diagnostic,{recursive:true});fs.mkdirSync(outside);
  put(path.join(outside,"witness.json"),"{}\n");fs.symlinkSync(outside,path.join(diagnostic,"redirect"),"junction");
  const r=deliver({evidenceRoot:f.root,receiptBytes:receipt()});
  const inventory=JSON.parse(fs.readFileSync(r.inventory.path));
  assert.equal(inventory.redirects.length,1);assert.equal(inventory.redirects[0].knownNegativeFixture,true);
  assert.equal(inventory.redirects[0].followed,false);assert.equal(inventory.violations.length,0);
  assert.equal(inventory.files.filter(row=>row.relativePath.endsWith("witness.json")).length,1);
  assert.equal(r.actualStoredBytes,storedBytes(f.root));unqualified(r);
});
test("unexpected junction is rejected after retaining receipt without reading target",()=>{
  const f=fixture(),outside=path.join(f.base,"external");fs.mkdirSync(outside);put(path.join(outside,"not-output.json"),"{bad");
  fs.symlinkSync(outside,path.join(f.root,"unknown-link"),"junction");
  const r=deliver({evidenceRoot:f.root,receiptBytes:receipt()});
  assert.equal(r.status,"rejected");assert.ok(r.receipt);assert.ok(r.errors.some(e=>e.startsWith("unexpected_redirect:")));
  const inventory=JSON.parse(fs.readFileSync(r.inventory.path));
  assert.equal(inventory.redirects[0].followed,false);assert.equal(inventory.files.some(row=>row.relativePath.includes("not-output")),false);unqualified(r);
});
test("caller cleanup booleans or formatted SHA cannot stand in for original receipt",()=>{
  const f=fixture(),r=deliver({evidenceRoot:f.root,verified:true,cleanupConfirmed:true,sha256:"a".repeat(64)});
  assert.equal(r.receipt,null);assert.equal(r.receiptStatus,"unknown");assert.equal(r.status,"unknown");unqualified(r);
  const g=fixture(),bad=deliver({evidenceRoot:g.root,receiptBytes:Buffer.from(JSON.stringify({verified:true,cleanupConfirmed:true,sha256:"a".repeat(64)}))});
  assert.equal(bad.receiptStatus,"rejected");unqualified(bad);
});
test("malformed original receipt remains exact durable evidence and rejected",()=>{
  const f=fixture(),raw=Buffer.from("{partial"),r=deliver({evidenceRoot:f.root,receiptBytes:raw});
  assert.equal(r.receiptStatus,"rejected");assert.equal(r.status,"rejected");
  assert.deepEqual(fs.readFileSync(r.receipt.path),raw);unqualified(r);
});
test("unknown or contradictory cleanup never upgrades from disk receipt",()=>{
  const f=fixture(),unknown=deliver({evidenceRoot:f.root,receiptBytes:receipt({cleanupConfirmed:false,activeProcessesAfterCleanup:1})});
  assert.equal(unknown.receiptStatus,"unknown");unqualified(unknown);
  const g=fixture(),bad=deliver({evidenceRoot:g.root,receiptBytes:receipt({cleanupConfirmed:true,activeProcessesAfterCleanup:1})});
  assert.equal(bad.receiptStatus,"rejected");unqualified(bad);
  const h=fixture(),incomplete=deliver({evidenceRoot:h.root,receiptBytes:receipt({exitCode:undefined})});
  assert.equal(incomplete.receiptStatus,"unknown");unqualified(incomplete);
});
test("oversized receipt is rejected in memory before writing any oversized witness",()=>{
  const f=fixture(),r=deliver({evidenceRoot:f.root,receiptBytes:Buffer.alloc(L.jsonBytes+1,32)});
  assert.equal(r.status,"rejected");assert.equal(r.receipt,null);
  assert.ok(r.errors.includes("single_json_limit"));assert.ok(r.summary.bytes<=L.summaryBytes);
  assert.ok(storedBytes(f.root)<L.failureReserveBytes);unqualified(r);
});
test("pending pairs and reserved failure space are charged at real serialized sizes",()=>{
  const f=fixture(),r=deliver({evidenceRoot:f.root,receiptBytes:receipt()});
  for(const binding of [r.receipt,r.inventory,r.summary]) {
    assert.equal(binding.storedBytes,binding.bytes*2);
    assert.equal(fs.statSync(binding.path).size,binding.bytes);
    assert.equal(fs.statSync(binding.pendingPath).size,binding.bytes);
    assert.equal(sha(fs.readFileSync(binding.pendingPath)),binding.sha256);
  }
  assert.equal(storedBytes(f.root),r.receipt.storedBytes+r.inventory.storedBytes+r.summary.storedBytes);
  assert.equal(r.actualStoredBytes,storedBytes(f.root));assert.ok(r.actualStoredBytes<=L.outputBytes-L.failureReserveBytes);unqualified(r);
});
test("aggregate limit refusal uses simulated metadata and leaves existing file unchanged",()=>{
  const f=fixture(),block=path.join(f.root,"existing.bin");put(block,"x");
  const original=fs.lstatSync,physicalBlock=fs.realpathSync(block);
  fs.lstatSync=function(file,options) {const s=original.call(this,file,options);if(path.resolve(file)===physicalBlock)s.size=options?.bigint?BigInt(L.outputBytes):L.outputBytes;return s;};
  let r;try {r=deliver({evidenceRoot:f.root,receiptBytes:receipt()})} finally {fs.lstatSync=original;}
  assert.equal(r.status,"rejected");assert.equal(r.receipt,null);assert.equal(r.summary,null);
  assert.equal(fs.readFileSync(block,"utf8"),"x");assert.equal(fs.readdirSync(f.root).length,1);unqualified(r);
});
test("existing immutable receipt and unknown lock are not overwritten or removed",()=>{
  const f=fixture();put(path.join(f.root,"owned-process-receipt.json"),"{}\n");put(path.join(f.root,"unknown.lock"),"keep");
  const r=deliver({evidenceRoot:f.root,receiptBytes:receipt()});
  assert.equal(r.status,"rejected");assert.ok(r.errors.includes("immutable_destination_exists"));
  assert.equal(fs.readFileSync(path.join(f.root,"owned-process-receipt.json"),"utf8"),"{}\n");
  assert.equal(fs.readFileSync(path.join(f.root,"unknown.lock"),"utf8"),"keep");unqualified(r);
});
test("no output audit is needed to retain original returned bytes",()=>{
  const f=fixture(),r=deliver({evidenceRoot:f.root,receiptBytes:receipt(),auditInventory:false});
  assert.ok(r.receipt);assert.equal(r.inventory,null);assert.equal(r.receiptStatus,"recorded");unqualified(r);
});

test("Python JSON pending-UUID size cap rejects simulated metadata without opening content",()=>{
  const f=fixture(),file=path.join(f.root,"legacy.json.pending-"+"a".repeat(32));put(file,"{}\n");
  const originalStat=fs.lstatSync,originalOpen=fs.openSync,physicalFile=fs.realpathSync(file);let targetOpens=0;
  fs.lstatSync=function(candidate,options) {
    const s=originalStat.call(this,candidate,options);
    if(path.resolve(candidate)===physicalFile)s.size=options?.bigint?BigInt(L.jsonBytes+1):L.jsonBytes+1;
    return s;
  };
  fs.openSync=function(candidate,...args) {if(path.resolve(candidate)===physicalFile)targetOpens++;return originalOpen.call(this,candidate,...args)};
  let r;
  try {r=deliver({evidenceRoot:f.root,receiptBytes:receipt()});assert.equal(targetOpens,0)}
  finally {fs.lstatSync=originalStat;fs.openSync=originalOpen;}
  assert.equal(r.status,"rejected");assert.ok(r.receipt);assert.ok(r.inventory);
  assert.ok(r.errors.some(e=>e.startsWith("single_json_limit:")));
  const inventory=JSON.parse(fs.readFileSync(r.inventory.path)),row=inventory.files.find(row=>row.relativePath===path.basename(file));
  assert.equal(row.bytes,L.jsonBytes+1);assert.equal(row.hashNotReadReason,"single_json_limit");
  assert.equal(Object.hasOwn(row,"sha256"),false);assert.equal(fs.statSync(file).size,3);
  assert.equal(fs.readFileSync(file,"utf8"),"{}\n");assert.ok(r.summary.bytes<=L.summaryBytes);unqualified(r);
});
