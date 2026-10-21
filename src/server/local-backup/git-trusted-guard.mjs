import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { hash, need } from './contracts.mjs'
import { safeFile, checkDirectory } from './store.mjs'

const root=path.resolve(process.cwd())
const caller=path.join(root,'scripts/lib/local-backup/git-pre-push')
const validator=path.join(root,'scripts/lib/local-backup/git-pre-push.mjs')
function source(file) {
  safeFile(file,65536)
  let directory=path.dirname(file)
  while(path.relative(root,directory)!==''){checkDirectory(directory);directory=path.dirname(directory)}
  return fs.readFileSync(file)
}
export function guardClosure() {
  const executablePath=fs.realpathSync.native(process.execPath)
  const before=safeFile(executablePath,256*1024*1024),digest=createHash('sha256'),fd=fs.openSync(executablePath,'r'),buffer=Buffer.alloc(1024*1024)
  try{let count;while((count=fs.readSync(fd,buffer,0,buffer.length,null))>0)digest.update(buffer.subarray(0,count))}finally{fs.closeSync(fd)}
  const after=safeFile(executablePath,256*1024*1024)
  need(before.ino===after.ino&&before.size===after.size&&before.mtimeMs===after.mtimeMs&&before.ctimeMs===after.ctimeMs,'git_guard_node_changed',409)
  return{callerPath:caller,callerSha256:hash(source(caller)),validatorPath:validator,validatorSha256:hash(source(validator)),interpreterPath:executablePath,interpreterSha256:digest.digest('hex')}
}
export function prepareGuard(stateRoot,expected,commit,branch,publication={}) {
  need(hash(guardClosure())===hash(expected),'git_guard_source_changed',409)
  checkDirectory(stateRoot)
  const hooks=path.join(stateRoot,'hooks');if(!fs.existsSync(hooks))fs.mkdirSync(hooks);checkDirectory(hooks)
  const directory=path.join(hooks,hash(expected));if(!fs.existsSync(directory))fs.mkdirSync(directory);checkDirectory(directory)
  const contents=[['pre-push',source(caller),expected.callerSha256],['validator.mjs',source(validator),expected.validatorSha256]]
  for(const [name,bytes,sha]of contents){const file=path.join(directory,name);if(!fs.existsSync(file))fs.writeFileSync(file,bytes,{flag:'wx',mode:0o700});safeFile(file,65536);need(hash(fs.readFileSync(file))===sha,'git_guard_copy_changed',409)}
  const executable=fs.lstatSync(expected.interpreterPath)
  need(executable.isFile()&&!executable.isSymbolicLink(),'git_guard_node_boundary',409)
  return{directory,environment:{AI_PET_WORLD_GIT_GUARD_NODE:expected.interpreterPath,AI_PET_WORLD_GIT_GUARD_SCRIPT:path.join(directory,'validator.mjs'),AI_PET_WORLD_GIT_GUARD_COMMIT:commit,AI_PET_WORLD_GIT_GUARD_REF:`refs/heads/${branch}`,AI_PET_WORLD_GIT_GUARD_ROOT:publication.root??'',AI_PET_WORLD_GIT_GUARD_TARGET:publication.targetUrl??'',AI_PET_WORLD_GIT_GUARD_DIRECTORY:directory},closure:expected}
}
