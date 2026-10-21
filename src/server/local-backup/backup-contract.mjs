import fs from 'node:fs'
import path from 'node:path'
import { fields, identity, need, hash } from './contracts.mjs'

export const backupScope='project-associated-roots-v1'
export const isProtectedPath=value=>/(?:^|\/)(?:\.env(?:\.[^/]*)?|credentials(?:\.[^/]*)?|cookies?(?:\.[^/]*)?|secrets?(?:\.[^/]*)?)$|\.(?:pem|key|pfx|p12)$/i.test(value)||/(?:^|\/)\.git\/(?:config|credentials)$/i.test(value)
export const containsProtectedContent=value=>/-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----|(?:gh[pousr]_|github_pat_|sk-proj-)[a-zA-Z0-9_]{16,}|(?:password|secret|api[_-]?key|access[_-]?token|csrf[_-]?token|cookie)\s*["']?\s*[:=]\s*["'][^"'\s]{12,}["']/i.test(value)
export function parseBackupRequest(input) {
  fields(input,['scopeId','idempotencyKey','expectedModuleRevision']);identity(input.idempotencyKey)
  need(input.scopeId===backupScope,'invalid_scope')
  need(Number.isSafeInteger(input.expectedModuleRevision)&&input.expectedModuleRevision>=0,'invalid_revision')
  return{scopeId:input.scopeId,idempotencyKey:input.idempotencyKey,expectedModuleRevision:input.expectedModuleRevision}
}
export function directoryIdentity(directory) {
  const stat=fs.lstatSync(directory,{bigint:true}),realPath=fs.realpathSync.native(directory)
  need(stat.isDirectory()&&!stat.isSymbolicLink()&&stat.ino>0n&&path.resolve(realPath).toLowerCase()===path.resolve(directory).toLowerCase(),'backup_directory_boundary',409)
  return{realPath,dev:String(stat.dev),ino:String(stat.ino)}
}
export function verifyDirectory(directory,expected) {need(expected&&hash(directoryIdentity(directory))===hash(expected),'backup_directory_identity_changed',409)}
export function safeRelative(value) {
  need(typeof value==='string'&&value.length>0&&value.length<=512&&!/[\\:<>"|?*\x00-\x1f\x7f]/.test(value)&&!value.startsWith('/')&&value.split('/').every(part=>part&&part!=='.'&&part!=='..'&&part===part.trim()&&!/[ .]$/.test(part)&&!/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part)),'backup_path_invalid',409)
  return value
}
export function verifyPath(root,relative,expectedRoot) {
  verifyDirectory(root,expectedRoot);safeRelative(relative)
  let current=root
  for(const part of relative.split('/').slice(0,-1)) {current=path.join(current,part);directoryIdentity(current)}
  const file=path.join(root,...relative.split('/')),stat=fs.lstatSync(file)
  need(stat.isFile()&&!stat.isSymbolicLink()&&stat.nlink===1,'backup_file_boundary',409)
  return{file,stat}
}
export function validateBackupConfiguration(config) {
  fields(config,['schemaVersion','configurationId','scopeId','sources','entries','target','limits','coverageGaps'])
  need(config.schemaVersion==='local_backup_execution_configuration_v1'&&config.scopeId===backupScope,'backup_configuration_invalid',503);identity(config.configurationId)
  need(Array.isArray(config.sources)&&config.sources.length>0&&config.sources.length<=8,'backup_sources_invalid',503)
  for(const source of config.sources){fields(source,['rootId','path','identity']);identity(source.rootId);need(path.isAbsolute(source.path),'backup_source_root_invalid',503)}
  need(new Set(config.sources.map(source=>source.rootId)).size===config.sources.length,'backup_sources_invalid',503)
  fields(config.target,['path','identity','installationId','installationSha256']);identity(config.target.installationId)
  need(path.isAbsolute(config.target.path)&&/^[a-f0-9]{64}$/.test(config.target.installationSha256),'backup_target_invalid',503)
  const limits=config.limits
  fields(limits,['concurrency','maxEntries','batchFiles','chunkBytes','sqlitePagesPerBatch','maxFileBytes','maxTotalBytes','maxManifestBytes','maxTaskMs','minFreeBytes'])
  const bounds={maxEntries:512,batchFiles:32,chunkBytes:1024*1024,sqlitePagesPerBatch:256,maxFileBytes:64*1024*1024,maxTotalBytes:256*1024*1024,maxManifestBytes:1024*1024,maxTaskMs:30000,minFreeBytes:Number.MAX_SAFE_INTEGER}
  need(limits.concurrency===1,'backup_concurrency_unsupported',503)
  for(const [key,max]of Object.entries(bounds))need(Number.isSafeInteger(limits[key])&&limits[key]>0&&limits[key]<=max,'backup_limits_invalid',503)
  need(limits.batchFiles<=limits.maxEntries&&limits.maxFileBytes<=limits.maxTotalBytes,'backup_limits_invalid',503)
  need(Array.isArray(config.entries)&&config.entries.length>0&&config.entries.length<=limits.maxEntries,'backup_entries_invalid',503)
  const keys=new Set()
  for(const entry of config.entries){fields(entry,['rootId','relativePath','capture']);need(config.sources.some(source=>source.rootId===entry.rootId),'backup_source_unregistered',503);safeRelative(entry.relativePath);need(['file','sqlite','protected'].includes(entry.capture),'backup_capture_unsupported',503);const key=JSON.stringify([entry.rootId,entry.relativePath]);need(!keys.has(key),'backup_duplicate_entry',503);keys.add(key)}
  need(Array.isArray(config.coverageGaps)&&config.coverageGaps.length<=32&&config.coverageGaps.every(gap=>typeof gap==='string'&&/^[a-z0-9_]{1,100}$/.test(gap)),'backup_coverage_invalid',503)
  const outside=relative=>relative==='..'||relative.startsWith('..'+path.sep)||path.isAbsolute(relative)
  for(const source of config.sources){const relative=path.relative(source.path,config.target.path);need(relative!==''&&outside(relative),'backup_target_inside_source',503);const reverse=path.relative(config.target.path,source.path);need(reverse!==''&&outside(reverse),'backup_source_inside_target',503)}
  return config
}
export function verifyInstallation(config) {
  verifyDirectory(config.target.path,config.target.identity)
  const marker=path.join(config.target.path,'.ai-pet-world-backup-installation.json'),stat=fs.lstatSync(marker)
  need(stat.isFile()&&!stat.isSymbolicLink()&&stat.nlink===1&&stat.size<=4096,'backup_installation_boundary',409)
  const bytes=fs.readFileSync(marker);need(hash(bytes)===config.target.installationSha256,'backup_installation_identity_changed',409)
  const value=JSON.parse(bytes.toString('utf8'))
  fields(value,['schemaVersion','installationId','scopeId'])
  need(value.schemaVersion==='local_backup_target_installation_v1'&&value.installationId===config.target.installationId&&value.scopeId===config.scopeId,'backup_installation_identity_changed',409)
}
