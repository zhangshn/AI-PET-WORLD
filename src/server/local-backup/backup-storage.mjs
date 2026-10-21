import fs from 'node:fs'
import path from 'node:path'
import { hash, need, identity } from './contracts.mjs'
import { checkDirectory, safeFile } from './store.mjs'

const terminalStates=new Set(['completed','failed','interrupted'])
const persistenceFailureCodes=new Set(['backup_local_completion_record_persistence_failed','backup_local_manifest_persistence_failed','backup_local_terminal_persistence_failed','backup_local_projection_persistence_failed'])
export function createBackupStorage(moduleRoot,store) {
  const runs=path.join(moduleRoot,'runs')
  function folder(directory){if(!fs.existsSync(directory))fs.mkdirSync(directory,{mode:0o700});checkDirectory(directory)}
  function read(file) {safeFile(file,1024*1024);const bytes=fs.readFileSync(file);return{value:JSON.parse(bytes.toString('utf8')),sha256:hash(bytes)}}
  function put(file,value){const bytes=Buffer.from(JSON.stringify(value));need(bytes.length<=1024*1024,'backup_evidence_limit',409);const fd=fs.openSync(file,'wx',0o600);try{fs.writeFileSync(fd,bytes);fs.fsyncSync(fd)}finally{fs.closeSync(fd)}return hash(bytes)}
  function requestFile(key){return path.join(runs,`request-${hash(key)}.json`)}
  function directory(id){identity(id);need(/^backup-[a-f0-9-]{36}$/.test(id),'backup_run_identity_invalid',409);return path.join(runs,id)}
  function request(input){const file=requestFile(input.idempotencyKey);if(!fs.existsSync(file))return null;checkDirectory(moduleRoot);checkDirectory(runs);const saved=read(file).value;need(saved.schemaVersion==='local_backup_request_v1'&&saved.requestSha256===hash(input),'backup_idempotency_conflict',409);directory(saved.backupId);return saved}
  function terminal(id){const file=path.join(directory(id),'terminal.json');if(!fs.existsSync(file))return null;checkDirectory(moduleRoot);checkDirectory(runs);checkDirectory(directory(id));const final=read(file);need(final.value.schemaVersion==='local_backup_run_terminal_v1'&&final.value.backupId===id&&terminalStates.has(final.value.state),'backup_terminal_identity_conflict',409);return final}
  function completionEvent(id,sequence,binding){const file=path.join(directory(id),'events',`${String(sequence).padStart(4,'0')}.json`);if(!fs.existsSync(file))return null;checkDirectory(moduleRoot);checkDirectory(runs);checkDirectory(directory(id));checkDirectory(path.dirname(file));const result=read(file),value=result.value,created=read(path.join(path.dirname(file),'0001.json')).value;need(value.schemaVersion==='local_backup_run_terminal_v1'&&value.backupId===id&&value.state==='completed'&&value.verificationStatus==='verified'&&/^[a-f0-9]{64}$/.test(value.manifestSha256)&&value.completionMarker==='completed-'+value.manifestSha256,'backup_completion_event_conflict',409);need(created.backupId===id&&created.state==='created'&&['schemaVersion','scopeId','configurationId','configurationSha256','requestSha256','startedAtUtc'].every(key=>typeof created[key]==='string'&&value[key]===created[key]),'backup_completion_identity_conflict',409);if(binding)need(value.requestSha256===binding.requestSha256&&value.configurationSha256===binding.configurationSha256,'backup_completion_identity_conflict',409);return result}
  function observed(id,recorded=store.run(id),binding=null){
    // Exact bounded event paths, never a directory scan or a target read. These
    // preserve successful copy facts even if later local persistence failed.
    let persistence=null,completionError=false
    const readCompletion=sequence=>{try{return completionEvent(id,sequence,binding)}catch{completionError=true;return null}}
    for(const sequence of [9,8,7,6]){const candidate=readCompletion(sequence);if(candidate){if(!persistenceFailureCodes.has(candidate.value.failureCode)){completionError=true;continue}persistence??=candidate}}
    const completed=readCompletion(5);let final=null
    try{final=terminal(id)}catch{/* A failed canonical write does not invalidate a separate, bound completion event. */}
    const best=final&&final.value.state!=='completed'?final:final?(persistence??final):completionError?null:(persistence??completed)
    if(best){const value=best.value;return{record:{...recorded,backup_id:id,state:value.state,started_at_utc:value.startedAtUtc,finished_at_utc:value.finishedAtUtc,elapsed_ms:value.elapsedMs,coverage:value.coverage,verification_status:value.verificationStatus,restorability_status:value.restorabilityStatus,failure_code:value.failureCode??(!final&&completed?'backup_local_terminal_not_recorded':null)},terminal:value,sha256:best.sha256,terminalRecorded:final!==null}}
    return{record:recorded?{...recorded,recorded_state:recorded.state,state:'unknown',verification_status:'unknown'}:null,terminal:null,terminalRecorded:false,reasonCode:completionError?'backup_completion_evidence_unavailable':'backup_terminal_not_recorded'}
  }
  function project(value,entries=[]) {
    store.write(db=>{
      const exists=db.prepare('SELECT backup_id FROM backup_runs WHERE backup_id=?').get(value.backupId)
      const values=[value.state,value.startedAtUtc??null,value.finishedAtUtc??null,value.elapsedMs??null,value.coverage??'partial',value.verificationStatus??'unknown',value.restorabilityStatus??'unknown',value.failureCode??null]
      if(exists)db.prepare('UPDATE backup_runs SET state=?,started_at_utc=?,finished_at_utc=?,elapsed_ms=?,coverage=?,verification_status=?,restorability_status=?,failure_code=? WHERE backup_id=?').run(...values,value.backupId)
      else db.prepare('INSERT INTO backup_runs VALUES (?,?,?,?,?,?,?,?,?)').run(value.backupId,...values)
      for(const entry of entries)db.prepare('INSERT INTO backup_entries VALUES (?,?,?,?,?) ON CONFLICT(backup_id,root_id,relative_path) DO UPDATE SET byte_size=excluded.byte_size,capture_status=excluded.capture_status').run(value.backupId,entry.rootId,entry.relativePath,entry.snapshotBytes,entry.captureMode)
      db.exec('UPDATE module_meta SET revision=revision+1 WHERE id=1')
    })
  }
  function lock(backupId) {
    checkDirectory(moduleRoot);const file=path.join(moduleRoot,'backup-publish.lock')
    let fd;try{fd=fs.openSync(file,'wx',0o600)}catch{need(false,'backup_task_lock_present',409)}
    fs.writeFileSync(fd,JSON.stringify({backupId,processId:process.pid,createdAtUtc:new Date().toISOString()}));fs.fsyncSync(fd);const own=fs.fstatSync(fd)
    return()=>{fs.closeSync(fd);const current=fs.lstatSync(file,{throwIfNoEntry:false});need(current&&current.isFile()&&!current.isSymbolicLink()&&current.ino===own.ino&&current.dev===own.dev,'backup_lock_identity_changed',409);fs.unlinkSync(file)}
  }
  function begin(input,backupId,configurationSha256,startedAtUtc) {
    folder(runs);folder(directory(backupId));folder(path.join(directory(backupId),'events'))
    put(requestFile(input.idempotencyKey),{schemaVersion:'local_backup_request_v1',backupId,requestSha256:hash(input),configurationSha256,createdAtUtc:startedAtUtc})
  }
  function event(id,sequence,value){return put(path.join(directory(id),'events',`${String(sequence).padStart(4,'0')}.json`),value)}
  function writeTerminal(value) {need(terminalStates.has(value.state),'backup_terminal_invalid',409);return put(path.join(directory(value.backupId),'terminal.json'),value)}
  function finish(value,entries=[]) {const sha256=writeTerminal(value);project(value,entries);return sha256}
  function manifest(id,value,expected){const sha256=put(path.join(directory(id),'manifest.json'),value);need(sha256===expected,'backup_manifest_hash_conflict',409);return sha256}
  function metadataRevision(){return store.read((db,meta)=>meta.revision)}
  return{request,observed,terminal,lock,begin,event,finish,writeTerminal,manifest,project,metadataRevision,directory}
}
