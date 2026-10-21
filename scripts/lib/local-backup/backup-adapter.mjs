import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { DatabaseSync, backup } from 'node:sqlite'
import { performance } from 'node:perf_hooks'
import { setImmediate as yieldBatch } from 'node:timers/promises'
import { need, hash, ModuleError } from '../../../src/server/local-backup/contracts.mjs'
import { directoryIdentity, verifyDirectory, verifyPath, verifyInstallation, isProtectedPath, containsProtectedContent } from '../../../src/server/local-backup/backup-contract.mjs'

const signature=stat=>[stat.dev,stat.ino,stat.size,stat.mtimeMs,stat.ctimeMs,stat.nlink].join(':')
export async function executeBackup({configuration,backupId,moduleRoot,onStage,signal,hooks={},taskStartedAt=performance.now()}) {
  const config=configuration,limits=config.limits,start=taskStartedAt,stagingParent=path.join(moduleRoot,'staging'),staging=path.join(stagingParent,backupId)
  let totalBytes=0,protectedCount=0,targetRun=null,targetRunIdentity=null,stagingParentIdentity=null,stagingRunIdentity=null,filesDirectory=null,filesIdentity=null
  const sourceRoots=new Map(config.sources.map(source=>[source.rootId,source])),snapshots=[],seenSources=new Set(),gaps=new Set(config.coverageGaps)
  const guard=()=>{need(!signal?.aborted,'backup_interrupted',409);need(performance.now()-start<=limits.maxTaskMs,'backup_time_limit',409);for(const source of config.sources)verifyDirectory(source.path,source.identity);verifyInstallation(config);if(targetRun)verifyDirectory(targetRun,targetRunIdentity);if(stagingParentIdentity)verifyDirectory(stagingParent,stagingParentIdentity);if(stagingRunIdentity)verifyDirectory(staging,stagingRunIdentity);if(filesIdentity)verifyDirectory(filesDirectory,filesIdentity)}
  const space=(directory,additional)=>{const stat=fs.statfsSync(directory,{bigint:true});need(stat.bavail*stat.bsize>=BigInt(limits.minFreeBytes)+BigInt(additional),'backup_free_space_limit',409)}
  const newFolder=directory=>{fs.mkdirSync(directory,{mode:0o700});return directoryIdentity(directory)}
  function openOutput(file){guard();const fd=fs.openSync(file,'wx',0o600);need(fs.fstatSync(fd).nlink===1,'backup_file_boundary',409);return fd}
  async function digest(file,{checkContent=false,max=limits.maxFileBytes}={}) {
    guard();const initial=fs.lstatSync(file);need(initial.isFile()&&!initial.isSymbolicLink()&&initial.nlink===1&&initial.size<=max,'backup_file_boundary',409)
    const fd=fs.openSync(file,fs.constants.O_RDONLY|(fs.constants.O_NOFOLLOW??0)),digest=createHash('sha256'),buffer=Buffer.alloc(limits.chunkBytes);let bytes=0,tail=''
    try{need(signature(initial)===signature(fs.fstatSync(fd)),'backup_file_identity_changed',409);let count
      while((count=fs.readSync(fd,buffer,0,buffer.length,null))>0){guard();bytes+=count;need(bytes<=max,'backup_file_size_limit',409);digest.update(buffer.subarray(0,count));if(checkContent){const text=tail+buffer.subarray(0,count).toString('utf8');need(!containsProtectedContent(text),'backup_protected_content_not_connected',409);tail=text.slice(-2048)}await yieldBatch()}
      need(signature(initial)===signature(fs.fstatSync(fd))&&signature(initial)===signature(fs.lstatSync(file)),'backup_source_changed',409)
    }finally{fs.closeSync(fd)}
    return{sha256:digest.digest('hex'),bytes,signature:signature(initial)}
  }
  async function copy(input,output,{expectedSha256,sourceSignature,max,afterChunk}={}) {
    guard();const initial=fs.lstatSync(input);need(initial.isFile()&&!initial.isSymbolicLink()&&initial.nlink===1,'backup_file_boundary',409)
    if(sourceSignature)need(signature(initial)===sourceSignature,'backup_source_changed',409)
    const sourceFd=fs.openSync(input,fs.constants.O_RDONLY|(fs.constants.O_NOFOLLOW??0)),digest=createHash('sha256'),buffer=Buffer.alloc(limits.chunkBytes)
    let bytes=0,destinationFd
    try{destinationFd=openOutput(output);const destinationIdentity=fs.fstatSync(destinationFd);need(signature(initial)===signature(fs.fstatSync(sourceFd)),'backup_source_changed',409);let count
      while((count=fs.readSync(sourceFd,buffer,0,buffer.length,null))>0){guard();need(signature(initial)===signature(fs.fstatSync(sourceFd)),'backup_source_changed',409);bytes+=count;need(bytes<=(max??limits.maxFileBytes),'backup_file_size_limit',409);space(path.dirname(output),count);let offset=0;while(offset<count)offset+=fs.writeSync(destinationFd,buffer,offset,count-offset,null);digest.update(buffer.subarray(0,count));await afterChunk?.();await yieldBatch()}
      fs.fsyncSync(destinationFd)
      const final=fs.lstatSync(output);need(final.isFile()&&!final.isSymbolicLink()&&final.nlink===1&&final.ino===destinationIdentity.ino&&final.dev===destinationIdentity.dev,'backup_destination_changed',409)
      need(signature(initial)===signature(fs.fstatSync(sourceFd))&&signature(initial)===signature(fs.lstatSync(input)),'backup_source_changed',409)
    }finally{fs.closeSync(sourceFd);if(destinationFd!==undefined)fs.closeSync(destinationFd)}
    const sha256=digest.digest('hex');if(expectedSha256)need(sha256===expectedSha256,'backup_source_changed',409)
    return{sha256,bytes}
  }
  guard();space(moduleRoot,limits.maxTotalBytes);space(config.target.path,limits.maxTotalBytes)
  await onStage('preflight');await hooks.afterPreflight?.()
  if(!fs.existsSync(stagingParent))newFolder(stagingParent);stagingParentIdentity=directoryIdentity(stagingParent);stagingRunIdentity=newFolder(staging)
  const checkStaging=guard
  await onStage('copying')
  for(let index=0;index<config.entries.length;index++) {
    checkStaging();const entry=config.entries[index]
    if(entry.capture==='protected'||isProtectedPath(entry.relativePath)){protectedCount++;gaps.add('protected_configuration_not_connected');continue}
    const root=sourceRoots.get(entry.rootId),{file,stat}=verifyPath(root.path,entry.relativePath,root.identity)
    const physicalKey=[stat.dev,stat.ino].join(':');need(!seenSources.has(physicalKey),'backup_duplicate_physical_source',409);seenSources.add(physicalKey)
    need(stat.size<=limits.maxFileBytes,'backup_file_size_limit',409)
    const snapshot=path.join(staging,`${index}.snapshot`),observedAtUtc=new Date().toISOString();let sourceSha256=null,sourceHashStatus='stable_file'
    await hooks.beforeCapture?.(entry)
    if(entry.capture==='sqlite'){
      const placeholder=openOutput(snapshot);fs.closeSync(placeholder)
      const database=new DatabaseSync(file,{readOnly:true})
      try{const pageSize=database.prepare('PRAGMA page_size').get().page_size;need(pageSize*database.prepare('PRAGMA page_count').get().page_count<=limits.maxFileBytes,'backup_file_size_limit',409);await backup(database,snapshot,{rate:limits.sqlitePagesPerBatch,progress:({totalPages})=>{checkStaging();const size=Math.max(totalPages*pageSize,fs.statSync(snapshot).size);need(size<=limits.maxFileBytes&&totalBytes+size<=limits.maxTotalBytes,'backup_total_size_limit',409)}})}finally{database.close()}
      const current=verifyPath(root.path,entry.relativePath,root.identity).stat;need(current.dev===stat.dev&&current.ino===stat.ino,'backup_source_changed',409)
      const copied=new DatabaseSync(snapshot,{readOnly:true});try{need(copied.prepare('PRAGMA integrity_check').all().every(row=>row.integrity_check==='ok'),'backup_sqlite_integrity_failed',409)}finally{copied.close()}
      sourceHashStatus='active_sqlite_raw_hash_unavailable'
    }else{
      need(!/\.(?:sqlite|sqlite3|db)$|-(?:wal|shm|journal)$/i.test(entry.relativePath),'backup_sqlite_capture_required',409)
      const header=Buffer.alloc(16),headerFd=fs.openSync(file,fs.constants.O_RDONLY|(fs.constants.O_NOFOLLOW??0));try{fs.readSync(headerFd,header,0,16,0)}finally{fs.closeSync(headerFd)}
      need(header.toString('binary')!=='SQLite format 3\x00','backup_sqlite_capture_required',409)
      const before=await digest(file,{checkContent:true});need(before.signature===signature(stat),'backup_source_changed',409);sourceSha256=before.sha256
      await copy(file,snapshot,{expectedSha256:before.sha256,sourceSignature:before.signature,afterChunk:()=>hooks.duringCapture?.(entry)})
    }
    const captured=await digest(snapshot,{checkContent:true});need(totalBytes+captured.bytes<=limits.maxTotalBytes,'backup_total_size_limit',409);totalBytes+=captured.bytes
    const snapshotStat=fs.lstatSync(snapshot)
    snapshots.push({rootId:entry.rootId,relativePath:entry.relativePath,snapshotBytes:captured.bytes,snapshotSha256:captured.sha256,capturedAtUtc:new Date().toISOString(),snapshotIdentity:{dev:String(snapshotStat.dev),ino:String(snapshotStat.ino),mtimeMs:snapshotStat.mtimeMs},captureMode:entry.capture==='sqlite'?'sqlite_online_backup':'stable_file_copy',source:{dev:String(stat.dev),ino:String(stat.ino),sizeBytes:stat.size,mtimeMs:stat.mtimeMs,observedAtUtc,sha256:sourceSha256,hashStatus:sourceHashStatus},file:snapshot})
    await hooks.afterCapture?.(entry)
    if((index+1)%limits.batchFiles===0)await yieldBatch()
  }
  checkStaging();need(snapshots.length>0,'backup_no_eligible_entries',409)
  targetRun=path.join(config.target.path,backupId);need(!fs.lstatSync(targetRun,{throwIfNoEntry:false}),'backup_destination_exists',409);targetRunIdentity=newFolder(targetRun)
  filesDirectory=path.join(targetRun,'files');filesIdentity=newFolder(filesDirectory)
  for(let index=0;index<snapshots.length;index++){
    checkStaging();verifyDirectory(filesDirectory,filesIdentity);const snapshot=snapshots[index],destination=path.join(filesDirectory,`${index}.snapshot`)
    const stable=await digest(snapshot.file,{checkContent:true});need(stable.sha256===snapshot.snapshotSha256,'backup_staging_changed',409)
    await hooks.beforeTransfer?.(snapshot)
    await copy(snapshot.file,destination,{expectedSha256:snapshot.snapshotSha256,max:limits.maxFileBytes,afterChunk:()=>hooks.duringTransfer?.(snapshot)})
    snapshot.destination=destination;snapshot.targetRelativePath=`files/${index}.snapshot`
  }
  await onStage('verifying');await hooks.beforeVerify?.()
  for(const snapshot of snapshots){checkStaging();verifyDirectory(filesDirectory,filesIdentity);const verified=await digest(snapshot.destination);need(verified.sha256===snapshot.snapshotSha256&&verified.bytes===snapshot.snapshotBytes,'backup_destination_hash_conflict',409);const stat=fs.lstatSync(snapshot.destination);snapshot.verifiedAtUtc=new Date().toISOString();snapshot.targetIdentity={dev:String(stat.dev),ino:String(stat.ino),mtimeMs:stat.mtimeMs}}
  const entries=snapshots.map(snapshot=>Object.fromEntries(Object.entries(snapshot).filter(([key])=>!['file','destination'].includes(key))))
  const manifest={schemaVersion:'local_backup_manifest_v1',backupId,configurationId:config.configurationId,configurationSha256:hash(config),installationId:config.target.installationId,scopeId:config.scopeId,coverage:'partial',coverageGaps:[...gaps,'global_snapshot_consistency_unknown','independent_restore_not_verified'],protectedEntryCount:protectedCount,entries,fileCount:entries.length,totalBytes,verificationStatus:'verified',restorabilityStatus:'unknown',globalSnapshotConsistency:'unknown'}
  const bytes=Buffer.from(JSON.stringify(manifest));need(bytes.length<=limits.maxManifestBytes,'backup_manifest_limit',409);checkStaging()
  const manifestPath=path.join(targetRun,'manifest.json'),fd=openOutput(manifestPath);try{fs.writeFileSync(fd,bytes);fs.fsyncSync(fd)}finally{fs.closeSync(fd)}
  const verifiedManifest=await digest(manifestPath,{max:limits.maxManifestBytes});need(verifiedManifest.sha256===hash(bytes),'backup_manifest_hash_conflict',409)
  await hooks.beforeComplete?.();checkStaging();verifyDirectory(filesDirectory,filesIdentity)
  for(const snapshot of snapshots){const final=await digest(snapshot.destination);need(final.sha256===snapshot.snapshotSha256,'backup_destination_hash_conflict',409)}
  const finalManifest=await digest(manifestPath,{max:limits.maxManifestBytes});need(finalManifest.sha256===verifiedManifest.sha256,'backup_manifest_hash_conflict',409)
  // A hash-named, empty directory is the final exclusive marker: no partially
  // written success JSON and no rename-overwrite or hardlink publication step.
  const completionMarker=`completed-${verifiedManifest.sha256}`
  checkStaging();fs.mkdirSync(path.join(targetRun,completionMarker),{mode:0o700})
  return{manifest,manifestSha256:verifiedManifest.sha256,completionMarker}
}
export const backupFailureCode=error=>error instanceof ModuleError?error.message:'backup_transport_or_io_failure'
