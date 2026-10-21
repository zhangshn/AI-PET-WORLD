import fs from 'node:fs'
import path from 'node:path'
import { hash, need, ModuleError } from './contracts.mjs'
import { checkDirectory, safeFile } from './store.mjs'

export function createGitStore(root) {
  const fileFor = (kind,id) => {
    need(['previews','operations'].includes(kind) && /^[a-f0-9]{64}$/.test(id),'git_identity_invalid')
    return path.join(root,kind,`${id}.json`)
  }
  function prepare() {
    checkDirectory(path.dirname(root))
    if(!fs.existsSync(root))fs.mkdirSync(root)
    checkDirectory(root)
    for(const kind of ['previews','operations']) {
      const dir=path.join(root,kind);if(!fs.existsSync(dir))fs.mkdirSync(dir);checkDirectory(dir)
    }
  }
  function read(kind,id) {
    const file=fileFor(kind,id)
    if(!fs.existsSync(root))throw new ModuleError('git_store_not_initialized',503)
    checkDirectory(root);checkDirectory(path.dirname(file))
    if(!fs.existsSync(file))return null
    safeFile(file,128*1024)
    const envelope=JSON.parse(fs.readFileSync(file,'utf8'))
    need(envelope.sha256===hash(envelope.value),'git_record_integrity_conflict',409)
    return envelope.value
  }
  function put(kind,id,value,replace=false) {
    prepare();const file=fileFor(kind,id),bytes=JSON.stringify({value,sha256:hash(value)})
    need(Buffer.byteLength(bytes)<=128*1024,'git_record_limit',409)
    if(!replace){fs.writeFileSync(file,bytes,{flag:'wx'});return}
    safeFile(file,128*1024)
    const temporary=`${file}.next`;fs.writeFileSync(temporary,bytes,{flag:'wx'})
    fs.renameSync(temporary,file)
  }
  function lock() {
    prepare();const file=path.join(root,'publish.lock')
    let fd
    try{fd=fs.openSync(file,'wx')}catch{throw new ModuleError('git_operation_lock_present',409)}
    fs.writeFileSync(fd,JSON.stringify({processId:process.pid,at:new Date().toISOString()}))
    const identity=fs.fstatSync(fd)
    return()=>{
      fs.closeSync(fd)
      const current=fs.lstatSync(file)
      need(!current.isSymbolicLink()&&current.ino===identity.ino&&current.dev===identity.dev,'git_operation_lock_changed',409)
      fs.unlinkSync(file) // only the exact lock created by this invocation; never stale-lock cleanup
    }
  }
  return {prepare,read,put,lock}
}
