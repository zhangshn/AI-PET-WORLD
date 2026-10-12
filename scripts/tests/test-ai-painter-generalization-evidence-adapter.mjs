import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { prepareShadow, validateShadowDependencies, ENTRY } from '../run-ai-painter-generalization-evidence-shadow.mjs';
import { SHADOW_ROOT, REPORT, hashFile, put } from '../lib/ai-painter-generalization-evidence-adapter-v1.mjs';

const sourceRoot = process.cwd(), namespace = 'test-' + Date.now(), outputRoot = path.resolve(sourceRoot, SHADOW_ROOT);
const indexOnly = process.argv.includes('--index-recovery-only');
const evidenceNamespace = indexOnly ? SHADOW_ROOT+'/index-recovery-m-d1-03' : SHADOW_ROOT;
const fixtureRoot = path.resolve(sourceRoot,evidenceNamespace, namespace + '-fixtures'); fs.mkdirSync(fixtureRoot,{recursive:true});
const before = ['scripts/lib/ai-painter-autonomous-closed-loop-v1.mjs','scripts/lib/ai-painter-autonomous-package-materializer-v1.mjs',
  'scripts/lib/ai-painter-owned-worker-v1.mjs','scripts/lib/ai-pet-world-storage-catalog.mjs',
  'ml/ai-painter/scripts/diagnose_stage4_mvp256_dry_v27_generalization.py',
  'ml/ai-painter/tests/test_diagnose_stage4_mvp256_dry_v27_generalization.py',
  '.runtime/ai-painter/current-execution-registry/current.json'].map(p=>({path:p,sha256:hashFile(path.resolve(sourceRoot,p))}));
