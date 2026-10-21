import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { performance } from 'node:perf_hooks'
import { need, hash, ModuleError } from './contracts.mjs'

const roots=['src/','scripts/','docs/','tools/','services/','ml/ai-painter/src/','ml/ai-painter/scripts/','ml/ai-painter/tests/','ml/ai-painter/config/','ml/ai-painter/configs/']
const rootFiles=new Set(['.gitattributes','.gitignore','AGENTS.md','README.md','package.json','package-lock.json','tsconfig.json','next.config.ts','next-env.d.ts','eslint.config.mjs','postcss.config.mjs','.env.example'])
const extension=/\.(?:ts|tsx|js|jsx|mjs|cjs|json|md|py|toml|css|ya?ml|ps1|cs|sh|txt)$/i
const oid=/^[a-f0-9]{40}(?:[a-f0-9]{24})?$/
const real = file => fs.realpathSync.native(file)
export function allowedPath(file) {
  if(typeof file!=='string'||file.length>512||/[\\:\x00-\x1f\x7f]/.test(file)||file.startsWith('/')||file.split('/').some(s=>!s||s==='.'||s==='..'))return false
  if(file!=='.env.example'&&/(?:^|\/)\.env(?:\.|$)|(?:^|\/)(?:node_modules|\.venv|\.runtime|\.git)(?:\/|$)|\.(?:pem|key|pfx|p12|sqlite|db|pt|pth|ckpt|safetensors)$/i.test(file))return false
  return rootFiles.has(file)||(roots.some(root=>file.startsWith(root))&&extension.test(file))
}
function endpoint(url) {
  try {
    const parsed=new URL(url)
    need(['https:','ssh:'].includes(parsed.protocol)&&!parsed.password&&!parsed.search&&!parsed.hash,'git_remote_unsupported',409)
    need(!parsed.username||parsed.protocol==='ssh:'&&parsed.username==='git','git_remote_embedded_credentials',409)
    return {transport:parsed.protocol.slice(0,-1),host:parsed.hostname,repositoryPath:parsed.pathname.replace(/^\//,'')}
  } catch(error) {
    if(error instanceof ModuleError)throw error
    const ssh=url.match(/^git@([a-zA-Z0-9.-]+):([a-zA-Z0-9_./-]+)$/)
    need(ssh,'git_remote_unsupported',409);return{transport:'ssh',host:ssh[1],repositoryPath:ssh[2]}
  }
}
export function createRepository(projectRoot,{privateFixture=false}={}) {
  const start=performance.now()
  function git(args,{input,timeout=10000,allowFailure=false,guardEnvironment={}}={}) {
    need(performance.now()-start<60000,'git_operation_budget_exhausted',409)
    const environment={...process.env,GIT_TERMINAL_PROMPT:'0',GCM_INTERACTIVE:'Never'}
    need(Object.keys(guardEnvironment).every(key=>['AI_PET_WORLD_GIT_GUARD_NODE','AI_PET_WORLD_GIT_GUARD_SCRIPT','AI_PET_WORLD_GIT_GUARD_COMMIT','AI_PET_WORLD_GIT_GUARD_REF','AI_PET_WORLD_GIT_GUARD_ROOT','AI_PET_WORLD_GIT_GUARD_TARGET','AI_PET_WORLD_GIT_GUARD_DIRECTORY'].includes(key)),'git_guard_environment_invalid',409)
    Object.assign(environment,guardEnvironment)
    // Private fixture children ignore host/global Git configuration; never change that configuration.
    if(privateFixture){environment.GIT_CONFIG_NOSYSTEM='1';environment.GIT_CONFIG_GLOBAL=process.platform==='win32'?'NUL':'/dev/null'}
    const invocationStartedAtUtc=new Date().toISOString()
    const result=spawnSync('git',['--no-optional-locks','--literal-pathspecs',...args],{cwd:projectRoot,input,encoding:'buffer',timeout:Math.min(timeout,Math.max(1,60000-(performance.now()-start))),maxBuffer:1024*1024,windowsHide:true,env:environment})
    if(!allowFailure&&(result.error||result.status!==0))throw new ModuleError(result.error?'git_command_unknown':'git_command_rejected',409)
    return {status:result.status,error:result.error?result.error.code??'unknown':null,stdout:result.stdout??Buffer.alloc(0),stderr:result.stderr??Buffer.alloc(0),processId:result.pid??null,invocationStartedAtUtc,commandIdentitySha256:hash(['git','--no-optional-locks','--literal-pathspecs',...args])}
  }
  const text=args=>git(args).stdout.toString('utf8').trim()
  const config=name=>{const r=git(['config','--get',name],{allowFailure:true});need(!r.error&&[0,1].includes(r.status),'git_configuration_unreadable',409);return r.status===0?r.stdout.toString('utf8').trim():null}
  function boundary() {
    const root=real(projectRoot),reported=text(['rev-parse','--show-toplevel'])
    need(real(reported).toLowerCase()===root.toLowerCase(),'git_repository_boundary',409)
    const gitRoot=path.join(root,'.git');need(fs.lstatSync(gitRoot).isDirectory()&&!fs.lstatSync(gitRoot).isSymbolicLink(),'git_worktree_unsupported',409)
    const common=text(['rev-parse','--git-common-dir'])
    need(real(path.resolve(root,common)).toLowerCase()===real(gitRoot).toLowerCase(),'git_common_directory_unsupported',409)
    if(privateFixture)need(fs.readFileSync(path.join(root,'.git','local-backup-private-fixture'),'utf8')==='private git fixture only','git_private_fixture_required',409)
    const fsmonitor=config('core.fsmonitor');need(fsmonitor===null||['true','false'].includes(fsmonitor),'git_custom_fsmonitor_unsupported',409)
    return {root,gitRoot}
  }
  function guard() {
    const {root,gitRoot}=boundary()
    for(const name of ['index.lock','HEAD.lock','MERGE_HEAD','CHERRY_PICK_HEAD','REVERT_HEAD','rebase-merge','rebase-apply'])need(!fs.existsSync(path.join(gitRoot,name)),'git_existing_lock_or_operation',409)
    need(!fs.existsSync(path.join(gitRoot,'objects/info/alternates')),'git_alternate_objects_unsupported',409)
    const staged=text(['diff','--cached','--name-only','--no-ext-diff','--no-textconv'])
    need(staged==='','git_staged_changes_unsupported',409)
    const hookPath=config('core.hooksPath');need(hookPath===null,'git_hooks_unsupported',409)
    const hookRoot=path.join(gitRoot,'hooks')
    if(fs.existsSync(hookRoot)){need(fs.lstatSync(hookRoot).isDirectory()&&!fs.lstatSync(hookRoot).isSymbolicLink(),'git_hooks_unsupported',409);for(const entry of fs.readdirSync(hookRoot))need(entry.endsWith('.sample'),'git_hooks_unsupported',409)}
    need(!['true','yes','on','1'].includes((config('commit.gpgsign')??'false').toLowerCase()),'git_signing_unsupported',409)
    const filters=git(['config','--get-regexp','^filter\.'],{allowFailure:true});need(!filters.error&&[0,1].includes(filters.status)&&filters.stdout.length===0,'git_filters_unsupported',409)
    const branch=text(['symbolic-ref','--quiet','--short','HEAD']);need(/^[a-zA-Z0-9_][a-zA-Z0-9_./-]{0,127}$/.test(branch),'git_branch_unsupported',409)
    const head=text(['rev-parse','HEAD']);need(oid.test(head),'git_head_unavailable',409)
    const aliases=text(['remote']).split('\n');need(aliases.includes('origin'),'git_origin_not_configured',409)
    // get-url without --all silently hides additional effective push destinations.
    const fetchUrls=text(['remote','get-url','--all','origin']).split('\n'),pushUrls=text(['remote','get-url','--push','--all','origin']).split('\n')
    need(fetchUrls.length===1&&pushUrls.length===1,'git_multiple_remote_targets_unsupported',409)
    const [fetchUrl]=fetchUrls,[pushUrl]=pushUrls
    need(pushUrl.length>0&&pushUrl.length<=4096&&!/[\r\0]/.test(pushUrl),'git_remote_unsupported',409)
    need(fetchUrl===pushUrl,'git_fetch_push_target_conflict',409)
    let target
    if(privateFixture) {
      const expected=path.join(path.dirname(root),'remote.git');need(real(pushUrl)===real(expected)&&fetchUrl===pushUrl,'git_fixture_remote_boundary',409)
      target={transport:'private_local_bare',host:null,repositoryPath:'private-fixture/remote.git'}
    } else {target=endpoint(pushUrl);need(JSON.stringify(endpoint(fetchUrl))===JSON.stringify(target),'git_fetch_push_target_conflict',409)}
    const index=path.join(gitRoot,'index');let indexSha=null
    if(fs.existsSync(index)){const s=fs.lstatSync(index);need(s.isFile()&&!s.isSymbolicLink()&&s.nlink===1&&s.size<=16*1024*1024,'git_index_boundary',409);indexSha=hash(fs.readFileSync(index))}
    const status=git(['status','--porcelain=v1','-z','--untracked-files=all']).stdout
    const records=[];const parts=status.toString('utf8').split('\0')
    for(let i=0;i<parts.length;i++) {
      const line=parts[i];if(!line)continue
      const code=line.slice(0,2),file=line.slice(3)
      // Renames/copies already staged are refused above; handle raw status robustly nonetheless.
      let original=null;if(/[RC]/.test(code)){original=parts[++i];need(original,'git_status_invalid',409)}
      records.push({path:file,status:code,originalPath:original,allowed:allowedPath(file),reasonCode:allowedPath(file)?null:'git_file_scope_blocked'})
    }
    need(records.length<=2000,'git_candidate_limit',409)
    const coreFilemode=config('core.filemode')!=='false'
    const indexEntries=git(['ls-files','--stage','-z']).stdout.toString('utf8').split('\0').filter(Boolean)
    return {root,gitRoot,branch,head,indexSha,remoteAlias:'origin',target,pushUrl,records,coreFilemode,indexEntries}
  }
  function capture(file,snapshot) {
    need(allowedPath(file),'git_file_scope_blocked',409)
    const absolute=path.join(snapshot.root,...file.split('/'))
    let parent=path.dirname(absolute)
    while(parent!==snapshot.root){const stat=fs.lstatSync(parent,{throwIfNoEntry:false});if(stat)need(stat.isDirectory()&&!stat.isSymbolicLink(),'git_file_link_unsupported',409);parent=path.dirname(parent)}
    const tree=git(['ls-tree','-z',snapshot.head,'--',file]).stdout.toString('utf8')
    const match=tree?tree.match(/^(\d+) blob ([a-f0-9]+)\t/):null
    if(tree)need(match&&['100644','100755'].includes(match[1]),'git_tree_entry_unsupported',409)
    if(!fs.existsSync(absolute)){need(!fs.lstatSync(absolute,{throwIfNoEntry:false}),'git_file_link_unsupported',409);need(match,'git_missing_untracked_file',409);return{path:file,workingSha256:null,sizeBytes:0,mode:'000000',expectedOid:null,baseOid:match[2],baseMode:match[1],newFile:false}}
    const before=fs.lstatSync(absolute);need(before.isFile()&&!before.isSymbolicLink()&&before.nlink===1&&before.size<=2*1024*1024,'git_file_boundary',409)
    const bytes=fs.readFileSync(absolute),after=fs.lstatSync(absolute)
    need(after.isFile()&&!after.isSymbolicLink()&&after.nlink===1&&before.ino===after.ino&&before.dev===after.dev&&before.size===after.size&&before.mtimeMs===after.mtimeMs&&before.ctimeMs===after.ctimeMs,'git_file_changed',409)
    const content=bytes.toString('utf8')
    need(!bytes.includes(0)&&!/(?:-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----|(?:gh[pousr]_|github_pat_|sk-proj-)[a-zA-Z0-9_]{16,}|(?:password|secret|api[_-]?key|access[_-]?token)\s*[:=]\s*["'][^"'\s]{12,}["'])/i.test(content),'git_sensitive_content_blocked',409)
    const attr=git(['check-attr','-z','filter','working-tree-encoding','--',file]).stdout.toString('utf8').split('\0')
    for(let i=0;i+2<attr.length;i+=3)need(['unspecified','unset'].includes(attr[i+2]),'git_attributes_unsupported',409)
    const converted=textWithInput(['hash-object',`--path=${file}`,'--stdin'],bytes)
    need(oid.test(converted),'git_blob_identity_invalid',409)
    const mode=snapshot.coreFilemode?(before.mode&0o111?'100755':'100644'):(match?.[1]??'100644')
    return{path:file,workingSha256:hash(bytes),sizeBytes:bytes.length,mtimeMs:before.mtimeMs,ctimeMs:before.ctimeMs,mode,expectedOid:converted,baseOid:match?.[2]??null,baseMode:match?.[1]??null,newFile:!match}
  }
  function textWithInput(args,input){return git(args,{input}).stdout.toString('utf8').trim()}
  function expectedChanges(selected){return selected.filter(x=>x.expectedOid!==x.baseOid||x.mode!==x.baseMode).map(x=>({path:x.path,newOid:x.expectedOid,newMode:x.mode})).sort((a,b)=>a.path.localeCompare(b.path))}
  function verifyCommit(parent,commit,expected) {
    const parents=text(['rev-list','--parents','-n','1',commit]).split(' ')
    need(parents.length===2&&parents[1]===parent,'git_commit_parent_conflict',409)
    const raw=git(['diff-tree','--raw','--full-index','--no-renames','-z','-r',parent,commit]).stdout.toString('utf8').split('\0'),actual=[]
    for(let i=0;i<raw.length;i+=2){if(!raw[i])continue;const m=raw[i].match(/^:\d+ (\d+) [a-f0-9]+ ([a-f0-9]+) [A-Z]\d*$/);need(m&&raw[i+1],'git_commit_diff_invalid',409);actual.push({path:raw[i+1],newOid:/^0+$/.test(m[2])?null:m[2],newMode:m[1]})}
    actual.sort((a,b)=>a.path.localeCompare(b.path));need(JSON.stringify(actual)===JSON.stringify(expected),'git_commit_tree_conflict',409)
    return actual
  }
  return{git,text,guard,capture,expectedChanges,verifyCommit}
}
