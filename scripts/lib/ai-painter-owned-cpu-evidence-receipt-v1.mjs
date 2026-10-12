import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

// Call immediately AFTER the existing owned executor returns (or throws with
// its original receipt). This module neither runs processes nor recovers an
// old receipt. Bytes/files cannot authenticate a live process or grant authority.
export const EVIDENCE_LIMITS = Object.freeze({outputBytes:8388608,jsonBytes:2097152,failureReserveBytes:65536,summaryBytes:16384});
const sha=raw=>crypto.createHash("sha256").update(raw).digest("hex");
const encode=value=>Buffer.from(JSON.stringify(value,null,2)+"\n");
const need=(ok,reason)=>{if(!ok)throw Error(reason)};
const stamp=s=>[s.dev,s.ino,s.size,s.mtimeNs,s.ctimeNs].map(String).join(":");
const key=p=>path.resolve(p).toLowerCase();
const boundedError=e=>String(e?.message??e).slice(0,512);
const isJson=name=>/\.json(?:\.pending(?:-.*)?|\.[a-f0-9-]+\.pending)?$/u.test(name);
function scope(root) {
  need(typeof root==="string"&&path.isAbsolute(root),"absolute_evidence_root_required");
  const logical=path.resolve(root),physical=fs.realpathSync(logical);
  const a=fs.statSync(logical,{bigint:true}),b=fs.statSync(physical,{bigint:true});
  need(a.isDirectory()&&a.dev>0n&&a.ino>0n&&a.dev===b.dev&&a.ino===b.ino,"evidence_root_identity_unavailable");
  return {logical,physical,device:String(a.dev),fileId:String(a.ino)};
}
function rootStable(s) {
  const a=fs.statSync(s.logical,{bigint:true});
  need(String(a.dev)===s.device&&String(a.ino)===s.fileId&&key(fs.realpathSync(s.logical))===key(s.physical),"evidence_root_changed");
}
function scan(s,{hash=false}={}) {
  rootStable(s);
  const files=[],redirects=[],violations=[];let bytes=0,metadataBytes=0;
  function visit(directory) {
    for(const entry of fs.readdirSync(directory,{withFileTypes:true})) {
      const file=path.join(directory,entry.name),relativePath=path.relative(s.physical,file).replaceAll("\\","/");
      metadataBytes+=Buffer.byteLength(relativePath)+96;
      need(metadataBytes<=EVIDENCE_LIMITS.jsonBytes,"inventory_metadata_limit");
      const meta=fs.lstatSync(file,{bigint:true});
      if(meta.isSymbolicLink()) {
        if(!hash) {redirects.push({relativePath,followed:false});continue;}
        // readlink obtains link text only: no target stat, traversal or content read.
        const link=fs.readlinkSync(file).replace(/^\\\\\?\\/u,"");
        const linkTarget=path.resolve(path.dirname(file),link);
        const relativeTarget=path.relative(s.logical,linkTarget);
        // Translate only the already-identified root alias. Do not realpath,
        // stat or traverse the descendant link target to compare F with D.
        const mapped=relativeTarget!==".."&&!relativeTarget.startsWith(".."+path.sep)&&!path.isAbsolute(relativeTarget);
        const target=mapped?path.join(s.physical,relativeTarget):linkTarget;
        const pieces=relativePath.split("/");
        const known=pieces.length===4&&pieces[0]==="fixtures"&&/^synthetic-[a-f0-9]+$/u.test(pieces[1])
          &&pieces[2]==="diagnostic"&&pieces[3]==="redirect"
          &&key(target)===key(path.join(path.dirname(directory),"outside"));
        redirects.push({relativePath,linkTarget,target,knownNegativeFixture:known,followed:false});
        if(!known)violations.push("unexpected_redirect:"+relativePath);
        need(stamp(fs.lstatSync(file,{bigint:true}))===stamp(meta),"redirect_changed_during_inventory");
        continue;
      }
      if(meta.isDirectory())visit(file);
      else {
        need(meta.isFile(),"nonregular_evidence");
        const size=Number(meta.size);need(Number.isSafeInteger(size)&&size>=0,"invalid_file_size");
        bytes+=size;need(bytes<=EVIDENCE_LIMITS.outputBytes,"output_limit");
        if(isJson(entry.name)&&size>EVIDENCE_LIMITS.jsonBytes)violations.push("single_json_limit:"+relativePath);
        const row={relativePath,bytes:size,device:String(meta.dev),fileId:String(meta.ino)};
        if(hash&&isJson(entry.name)&&size>EVIDENCE_LIMITS.jsonBytes) {
          row.hashNotReadReason="single_json_limit";files.push(row);continue;
        }
        if(hash) {
          const fd=fs.openSync(file,"r"),h=crypto.createHash("sha256"),chunk=Buffer.alloc(65536);let read=0,n;
          try {
            need(stamp(fs.fstatSync(fd,{bigint:true}))===stamp(meta),"changed_during_inventory");
            while((n=fs.readSync(fd,chunk,0,chunk.length,null))>0) {read+=n;need(read<=size,"changed_during_inventory");h.update(chunk.subarray(0,n));}
            need(read===size&&stamp(fs.fstatSync(fd,{bigint:true}))===stamp(meta)&&stamp(fs.lstatSync(file,{bigint:true}))===stamp(meta),"changed_during_inventory");
            row.sha256=h.digest("hex");
          } finally {fs.closeSync(fd)}
        }
        files.push(row);
      }
    }
  }
  visit(s.physical);rootStable(s);
  return {root:s,files,redirects,violations,bytes};
}
function pair(s,name,raw,{failure=false,maximum=EVIDENCE_LIMITS.jsonBytes}={}) {
  need(Buffer.isBuffer(raw)&&raw.length<=maximum&&raw.length<=EVIDENCE_LIMITS.jsonBytes,"single_json_limit");
  const final=path.join(s.physical,name),pending=final+".pending";
  need(!fs.existsSync(final)&&!fs.existsSync(pending),"immutable_destination_exists");
  const available=EVIDENCE_LIMITS.outputBytes-(failure?0:EVIDENCE_LIMITS.failureReserveBytes);
  need(scan(s).bytes+raw.length*2<=available,"output_reserve_exhausted");
  rootStable(s);
  const fd=fs.openSync(pending,"wx+");let savedStamp;
  try {
    fs.writeFileSync(fd,raw);fs.fsyncSync(fd);
    const meta=fs.fstatSync(fd,{bigint:true});savedStamp=stamp(meta);
    need(meta.size===BigInt(raw.length),"pending_readback_changed");
    // Read back through the still-owned file descriptor at a bounded size.
    // Never follow a replacement pending path or allocate its reported size.
    const saved=Buffer.alloc(raw.length);let count=0;
    while(count<saved.length) {const n=fs.readSync(fd,saved,count,saved.length-count,count);need(n>0,"pending_readback_changed");count+=n;}
    need(saved.equals(raw)&&stamp(fs.fstatSync(fd,{bigint:true}))===savedStamp
      &&stamp(fs.lstatSync(pending,{bigint:true}))===savedStamp,"pending_readback_changed");
  } finally {fs.closeSync(fd)}
  // Keep a failed pending witness; never delete evidence to make a quota pass.
  need(scan(s).bytes+raw.length<=available,"output_reserve_exhausted");
  rootStable(s);need(stamp(fs.lstatSync(pending,{bigint:true}))===savedStamp,"pending_readback_changed");fs.linkSync(pending,final); // no-overwrite publication, retain pending
  return {path:final,pendingPath:pending,sha256:sha(raw),bytes:raw.length,storedBytes:raw.length*2};
}
function receiptStatus(raw) {
  if(!raw)return {status:"unknown",reason:"original_receipt_missing"};
  let value;
  try {value=JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(raw))}
  catch {return {status:"rejected",reason:"original_receipt_invalid_json"}}
  if(!value||Array.isArray(value)||typeof value!=="object")return {status:"rejected",reason:"original_receipt_invalid_shape"};
  // Frozen Python private-Job executor's actual return shape. No SHA/verified
  // flags supplied by the caller replace any required original receipt field.
  // FILETIME exceeds Number.MAX_SAFE_INTEGER: retain its exact decimal token
  // in original bytes; do not round it and call the result authenticated.
  const creation=raw.toString("utf8").match(/"processCreationFileTime"\s*:\s*([0-9]{1,20})(?=\s*[,}])/u);
  const identity=typeof value.jobName==="string"&&value.jobName.startsWith("Local\\ai-painter-snapshot-")
    &&Number.isSafeInteger(value.pid)&&value.pid>0&&Object.hasOwn(value,"processCreationFileTime")&&Number.isInteger(value.processCreationFileTime)&&value.processCreationFileTime>0
    &&creation!==null&&BigInt(creation[1])>0n
    &&Array.isArray(value.argv)&&value.argv.length>0&&value.argv.every(v=>typeof v==="string");
  if(!identity)return {status:"rejected",reason:"original_receipt_identity_missing"};
  if(!Number.isSafeInteger(value.totalProcesses)||value.totalProcesses<1||!Number.isInteger(value.exitCode)
    ||typeof value.timedOut!=="boolean"||!Number.isFinite(value.elapsedSeconds)||value.elapsedSeconds<0)
    return {status:"unknown",reason:"original_execution_result_incomplete"};
  if(value.assignedBeforeResume!==true||value.killOnJobClose!==true)return {status:"unknown",reason:"original_job_containment_unknown"};
  if(value.cleanupConfirmed===true&&value.activeProcessesAfterCleanup!==0)return {status:"rejected",reason:"original_cleanup_contradiction"};
  if(value.cleanupConfirmed!==true||value.activeProcessesAfterCleanup!==0)return {status:"unknown",reason:"original_cleanup_unknown"};
  return {status:"recorded",reason:"structural_receipt_only_not_live_cleanup_authority"};
}
/** Evidence root must belong exclusively to this invocation; no lock takeover.
 * receiptBytes is the exact serialization of the original executor receipt,
 * never a history lookup or qualification object. Persist it before JSON parsing,
 * content inventory, optional review callbacks, or summary serialization.
 * Optional review callbacks are readonly; they must not produce unaccounted
 * output or launch work. A metadata-only byte preflight is necessary before
 * every write; it skips all descendant links without inspecting their targets.
 * Reuse: const owned = await existingExecutor(...); deliverOwnedCpuEvidence({
 *   evidenceRoot, receiptBytes: Buffer.from(JSON.stringify(owned)) });
 * If an executor throws, pass only its actual attached original receipt. Missing
 * receipt remains missing. Nothing here upgrades cleanup or production status.
 */
