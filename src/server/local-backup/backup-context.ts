import fs from 'node:fs'
import path from 'node:path'
import { store } from './service'
import { fields, hash, need } from './contracts.mjs'
import { safeFile, checkDirectory } from './store.mjs'
import { validateBackupConfiguration, parseBackupRequest } from './backup-contract.mjs'
import { createBackupService, runBackupAndRecord } from './backup-service.mjs'
import { createBackupStorage } from './backup-storage.mjs'
import { recordBackupRun } from './work-producers.mjs'

// Installation is a local program artifact, never a browser path/boolean override.
// This build does not create installation/configuration files or access the share.
const targetUnc='\\\\192.168.1.246\\DataStorage\\AI-PET-WORLD-LOCAL-BACKUP'
const moduleRoot=()=>path.join(fs.realpathSync.native(path.join(process.cwd(),'.runtime')),'local-backup')
export function productionBackup() {
  const currentStore=store(),root=moduleRoot(),file=path.join(root,'backup-installation.json')
  let configuration=null
  if(fs.existsSync(file)){
    checkDirectory(root);safeFile(file,256*1024)
    const installed=JSON.parse(fs.readFileSync(file,'utf8'))
    fields(installed,['schemaVersion','inventorySha256','configurationSha256','configuration'])
    need(installed.schemaVersion==='local_backup_installation_v1','backup_installation_configuration_invalid',503)
    const inventory=currentStore.inventory()
    need(installed.inventorySha256===inventory.inventorySha256&&installed.configurationSha256===hash(installed.configuration),'backup_installation_configuration_conflict',503)
    configuration=validateBackupConfiguration(installed.configuration)
    need(process.platform==='win32'&&configuration.target.path.toLowerCase()===targetUnc.toLowerCase(),'backup_fixed_unc_conflict',503)
    for(const source of configuration.sources){const registered=inventory.roots.find((entry:{sourceRootId:string;physicalRoot:string})=>entry.sourceRootId===source.rootId);need(registered&&path.resolve(source.path).toLowerCase()===path.resolve(registered.physicalRoot).toLowerCase(),'backup_source_registration_conflict',503)}
    need(configuration.coverageGaps.includes('inventory_coverage_partial')&&configuration.coverageGaps.includes('protected_configuration_not_connected'),'backup_coverage_qualification_missing',503)
  }
  const service=createBackupService({moduleRoot:root,store:currentStore,configuration})
  return{run:(input:unknown,options:{signal?:AbortSignal}={})=>runBackupAndRecord(service,parseBackupRequest(input),recordBackupRun,options)}
}
export function projectBackupRecord(currentStore:ReturnType<typeof store>,record:Record<string,unknown>|null,id?:string) {
  const backupId=id??String(record?.backup_id??'')
  if(!/^backup-[a-f0-9-]{36}$/.test(backupId)||record&&['failed','interrupted'].includes(String(record.state)))return record
  return createBackupStorage(moduleRoot(),currentStore).observed(backupId,record).record
}
