import fs from 'node:fs'
import path from 'node:path'
import { DatabaseSync, backup } from 'node:sqlite'
import { performance } from 'node:perf_hooks'
import { need, hash, identity, ModuleError } from '../../../src/server/local-backup/contracts.mjs'
import { checkDirectory, safeFile } from '../../../src/server/local-backup/store.mjs'

// Private small-fixture adapter only. Not imported by the application or a production executor.
// Its explicit marker, size/count/time ceilings and fixed source/target children prohibit
// treating component acceptance as authorization to copy real project or SMB roots.
export async function copyPrivateSnapshot(fixtureRoot, backupId, hooks = {}) {
  identity(backupId); checkDirectory(fixtureRoot)
  const marker = path.join(fixtureRoot, '.local-backup-private-fixture')
  safeFile(marker, 64); need(fs.readFileSync(marker,'utf8') === 'private fixture only', 'fixture_marker_required')
  const source = path.join(fixtureRoot,'source'), target = path.join(fixtureRoot,'target')
  checkDirectory(source); checkDirectory(target)
  const output = path.join(target, backupId)
  need(!fs.existsSync(output), 'backup_destination_exists', 409)
  fs.mkdirSync(output)
  const startedAtUtc = new Date().toISOString(), start = performance.now()
  const files = [], skipped = []
  let bytes = 0
  const guard = () => need(performance.now()-start < 30000, 'fixture_time_limit', 409)
  try {
    const queue = [{directory:source,relative:''}]
    while(queue.length) {
      guard(); const {directory,relative} = queue.shift()
      checkDirectory(directory)
      for(const item of fs.readdirSync(directory,{withFileTypes:true})) {
        guard()
        const file = path.join(directory,item.name), rel = relative ? `${relative}/${item.name}` : item.name
        need(!/[:\0]/.test(item.name) && !['.','..'].includes(item.name), 'fixture_path_invalid')
        const before = fs.lstatSync(file)
        need(!before.isSymbolicLink(), 'fixture_link_refused', 409)
        if(before.isDirectory()) { need(queue.length < 128,'fixture_count_limit'); queue.push({directory:file,relative:rel}); continue }
        need(before.isFile() && before.nlink === 1, 'fixture_file_boundary', 409)
        need(!/^\.env(?:\.|$)|\.(?:key|pem|pfx|p12)$/i.test(item.name), 'protected_configuration_not_connected', 409)
        if(/-(?:wal|shm|journal)$/i.test(item.name)) {
          const dbFile=file.replace(/-(?:wal|shm|journal)$/i,'')
          need(fs.existsSync(dbFile) && /\.(?:db|sqlite|sqlite3)$/i.test(dbFile),'sqlite_group_unresolved',409)
          skipped.push({relativePath:rel,reason:'captured_through_online_database_snapshot'}); continue
        }
        need(files.length < 128 && before.size <= 8*1024*1024 && bytes+before.size <= 8*1024*1024,'fixture_byte_or_count_limit',409)
        const destination = path.join(output,'files',...rel.split('/'))
        fs.mkdirSync(path.dirname(destination),{recursive:true})
        fs.writeFileSync(destination,'',{flag:'wx'})
        hooks.beforeCopy?.(rel)
        let captureMode = 'stable_file_copy'
        if(/\.(?:db|sqlite|sqlite3)$/i.test(item.name)) {
          captureMode='sqlite_online_backup'
          const db = new DatabaseSync(file,{readOnly:true})
          try { await backup(db,destination) } finally { db.close() }
          const copy = new DatabaseSync(destination,{readOnly:true})
          try { need(copy.prepare('PRAGMA integrity_check').get().integrity_check === 'ok','sqlite_snapshot_invalid',409) } finally { copy.close() }
        } else {
          const data=fs.readFileSync(file)
          hooks.afterRead?.(rel)
          const after=fs.lstatSync(file)
          need(!after.isSymbolicLink() && after.nlink===1 && before.dev===after.dev && before.ino===after.ino && before.size===after.size && before.mtimeMs===after.mtimeMs && before.ctimeMs===after.ctimeMs && data.length===before.size,'source_changed_during_capture',409)
          need(hash(fs.readFileSync(file))===hash(data),'source_changed_during_capture',409)
          fs.writeFileSync(destination,data,{flag:'r+'})
        }
        const expectedSnapshotSha=hash(fs.readFileSync(destination))
        hooks.beforeVerify?.(rel)
        safeFile(destination,8*1024*1024)
        const captured=fs.readFileSync(destination)
        need(bytes+captured.length<=8*1024*1024,'fixture_byte_or_count_limit',409)
        const sha=hash(captured)
        need(sha===expectedSnapshotSha,'destination_hash_conflict',409)
        hooks.afterVerify?.(rel)
        need(hash(fs.readFileSync(destination))===sha,'destination_hash_conflict',409)
        bytes+=captured.length
        files.push({relativePath:rel,sizeBytes:captured.length,sha256:sha,captureMode})
      }
    }
    guard()
    const manifest={schemaVersion:'local_backup_fixture_manifest_v1',backupId,scope:'private_fixture_only',startedAtUtc,entries:files,sidecarObservations:skipped,fileCount:files.length,totalBytes:bytes,coverage:'declared_fixture_scope',verificationStatus:'verified',restorabilityStatus:'unknown',globalSnapshotConsistency:'unknown',productionBackup:false}
    const manifestBytes=JSON.stringify(manifest)
    fs.writeFileSync(path.join(output,'manifest.json'),manifestBytes,{flag:'wx'})
    need(hash(fs.readFileSync(path.join(output,'manifest.json')))===hash(manifestBytes),'manifest_hash_conflict',409)
    hooks.beforeCommit?.()
    fs.writeFileSync(path.join(output,'completed.json'),JSON.stringify({backupId,manifestSha256:hash(manifestBytes),finishedAtUtc:new Date().toISOString(),elapsedMs:performance.now()-start}),{flag:'wx'})
    return manifest
  } catch(error) {
    const code=error instanceof ModuleError ? error.message : 'fixture_transport_or_io_failure'
    try { fs.writeFileSync(path.join(output,'failed.json'),JSON.stringify({backupId,failureCode:code,startedAtUtc,finishedAtUtc:new Date().toISOString()}),{flag:'wx'}) } catch {}
    throw new ModuleError(code,409)
  }
}