export function deliverOwnedCpuEvidence({evidenceRoot,receiptBytes,reviewInventory,auditInventory=true}={}) {
  const s=scope(evidenceRoot);
  const result={receipt:null,inventory:null,summary:null,receiptStatus:"unknown",status:"unknown",
    cleanupQualification:"unknown",liveCleanupVerified:false,productionEligible:false,qualificationGranted:false,errors:[]};
  let original;
  try {
    if(receiptBytes!==undefined&&receiptBytes!==null) {
      need(Buffer.isBuffer(receiptBytes),"original_receipt_bytes_required");
      need(receiptBytes.length<=EVIDENCE_LIMITS.jsonBytes,"single_json_limit");
      original=Buffer.from(receiptBytes);
      result.receipt=pair(s,"owned-process-receipt.json",original);
    }
    const classification=receiptStatus(original);result.receiptStatus=classification.status;
    result.status=classification.status;result.errors.push(classification.reason);
    if(auditInventory) {
      const inventory=scan(s,{hash:true});
      // Serialize the potentially large inventory separately from a small summary.
      result.inventory=pair(s,"output-inventory.json",encode(inventory));
      if(inventory.violations.length)throw Error(inventory.violations[0]);
      if(reviewInventory)reviewInventory(inventory,{receipt:result.receipt?Object.freeze({...result.receipt}):null});
    }
  } catch(error) {result.status="rejected";result.errors.push(boundedError(error))}
  const summary={schemaVersion:"owned-cpu-evidence-delivery-v1",status:result.status,receiptStatus:result.receiptStatus,
    receipt:result.receipt,inventory:result.inventory,errors:result.errors.slice(0,4).map(e=>e.slice(0,512)),
    cleanupQualification:"unknown",liveCleanupVerified:false,productionEligible:false,qualificationGranted:false};
  try {result.summary=pair(s,"delivery-summary.json",encode(summary),{failure:true,maximum:EVIDENCE_LIMITS.summaryBytes})}
  catch(error) {result.status="rejected";result.errors.push("summary_not_saved:"+boundedError(error))}
  try {result.actualStoredBytes=scan(s).bytes}
  catch(error) {result.actualStoredBytes=null;result.status="rejected";result.errors.push(boundedError(error))}
  return result;
}
