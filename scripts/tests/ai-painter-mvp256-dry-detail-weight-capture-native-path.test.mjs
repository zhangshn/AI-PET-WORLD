import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {test} from 'node:test';
import {runNative,cleanupForCurrentCall,withNativeReceiptBudget,withNativeOrdinaryBudget} from '../run-ai-painter-mvp256-dry-detail-weight-capture-training.mjs';
import sharp from 'sharp';
import {write,withOutputBudget} from '../lib/ai-painter-mvp256-dry-detail-weight-capture-package-chain-v1.mjs';
import {nativeBuildFailureObservation} from '../lib/ai-painter-owned-worker-native-v1.mjs';
const digest=b=>crypto.createHash('sha256').update(b).digest('hex');
const base=path.resolve('.runtime/m-c4-01');fs.mkdirSync(base,{recursive:true});
assert.equal(fs.realpathSync(base),path.join(fs.realpathSync('.runtime'),'m-c4-01'));
const evidenceRoot=fs.mkdtempSync(path.join(base,'path-'));
const guardRelative='.runtime/ai-painter/owned-worker-guards/active.json';
const results=[];
const hardBytes=8*1024**2,cpuFixtureBytes=1024**2,ordinaryReserveBytes=65536;
const cpuTaskRoot='.runtime/ai-painter/native-startup-recovery-t-q4-55/cpu';
const packageUrl=new URL('../lib/ai-painter-mvp256-dry-detail-weight-capture-package-chain-v1.mjs',import.meta.url).href;
const countBytes=dir=>!fs.existsSync(dir)?0:fs.readdirSync(dir,{withFileTypes:true}).reduce((n,e)=>{
  const file=path.join(dir,e.name);assert.equal(fs.lstatSync(file).isSymbolicLink(),false);
  return n+(e.isDirectory()?countBytes(file):fs.statSync(file).size);
},0);
const accountingBytes=(root,receipt)=>receipt.outputAccountingRoots.reduce((n,r)=>n+countBytes(path.join(root,r)),0);
const namespaceFor=outputRoot=>{const key=digest(outputRoot).slice(0,32);return '.runtime/ai-painter/owned-worker-guards/'+[key.slice(0,8),key.slice(8,12),key.slice(12,16),key.slice(16,20),key.slice(20)].join('-');};
const cpuCall=(root,outputRoot,args)=>runNative({root,outputRoot,phase:'cpu',executable:process.execPath,args,cpuAccountingRoot:cpuTaskRoot,cpuMaximumBytes:cpuFixtureBytes});
const assertPartition=receipt=>{
  assert.equal(receipt.budget.outputBytes,cpuFixtureBytes);assert.equal(receipt.budget.timeoutMs,120000);
  assert(Number.isSafeInteger(receipt.budget.terminalReserveBytes)&&receipt.budget.terminalReserveBytes>0);
  assert(Number.isSafeInteger(receipt.budget.ordinaryOutputLimitBytes)&&receipt.budget.ordinaryOutputLimitBytes>ordinaryReserveBytes);
  assert.equal(receipt.budget.ordinaryOutputLimitBytes+receipt.budget.terminalReserveBytes,cpuFixtureBytes);
};
test('long Run name uses a fresh short native build; build and start bytes remain budgeted',async()=>{
  const root=path.join(evidenceRoot,'normal');fs.mkdirSync(root);
  const outputRoot='.runtime/ai-painter/detail-weight-capture-managed-executions/'+('long-run-'.repeat(14));
  const result=await runNative({root,outputRoot,phase:'cpu',executable:process.execPath,args:['-e','console.log(JSON.stringify({synthetic:true,optimizerSteps:0}))']});
  const receipt=result.ownedReceipt,helperRoot=path.join(root,receipt.guard.nativeEvidenceRoot);
  assert.deepEqual(JSON.parse(result.stdout),{synthetic:true,optimizerSteps:0});
  assert.equal(receipt.cleanupConfirmed,true);assert.equal(receipt.proof.activeProcessesAfterCleanup,0);assert.equal(receipt.proof.assignedBeforeResume,true);
  assert.equal(fs.existsSync(path.join(root,guardRelative)),false);
  assert(receipt.outputAccountingRoots.includes(outputRoot));assert(receipt.outputAccountingRoots.includes(receipt.guard.nativeEvidenceRoot));
  assert(receipt.nativeBuild.binary.startsWith(helperRoot+path.sep));assert(!receipt.nativeBuild.binary.startsWith(path.join(root,outputRoot)+path.sep));
  assert.equal(digest(fs.readFileSync(receipt.nativeBuild.binary)),receipt.nativeBuild.binarySha256);
  assert.equal(digest(fs.readFileSync(receipt.nativeBuild.snapshot)),receipt.nativeBuild.source.sha256);
  const started=JSON.parse(fs.readFileSync(path.join(helperRoot,receipt.guard.identity+'-started.json'),'utf8'));
  assert.equal(started.identity,receipt.guard.identity);assert.equal(started.ownerPid,receipt.ownerIdentity.pid);
  assert.equal(JSON.parse(fs.readFileSync(path.join(root,outputRoot,'owned-cpu-'+receipt.guard.identity,'original-receipt.json'))).cleanupConfirmed,false);
  assert.equal(receipt.budget.outputBytes,8*1024**2);assert.equal(receipt.budget.timeoutMs,120000);
  const beforeBytes=fs.readFileSync(receipt.nativeBuild.binary);
  const second=await runNative({root,outputRoot,phase:'cpu',executable:process.execPath,args:['-e','console.log("{}")']});
  assert.equal(second.ownedReceipt.guard.nativeEvidenceRoot,receipt.guard.nativeEvidenceRoot);
  assert.notEqual(second.ownedReceipt.nativeBuild.binary,receipt.nativeBuild.binary);
  assert.deepEqual(fs.readFileSync(receipt.nativeBuild.binary),beforeBytes);
  assert(second.ownedReceipt.outputAccountingRoots.includes(receipt.guard.nativeEvidenceRoot));
  assert.equal(second.ownedReceipt.cleanupConfirmed,true);
  results.push({name:'long_run_native_cleanup',status:'passed',receipt,resultBinding:result.receiptBinding});
});
test('an existing unknown guard is byte-preserved and never authorizes a new owner',async()=>{
  const root=path.join(evidenceRoot,'unknown');fs.mkdirSync(root);
  const guard=path.join(root,guardRelative);fs.mkdirSync(path.dirname(guard),{recursive:true});
  const bytes=Buffer.from('unknown retained guard fixture');fs.writeFileSync(guard,bytes,{flag:'wx'});
  await assert.rejects(runNative({root,outputRoot:'.runtime/ai-painter/detail-weight-capture-managed-executions/unknown',phase:'cpu',executable:process.execPath,args:[]}),e=>e.code==='OWNED_GUARD_BUSY'&&e.ownedReceipt.cleanupConfirmed===false);
  assert.deepEqual(fs.readFileSync(guard),bytes);
  const entries=fs.readdirSync(path.dirname(guard),{withFileTypes:true});
  for(const entry of entries.filter(e=>e.isDirectory()))assert.equal(fs.readdirSync(path.join(path.dirname(guard),entry.name)).length,0);
  assert.equal(cleanupForCurrentCall({ownedReceipt:{cleanupConfirmed:false}},{cleanupConfirmed:true}),false);
  results.push({name:'unknown_guard_preserved',status:'passed',guardSha256:digest(bytes),nativeOwnerInvocations:0});
});
test('cross-Run namespace binding is rejected before native build and guard creation',async()=>{
  const root=path.join(evidenceRoot,'cross-run');fs.mkdirSync(root);
  const outputRoot='.runtime/ai-painter/detail-weight-capture-managed-executions/cross-run';
  const nativeEvidenceRoot='.runtime/ai-painter/owned-worker-guards/'+crypto.randomUUID();
  const pointer={schema:'detail-weight-native-evidence-root-v1',outputRoot,nativeEvidenceRoot};
  fs.mkdirSync(path.join(root,outputRoot),{recursive:true});fs.mkdirSync(path.join(root,nativeEvidenceRoot),{recursive:true});
  fs.writeFileSync(path.join(root,outputRoot,'native-evidence-root.json'),JSON.stringify(pointer)+'\n',{flag:'wx'});
  fs.writeFileSync(path.join(root,nativeEvidenceRoot,'binding.json'),JSON.stringify({...pointer,outputRoot:outputRoot+'-other'})+'\n',{flag:'wx'});
  await assert.rejects(runNative({root,outputRoot,phase:'cpu',executable:process.execPath,args:[]}),e=>e.code==='ERR_ASSERTION');
  assert.equal(fs.existsSync(path.join(root,guardRelative)),false);
  assert.deepEqual(fs.readdirSync(path.join(root,nativeEvidenceRoot)),['binding.json']);
  results.push({name:'cross_run_namespace_rejected',status:'passed',nativeOwnerInvocations:0});
});
test('a real compiler failure precedes lease acquisition and cannot launch a native owner',async()=>{
  const root=path.join(evidenceRoot,'compiler-failure','p'.repeat(180));fs.mkdirSync(root,{recursive:true});
  const outputRoot='.runtime/ai-painter/detail-weight-capture-managed-executions/compiler-failure';
  const error=await runNative({root,outputRoot,phase:'cpu',executable:process.execPath,args:['-e','throw new Error("must not execute")']}).catch(e=>e);
  assert(error instanceof Error);assert.match(String(error.stdout),/CS(?:1619|2021)/);
  const observation=nativeBuildFailureObservation(error),receipt=error.ownedReceipt;
  assert(observation);assert.equal(observation.runnerPid,process.pid);assert.equal(observation.exitStatus,1);
  assert.equal(receipt.cleanupConfirmed,true);assert.equal(receipt.cleanupBasis,'same_live_call_no_guard_or_native_owner_created');
  assert.equal(receipt.guard.state,'not_acquired');assert.equal(receipt.nativeOwnerSpawnAttempted,false);assert.equal(receipt.workerStarted,false);
  assert.equal(fs.existsSync(path.join(root,guardRelative)),false);
  const scope=path.join(root,outputRoot,'owned-cpu-'+receipt.guard.identity);
  assert.equal(JSON.parse(fs.readFileSync(path.join(scope,'original-receipt.json'))).cleanupConfirmed,false);
  assert.equal(JSON.parse(fs.readFileSync(path.join(scope,'release-receipt.json'))).cleanupConfirmed,true);
  assert.equal(digest(fs.readFileSync(observation.failurePath)),observation.failureSha256);
  assert.equal(fs.existsSync(path.join(path.dirname(observation.failurePath),'owner.exe')),false);
  assert.equal(nativeBuildFailureObservation({...error}),null);
  assert.equal(nativeBuildFailureObservation(JSON.parse(JSON.stringify(observation))),null);
  assert.equal(nativeBuildFailureObservation(Object.assign(new Error('copied fields'),{status:1,compilerExited:true})),null);
  results.push({name:'compiler_failure_before_guard',status:'passed',receipt,resultBinding:error.receiptBinding,nativeOwnerInvocations:0});
});
test('failure evidence IO cannot be reported as confirmed pre-spawn completion',async()=>{
  const root=path.join(evidenceRoot,'failure-io','p'.repeat(180));fs.mkdirSync(root,{recursive:true});
  const outputRoot='.runtime/ai-painter/detail-weight-capture-managed-executions/failure-io';
  let injected=false,error;
  // write() uses an fd. Deny opening only the new immutable raw receipt.
  const open=fs.openSync;
  try{fs.openSync=function(file,...args){if(String(file).endsWith('original-receipt.json')){injected=true;throw new Error('synthetic receipt IO refusal');}return open.call(this,file,...args);};
    error=await runNative({root,outputRoot,phase:'cpu',executable:process.execPath,args:[]}).catch(e=>e);
  }finally{fs.openSync=open;}
  assert(injected);assert(error instanceof Error);assert.match(String(error.stdout),/CS(?:1619|2021)/);
  assert.equal(error.ownedReceipt.cleanupConfirmed,false);assert.match(error.secondaryEvidenceError,/synthetic receipt IO refusal/);
  assert.equal(fs.existsSync(path.join(root,guardRelative)),false);
  assert.equal(fs.existsSync(path.join(root,outputRoot,'owned-cpu-'+error.ownedReceipt.guard.identity,'release-receipt.json')),false);
  results.push({name:'pre_spawn_receipt_io_failure_refused',status:'passed',nativeOwnerInvocations:0,cleanupConfirmed:false});
});
test('missing or jointly rewritten namespace bindings cannot hide earlier native bytes',async()=>{
  const root=path.join(evidenceRoot,'namespace-anchor');fs.mkdirSync(root);
  const outputRoot='.runtime/ai-painter/detail-weight-capture-managed-executions/namespace-anchor';
  const result=await runNative({root,outputRoot,phase:'cpu',executable:process.execPath,args:['-e','console.log("{}")']});
  const pointer=path.join(root,outputRoot,'native-evidence-root.json'),saved=pointer+'.original',bytes=fs.readFileSync(pointer);
  fs.renameSync(pointer,saved);
  await assert.rejects(runNative({root,outputRoot,phase:'cpu',executable:process.execPath,args:[]}),/namespace pointer is missing/);
  assert.equal(fs.existsSync(path.join(root,guardRelative)),false);fs.renameSync(saved,pointer);
  const fakeRoot='.runtime/ai-painter/owned-worker-guards/'+crypto.randomUUID();fs.mkdirSync(path.join(root,fakeRoot));
  const changed=JSON.stringify({...JSON.parse(bytes),nativeEvidenceRoot:fakeRoot})+'\n';
  fs.writeFileSync(pointer,changed);fs.writeFileSync(path.join(root,fakeRoot,'binding.json'),changed,{flag:'wx'});
  await assert.rejects(runNative({root,outputRoot,phase:'cpu',executable:process.execPath,args:[]}),/namespace identity must derive/);
  assert.equal(fs.existsSync(path.join(root,guardRelative)),false);
  assert.equal(digest(fs.readFileSync(result.ownedReceipt.nativeBuild.binary)),result.ownedReceipt.nativeBuild.binarySha256);
  results.push({name:'namespace_loss_and_dual_rewrite_refused',status:'passed',nativeOwnerInvocations:1});
});
test('outer evidence writes count the short native namespace and restore budget environment',async()=>{
  const root=path.join(evidenceRoot,'outer-budget');fs.mkdirSync(root);
  const outputRoot='.runtime/ai-painter/detail-weight-capture-managed-executions/outer-budget';
  const result=await runNative({root,outputRoot,phase:'cpu',executable:process.execPath,args:['-e','console.log("{}")']});
  const diskBytes=accountingBytes(root,result.ownedReceipt);
  // Final outer writes may spend the reserved capacity now; deny on the actual
  // hard ceiling, not by requiring another unused 64 KiB after finalization.
  const narrowed={...result.ownedReceipt,budget:{...result.ownedReceipt.budget,outputBytes:diskBytes+512}};
  const saved=process.env.DETAIL_WEIGHT_OUTPUT_ROOTS;
  await assert.rejects(withNativeReceiptBudget(root,narrowed,async()=>write(root,outputRoot+'/outer.json',{padding:'x'.repeat(1024)})),/total output reserve/);
  assert.equal(fs.existsSync(path.join(root,outputRoot,'outer.json')),false);assert.equal(process.env.DETAIL_WEIGHT_OUTPUT_ROOTS,saved);
  const legacyBudget={...result.ownedReceipt.budget,outputBytes:diskBytes+ordinaryReserveBytes+512};delete legacyBudget.terminalReserveBytes;
  const legacy={...result.ownedReceipt,budget:legacyBudget};
  await assert.rejects(withNativeReceiptBudget(root,legacy,async()=>write(root,outputRoot+'/legacy-reserve.json',{padding:'x'.repeat(1024)})),/total output reserve/);
  assert.equal(fs.existsSync(path.join(root,outputRoot,'legacy-reserve.json')),false);assert.equal(process.env.DETAIL_WEIGHT_OUTPUT_ROOTS,saved);
  // Without the 4096 stream-byte deduction this 1024-byte record would fit.
  const streamFixture={...result.ownedReceipt,streamBytes:{stdout:4096,stderr:0},budget:{...result.ownedReceipt.budget,outputBytes:diskBytes+4096+512}};
  await assert.rejects(withNativeReceiptBudget(root,streamFixture,async()=>write(root,outputRoot+'/stream-budget.json',{padding:'x'.repeat(1024)})),/total output reserve/);
  assert.equal(fs.existsSync(path.join(root,outputRoot,'stream-budget.json')),false);assert.equal(process.env.DETAIL_WEIGHT_OUTPUT_ROOTS,saved);
  results.push({name:'outer_write_namespace_and_stream_budget',status:'passed',nativeOwnerInvocations:1});
});
test('a one-MiB CPU task counts prior exact native namespaces across different Run roots',{timeout:120000},async()=>{
  const root=fs.mkdtempSync(path.join(evidenceRoot,'t56-cumulative-'));
  const firstOut=cpuTaskRoot+'/training/a',secondOut=cpuTaskRoot+'/training/b';
  const first=await cpuCall(root,firstOut,['-e','console.log("{}")']);assertPartition(first.ownedReceipt);
  const priorNamespace=first.ownedReceipt.guard.nativeEvidenceRoot,priorBinary=fs.readFileSync(first.ownedReceipt.nativeBuild.binary);
  fs.writeFileSync(path.join(root,priorNamespace,'prior-counted.bin'),Buffer.alloc(16384),{flag:'wx'});
  const priorBytes=countBytes(path.join(root,priorNamespace));
  // An unrelated directory in this fixture's guard store is not a CPU Run
  // binding and must not turn this bounded walk into a global-history scan.
  const unrelated='.runtime/ai-painter/owned-worker-guards/'+crypto.randomUUID();
  fs.mkdirSync(path.join(root,unrelated));fs.writeFileSync(path.join(root,unrelated,'unrelated.bin'),Buffer.alloc(1024),{flag:'wx'});
  const second=await cpuCall(root,secondOut,['-e','console.log(JSON.stringify({roots:JSON.parse(process.env.DETAIL_WEIGHT_OUTPUT_ROOTS),threads:process.env.OMP_NUM_THREADS}))']);
  const receipt=second.ownedReceipt,worker=JSON.parse(second.stdout);assertPartition(receipt);
  assert.deepEqual(new Set(receipt.outputAccountingRoots),new Set([cpuTaskRoot,priorNamespace,receipt.guard.nativeEvidenceRoot]));
  assert.equal(receipt.outputAccountingRoots.length,3);assert.deepEqual(worker.roots,receipt.outputAccountingRoots);assert.equal(worker.threads,'2');
  assert.equal(receipt.outputAccountingRoots.includes(unrelated),false);
  assert.notEqual(receipt.guard.nativeEvidenceRoot,priorNamespace);assert.deepEqual(fs.readFileSync(first.ownedReceipt.nativeBuild.binary),priorBinary);
  assert.equal(countBytes(path.join(root,priorNamespace)),priorBytes);assert.equal(receipt.cleanupConfirmed,true);
  assert.equal(fs.existsSync(path.join(root,guardRelative)),false);
  assert(accountingBytes(root,receipt)+receipt.streamBytes.stdout+receipt.streamBytes.stderr<=cpuFixtureBytes);
  results.push({name:'cpu_cross_run_namespace_cumulative',status:'passed',nativeOwnerInvocations:2,priorNamespaceBytes:priorBytes,outputAccountingRoots:receipt.outputAccountingRoots});
});
test('ordinary package writes hit their ceiling while failed worker live receipts still release its Job',{timeout:120000},async()=>{
  const root=fs.mkdtempSync(path.join(evidenceRoot,'t56-edge-')),outputRoot=cpuTaskRoot+'/training/edge';
  // Keep this producer small: the actual ledger is 1 MiB, not an 8 MiB padding
  // fixture. The worker uses only the existing environment-budgeted write().
  const producer=`
    import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';
    import {write} from ${JSON.stringify(packageUrl)};
    const root=${JSON.stringify(root)},out=${JSON.stringify(outputRoot)};
    const guard=JSON.parse(fs.readFileSync(path.join(root,${JSON.stringify(guardRelative)}),'utf8'));
    for(let n=0;!fs.existsSync(guard.startedEvidence)&&n<100;n++)await new Promise(resolve=>setTimeout(resolve,10));
    assert(fs.existsSync(guard.startedEvidence),'fixture owner start record');
    const roots=JSON.parse(process.env.DETAIL_WEIGHT_OUTPUT_ROOTS),maximum=Number(process.env.DETAIL_WEIGHT_OUTPUT_MAX);
    const count=dir=>fs.readdirSync(dir,{withFileTypes:true}).reduce((n,e)=>n+(e.isDirectory()?count(path.join(dir,e.name)):fs.statSync(path.join(dir,e.name)).size),0);
    const disk=()=>roots.reduce((n,r)=>n+count(path.join(root,r)),0);
    const padding=maximum-65536-disk()-256;
    assert(padding>0&&padding<=524288,'bounded ordinary fixture padding');
    write(root,out+'/ordinary-fill.bin',Buffer.alloc(padding));
    let refused=false;try{write(root,out+'/ordinary-overflow.bin',Buffer.alloc(1024));}catch(error){assert.match(String(error),/total output reserve/);refused=true;}
    assert(refused,'ordinary output ceiling must refuse the second write');
    process.stdout.write(JSON.stringify({refused,maximum,padding,threads:process.env.OMP_NUM_THREADS}));
    process.stderr.write('ordinary_output_ceiling\\n');process.exitCode=23;
  `;
  const error=await cpuCall(root,outputRoot,['--input-type=module','-e',producer]).catch(e=>e);
  assert(error instanceof Error);const receipt=error.ownedReceipt;assertPartition(receipt);
  const worker=JSON.parse(error.stdout);assert.equal(worker.refused,true);assert.equal(worker.maximum,receipt.budget.ordinaryOutputLimitBytes);assert.equal(worker.threads,'2');
  assert.equal(receipt.cleanupConfirmed,true);assert.equal(receipt.ownerClosed,true);assert.equal(receipt.proof.activeProcessesAfterCleanup,0);
  assert.equal(receipt.proof.assignedBeforeResume,true);assert.equal(receipt.proof.killOnJobClose,true);assert.notEqual(receipt.proof.exitCode,0);
  assert.equal(receipt.persistenceError,undefined);assert.equal(fs.existsSync(path.join(root,guardRelative)),false);
  assert.equal(fs.existsSync(path.join(root,outputRoot,'ordinary-overflow.bin')),false);
  const scope=path.join(root,outputRoot,'owned-cpu-'+receipt.guard.identity);
  const raw=JSON.parse(fs.readFileSync(path.join(scope,'original-receipt.json'))),final=JSON.parse(fs.readFileSync(path.join(scope,'release-receipt.json')));
  assert.equal(raw.cleanupConfirmed,false);assert.equal(final.cleanupConfirmed,true);assert.equal(final.guard.state,'released_after_live_empty_job');
  assert.equal(raw.guard.identity,receipt.guard.identity);assert.equal(final.guard.identity,receipt.guard.identity);
  assert.equal(digest(fs.readFileSync(path.join(root,error.receiptBinding.path))),error.receiptBinding.sha256);
  assert(accountingBytes(root,receipt)>receipt.budget.ordinaryOutputLimitBytes-ordinaryReserveBytes,'parent receipts must consume genuinely reserved capacity');
  const terminal=await withNativeReceiptBudget(root,receipt,()=>write(root,outputRoot+'/outer-failed.json',{status:'failed_closed',ownedReceipt:error.receiptBinding,automaticRetries:0}));
  assert.equal(JSON.parse(fs.readFileSync(path.join(root,terminal.path))).status,'failed_closed');
  // A final-record allowance is bounded to 64 KiB even if the hard ledger has
  // more headroom; this is not a generic worker output-budget bypass.
  await assert.rejects(withNativeReceiptBudget(root,receipt,()=>write(root,outputRoot+'/outer-too-large.bin',Buffer.alloc(ordinaryReserveBytes+1))),e=>e.code==='ERR_ASSERTION');
  assert.equal(fs.existsSync(path.join(root,outputRoot,'outer-too-large.bin')),false);
  assert(accountingBytes(root,receipt)+receipt.streamBytes.stdout+receipt.streamBytes.stderr<=cpuFixtureBytes);
  assert(countBytes(root)<=cpuFixtureBytes);assert(cpuFixtureBytes<=hardBytes);
  results.push({name:'ordinary_ceiling_preserves_live_finalization',status:'passed',nativeOwnerInvocations:1,workerExitCode:receipt.proof.exitCode,workerFailed:true,receiptBinding:error.receiptBinding,budget:receipt.budget,paddingBytes:worker.padding});
});
test('insufficient finalization capacity refuses before acquiring guard or starting a native owner',{timeout:120000},async()=>{
  const root=fs.mkdtempSync(path.join(evidenceRoot,'t56-capacity-'));
  const baseline=await cpuCall(root,cpuTaskRoot+'/training/baseline',['-e','console.log("{}")']);assertPartition(baseline.ownedReceipt);
  const outputRoot=cpuTaskRoot+'/training/refused',marker=path.join(root,'worker-must-not-start');
  // Derive a few-hundred-KiB fill from the actual partition. Never create a
  // seven-MiB negative fixture or alter a production guard to force this path.
  const padding=baseline.ownedReceipt.budget.ordinaryOutputLimitBytes-accountingBytes(root,baseline.ownedReceipt)+1;
  assert(padding>0&&padding<=512*1024);
  withOutputBudget({projectRoot:root,roots:[cpuTaskRoot],maximum:cpuFixtureBytes,reserveBytes:0},()=>write(root,outputRoot+'/bounded-fill.bin',Buffer.alloc(padding)));
  let guardWrites=0;const guard=path.join(root,guardRelative),originalWrite=fs.writeFileSync,originalOpen=fs.openSync;
  const isGuard=file=>(typeof file==='string'||file instanceof URL)&&path.resolve(String(file))===guard;
  let error;
  try{
    fs.writeFileSync=function(file,...args){if(isGuard(file))guardWrites++;return originalWrite.call(this,file,...args);};
    fs.openSync=function(file,...args){if(isGuard(file))guardWrites++;return originalOpen.call(this,file,...args);};
    error=await cpuCall(root,outputRoot,['-e',`require('node:fs').writeFileSync(${JSON.stringify(marker)},'unexpected worker')`]).catch(e=>e);
  }finally{fs.writeFileSync=originalWrite;fs.openSync=originalOpen;}
  assert(error instanceof Error);assert.match(String(error),/finalization capacity unavailable before guard/);
  assert.equal(guardWrites,0);assert.equal(fs.existsSync(guard),false);assert.equal(fs.existsSync(marker),false);
  assert.equal(error.ownedReceipt.guard.state,'not_acquired');assert.equal(error.ownedReceipt.nativeOwnerSpawnAttempted,false);assert.equal(error.ownedReceipt.workerStarted,false);
  const namespace=namespaceFor(outputRoot),entries=fs.readdirSync(path.join(root,namespace));
  assert.equal(entries.some(name=>name.endsWith('-started.json')),false);
  assert(error.ownedReceipt.nativeBuild,'compilation may complete but admission must precede guard acquisition');
  assert(countBytes(root)<=cpuFixtureBytes);
  results.push({name:'insufficient_terminal_capacity_pre_guard',status:'passed',nativeOwnerInvocations:1,rejectedCallOwnerInvocations:0,guardAcquisitionAttempts:guardWrites,paddingBytes:padding});
});
test('a prior CPU Run missing or forged pointer or current-Run alias never hides earlier namespace bytes',{timeout:120000},async()=>{
  const root=fs.mkdtempSync(path.join(evidenceRoot,'t56-alias-'));
  const firstOut=cpuTaskRoot+'/training/prior',secondOut=cpuTaskRoot+'/training/current';
  const first=await cpuCall(root,firstOut,['-e','console.log("{}")']);assertPartition(first.ownedReceipt);
  const priorPointer=path.join(root,firstOut,'native-evidence-root.json'),original=fs.readFileSync(priorPointer),binary=fs.readFileSync(first.ownedReceipt.nativeBuild.binary);
  const currentNamespace=namespaceFor(secondOut),current={schema:'detail-weight-native-evidence-root-v1',outputRoot:secondOut,nativeEvidenceRoot:currentNamespace};
  fs.mkdirSync(path.join(root,secondOut),{recursive:true});fs.mkdirSync(path.join(root,currentNamespace));
  fs.writeFileSync(path.join(root,secondOut,'native-evidence-root.json'),JSON.stringify(current)+'\n',{flag:'wx'});
  fs.writeFileSync(path.join(root,currentNamespace,'binding.json'),JSON.stringify(current)+'\n',{flag:'wx'});
  // A missing earlier pointer is not permission to omit its surviving native
  // bytes. The prior owned scope is still inside this exact CPU task root.
  const savedPointer=priorPointer+'.kept';fs.renameSync(priorPointer,savedPointer);
  try{await assert.rejects(cpuCall(root,secondOut,['-e','console.log("{}")']),e=>e.code==='ERR_ASSERTION');}
  finally{fs.renameSync(savedPointer,priorPointer);}
  assert.equal(fs.existsSync(path.join(root,guardRelative)),false);assert.deepEqual(fs.readdirSync(path.join(root,currentNamespace)),['binding.json']);
  const fakeNamespace='.runtime/ai-painter/owned-worker-guards/'+crypto.randomUUID();fs.mkdirSync(path.join(root,fakeNamespace));
  const forged={...JSON.parse(original),nativeEvidenceRoot:fakeNamespace},forgedBytes=JSON.stringify(forged)+'\n';
  fs.writeFileSync(priorPointer,forgedBytes);fs.writeFileSync(path.join(root,fakeNamespace,'binding.json'),forgedBytes,{flag:'wx'});
  await assert.rejects(cpuCall(root,secondOut,[]),e=>e.code==='ERR_ASSERTION');
  assert.equal(fs.existsSync(path.join(root,guardRelative)),false);assert.deepEqual(fs.readdirSync(path.join(root,currentNamespace)),['binding.json']);
  // This alias is byte-identical to a valid current binding, but is physically
  // stored under the prior Run. Checking only pointer/binding equality loses
  // the earlier namespace; the containing Run identity must also be checked.
  fs.writeFileSync(priorPointer,JSON.stringify(current)+'\n');
  await assert.rejects(cpuCall(root,secondOut,[]),e=>e.code==='ERR_ASSERTION');
  assert.equal(fs.existsSync(path.join(root,guardRelative)),false);assert.deepEqual(fs.readdirSync(path.join(root,currentNamespace)),['binding.json']);
  assert.deepEqual(fs.readFileSync(first.ownedReceipt.nativeBuild.binary),binary);
  assert.equal(digest(binary),first.ownedReceipt.nativeBuild.binarySha256);
  fs.writeFileSync(priorPointer,original);assert(countBytes(root)<=cpuFixtureBytes);
  results.push({name:'prior_namespace_loss_forgery_and_current_alias_refused',status:'passed',nativeOwnerInvocations:1,rejectedCalls:3});
});
test('ordinary review PNG larger than 64KiB remains separate from the bounded final-record allowance',{timeout:120000},async()=>{
  const root=fs.mkdtempSync(path.join(evidenceRoot,'t56-review-'));
  const outputRoot='.runtime/ai-painter/detail-weight-capture-managed-executions/review-budget/dry-review-owned';
  const result=await runNative({root,outputRoot,phase:'review',executable:process.execPath,args:['-e','console.log(JSON.stringify({synthetic:true}))']});
  const receipt=result.ownedReceipt;assert.equal(receipt.cleanupConfirmed,true);assert.equal(receipt.budget.outputBytes,16*1024**2);
  // Synthetic test pixels only. No original, reference or model image is read.
  const png=await sharp(crypto.randomBytes(256*192*3),{raw:{width:256,height:192,channels:3}}).resize(1024,768,{kernel:'nearest'}).png().toBuffer();
  assert(png.length>65536&&png.length<1048576);
  const reviewRoot=outputRoot.replace(/-owned$/u,''),image=await withNativeOrdinaryBudget(root,receipt,()=>write(root,reviewRoot+'/synthetic-auditor-input.png',png));
  assert.equal(digest(fs.readFileSync(path.join(root,image.path))),image.sha256);
  const metadata=await sharp(fs.readFileSync(path.join(root,image.path))).metadata();assert.deepEqual([metadata.width,metadata.height],[1024,768]);
  const audit=await withNativeOrdinaryBudget(root,receipt,()=>write(root,reviewRoot+'/synthetic-audit.json',{synthetic:true,nativeOwnedReceipt:result.receiptBinding,image}));
  assert.equal(JSON.parse(fs.readFileSync(path.join(root,audit.path))).synthetic,true);
  const before=accountingBytes(root,receipt);
  const exhausted={...receipt,budget:{...receipt.budget,ordinaryOutputLimitBytes:before+receipt.streamBytes.stdout+receipt.streamBytes.stderr+65536+512}};
  await assert.rejects(withNativeOrdinaryBudget(root,exhausted,()=>write(root,reviewRoot+'/refused.bin',Buffer.alloc(1024))),/total output reserve/);
  assert.equal(fs.existsSync(path.join(root,reviewRoot,'refused.bin')),false);
  const final=await withNativeReceiptBudget(root,receipt,()=>write(root,reviewRoot+'/synthetic-finalization.json',{synthetic:true,status:'failed_closed',audit}));
  assert.equal(JSON.parse(fs.readFileSync(path.join(root,final.path))).status,'failed_closed');
  const runRoot=outputRoot.slice(0,outputRoot.lastIndexOf('/'));
  const terminalFiles=[runRoot+'/finalization.json',runRoot+'/capsule-synthetic.json'];
  await withNativeReceiptBudget(root,receipt,()=>{
    write(root,terminalFiles[0],Buffer.alloc(34000));
    assert.throws(()=>write(root,terminalFiles[1],Buffer.alloc(33000)),/total output reserve/);
    assert.equal(fs.existsSync(path.join(root,terminalFiles[1])),false);
    assert.throws(()=>write(root,runRoot+'/unlisted.json',{synthetic:true}),/outside explicit accounting scope/);
    write(root,terminalFiles[1],{synthetic:true,status:'failed_closed'});
  },terminalFiles);
  const currentBytes=accountingBytes(root,receipt)+terminalFiles.reduce((n,f)=>n+fs.statSync(path.join(root,f)).size,0);
  const hardLimited={...receipt,budget:{...receipt.budget,outputBytes:currentBytes+receipt.streamBytes.stdout+receipt.streamBytes.stderr+512}};
  await assert.rejects(withNativeReceiptBudget(root,hardLimited,()=>write(root,reviewRoot+'/refused-hard-final.bin',Buffer.alloc(1024)),terminalFiles),/total output reserve/);
  assert.equal(fs.existsSync(path.join(root,reviewRoot,'refused-hard-final.bin')),false);
  assert.equal(fs.existsSync(path.join(root,guardRelative)),false);
  assert(countBytes(root)<hardBytes);
  results.push({name:'ordinary_review_png_not_terminal_capped',status:'passed',nativeOwnerInvocations:1,syntheticImageBytes:png.length,resolution:[1024,768],outOfDirectoryTerminalFilesCounted:true,cumulativeTerminalOverflowRefused:true,unlistedWritesRefused:true,qualificationGranted:false});
});
process.once('beforeExit',()=>{
  const payload=JSON.stringify({recordedAtUtc:new Date().toISOString(),evidenceRoot,results,gpuWorkerInvocations:0,trainingInvocations:0,productionGuardWritten:false},null,2);
  // The whole batch (including the seven retained cases and summary) shares
  // an 8 MiB artifact bound. Large negative cases use a 1 MiB private ledger.
  assert(countBytes(evidenceRoot)+Buffer.byteLength(payload)<=hardBytes,'native-path batch artifact ceiling');
  fs.writeFileSync(path.join(evidenceRoot,'results.json'),payload,{flag:'wx'});
  console.log(JSON.stringify({evidenceRoot,results:results.map(r=>({name:r.name,status:r.status}))}));
});
