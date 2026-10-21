import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'
import { spawnSync } from 'node:child_process'

// Called inside the actual native pre-push, after Git has selected its transport.
// Reads only; a newly configured user hook is refused, never invoked or disabled.
export function verifyPushBoundary(args,context,environment=process.env) {
  try {
    const {root,targetUrl,directory}=context
    if(args.length!==2||!root||!directory||typeof targetUrl!=='string'||targetUrl.length===0||targetUrl.length>4096)return 'guard_target_context_invalid'
    if(args[0]!==targetUrl||args[1]!==targetUrl)return 'guard_actual_target_conflict'
    const real=value=>fs.realpathSync.native(value),samePath=(a,b)=>real(a).toLowerCase()===real(b).toLowerCase()
    if(!samePath(process.cwd(),root)||!samePath(path.dirname(fileURLToPath(import.meta.url)),directory))return 'guard_repository_context_conflict'
    const started=Date.now()
    function read(args,missing=false) {
      const remaining=4000-(Date.now()-started);if(remaining<=0)throw Error('budget')
      const result=spawnSync('git',['--no-optional-locks','--literal-pathspecs',...args],{cwd:root,encoding:'utf8',windowsHide:true,env:environment,timeout:Math.min(1200,remaining),maxBuffer:16384})
      if(result.error||!(result.status===0||missing&&result.status===1))throw Error('read')
      return result.status===1?[]:result.stdout.replace(/\n$/,'').split('\n')
    }
    const gitRoot=path.join(root,'.git'),actualGit=read(['rev-parse','--absolute-git-dir'])
    const gitStat=fs.lstatSync(gitRoot)
    if(!gitStat.isDirectory()||gitStat.isSymbolicLink())return 'guard_repository_context_conflict'
    if(actualGit.length!==1||!samePath(actualGit[0],gitRoot))return 'guard_repository_context_conflict'
    const push=read(['remote','get-url','--push','--all','origin']),fetch=read(['remote','get-url','--all','origin'])
    if(push.length!==1||fetch.length!==1||push[0]!==targetUrl||fetch[0]!==targetUrl)return 'guard_target_configuration_changed'
    // --get-all includes the operation's command-line override and every live
    // user/system/local value. A late user hooksPath must not be hidden by -c.
    const hooks=read(['config','--get-all','core.hooksPath'],true)
    if(hooks.length!==1||!samePath(hooks[0],directory))return 'guard_user_hook_configuration_changed'
    const userHooks=path.join(gitRoot,'hooks'),stat=fs.lstatSync(userHooks,{throwIfNoEntry:false})
    if(stat&&(!stat.isDirectory()||stat.isSymbolicLink()||fs.readdirSync(userHooks).some(name=>!name.endsWith('.sample'))))return 'guard_user_hook_present'
    return null
  }catch{return 'guard_boundary_unverifiable'}
}

export function verifyPushInput(input,commit,remoteRef) {
  const oid=/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/
  if(!oid.test(commit)||!/^refs\/heads\/[a-zA-Z0-9_][a-zA-Z0-9_./-]{0,127}$/.test(remoteRef))return 'guard_context_invalid'
  if(Buffer.byteLength(input)>4096)return 'guard_input_limit'
  const lines=input.replace(/\n$/,'').split('\n')
  if(lines.length!==1||!lines[0]||lines[0].includes('\r'))return 'guard_ref_count_invalid'
  const parts=lines[0].split(' ')
  if(parts.length!==4||parts.some(x=>!x))return 'guard_input_invalid'
  const [localRef,localOid,actualRemoteRef,remoteOid]=parts
  if(localRef!==commit||localOid!==commit||actualRemoteRef!==remoteRef||!oid.test(remoteOid)||remoteOid.length!==commit.length)return 'guard_ref_identity_conflict'
  if(/^0+$/.test(remoteOid))return 'guard_remote_branch_absent'
  return null
}
if(process.argv[1]&&fs.realpathSync.native(path.resolve(process.argv[1]))===fs.realpathSync.native(fileURLToPath(import.meta.url))) {
  let input='',finished=false
  const refuse=code=>{if(!finished){finished=true;process.stderr.write(`local_backup_pre_push_rejected:${code}\n`);process.exit(1)}}
  const timer=setTimeout(()=>refuse('guard_stdin_timeout'),5000)
  process.stdin.setEncoding('utf8')
  process.stdin.on('data',chunk=>{input+=chunk;if(Buffer.byteLength(input)>4096)refuse('guard_input_limit')})
  process.stdin.on('error',()=>refuse('guard_stdin_error'))
  process.stdin.on('end',()=>{clearTimeout(timer);const error=verifyPushInput(input,process.env.AI_PET_WORLD_GIT_GUARD_COMMIT??'',process.env.AI_PET_WORLD_GIT_GUARD_REF??'')??verifyPushBoundary(process.argv.slice(2),{root:process.env.AI_PET_WORLD_GIT_GUARD_ROOT,targetUrl:process.env.AI_PET_WORLD_GIT_GUARD_TARGET,directory:process.env.AI_PET_WORLD_GIT_GUARD_DIRECTORY});if(error)refuse(error);else finished=true})
}
