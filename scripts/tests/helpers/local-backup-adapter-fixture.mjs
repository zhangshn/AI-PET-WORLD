import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { hash } from '../../../src/server/local-backup/contracts.mjs'
import { initializeStore, createStore } from '../../../src/server/local-backup/store.mjs'
import { directoryIdentity, backupScope } from '../../../src/server/local-backup/backup-contract.mjs'
import { createBackupService } from '../../../src/server/local-backup/backup-service.mjs'

export function backupFixture({hooks={},entries=[{rootId:'fixture',relativePath:'one.txt',capture:'file'}],contents={'one.txt':'private fixture public content\n'},limits={}}={}) {
  const root=fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(),'backup-003-'))),source=path.join(root,'source'),target=path.join(root,'target'),moduleRoot=path.join(root,'module')
  fs.mkdirSync(source);fs.mkdirSync(target);fs.writeFileSync(path.join(root,'.local-backup-adapter-private-fixture'),'private adapter fixture only',{flag:'wx'})
  initializeStore(moduleRoot,{schemaVersion:'local_backup_inventory_v1',coverageComplete:false,totalBytes:null,totalFiles:null})
  for(const [relative,bytes]of Object.entries(contents)){const file=path.join(source,...relative.split('/'));fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,bytes)}
  const installation={schemaVersion:'local_backup_target_installation_v1',installationId:'private-target-v1',scopeId:backupScope},marker=Buffer.from(JSON.stringify(installation))
  fs.writeFileSync(path.join(target,'.ai-pet-world-backup-installation.json'),marker,{flag:'wx'})
  const configuration={schemaVersion:'local_backup_execution_configuration_v1',configurationId:'private-small-scope-v1',scopeId:backupScope,sources:[{rootId:'fixture',path:source,identity:directoryIdentity(source)}],entries,target:{path:target,identity:directoryIdentity(target),installationId:installation.installationId,installationSha256:hash(marker)},limits:{concurrency:1,maxEntries:32,batchFiles:4,chunkBytes:4096,sqlitePagesPerBatch:1,maxFileBytes:1024*1024,maxTotalBytes:4*1024*1024,maxManifestBytes:65536,maxTaskMs:10000,minFreeBytes:1024,...limits},coverageGaps:['inventory_coverage_partial','protected_configuration_not_connected']}
  const store=createStore(moduleRoot),make=(nextHooks=hooks)=>createBackupService({moduleRoot,store,configuration,privateFixtureRoot:root,hooks:nextHooks}),service=make()
  return{root,source,target,moduleRoot,configuration,store,service,make,input:(idempotencyKey='fixture-request')=>({scopeId:backupScope,idempotencyKey,expectedModuleRevision:store.inventory().moduleRevision})}
}
export function targetRuns(fixture){return fs.readdirSync(fixture.target).filter(name=>name.startsWith('backup-'))}
export function completeMarkers(directory){return fs.existsSync(directory)?fs.readdirSync(directory).filter(name=>name.startsWith('completed-')):[]}
export function fileHashes(directory){const result=[];function visit(dir,prefix=''){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const absolute=path.join(dir,entry.name),relative=prefix+entry.name;if(entry.isDirectory())visit(absolute,relative+'/');else if(entry.isFile())result.push([relative,hash(fs.readFileSync(absolute))]);else result.push([relative,'link'])}}visit(directory);return result}