put(path.join(fixtureRoot,'protected-baseline.json'),before);
const results = [];
const read = p => JSON.parse(fs.readFileSync(p));
const evidence = (root,name) => path.join(root,'.runtime/ai-painter/evidence',name);
function command(args,{timeout=180000,script=path.resolve(sourceRoot,ENTRY)}={}) {
  return new Promise((resolve,reject)=>{
    const child = spawn(process.execPath,[script,...args],{cwd:sourceRoot,windowsHide:true,env:{...process.env,UV_THREADPOOL_SIZE:'2',OMP_NUM_THREADS:'2',MKL_NUM_THREADS:'2'},stdio:['ignore','pipe','pipe']});
    let stdout='',stderr='';
    child.stdout.on('data',b=>{stdout+=b;if(stdout.length>100000)child.kill();});
    child.stderr.on('data',b=>{stderr+=b;if(stderr.length>100000)child.kill();});
    const timer=setTimeout(()=>{child.kill();reject(new Error('test command deadline'));},timeout);
    child.on('error',reject);child.on('close',(code,signal)=>{clearTimeout(timer);resolve({pid:child.pid,code,signal,stdout,stderr,closedAtUtc:new Date().toISOString()});});
  });
}
async function until(fn,timeout=180000) {
  const end=Date.now()+timeout;
  while(Date.now()<end){const result=fn();if(result)return result;await new Promise(r=>setTimeout(r,100));}
  throw new Error('test observation deadline');
}
async function check(name,action){const start=Date.now();await action();results.push({name,status:'passed',elapsedMs:Date.now()-start});console.log('PASS '+name);}
function terminal(root){return read(path.join(root,'runner-result.json')).result;}
function size(directory){return fs.readdirSync(directory,{withFileTypes:true}).reduce((sum,e)=>sum+(e.isDirectory()?size(path.join(directory,e.name)):fs.statSync(path.join(directory,e.name)).size),0);}
let good, verification;
try {
  if (indexOnly) {
    assert(size(outputRoot)+2*1024*1024<16*1024*1024,'insufficient global shadow budget');
    const driver=path.join(fixtureRoot,'index-driver.mjs');
    fs.writeFileSync(driver,`import fs from 'node:fs';import path from 'node:path';import {commitShadowIndex} from './scripts/lib/ai-painter-generalization-evidence-adapter-v1.mjs';
      const [mode,root]=process.argv.slice(2);const m=JSON.parse(fs.readFileSync(path.join(root,'materialized.json')));const s=JSON.parse(fs.readFileSync(path.join(root,m.packagePath)));
      const context={projectRoot:root,packageIdentity:s.packageIdentity,capabilityVersion:s.capabilityVersion,outputRoot:s.outputRoot,inputEvidence:s.inputEvidence,executionRoot:path.join(root,'.runtime/ai-painter/autonomous-closed-loop-executions',s.packageIdentity)};
      try{const receipt=await commitShadowIndex(context,{_testHooks:mode==='after-commit-failure'?{afterCommit(){throw new Error('injected receipt IO failure after COMMIT');}}:null});console.log(JSON.stringify(receipt));}
      catch(error){console.error(String(error.stack??error));process.exitCode=1;}
    `,{flag:'wx'});
    const source=path.join(fixtureRoot,'historical-report-fixture.json');
    put(source,{testFixtureOnly:true,historicalReport:REPORT,meaning:'index payload fixture; no report verification or model execution'});
    const fixtureReport={path:path.relative(sourceRoot,source).replaceAll('\\','/'),sha256:hashFile(source)};
    function prepareCase(suffix){
      const p=prepareShadow({sourceRoot,name:namespace+'-'+suffix,report:fixtureReport,workerFixture:driver,outputNamespace:evidenceNamespace});
      put(evidence(p.projectRoot,'verified.json'),{testFixtureOnly:true,modelForwardCalls:0});
      put(evidence(p.projectRoot,'classification.json'),{testFixtureOnly:true,causalRootCause:'unknown',qualificationGranted:false});
      return p;
    }
    const dbFile=p=>path.join(p.projectRoot,'catalog-data/catalog/ai-pet-world-catalog.sqlite');
    const runIndex=(p,mode='commit')=>command([mode,p.projectRoot],{script:path.join(p.projectRoot,'worker-fixture.mjs')});
    const inspect=p=>{const db=new DatabaseSync(dbFile(p),{readOnly:true});try{return {artifacts:db.prepare('SELECT * FROM artifacts ORDER BY logical_path').all(),events:db.prepare('SELECT * FROM program_events ORDER BY event_id').all()};}finally{db.close();}};
    const recover=p=>command(['--recover-index',p.projectRoot,hashFile(evidence(p.projectRoot,'index-intent.json'))]);
    good=prepareCase('index-repeat');
    await check('immutable intent, committed event and repeated index identity readback',async()=>{
      const first=await runIndex(good);assert.equal(first.code,0,first.stderr);
      const rows=inspect(good),intentSha=hashFile(evidence(good.projectRoot,'index-intent.json')),receiptSha=hashFile(evidence(good.projectRoot,'index-commit.json'));
      assert.equal(rows.artifacts.length,3);assert.equal(rows.events.length,1);
      const repeated=await runIndex(good);assert.equal(repeated.code,0,repeated.stderr);assert.deepEqual(inspect(good),rows);
      assert.equal(hashFile(evidence(good.projectRoot,'index-intent.json')),intentSha);assert.equal(hashFile(evidence(good.projectRoot,'index-commit.json')),receiptSha);
      put(path.join(fixtureRoot,'idempotent-proof.json'),{first,repeated,rows,intentSha,receiptSha});
    });
    await check('different SHA conflict rejected without overwriting rows or intent',async()=>{
      const db=new DatabaseSync(dbFile(good));const logical=read(evidence(good.projectRoot,'index-intent.json')).artifacts[0].logicalPath;
      db.prepare('UPDATE artifacts SET sha256=? WHERE logical_path=?').run('0'.repeat(64),logical);db.close();
      const rows=inspect(good),intentSha=hashFile(evidence(good.projectRoot,'index-intent.json'));
      const failure=await runIndex(good);assert.equal(failure.code,1);assert.match(failure.stderr,/index artifact identity conflict/);
      assert.deepEqual(inspect(good),rows);assert.equal(hashFile(evidence(good.projectRoot,'index-intent.json')),intentSha);
      assert(fs.readdirSync(evidence(good.projectRoot,'index-failures')).length>0);
      put(path.join(fixtureRoot,'conflict-proof.json'),{failure,preservedRows:rows,intentSha});
    });
    const gap=prepareCase('receipt-gap');
    await check('COMMIT succeeds then receipt IO fails; recovery only reads original intent',async()=>{
      const failure=await runIndex(gap,'after-commit-failure');assert.equal(failure.code,1);assert.match(failure.stderr,/injected receipt IO failure/);
      assert(!fs.existsSync(evidence(gap.projectRoot,'index-commit.json')));
      const rows=inspect(gap);assert.equal(rows.artifacts.length,3);assert.equal(rows.events.length,1);
      const failures=fs.readdirSync(evidence(gap.projectRoot,'index-failures')).map(f=>({path:f,sha256:hashFile(evidence(gap.projectRoot,'index-failures/'+f))}));
      const fixed=await recover(gap);assert.equal(fixed.code,0,fixed.stderr);assert.deepEqual(inspect(gap),rows);
      const repeated=await recover(gap);assert.equal(repeated.code,0,repeated.stderr);assert.deepEqual(inspect(gap),rows);
      for(const f of failures)assert.equal(hashFile(evidence(gap.projectRoot,'index-failures/'+f.path)),f.sha256);
      for(const p of ['consumption-claim.json','runner-result.json','.runtime/ai-painter/owned-worker-guards','.runtime/ai-painter/autonomous-closed-loop-executions'])assert(!fs.existsSync(path.join(gap.projectRoot,p)));
      assert(!fs.existsSync(evidence(gap.projectRoot,'worker-start.json')));
      put(path.join(fixtureRoot,'commit-gap-recovery-proof.json'),{failure,fixed,repeated,rows,preservedFailures:failures,modelOrSixPhaseInvocations:0});
    });
    const failed=prepareCase('open-failure');
    await check('precommit SQLite open failure retains intent and files; only index recovery commits',async()=>{
      fs.mkdirSync(dbFile(failed),{recursive:true});
      const failure=await runIndex(failed);assert.equal(failure.code,1);assert(fs.existsSync(evidence(failed.projectRoot,'index-intent.json')));
      const intentSha=hashFile(evidence(failed.projectRoot,'index-intent.json'));assert(!fs.existsSync(evidence(failed.projectRoot,'index-commit.json')));
      // Preserve the injected empty-directory obstruction instead of deleting it.
      fs.renameSync(dbFile(failed),dbFile(failed)+'.injected-obstruction-preserved');
      const fixed=await recover(failed);assert.equal(fixed.code,0,fixed.stderr);assert.equal(inspect(failed).artifacts.length,3);
      assert.equal(hashFile(evidence(failed.projectRoot,'index-intent.json')),intentSha);
      put(path.join(fixtureRoot,'precommit-recovery-proof.json'),{failure,fixed,intentSha});
    });
    await check('wrong intent, changed file and unknown lock are refused; no lock cleanup',async()=>{
      const wrong=await command(['--recover-index',gap.projectRoot,'0'.repeat(64)]);assert.equal(wrong.code,1);assert.match(wrong.stderr,/intent SHA mismatch/);
      const lock=evidence(gap.projectRoot,'index-transaction.lock');fs.mkdirSync(lock);put(path.join(lock,'unknown-owner.json'),{unknown:true});
      const locked=await recover(gap);assert.equal(locked.code,1);assert(fs.existsSync(path.join(lock,'unknown-owner.json')));
      fs.appendFileSync(evidence(failed.projectRoot,'classification.json'),' ');
      const changed=await recover(failed);assert.equal(changed.code,1);assert.match(changed.stderr,/indexed file changed/);
      put(path.join(fixtureRoot,'refusals-proof.json'),{wrong,locked,changed,unknownLockPreserved:true});
    });
    await check('protected sources unchanged; no production writes and bounded new output',async()=>{
      for(const b of before)assert.equal(hashFile(path.resolve(sourceRoot,b.path)),b.sha256,b.path);
      assert(size(path.resolve(sourceRoot,evidenceNamespace))<2*1024*1024);assert(size(outputRoot)<16*1024*1024);
    });
  } else if (process.argv.includes('--dependencies-only')) {
    assert(size(outputRoot) + 512 * 1024 < 16 * 1024 * 1024, 'insufficient retained-evidence budget');
    good=prepareShadow({sourceRoot,name:namespace+'-dependencies'});
    const spec=read(path.join(good.projectRoot,good.packagePath));
    await check('actual copied code, contracts and C# bytes are package inputs',async()=>{
      const baseline=read(path.join(good.projectRoot,'dependency-baseline.json'));
      for(const b of baseline){assert.equal(hashFile(path.join(good.projectRoot,b.path)),b.sha256);assert(spec.inputEvidence.some(i=>i.path===b.path&&i.sha256===b.sha256));}
      for(const p of ['scripts/lib/ai-painter-owned-worker-native-v1.mjs','scripts/windows/ai-painter-owned-worker-owner.cs',
        'data/ai-painter/system-governance/ai-painter-autonomous-closed-loop-contract-v1.json'])assert(baseline.some(b=>b.path===p));
      validateShadowDependencies(good.projectRoot,spec);
    });
    await check('missing, escaping and duplicate conflicting bindings refused',async()=>{
      const missing=structuredClone(spec);missing.inputEvidence.push({path:'absent.mjs',sha256:'0'.repeat(64)});
      assert.throws(()=>validateShadowDependencies(good.projectRoot,missing),/ENOENT/);
      const escaping=structuredClone(spec);escaping.inputEvidence.push({path:'../outside.mjs',sha256:'0'.repeat(64)});
      assert.throws(()=>validateShadowDependencies(good.projectRoot,escaping));
      const duplicate=structuredClone(spec);duplicate.inputEvidence.push({...spec.inputEvidence[0],sha256:'0'.repeat(64)});
      assert.throws(()=>validateShadowDependencies(good.projectRoot,duplicate),/duplicate input dependency/);
      const omitted=structuredClone(spec);omitted.inputEvidence=omitted.inputEvidence.filter(b=>!b.path.endsWith('/ai-painter-owned-worker-owner.cs'));
      assert.throws(()=>validateShadowDependencies(good.projectRoot,omitted),/dependency missing/);
    });
    await check('transitive code tamper blocks start and consume before execute or owned worker',async()=>{
      const target='scripts/lib/ai-painter-owned-worker-native-v1.mjs';
      fs.appendFileSync(path.join(good.projectRoot,target),'\n// negative test: altered transitive shadow bytes\n');
      const start=await command(['--start-prepared',good.projectRoot]);
      const consume=await command(['--consume',good.projectRoot]);
      for(const result of [start,consume]){assert.equal(result.code,1);assert.match(result.stderr,/shadow dependency SHA mismatch/);}
      for(const p of ['start-claim.json','consumption-claim.json','.runtime/ai-painter/owned-worker-guards',
        '.runtime/ai-painter/autonomous-closed-loop-executions','.runtime/ai-painter/autonomous-background-launches'])
        assert(!fs.existsSync(path.join(good.projectRoot,p)),p+' unexpectedly created');
      put(path.join(fixtureRoot,'dependency-tamper-rejections.json'),{target,start,consume,executeStarted:false,ownedWorkerStarted:false});
    });
    await check('protected files unchanged and retained output remains within 16 MiB',async()=>{
      for(const b of before)assert.equal(hashFile(path.resolve(sourceRoot,b.path)),b.sha256,b.path);
      assert(size(outputRoot)<16*1024*1024);
    });
  } else {
  await check('real six-phase runner survives starter exit; SQLite and cleanup match',async()=>{
    good=prepareShadow({sourceRoot,name:namespace+'-normal',starterExitGate:true});
    const starter=await command(['--start-prepared',good.projectRoot]);assert.equal(starter.code,0,starter.stderr);
    const receipt=JSON.parse(starter.stdout); assert.notEqual(receipt.processId,starter.pid);
    put(path.join(good.projectRoot,'starter-exit-observed.json'),starter);
    await until(()=>fs.existsSync(path.join(good.projectRoot,'runner-result.json')));
    const runner=read(path.join(good.projectRoot,'runner-result.json'));
    assert.equal(runner.result.state,'completed',JSON.stringify(runner)); assert.equal(runner.pid,receipt.processId);
    assert(Date.parse(runner.finishedAtUtc)>Date.parse(starter.closedAtUtc));
    const cleanup=read(evidence(good.projectRoot,'worker-receipt.json'));
    assert.equal(cleanup.cleanupConfirmed,true);assert.equal(cleanup.proof.activeProcessesAfterCleanup,0);assert.equal(cleanup.proof.exitCode,0);
    verification=read(evidence(good.projectRoot,'verified.json'));
    assert.equal(verification.directBindingCount,1858);assert.equal(verification.classification.pattern,'train_higher_on_all_applicable_roles');
    assert.equal(verification.classification.qualificationGranted,false);assert.equal(verification.boundary.modelForwardCalls,0);
    const store=path.join(good.projectRoot,'.runtime/ai-painter/autonomous-closed-loop-executions',good.packageIdentity);
    const db=new DatabaseSync(path.join(store,'execution.sqlite'),{readOnly:true});
    assert.equal(db.prepare('SELECT count(*) AS n FROM artifacts').get().n,6);
    assert.equal(db.prepare("SELECT state FROM executions").get().state,'completed'); db.close();
    assert.equal(read(path.join(store,'phase-terminal.json')).status,'completed');
    const catalog=new DatabaseSync(path.join(good.projectRoot,'catalog-data/catalog/ai-pet-world-catalog.sqlite'),{readOnly:true});
    const rows=catalog.prepare('SELECT logical_path,physical_uri,sha256 FROM artifacts').all();assert.equal(rows.length,3);
    for(const row of rows)assert.equal(hashFile(row.physical_uri),row.sha256);catalog.close();
    put(path.join(fixtureRoot,'launcher-exit-proof.json'),{starter,receipt,runner,cleanup,workerStart:read(evidence(good.projectRoot,'worker-start.json'))});
  });
  await check('duplicate consumption and unknown start namespace refused',async()=>{
    const prior=hashFile(path.join(good.projectRoot,'runner-result.json'));
    const duplicate=await command(['--consume',good.projectRoot]); assert.notEqual(duplicate.code,0);assert.match(duplicate.stderr,/EEXIST/);
    const repeatStart=await command(['--start-prepared',good.projectRoot]);assert.notEqual(repeatStart.code,0);
    assert.equal(hashFile(path.join(good.projectRoot,'runner-result.json')),prior);
    assert.throws(()=>prepareShadow({sourceRoot,name:good.packageIdentity}),/EEXIST/);
  });
  await check('report byte tamper fails closed before consumption',async()=>{
    const copy=path.join(fixtureRoot,'tampered-report.json');fs.copyFileSync(path.resolve(sourceRoot,REPORT.path),copy);
    const report={path:path.relative(sourceRoot,copy).replaceAll('\\','/'),sha256:hashFile(copy)};
    const p=prepareShadow({sourceRoot,name:namespace+'-tamper',report});fs.appendFileSync(copy,' ');
    const run=await command(['--consume',p.projectRoot]);assert.equal(run.code,1);assert.equal(terminal(p.projectRoot).state,'failed_closed');
    assert(!fs.existsSync(evidence(p.projectRoot,'verified.json')));
  });
  await check('correct hash with wrong diagnostic identity fails closed',async()=>{
    const changed=read(path.resolve(sourceRoot,REPORT.path));changed.runId='wrong-run';
    const file=path.join(fixtureRoot,'wrong-identity.json');fs.writeFileSync(file,JSON.stringify(changed),{flag:'wx'});
    const p=prepareShadow({sourceRoot,name:namespace+'-identity',report:{path:path.relative(sourceRoot,file).replaceAll('\\','/'),sha256:hashFile(file)}});
    const run=await command(['--consume',p.projectRoot]);assert.equal(run.code,1);assert.equal(terminal(p.projectRoot).state,'failed_closed');
    const failure=read(evidence(p.projectRoot,'worker-failure.json'));assert.match(failure.stderr,/run identity mismatch/);assert.equal(failure.ownedReceipt.cleanupConfirmed,true);
  });
  await check('bound evidence SHA tamper fails closed',async()=>{
    const changed=read(path.resolve(sourceRoot,REPORT.path));changed.inputBindings[0].sha256='0'.repeat(64);
    const file=path.join(fixtureRoot,'wrong-binding.json');fs.writeFileSync(file,JSON.stringify(changed),{flag:'wx'});
    const p=prepareShadow({sourceRoot,name:namespace+'-binding',report:{path:path.relative(sourceRoot,file).replaceAll('\\','/'),sha256:hashFile(file)}});
    await command(['--consume',p.projectRoot]);assert.equal(terminal(p.projectRoot).state,'failed_closed');assert.match(read(evidence(p.projectRoot,'worker-failure.json')).stderr,/SHA mismatch/);
  });
  await check('hard timeout kills synchronous writer and descendant; no later writes',async()=>{
    const file=path.join(fixtureRoot,'timeout-worker.mjs');
    fs.writeFileSync(file,`import fs from 'node:fs';import path from 'node:path';import {spawn} from 'node:child_process';
      const root=process.argv[3]; const target=path.join(root,'descendant-writer.json');
      const child=spawn(process.execPath,['-e',"const fs=require('fs');setInterval(()=>fs.writeFileSync(process.argv[1],String(Date.now())),25)",target],{windowsHide:true,stdio:'ignore'});
      fs.writeFileSync(path.join(root,'timeout-identities.json'),JSON.stringify({parentPid:process.pid,childPid:child.pid}));
      while(true){fs.writeFileSync(path.join(root,'blocked-writer.json'),String(Date.now()));}
    `,{flag:'wx'});
    const p=prepareShadow({sourceRoot,name:namespace+'-timeout',timeoutMs:8000,workerFixture:file});
    const run=await command(['--consume',p.projectRoot]);assert.equal(run.code,1);assert.equal(terminal(p.projectRoot).state,'failed_closed');
    const fail=read(evidence(p.projectRoot,'worker-failure.json'));assert.equal(fail.code,'ETIMEDOUT');assert.equal(fail.ownedReceipt.cleanupConfirmed,true);
    assert.equal(fail.ownedReceipt.proof.activeProcessesAfterCleanup,0);
    const ids=read(path.join(p.projectRoot,'timeout-identities.json'));
    const files=['descendant-writer.json','blocked-writer.json'].map(f=>path.join(p.projectRoot,f));const hashes=files.map(hashFile);
    await new Promise(r=>setTimeout(r,400));assert.deepEqual(files.map(hashFile),hashes);
    for(const pid of [ids.parentPid,ids.childPid]) assert.throws(()=>process.kill(pid,0));
    put(path.join(fixtureRoot,'hard-timeout-proof.json'),{ids,failure:fail,writerHashesAfterWait:hashes});
  });
  await check('real SQLite open failure reaches failed_closed and preserves classification',async()=>{
    const file=path.join(fixtureRoot,'index-worker.mjs');
    fs.writeFileSync(file,`import fs from 'node:fs';import path from 'node:path';const root=process.argv[3];fs.writeFileSync(path.join(root,'.runtime/ai-painter/evidence/verified.json'),${JSON.stringify(JSON.stringify(verification))},{flag:'wx'});`,{flag:'wx'});
    const p=prepareShadow({sourceRoot,name:namespace+'-index',workerFixture:file});
    fs.mkdirSync(path.join(p.projectRoot,'catalog-data/catalog/ai-pet-world-catalog.sqlite'),{recursive:true});
    const run=await command(['--consume',p.projectRoot]);assert.equal(run.code,1);assert.equal(terminal(p.projectRoot).state,'failed_closed');
    assert(fs.existsSync(evidence(p.projectRoot,'classification.json')));assert(!fs.existsSync(evidence(p.projectRoot,'index-commit.json')));
    const final=path.join(p.projectRoot,'.runtime/ai-painter/autonomous-closed-loop-executions',p.packageIdentity,'phase-evidence/finalize-attempt-0.json');
    assert.match(read(final).result.detail,/unable to open database|cannot open|database/i);
  });
  await check('shared programs, diagnostic and production current bytes preserved; bounded output',async()=>{
    for(const b of before)assert.equal(hashFile(path.resolve(sourceRoot,b.path)),b.sha256,b.path);
    assert(size(outputRoot)<16*1024*1024,'total shadow output >16 MiB');
  });
  }
  put(path.join(fixtureRoot,'test-results.json'),{status:'passed',results,outputBytes:size(outputRoot),realShadowRoot:good.projectRoot,protectedFiles:before});
  console.log(JSON.stringify({status:'passed',tests:results.length,evidence:path.join(fixtureRoot,'test-results.json')}));
} catch(error) {
  put(path.join(fixtureRoot,'test-failure.json'),{status:'failed',results,error:String(error.stack??error),realShadowRoot:good?.projectRoot??null});
  throw error;
}
