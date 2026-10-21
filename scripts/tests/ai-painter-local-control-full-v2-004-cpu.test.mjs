// Full-v2 control acceptance only. Production/model/GPU/offline qualifications
// are deliberately separate from the genuine private Windows Job evidence.
import test from'node:test';import assert from'node:assert/strict';import fs from'node:fs';import path from'node:path';import os from'node:os';import crypto from'node:crypto';import{spawnSync}from'node:child_process';import{DatabaseSync}from'node:sqlite';
import{buildFixture,validateFixtureRoot,staticStatus,runCase,measure,TASK,PROTOCOL,CANDIDATE,LIMITS}from'./helpers/local-control-full-v2-004-fixture.mjs';
const hash=b=>crypto.createHash('sha256').update(b).digest('hex'),output=process.env.AI_PAINTER_FULL_V2_004_EVIDENCE;
const nativeEnabled=process.env.AI_PAINTER_FULL_V2_004_NATIVE_WINDOW==='coordinated_private_cpu_only';let root,setup,priorFailure=false;const completed=[];
test('full-v2004 private roots/protocol/resource scope reject project, nested, reused or wrong candidates',()=>{
 assert.equal(TASK,'M-LOCAL-FULL-V2-CPU-004');assert.equal(PROTOCOL,'ai-painter-local-control-v2');assert.equal(CANDIDATE,'ecology-quality-v1');assert.deepEqual(LIMITS,{cpuThreads:2,affinity:'3',wallMs:120000,outputBytes:8388608,automaticRetries:0,attempts:1});
 const fresh=path.join(fs.realpathSync(os.tmpdir()),'fullv2-004-'+crypto.randomBytes(4).toString('hex'));assert.equal(validateFixtureRoot(fresh,{mustBeFresh:true}),fresh);
 for(const p of [process.cwd(),path.join(path.dirname(fresh),'other-fixture'),path.join(fresh,'fullv2-004-12345678')])assert.throws(()=>validateFixtureRoot(p,{mustBeFresh:true}));
})
test('full-v2004 helper syntax and fixed private worker cannot import model/network/training APIs',()=>{
 for(const name of ['fixture','chain','native','adapter']){const r=spawnSync(process.execPath,['--check','scripts/tests/helpers/local-control-full-v2-004-'+name+'.mjs'],{encoding:'utf8',windowsHide:true,timeout:5000});assert.equal(r.status,0,r.stderr)}
 const text=fs.readFileSync('scripts/tests/helpers/local-control-full-v2-004-worker.py','utf8');assert.doesNotMatch(text,/import (?:torch|requests|urllib|socket)|\.backward\(|\.step\(|https?:/);assert.match(text,/sys\.exit\(7/)
})
for(const [label,mode]of [['normal-1','normal'],['normal-2','normal'],['program-failure','failure'],['operator-stop','stop']])test('full-v2004 real independent CLI from registered config: '+label,{skip:!nativeEnabled,timeout:125000},async t=>{
 if(output&&fs.existsSync(path.join(output,'pause-new-cases.json'))){t.skip('controller reserved training CPU window; new private cases paused');return}
 if(priorFailure){t.skip('prior failed attempt preserved; no automatic subsequent dispatch');return}assert(output&&path.isAbsolute(output));assert(fs.statSync(output).isDirectory());
 try{
  if(!root){root=process.env.AI_PAINTER_FULL_V2_004_FIXTURE_ROOT;validateFixtureRoot(root,{mustBeFresh:true});setup=await buildFixture(root);fs.writeFileSync(path.join(output,'fixture-root.json'),JSON.stringify(setup,null,2)+'\n',{flag:'wx'});const status=staticStatus(root);assert.equal(status.status,0,status.stderr);const parsed=JSON.parse(status.stdout);assert.equal(parsed.current.ok,true);assert.equal(parsed.current.registry.activeExecution,null);assert.equal(fs.existsSync(path.join(root,'.runtime/ai-painter/autonomous-closed-loop-packages')),false,'only v2 itself may materialize an execution package');}
  const result=await runCase(root,mode,label);for(const previous of completed){assert.notEqual(result.launch.requestId,previous.launch.requestId);assert.notEqual(result.launch.plannedPackageId,previous.launch.plannedPackageId);assert.notEqual(result.launch.launch.commandIdentitySha256,previous.launch.launch.commandIdentitySha256)}
  const db=new DatabaseSync(path.join(root,'.runtime/ai-painter/autonomous-closed-loop-executions',result.launch.plannedPackageId,'execution.sqlite'),{readOnly:true});try{const row=db.prepare('SELECT state, owner_response_required FROM executions WHERE package_identity=?').get(result.launch.plannedPackageId);assert.equal(row.state,mode==='normal'?'completed':'failed_closed');assert.equal(row.owner_response_required,0)}finally{db.close()}
  if(mode==='normal'){const phases=fs.readFileSync(path.join(root,'.runtime/ai-painter/ecology-regime-quality-executions',result.launch.requestId,'fixture-lifecycle.jsonl'),'utf8').trim().split('\n').map(JSON.parse).map(v=>v.phase);assert.deepEqual(phases,['preflight','execute','execute_native_terminal','validate','review','adjudicate','finalize'])}else assert.match(result.terminal.detail,mode==='failure'?/private_full_v2_worker_exit_7/:/private_full_v2_operator_stopped/);
  assert(measure(root)<8388608);completed.push(result);fs.writeFileSync(path.join(output,label+'-result.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log('full-v2004 '+label+' '+root+' '+result.launch.requestId)
 }catch(error){priorFailure=true;fs.writeFileSync(path.join(output,label+'-failure.json'),JSON.stringify({taskId:TASK,recordedAtUtc:new Date().toISOString(),root,label,error:String(error.stack??error),evidenceRetained:true,automaticRetries:0,unknownProcessesNotTouched:true},null,2)+'\n',{flag:'wx'});throw error}
})
