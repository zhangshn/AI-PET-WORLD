import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { performance } from 'node:perf_hooks'
import { hash, need, ModuleError } from './contracts.mjs'
import { parseBackupRequest, validateBackupConfiguration, directoryIdentity, verifyDirectory } from './backup-contract.mjs'
import { createBackupStorage } from './backup-storage.mjs'
import { executeBackup, backupFailureCode } from '../../../scripts/lib/local-backup/backup-adapter.mjs'

export function createBackupService({moduleRoot,store,configuration,privateFixtureRoot=null,hooks={}}) {
  need(!Object.keys(hooks).length||privateFixtureRoot!==null,'backup_test_hooks_not_allowed',409)
  if(privateFixtureRoot){
    directoryIdentity(privateFixtureRoot);need(fs.readFileSync(path.join(privateFixtureRoot,'.local-backup-adapter-private-fixture'),'utf8')==='private adapter fixture only','backup_private_fixture_required',409)
    for(const [directory,name]of [[moduleRoot,'module'],[configuration?.target.path,'target'],[configuration?.sources[0]?.path,'source']])need(directory&&path.resolve(directory).toLowerCase()===path.join(privateFixtureRoot,name).toLowerCase(),'backup_private_fixture_boundary',409)
    need(configuration.sources.length===1,'backup_private_fixture_boundary',409)
  }
  const storage=createBackupStorage(moduleRoot,store)
  async function run(raw,{signal}={}) {
    const input=parseBackupRequest(raw),existing=storage.request(input)
    if(existing)return{dataStatus:'partial',replayed:true,backupId:existing.backupId,...storage.observed(existing.backupId,undefined,existing)}
    if(!configuration)throw new ModuleError('production_backup_adapter_not_connected',503)
    validateBackupConfiguration(configuration)
    const configurationSha256=hash(configuration),backupId='backup-'+randomUUID(),unlock=storage.lock(backupId),startedAtUtc=new Date().toISOString(),started=performance.now()
    let begun=false,sequence=0,result,manifest
    const base={schemaVersion:'local_backup_run_terminal_v1',backupId,scopeId:input.scopeId,requestSha256:hash(input),configurationId:configuration.configurationId,configurationSha256,startedAtUtc,coverage:'partial',verificationStatus:'unknown',restorabilityStatus:'unknown',globalSnapshotConsistency:'unknown'}
    const stage=async state=>{const value={...base,state,observedAtUtc:new Date().toISOString()};storage.event(backupId,++sequence,value);storage.project(value);await hooks.onStage?.(state)}
    try{
      const repeated=storage.request(input);if(repeated)return{dataStatus:'partial',replayed:true,backupId:repeated.backupId,...storage.observed(repeated.backupId,undefined,repeated)}
      need(storage.metadataRevision()===input.expectedModuleRevision,'backup_module_revision_conflict',409)
      storage.begin(input,backupId,configurationSha256,startedAtUtc);begun=true;await stage('created')
      const moduleIdentity=directoryIdentity(moduleRoot)
      const copied=await executeBackup({configuration,backupId,moduleRoot,signal,hooks,taskStartedAt:started,onStage:async state=>{verifyDirectory(moduleRoot,moduleIdentity);await stage(state)}})
      manifest=copied.manifest
      result={...base,state:'completed',finishedAtUtc:new Date().toISOString(),elapsedMs:performance.now()-started,verificationStatus:'verified',manifestSha256:copied.manifestSha256,completionMarker:copied.completionMarker,fileCount:manifest.fileCount,totalBytes:manifest.totalBytes,coverageGaps:manifest.coverageGaps,failureCode:null}
      // Adapter success is a copy fact, independent of every later local write.
      // Each persistence step is attempted once. No catch retries a terminal or
      // re-enters the adapter, and existing terminal bytes are never overwritten.
      const persistenceFailure=code=>{result={...result,failureCode:result.failureCode??code};try{storage.event(backupId,++sequence,{...result,failureCode:code})}catch{/* Keep prior immutable facts; never retry a failed evidence write. */}}
      try{storage.event(backupId,++sequence,result)}catch{persistenceFailure('backup_local_completion_record_persistence_failed')}
      try{storage.manifest(backupId,manifest,copied.manifestSha256)}catch{persistenceFailure('backup_local_manifest_persistence_failed')}
      try{storage.writeTerminal(result)}catch{persistenceFailure('backup_local_terminal_persistence_failed')}
      try{storage.project(result,manifest.entries)}catch{persistenceFailure('backup_local_projection_persistence_failed')}
    }catch(error){
      if(!begun)throw error
      const recorded=storage.terminal(backupId)
      if(recorded){result=recorded.value}
      else{const failureCode=backupFailureCode(error);result={...base,state:failureCode==='backup_interrupted'?'interrupted':'failed',finishedAtUtc:new Date().toISOString(),elapsedMs:performance.now()-started,failureCode,coverageGaps:[...configuration.coverageGaps,'backup_scope_incomplete']};try{storage.finish(result)}catch{/* Keep request, events and any actual terminal; never redo copying. */}}
    }finally{unlock()}
    return{dataStatus:'partial',replayed:false,backupId,...storage.observed(backupId)}
  }
  return{run,observed:storage.observed,terminalBinding(backupId){const terminal=storage.terminal(backupId);return terminal?{backupId,sha256:terminal.sha256}:null}}
}
export async function runBackupAndRecord(service,input,recordBackupRun,options={}) {
  const result=await service.run(input,options);let workRecording
  try{const binding=service.terminalBinding(result.backupId);workRecording=binding?await recordBackupRun(binding):{recorded:false,reasonCode:'backup_terminal_not_recorded'}}catch{workRecording={recorded:false,reasonCode:'backup_work_recording_unavailable'}}
  return{...result,workRecording}
}
