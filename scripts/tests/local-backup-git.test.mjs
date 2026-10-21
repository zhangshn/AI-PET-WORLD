import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { createGitService } from '../../src/server/local-backup/git-service.mjs'
import { createRepository } from '../../src/server/local-backup/git-repository.mjs'
import { hash } from '../../src/server/local-backup/contracts.mjs'
import { verifyPushInput } from '../lib/local-backup/git-pre-push.mjs'
import { publishAndRecord } from '../../src/server/local-backup/git-recording.mjs'

const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'local-backup-git-'));let number=0
function git(root,args,input){const r=spawnSync('git',args,{cwd:root,input,encoding:'utf8',timeout:10000,maxBuffer:1024*1024,windowsHide:true,env:{...process.env,GIT_TERMINAL_PROMPT:'0',GCM_INTERACTIVE:'Never'}});assert.equal(r.status,0,`private fixture git failed: ${args[0]} ${r.stderr}`);return r.stdout.trim()}
function fixture(hooks){
 const root=path.join(temporary,`case-${++number}`);fs.mkdirSync(root);const project=path.join(root,'project'),remote=path.join(root,'remote.git'),moduleRoot=path.join(root,'module');fs.mkdirSync(project);fs.mkdirSync(moduleRoot)
 git(root,['init','--bare','--initial-branch=main',remote]);git(project,['init','--initial-branch=main']);git(project,['config','user.name','Private Fixture']);git(project,['config','user.email','fixture@example.invalid']);git(project,['config','core.autocrlf','false']);git(project,['config','commit.gpgsign','false'])
 for(const dir of ['src','docs'])fs.mkdirSync(path.join(project,dir));fs.writeFileSync(path.join(project,'src/a.ts'),'export const a=1\n');fs.writeFileSync(path.join(project,'src/b.ts'),'export const b=1\n');fs.writeFileSync(path.join(project,'docs/old.md'),'original\n');fs.writeFileSync(path.join(project,'.gitattributes'),'*.ts text eol=lf\n')
 git(project,['add','--','.gitattributes','src/a.ts','src/b.ts','docs/old.md']);git(project,['commit','-m','initial private fixture']);git(project,['remote','add','origin',remote]);git(project,['push','origin','main'])
 fs.writeFileSync(path.join(project,'.git/local-backup-private-fixture'),'private git fixture only')
 const service=createGitService(project,path.join(moduleRoot,'git'),{privateFixture:true,hooks})
 return{root,project,remote,service,head:()=>git(project,['rev-parse','HEAD']),remoteHead:()=>git(root,['--git-dir='+remote,'rev-parse','refs/heads/main']),write:(file,bytes)=>fs.writeFileSync(path.join(project,file),bytes)}
}
const request=preview=>({previewId:preview.previewId,expectedRevision:preview.preview.revision,idempotencyKey:'private-fixture-key',message:'Explicit private fixture commit'})
function previewA(f){f.write('src/a.ts','export const a=2\n');return f.service.preview({files:['src/a.ts']})}
test('native selective commit preserves unselected work and privately pushes exact new/deleted/renamed literal paths and attribute-converted content',async t=>{
 const f=fixture();f.write('src/a.ts','export const a=2\r\n');f.write('src/b.ts','unselected remains\n');f.write('src/literal[one].ts','new file\r\n');fs.renameSync(path.join(f.project,'docs/old.md'),path.join(f.project,'docs/new.md'))
 const found=f.service.preview({files:[]},new URLSearchParams({limit:'2'}));assert.equal(found.records.length,2);assert(found.nextCursor)
 const next=f.service.preview({files:[]},new URLSearchParams({limit:'2',cursor:found.nextCursor}));assert.notEqual(next.records[0].path,found.records[0].path)
 const preview=f.service.preview({files:['src/a.ts','src/literal[one].ts','docs/old.md','docs/new.md']});assert.equal(preview.preview.expectedChanges.length,4)
 const result=f.service.publish(request(preview)).operation;assert.equal(result.status,'succeeded');assert.equal(result.commit.status,'verified');assert.equal(result.push.status,'succeeded');assert.equal(f.remoteHead(),result.commit.commitSha)
 t.diagnostic(JSON.stringify({scope:'private_local_bare_only',parent:preview.preview.repository.head,commit:result.commit.commitSha,remoteCommit:f.remoteHead(),selectedFiles:result.selectedFiles,commitStatus:result.commit.status,pushStatus:result.push.status,productionRepositoryTouched:false}))
 assert.equal(git(f.project,['show','HEAD:src/a.ts']),'export const a=2');assert.equal(git(f.project,['show','HEAD:src/b.ts']),'export const b=1');assert.equal(fs.readFileSync(path.join(f.project,'src/b.ts'),'utf8'),'unselected remains\n');assert.equal(git(f.project,['diff','--cached','--name-only']),'')
 assert.equal(f.service.publish(request(preview)).replayed,true);assert.throws(()=>f.service.publish({...request(preview),message:'different request'}),/idempotency_conflict/)
 const beforeRecord=f.head();let supplied
 const recording=await publishAndRecord(f.service,request(preview),async binding=>{supplied=binding;throw Error('private ledger failure')})
 const envelope=JSON.parse(fs.readFileSync(path.join(f.root,'module/git/operations',`${result.operationId}.json`),'utf8'))
 assert.equal(supplied.sha256,envelope.sha256);assert.equal(supplied.revision,envelope.value.revision);assert.equal(recording.operation.status,'succeeded');assert.equal(recording.workRecording.recorded,false);assert.equal(f.head(),beforeRecord);assert.equal(f.remoteHead(),beforeRecord)
})
test('existing staged changes are refused without clearing the original index',()=>{
 const f=fixture();f.write('src/b.ts','staged user work');git(f.project,['add','--','src/b.ts']);const index=fs.readFileSync(path.join(f.project,'.git/index'))
 assert.throws(()=>f.service.preview({files:[]}),/staged_changes_unsupported/);assert.deepEqual(fs.readFileSync(path.join(f.project,'.git/index')),index)
})
test('changed preview content is rejected before any commit or push',()=>{
 const f=fixture(),preview=previewA(f),head=f.head();f.write('src/a.ts','different after preview');const operation=f.service.publish(request(preview)).operation;assert.equal(operation.status,'failed');assert.equal(operation.failureCode,'git_preview_stale');assert.equal(f.head(),head);assert.equal(f.remoteHead(),head)
})
test('concurrent HEAD and index changes and unknown Git locks fail closed',()=>{
 const f=fixture(),preview=previewA(f);f.write('src/b.ts','external index modification');git(f.project,['add','--','src/b.ts']);const index=fs.readFileSync(path.join(f.project,'.git/index'));assert.equal(f.service.publish(request(preview)).operation.failureCode,'git_staged_changes_unsupported');assert.deepEqual(fs.readFileSync(path.join(f.project,'.git/index')),index)
 const g=fixture(),second=previewA(g);g.write('src/b.ts','external commit');git(g.project,['add','--','src/b.ts']);git(g.project,['commit','-m','concurrent external commit']);const external=g.head();assert.equal(g.service.publish(request(second)).operation.failureCode,'git_preview_stale');assert.equal(g.head(),external)
 const h=fixture(),third=previewA(h),lock=path.join(h.project,'.git/index.lock');fs.writeFileSync(lock,'unknown lock');assert.equal(h.service.publish(request(third)).operation.failureCode,'git_existing_lock_or_operation');assert.equal(fs.readFileSync(lock,'utf8'),'unknown lock')
})
test('selected content changed at native commit race is detected in actual commit and never pushed or reset',()=>{
 let f;f=fixture({beforeNativeCommit:()=>f.write('src/a.ts','race changed bytes')});const preview=previewA(f),oldHead=f.head();const result=f.service.publish(request(preview)).operation
 assert.equal(result.failureCode,'git_commit_tree_conflict');assert.equal(result.commit.status,'created_unverified');assert.equal(result.push.status,'not_started');assert.notEqual(f.head(),oldHead);assert.equal(f.remoteHead(),oldHead)
})
test('whole commit tree verification rejects extra unselected files added by a racing hook',()=>{
 let f;f=fixture({beforeNativeCommit:()=>{f.write('src/b.ts','extra unselected tree change');fs.writeFileSync(path.join(f.project,'.git/hooks/pre-commit'),'#!/bin/sh\ngit add -- src/b.ts\n',{mode:0o755})}})
 const preview=previewA(f),oldHead=f.head(),result=f.service.publish(request(preview)).operation;assert.equal(result.failureCode,'git_commit_tree_conflict');assert.equal(result.push.status,'not_started');assert.equal(f.remoteHead(),oldHead)
})
test('unselected index changes racing native commit are preserved and prevent push',()=>{
 let f;f=fixture({beforeNativeCommit:()=>{f.write('src/b.ts','concurrent staged bytes');git(f.project,['add','--','src/b.ts'])}});const preview=previewA(f),oldHead=f.head();const result=f.service.publish(request(preview)).operation
 assert.equal(result.commit.status,'created_unverified');assert.equal(result.push.status,'not_started');assert.equal(git(f.project,['show',':src/b.ts']),'concurrent staged bytes');assert.equal(f.remoteHead(),oldHead)
})
test('ordinary non-fast-forward push rejection preserves the verified local commit and is never automatically retried',()=>{
 const f=fixture(),preview=previewA(f),other=path.join(f.root,'other');git(f.root,['clone',f.remote,other]);git(other,['config','user.name','Private Fixture']);git(other,['config','user.email','fixture@example.invalid']);git(other,['config','commit.gpgsign','false']);fs.writeFileSync(path.join(other,'docs/remote.md'),'remote advanced');git(other,['add','--','docs/remote.md']);git(other,['commit','-m','remote advanced']);git(other,['push','origin','main']);const remoteHead=f.remoteHead()
 const result=f.service.publish(request(preview)).operation;assert.equal(result.commit.status,'verified');assert.equal(result.status,'push_failed');assert.equal(result.push.status,'failed');assert.equal(f.head(),result.commit.commitSha);assert.equal(f.remoteHead(),remoteHead);assert.equal(f.service.publish(request(preview)).replayed,true)
})
test('push timeout is unknown, not false failure/success; duplicate requests never repeat commit/push',()=>{
 let pushes=0;const f=fixture({pushResult:()=>{pushes++;return{status:null,error:'ETIMEDOUT',stdout:Buffer.alloc(0),stderr:Buffer.alloc(0)}}}),preview=previewA(f),oldHead=f.head();const first=f.service.publish(request(preview));assert.equal(first.operation.status,'push_unknown');assert.equal(first.operation.commit.status,'verified');assert.equal(first.operation.push.status,'unknown');assert.equal(f.remoteHead(),oldHead)
 const committed=f.head();assert.equal(f.service.publish(request(preview)).replayed,true);assert.equal(pushes,1);assert.equal(f.head(),committed);assert.equal(f.service.operation(first.operation.operationId).push.status,'unknown')
})
test('secrets, ignored files, binary/data scope, hardlinks, hooks, filters and signing are refused',()=>{
 const f=fixture();f.write('src/a.ts',`const token='${'ghp_'+'x'.repeat(30)}'`);assert.throws(()=>f.service.preview({files:['src/a.ts']}),/sensitive_content/)
 assert.throws(()=>f.service.preview({files:['.git/config']}),/not_candidate/);assert.throws(()=>f.service.preview({files:['../other']}),/not_candidate/)
 fs.writeFileSync(path.join(f.project,'.gitignore'),'src/ignored.ts\n');f.write('src/ignored.ts','ignored');assert.throws(()=>f.service.preview({files:['src/ignored.ts']}),/not_candidate/)
 const h=fixture();fs.linkSync(path.join(h.project,'src/a.ts'),path.join(h.project,'src/hardlink.ts'));assert.throws(()=>h.service.preview({files:['src/hardlink.ts']}),/file_boundary/)
 const hooked=fixture();fs.writeFileSync(path.join(hooked.project,'.git/hooks/pre-commit'),'not invoked');assert.throws(()=>hooked.service.preview({files:[]}),/hooks_unsupported/)
 const filtered=fixture();git(filtered.project,['config','filter.private.clean','never-run-this']);assert.throws(()=>filtered.service.preview({files:[]}),/filters_unsupported/)
 const signed=fixture();git(signed.project,['config','commit.gpgsign','true']);assert.throws(()=>signed.service.preview({files:[]}),/signing_unsupported/)
})
test('server-produced exact preview identity and operation read cannot create missing stores or accept browser Git arguments',()=>{
 const f=fixture();assert.throws(()=>f.service.operation('a'.repeat(64)),/not_initialized/);assert.equal(fs.existsSync(path.join(f.root,'module/git')),false)
 assert.throws(()=>f.service.preview({files:[],remoteUrl:'https://example.com'}),/invalid_fields/);assert.throws(()=>f.service.publish({previewId:'bad'}),/invalid_fields/)
 const preview=previewA(f);assert.throws(()=>f.service.publish({...request(preview),expectedRevision:2}),/revision_conflict/);const repository=createRepository(f.project,{privateFixture:true});assert.throws(()=>repository.verifyCommit(preview.preview.repository.head,preview.preview.repository.head,preview.preview.expectedChanges),/parent_conflict/)
})
test('trusted pre-push guard refuses a remote branch deleted after preview without recreating it',()=>{
 let f;f=fixture({beforePush:()=>git(f.root,['--git-dir='+f.remote,'update-ref','-d','refs/heads/main'])});const preview=previewA(f),result=f.service.publish(request(preview)).operation
 assert.equal(result.commit.status,'verified');assert.equal(result.push.status,'failed');assert.equal(result.status,'push_failed')
 const remote=spawnSync('git',['--git-dir='+f.remote,'show-ref','--verify','--quiet','refs/heads/main'],{encoding:'utf8',timeout:10000,windowsHide:true});assert.equal(remote.status,1)
})
test('guard rejects extra refs, zero remote OID and malformed protocol; fixed caller validates stdin too',()=>{
 const commit='a'.repeat(40),remote='b'.repeat(40),ref='refs/heads/main',valid=`${commit} ${commit} ${ref} ${remote}\n`
 assert.equal(verifyPushInput(valid,commit,ref),null)
 for(const input of [valid+valid,`${commit} ${commit} ${ref} ${'0'.repeat(40)}\n`,valid.replace(ref,'refs/heads/other'),'','malformed\n',valid.replace(commit,'HEAD'),valid+'\n'])assert(verifyPushInput(input,commit,ref))
 const script=path.resolve('scripts/lib/local-backup/git-pre-push.mjs');const result=spawnSync(process.execPath,[script],{input:valid+valid,encoding:'utf8',timeout:10000,windowsHide:true,env:{...process.env,AI_PET_WORLD_GIT_GUARD_COMMIT:commit,AI_PET_WORLD_GIT_GUARD_REF:ref}});assert.equal(result.status,1);assert(result.stderr.includes('local_backup_pre_push_rejected'))
})
test('verified hook bytes cannot be replaced and operation-scoped selection does not rewrite repository config',()=>{
 let f,preview;f=fixture({beforePush:()=>{const copy=path.join(f.root,'module/git/hooks',hash(preview.preview.guardClosure),'pre-push');fs.writeFileSync(copy,'#!/bin/sh\nexit 0\n')}});preview=previewA(f);const config=fs.readFileSync(path.join(f.project,'.git/config')),result=f.service.publish(request(preview)).operation
 assert.equal(result.failureCode,'git_guard_copy_changed');assert.equal(result.commit.status,'verified');assert.equal(result.push.status,'not_started');assert.deepEqual(fs.readFileSync(path.join(f.project,'.git/config')),config)
})
test('ordinary push explicitly disables configured tag following and never uploads extra refs',()=>{
 const f=fixture();git(f.project,['config','push.followTags','true']);git(f.project,['tag','-a','private-not-selected-tag','-m','not selected']);const preview=previewA(f),config=fs.readFileSync(path.join(f.project,'.git/config')),result=f.service.publish(request(preview)).operation
 assert.equal(result.status,'succeeded');const remote=spawnSync('git',['--git-dir='+f.remote,'show-ref','--verify','--quiet','refs/tags/private-not-selected-tag'],{timeout:10000,windowsHide:true});assert.equal(remote.status,1);assert.deepEqual(fs.readFileSync(path.join(f.project,'.git/config')),config)
})
test('all effective push URLs are counted; different and duplicate extra destinations are refused before commit',()=>{
 for(const duplicate of [false,true]){
  const f=fixture(),other=path.join(f.root,'other.git');git(f.root,['clone','--bare',f.remote,other]);const head=f.head(),otherHead=git(f.root,['--git-dir='+other,'rev-parse','refs/heads/main'])
  git(f.project,['config','--add','remote.origin.pushurl',f.remote]);git(f.project,['config','--add','remote.origin.pushurl',duplicate?f.remote:other]);f.write('src/a.ts','changed selected work')
  assert.throws(()=>f.service.preview({files:['src/a.ts']}),/git_multiple_remote_targets_unsupported/)
  assert.equal(f.head(),head);assert.equal(f.remoteHead(),head);assert.equal(git(f.root,['--git-dir='+other,'rev-parse','refs/heads/main']),otherHead)
 }
})
test('native pre-push refuses a changed origin target after final service guard and retains the verified local commit',()=>{
 let f;const otherName='other.git';f=fixture({beforePush:()=>git(f.project,['remote','set-url','--push','origin',path.join(f.root,otherName)])})
 const other=path.join(f.root,otherName);git(f.root,['clone','--bare',f.remote,other]);const preview=previewA(f),old=f.remoteHead(),result=f.service.publish(request(preview)).operation
 assert.equal(result.commit.status,'verified');assert.equal(result.status,'push_failed');assert.equal(result.push.guardFailureCode,'guard_target_configuration_changed')
 assert.notEqual(f.head(),old);assert.equal(f.remoteHead(),old);assert.equal(git(f.root,['--git-dir='+other,'rev-parse','refs/heads/main']),old)
 assert.equal(git(f.project,['remote','get-url','--push','origin']),other);assert.equal(f.service.publish(request(preview)).replayed,true)
})
test('native pre-push refuses a second push URL added after final service guard without publishing to either target',()=>{
 let f;f=fixture({beforePush:()=>{git(f.project,['config','--add','remote.origin.pushurl',f.remote]);git(f.project,['config','--add','remote.origin.pushurl',path.join(f.root,'other.git')])}})
 const other=path.join(f.root,'other.git');git(f.root,['clone','--bare',f.remote,other]);const preview=previewA(f),old=f.remoteHead(),result=f.service.publish(request(preview)).operation
 assert.equal(result.push.guardFailureCode,'guard_target_configuration_changed');assert.equal(result.commit.status,'verified');assert.equal(f.remoteHead(),old);assert.equal(git(f.root,['--git-dir='+other,'rev-parse','refs/heads/main']),old)
})
test('actual native hook target argv catches late URL rewriting even when the push argument was pinned',()=>{
 let f;f=fixture({beforePush:()=>git(f.project,['config',`url.${path.join(f.root,'other.git')}.insteadOf`,f.remote])})
 const other=path.join(f.root,'other.git');git(f.root,['clone','--bare',f.remote,other]);const preview=previewA(f),old=f.remoteHead(),result=f.service.publish(request(preview)).operation
 assert.equal(result.push.guardFailureCode,'guard_actual_target_conflict');assert.equal(result.status,'push_failed');assert.equal(result.commit.status,'verified');assert.equal(f.remoteHead(),old);assert.equal(git(f.root,['--git-dir='+other,'rev-parse','refs/heads/main']),old)
})
test('new default user pre-push hook is preserved and refuses publication from inside the actual module hook',()=>{
 let f;const hook='#!/bin/sh\nexit 1\n';f=fixture({beforePush:()=>fs.writeFileSync(path.join(f.project,'.git/hooks/pre-push'),hook,{mode:0o755})})
 const preview=previewA(f),old=f.remoteHead(),result=f.service.publish(request(preview)).operation
 assert.equal(result.push.guardFailureCode,'guard_user_hook_present');assert.equal(result.status,'push_failed');assert.equal(result.commit.status,'verified');assert.equal(f.remoteHead(),old);assert.notEqual(f.head(),old);assert.equal(fs.readFileSync(path.join(f.project,'.git/hooks/pre-push'),'utf8'),hook)
})
test('late user hooksPath remains visible beneath the operation override and publication is refused without config edits',()=>{
 let f;f=fixture({beforePush:()=>git(f.project,['config','core.hooksPath',path.join(f.root,'user-hooks')])})
 const hooks=path.join(f.root,'user-hooks');fs.mkdirSync(hooks);const hook='#!/bin/sh\nexit 1\n';fs.writeFileSync(path.join(hooks,'pre-push'),hook,{mode:0o755})
 const preview=previewA(f),old=f.remoteHead(),result=f.service.publish(request(preview)).operation
 assert.equal(result.push.guardFailureCode,'guard_user_hook_configuration_changed');assert.equal(result.status,'push_failed');assert.equal(result.commit.status,'verified');assert.equal(f.remoteHead(),old);assert.equal(git(f.project,['config','core.hooksPath']),hooks);assert.equal(fs.readFileSync(path.join(hooks,'pre-push'),'utf8'),hook)
})
