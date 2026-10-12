// Internal leased CPU acceptance. One native Job contains the entire batch.
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {spawnSync} from "node:child_process"
import {fileURLToPath} from "node:url"
import {inside,read,json,bind,write,sha} from "./lib/ai-painter-mvp256-dry-detail-weight-package-chain-v1.mjs"
import {runNative} from "./run-ai-painter-mvp256-dry-detail-weight-training.mjs"
import {initializeCurrentExecutionRegistry,advanceCurrentExecutionRegistry,readCurrentExecutionRegistry} from "../src/server/ai-painter-current-execution-registry.mjs"
const SELF=fileURLToPath(import.meta.url),REGISTRY=".runtime/ai-painter/current-execution-registry/current.json"
const MODULES=["test_detail_weight_managed_checkpoint","test_painter_stage4_detail_weight_managed_worker","test_qualify_stage4_detail_weight_gpu","test_review_stage4_detail_weight_cpu"]
export function validateBatch(raw){assert.equal(raw.failed,0);assert.equal(raw.errors,0);assert.equal(raw.skipped,0);assert.ok(raw.passed>0);assert.equal(raw.items.length,raw.passed);assert.ok(raw.items.every(x=>x.status==="passed"));assert.equal(raw.gpuInitialized,false);assert.equal(raw.synthetic,true);assert.ok(raw.actualOptimizerStepAttempts.generator<=2&&raw.actualOptimizerStepAttempts.discriminator<=3);assert.ok(raw.actualOptimizerSteps.generator<=raw.actualOptimizerStepAttempts.generator&&raw.actualOptimizerSteps.discriminator<=raw.actualOptimizerStepAttempts.discriminator);assert.ok(raw.actualCalls.generatorForwards<=12&&raw.actualCalls.generatorGradientCompleted<=24&&raw.actualCalls.discriminatorGradientCompleted<=6)}
export async function isolatedRegistry(projectRoot,root,programBindings){
 const stamp=new Date().toISOString(),candidate=write(root,".runtime/fixture/plan/candidate.json",{schemaVersion:"stage4-post-decode-bounded-candidate-v1",status:"cpu_inactive_candidate_planned_not_implemented",selectedCandidate:{candidateKind:"synthetic_fixture"},recordedAtUtc:stamp})
 const terminal=write(root,".runtime/fixture/plan/terminal.json",{schemaVersion:"stage4-post-decode-failure-bounded-planning-terminal-v1",executionState:"completed",status:"bounded_candidate_planning_completed",planningRunId:"synthetic-plan",nextAction:"synthetic-next",candidate,recordedAtUtc:stamp})
 const capsule=write(root,".runtime/fixture/plan/capsule.json",{schemaVersion:"ai-painter-local-task-capsule-v2",latestTerminal:terminal,recordedAtUtc:stamp})
 const last=write(root,".runtime/fixture/prior/terminal.json",{schemaVersion:"stage4-post-decode-object-rgb-stage0-terminal-v1",executionState:"completed",status:"post_decode_object_rgb_stage0_real_visual_failure",runId:"synthetic-prior",synthetic:true})
 for(const [name,value] of [["execution-state.json",{status:"completed"}],["machine-review.json",{synthetic:true}],["training-output/progress.json",{synthetic:true}]])write(root,".runtime/fixture/prior/"+name,value)
 const before=await initializeCurrentExecutionRegistry({projectRoot:root,currentTaskCapsulePath:capsule.path,currentTaskTerminalPath:terminal.path,currentCandidatePath:candidate.path,latestTrainingTerminalPath:last.path,archivedEvidenceNamespaces:[".runtime/fixture/archive"]});assert.equal(before.ok,true)
 const evidence=write(root,".runtime/fixture/next/evidence.json",{synthetic:true,programBindings})
 const nextTerminal=write(root,".runtime/fixture/next/terminal.json",{schemaVersion:"detail-weight-synthetic-registry-terminal-v1",executionState:"completed",status:"synthetic_registry_roundtrip",runId:"synthetic-next",formalStage4QualificationGranted:false,runtimePublicationGranted:false})
 const nextCapsule=write(root,".runtime/fixture/next/capsule.json",{schemaVersion:"ai-painter-local-task-capsule-v1",integrity:{status:"verified"},evidence:[{...evidence,kind:"synthetic_structure",sha256Verified:true}]})
 const advanced=await advanceCurrentExecutionRegistry({projectRoot:root,capabilityVersion:"detail-weight-synthetic-only",packageId:"synthetic-package",taskId:"synthetic-next",taskKind:"cpu_structure",taskGoal:"Synthetic registry write and independent readback",priority:5,queueStatus:"completed",nextMachineAction:null,queuedAtUtc:stamp,runId:"synthetic-next",lifecycleStage:"synthetic",executionState:"completed",activity:"completed",taskCapsulePath:nextCapsule.path,terminalEvidencePath:nextTerminal.path,activeExecution:null,expectedPreviousRegistryRevision:before.registry.registryRevision,expectedPreviousRegistrySha256:before.registrySha256})
 assert.equal(advanced.ok,true);const readback=await readCurrentExecutionRegistry(root);assert.equal(readback.ok,true);assert.equal(readback.registrySha256,advanced.registrySha256);assert.equal(readback.registry.registryRevision,before.registry.registryRevision+1)
 return {status:"isolated_registry_roundtrip_verified",registryRevisionBefore:before.registry.registryRevision,registryRevisionAfter:readback.registry.registryRevision,registrySha256:readback.registrySha256,programBindings,productionRegistryChanged:false,synthetic:true}
}
const PYTHON_BATCH=String.raw`
import sys,json,unittest,torch
from pathlib import Path
root=Path(sys.argv[1]);sys.path[:0]=[str(root/'ml/ai-painter/tests'),str(root/'ml/ai-painter/scripts'),str(root/'ml/ai-painter/src')]
torch.set_num_threads(2)
counts={'generator':0,'discriminator':0};attempts={'generator':0,'discriminator':0};calls={'generatorForwardAttempted':0,'generatorForwards':0,'generatorGradientAttempted':0,'generatorGradientCompleted':0,'discriminatorGradientAttempted':0,'discriminatorGradientCompleted':0};assigned={};ordinal=[0]
original_init=torch.optim.AdamW.__init__;original_step=torch.optim.AdamW.step;original_forward=torch.nn.Module._call_impl

def init(self,*a,**k):
 original_init(self,*a,**k);kind='generator' if ordinal[0]%2==0 else 'discriminator';ordinal[0]+=1;self._synthetic_kind=kind
 for group in self.param_groups:
  for p in group['params']:
   assigned[id(p)]=kind

def step(self,*a,**k):
 kind=self._synthetic_kind
 if attempts[kind]>=(2 if kind=='generator' else 3):raise RuntimeError('optimizer budget')
 attempts[kind]+=1
 value=original_step(self,*a,**k);counts[kind]+=1;return value

def forward(self,*a,**k):
 if any(assigned.get(id(p))=='generator' for p in self.parameters()):
  if calls['generatorForwardAttempted']>=12:raise RuntimeError('forward budget')
  calls['generatorForwardAttempted']+=1;value=original_forward(self,*a,**k);calls['generatorForwards']+=1;return value
 return original_forward(self,*a,**k)
torch.optim.AdamW.__init__=init;torch.optim.AdamW.step=step;torch.nn.Module._call_impl=forward
class Result(unittest.TextTestResult):
 def __init__(self,*a,**k):super().__init__(*a,**k);self.items=[]
 def addSuccess(self,t):super().addSuccess(t);self.items.append({'name':t.id(),'status':'passed','executionKind':'synthetic_simulation' if 'simulated' in t.id() else 'synthetic_cpu'})
 def addFailure(self,t,e):super().addFailure(t,e);self.items.append({'name':t.id(),'status':'failed'})
 def addError(self,t,e):super().addError(t,e);self.items.append({'name':t.id(),'status':'error'})
 def addSkip(self,t,e):super().addSkip(t,e);self.items.append({'name':t.id(),'status':'skipped'})
import painter_stage4_detail_weight_managed_worker as managed
from ai_painter.complete_world import detail_weight_managed_checkpoint as checkpoint
import check_stage4_mvp256_dry_appearance_regime_cpu as source
reader=source.Reader(root);_,candidate_binding=reader.snapshot(checkpoint.CANDIDATE_PATH);config=checkpoint.derive_configuration(reader,candidate_binding,{'path':checkpoint.SPEC_PATH,'sha256':checkpoint.SPEC_SHA})
import test_painter_stage4_detail_weight_managed_worker as pair_tests
def event(stage,kind):
 key=kind+('Attempted' if stage=='attempt' else 'Completed');limit=24 if kind=='generatorGradient' else 6
 if calls[key]>=limit:raise RuntimeError('gradient budget')
 calls[key]+=1
 if stage=='complete' and calls[key]>calls[kind+'Attempted']:raise RuntimeError('gradient completion without attempt')
pair_tests.update_event=event
suite=unittest.defaultTestLoader.loadTestsFromNames(json.loads(sys.argv[2]));result=unittest.TextTestRunner(verbosity=2,resultclass=Result).run(suite)
print(json.dumps({'items':result.items,'passed':len(result.items)-len(result.failures)-len(result.errors)-len(result.skipped),'failed':len(result.failures),'errors':len(result.errors),'skipped':len(result.skipped),'synthetic':True,'configuration':config,'actualOptimizerSteps':counts,'actualOptimizerStepAttempts':attempts,'actualCalls':calls,'gpuInitialized':torch.cuda.is_initialized()}))
sys.exit(0 if result.wasSuccessful() else 1)
`
export async function accept({root,outputRoot,programBindings}){
 assert.ok(outputRoot.startsWith(".runtime/ai-painter/detail-weight-lifecycle-completion-t-q4-47/training/"));for(const b of Object.values(programBindings))read(root,b)
 const productionBefore=fs.readFileSync(inside(root,REGISTRY)),input=write(root,outputRoot+"/cpu-input.json",{programBindings,productionRegistrySha256:sha(productionBefore)})
 try{
  const result=await runNative({root,outputRoot,phase:"cpu",executable:process.execPath,args:[SELF,"--internal-owned-child",root,outputRoot,input.path,input.sha256]})
  const rawBinding=bind(root,outputRoot+"/raw-tests.json"),raw=json(root,rawBinding);validateBatch(raw)
  assert.ok(fs.readFileSync(inside(root,REGISTRY)).equals(productionBefore),"CPU batch changed production registry")
  for(const b of Object.values(programBindings))read(root,b)
  const isolatedBinding=bind(root,outputRoot+"/isolated-registry-proof.json");assert.equal(json(root,isolatedBinding).status,"isolated_registry_roundtrip_verified")
  return write(root,outputRoot+"/acceptance.json",{schema:"detail-weight-lifecycle-cpu-acceptance-v1",status:"passed",programBindings,testResult:rawBinding,ownedReceipt:result.receiptBinding,isolatedRegistryProof:isolatedBinding,gpuInitialized:false,realTrainingStarted:false,synthetic:true,automaticRetries:0})
 }catch(error){try{write(root,outputRoot+"/acceptance-failure.json",{status:"failed_closed",error:String(error).slice(0,4096),ownedReceipt:error.receiptBinding??null,gpuInitialized:false,realTrainingStarted:false})}catch(secondary){error.secondaryEvidenceError=String(secondary)}throw error}
}
async function child(root,out,inputBinding){
 const input=json(root,inputBinding);for(const b of Object.values(input.programBindings))read(root,b)
 const deadline=Date.now()+110000
 const result=spawnSync(inside(root,"ml/ai-painter/.venv/Scripts/python.exe"),["-B","-c",PYTHON_BATCH,root,JSON.stringify(MODULES)],{cwd:root,env:{...process.env,CUDA_VISIBLE_DEVICES:"",PYTHONDONTWRITEBYTECODE:"1",OMP_NUM_THREADS:"2",MKL_NUM_THREADS:"2"},windowsHide:true,timeout:Math.max(1,deadline-Date.now()),encoding:"utf8",maxBuffer:2097152})
 const log=write(root,out+"/python-stderr.txt",Buffer.from(result.stderr??"")),raw=JSON.parse(result.stdout??"{}");raw.pythonLog=log
 process.env.DETAIL_WEIGHT_INTERNAL_BATCH="1"
 const {runCases}=await import("./tests/ai-painter-mvp256-dry-detail-weight-integration.test.mjs")
 const fixture=suffix=>{const value=inside(root,out+"/fixtures/"+suffix);fs.mkdirSync(value,{recursive:true});return value}
 const js=await runCases({projectRoot:root,fixture});raw.items.push(...js);raw.passed+=js.filter(x=>x.status==="passed").length;raw.failed+=js.filter(x=>x.status!=="passed").length
 write(root,out+"/raw-tests.json",raw);assert.equal(result.status,0,result.error?.message??"python batch failed");validateBatch(raw)
 assert.ok(Date.now()<deadline,"CPU child batch deadline")
 const proof=await isolatedRegistry(root,fixture("registry"),input.programBindings)
 assert.equal(sha(fs.readFileSync(inside(root,REGISTRY))),input.productionRegistrySha256);write(root,out+"/isolated-registry-proof.json",proof)
 console.log(JSON.stringify({status:"synthetic_cpu_batch_completed",raw:bind(root,out+"/raw-tests.json")}))
}
if(process.argv[2]==="--internal-owned-child"){try{await child(process.argv[3],process.argv[4],{path:process.argv[5],sha256:process.argv[6]})}catch(error){console.error(String(error));process.exitCode=1}}
