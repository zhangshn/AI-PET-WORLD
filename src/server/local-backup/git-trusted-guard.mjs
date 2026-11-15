import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { hash, need } from './contracts.mjs'
import { checkDirectory } from './store.mjs'

const root=path.resolve(process.cwd())
const caller=path.join(root,'scripts/lib/local-backup/git-pre-push')
const validator=path.join(root,'scripts/lib/local-backup/git-pre-push.mjs')
// Bind the pathname and opened descriptor to the same exact file version.
// The limits are the existing script/interpreter limits, not caller input.
function readGuardFile(file,maxBytes,changedCode,retainBytes=false) {
  const signature=s=>[s.dev,s.ino,s.size,s.mtimeNs,s.ctimeNs,s.nlink].join(':')
  const before=fs.lstatSync(file,{bigint:true})
  need(before.isFile()&&!before.isSymbolicLink()&&before.nlink===1n&&before.size<=maxBytes,'store_file_boundary',409)
  const expected=signature(before),size=Number(before.size)
  const buffer=Buffer.alloc(Math.min(1024*1024,Math.max(size,1))),digest=createHash('sha256'),parts=[]
  const fd=fs.openSync(file,'r'),errors=[]
  try {
    need(signature(fs.fstatSync(fd,{bigint:true}))===expected,changedCode,409)
    let used=0
    while(used<size) {
      const count=fs.readSync(fd,buffer,0,Math.min(buffer.length,size-used),used)
      need(Number.isInteger(count)&&count>0&&count<=Math.min(buffer.length,size-used),changedCode,409)
      digest.update(buffer.subarray(0,count))
      if(retainBytes)parts.push(Buffer.from(buffer.subarray(0,count)))
      used+=count
    }
    const after=fs.lstatSync(file,{bigint:true})
    need(after.isFile()&&!after.isSymbolicLink()&&signature(after)===expected&&signature(fs.fstatSync(fd,{bigint:true}))===expected,changedCode,409)
  } catch(error) { errors.push(error) }
  finally { try{fs.closeSync(fd)}catch(error){errors.push(error)} }
  if(errors.length===1)throw errors[0]
  if(errors.length>1)throw new AggregateError(errors,`Git guard read and close failed: ${errors.map(error=>error instanceof Error?error.message:String(error)).join('; ')}`,{cause:errors[0]})
  return {sha256:digest.digest('hex'),bytes:retainBytes?Buffer.concat(parts):null}
}
function source(file) {
  let directory=path.dirname(file)
  while(path.relative(root,directory)!==''){checkDirectory(directory);directory=path.dirname(directory)}
  return readGuardFile(file,65536,'git_guard_source_changed',true).bytes
}
export function guardClosure() {
  const executablePath=fs.realpathSync.native(process.execPath)
  const executable=readGuardFile(executablePath,256*1024*1024,'git_guard_node_changed')
  return{callerPath:caller,callerSha256:hash(source(caller)),validatorPath:validator,validatorSha256:hash(source(validator)),interpreterPath:executablePath,interpreterSha256:executable.sha256}
}
export function prepareGuard(stateRoot,expected,commit,branch,publication={}) {
  need(hash(guardClosure())===hash(expected),'git_guard_source_changed',409)
  checkDirectory(stateRoot)
  const hooks=path.join(stateRoot,'hooks');if(!fs.existsSync(hooks))fs.mkdirSync(hooks);checkDirectory(hooks)
  const directory=path.join(hooks,hash(expected));if(!fs.existsSync(directory))fs.mkdirSync(directory);checkDirectory(directory)
  const contents=[['pre-push',source(caller),expected.callerSha256],['validator.mjs',source(validator),expected.validatorSha256]]
  for(const [name,bytes,sha]of contents){const file=path.join(directory,name);if(!fs.existsSync(file))fs.writeFileSync(file,bytes,{flag:'wx',mode:0o700});need(readGuardFile(file,65536,'git_guard_copy_changed').sha256===sha,'git_guard_copy_changed',409)}
  const executable=fs.lstatSync(expected.interpreterPath)
  need(executable.isFile()&&!executable.isSymbolicLink(),'git_guard_node_boundary',409)
  return{directory,environment:{AI_PET_WORLD_GIT_GUARD_NODE:expected.interpreterPath,AI_PET_WORLD_GIT_GUARD_SCRIPT:path.join(directory,'validator.mjs'),AI_PET_WORLD_GIT_GUARD_COMMIT:commit,AI_PET_WORLD_GIT_GUARD_REF:`refs/heads/${branch}`,AI_PET_WORLD_GIT_GUARD_ROOT:publication.root??'',AI_PET_WORLD_GIT_GUARD_TARGET:publication.targetUrl??'',AI_PET_WORLD_GIT_GUARD_DIRECTORY:directory},closure:expected}
}
