import test from "node:test";
import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import {ARMS,TRAINING,TRAINING_V2,TRAINING_V3,RESOURCES,OWNED_FILES,summarize,decide,failureFacts,validatePredecessor,
  sealEndpointV2Request,sealEndpointV3Request,validateRequestStrategy,buildEndpointAbV2Request,buildEndpointAbV3Request,requestOf,
  TRAINING_V4,sealEndpointV4Request,buildEndpointAbV4Request,expectedEndpointRoute,PHASE4_POLICY,validatePhase4Policy,
  validateGpuRecheckResult,GPU_RECHECK_POLICY,CONTROLLED_TRAINING_POLICY} from "../lib/ai-painter-endpoint-ab-v1.mjs";
const hash="a".repeat(64), checkpoint={path:"parent.pt",sha256:hash};
const regions=["terrain_path_ground","object_footprints","object_tree","object_rock","object_vegetation"];
const metrics=value=>({final:{rgbMae:value,laplacianMae:value,edgeMae:value,phase4ResidualRmsAfterGlobalBiasRemoval:value},
  semanticRegions:Object.fromEntries(regions.map(k=>[k,{rgbMae:value,pixelWeight:10}]))});
function fixture(){
  const samples=["sample-a","sample-b"],outputRoot=".runtime/ai-painter/learning-capacity-experiments/test";
  const request={identity:"test",outputRoot,parentCheckpoint:checkpoint,selectedRows:samples.map(sampleId=>({sampleId,split:"train"}))};
  const expected=samples.flatMap((sampleId,i)=>[0,1,2].map(j=>({arm:"legacy_global_schedule_control",sampleId,seed:20264008+i+j*100,
    steps:10,noiseStateSha256:hash,image:{path:`old-${i}-${j}.png`,sha256:hash},measurements:metrics(2)})));
  const parentReplay=expected.map(e=>({...e,split:"train",fullEndpoint:true,targetUsedForInitialization:false,baseline:e.measurements,baselineImage:e.image}));
  const ledgers=ARMS.map((arm,a)=>({ledger:{schemaVersion:"ai-painter-train-split-step-evidence-v1",optimizerSteps:200,
    nonTrainOptimizerSteps:0,rejectedOptimizerStepAttempts:0,steps:Array.from({length:200},(_,n)=>({optimizerStep:n+1,
      sampleIds:[samples[n%2]],split:"train",datasetReleaseIdentity:"test",datasetSelectionSha256:hash}))},
    records:Array.from({length:200},(_,n)=>({optimizerStep:n+1,epoch:Math.floor(n/2),sampleId:samples[n%2],seed:20260909+n,
      route:a&&Math.floor(n/2)%2?"endpoint_rgb":"single_step",teacherTimestep:a&&Math.floor(n/2)%2?null:n,
      noiseSha256:hash,loss:1}))}));
  const result={schemaVersion:"ai-painter-endpoint-ab-result-v1",runId:"test",parentCheckpoint:checkpoint,training:TRAINING,resources:RESOURCES,
    status:"endpoint_ab_completed_not_visual_qualified",executionState:"completed",gpuStarted:true,trainingStarted:true,
    optimizerSteps:400,stepInFlight:false,finalStepCountKnown:true,checkpointReloadExact:true,formalQualificationAllowed:false,
    checkpointSelected:false,worldEntryAllowed:false,gpuSeconds:20,elapsedSeconds:40,
    numericRuntime:{strictDeterministicBackward:false,cudnnDeterministic:true},
    gpuProbes:["single_step","endpoint_rgb"].flatMap(route=>samples.map(sampleId=>({route,sampleId,optimizerCreated:false,
      modelStateUnchanged:true,baseOutputReached:true,gradientL2:1,frozenGradientCount:0}))),
    arms:ARMS.map(arm=>({arm,optimizerSteps:200,initialDenoiserStateSha256:hash,denoiserStateSha256:"b".repeat(64),
      frozenStateSha256:hash,trainingInputStateSha256:hash,frozenStateUnchanged:true,checkpointReloadExact:true,
      checkpoint:{path:`${outputRoot}/${arm}.pt`,sha256:hash}})),parentReplay,
    rows:ARMS.flatMap((arm,a)=>expected.map((e,n)=>({...e,arm,split:"train",fullEndpoint:true,targetUsedForInitialization:false,
      baseline:e.measurements,baselineImage:e.image,measurements:metrics(a?1:1.5),
      image:{path:`${outputRoot}/${arm}-${Math.floor(n/3)}-${n%3}.png`,sha256:hash}})))};
  return {request,result,sampled:{rows:expected},ledgers};
}
const run=f=>summarize(f.result,f.sampled,f.request,f.ledgers);
test("valid finite experiment does not grant visual approval or select a checkpoint",()=>{
  const summary=run(fixture()),decision=decide(summary,{path:"review.json",sha256:hash});
  assert.equal(summary.candidateVersusControl.rgbMae.improvedCount,6);
  assert.equal(decision.applied,false);assert.equal(decision.checkpointSelected,false);
  assert.equal(decision.formalQualificationAllowed,false);assert.equal(decision.nextMachineAction,null);
});
test("GPU and CPU contract constants agree exactly",()=>{
  const request=sealEndpointV2Request({schemaVersion:"ai-painter-endpoint-ab-request-v2",mode:"bounded_paired_endpoint_training",
    training:TRAINING_V2,resources:RESOURCES,unicodeBoundary:"原图"});
  const {identity,outputRoot,...payload}=request;
  const requestV3=sealEndpointV3Request({...payload,schemaVersion:"ai-painter-endpoint-ab-request-v3",training:TRAINING_V3});
  const raw=execFileSync(process.env.AI_PAINTER_CPU_TEST_PYTHON??"ml/ai-painter/.venv/Scripts/python.exe",["-c",
    "import json,sys,painter_endpoint_ab_experiment as p;print(json.dumps([p.TRAINING,p.RESOURCES,p.TRAINING_V2,p.request_strategy(json.loads(sys.argv[1])),p.TRAINING_V3,p.request_strategy(json.loads(sys.argv[2]))]))",JSON.stringify(request),JSON.stringify(requestV3)],{
    cwd:process.cwd(),windowsHide:true,timeout:10000,encoding:"utf8",env:{...process.env,CUDA_VISIBLE_DEVICES:"",PYTHONDONTWRITEBYTECODE:"1",
      PYTHONPATH:[path.resolve("ml/ai-painter/src"),path.resolve("ml/ai-painter/scripts")].join(path.delimiter)}});
  assert.deepEqual(JSON.parse(raw),[TRAINING,RESOURCES,TRAINING_V2,"v2",TRAINING_V3,"v3"]);
});
test("only current completed CPU gradient proof is an eligible predecessor",()=>{
  const p={schemaVersion:"ai-painter-endpoint-gradient-shadow-result-v1",status:"endpoint_gradient_shadow_completed_not_visual_qualified",
    executionState:"completed",runId:"current",summary:{cpuCandidatePathVerified:true,gpuCandidateQualified:false},optimizerSteps:0,trainingStarted:false};
  validatePredecessor(p,{runId:"current"});
  for(const patch of [{runId:"historical"},{schemaVersion:"ai-painter-rgb-composition-shadow-result-v1"},{executionState:"failed_closed"},
    {summary:{cpuCandidatePathVerified:false,gpuCandidateQualified:false}},{optimizerSteps:1}])
    assert.throws(()=>validatePredecessor({...p,...patch},{runId:"current"}));
});
test("budget incomplete updates unsafe flags and stale GPU probes rejected",()=>{
  for(const mutate of [f=>f.result.optimizerSteps=399,f=>f.result.finalStepCountKnown=false,f=>f.result.stepInFlight=true,
    f=>f.result.gpuSeconds=601,f=>f.result.training={...TRAINING,epochsPerArm:101},f=>f.result.gpuProbes.pop(),
    f=>f.result.gpuProbes[0].optimizerCreated=true,f=>f.result.gpuProbes[0].frozenGradientCount=1,f=>f.result.gpuProbes[0].gradientL2=NaN,
    f=>f.result.formalQualificationAllowed=true,f=>f.result.checkpointSelected=true]){
    const f=fixture();mutate(f);assert.throws(()=>run(f));
  }
});
test("per-image route bias altered seed and fabricated split step fail",()=>{
  for(const mutate of [f=>f.ledgers[1].records[1].route="endpoint_rgb",f=>f.ledgers[1].records[2].seed=20264008,
    f=>f.ledgers[1].records[0].teacherTimestep=999,f=>f.ledgers[1].records[0].noiseSha256="b".repeat(64),
    f=>f.ledgers[0].ledger.steps[0].split="challenge",f=>f.ledgers[1].ledger.steps[0].datasetReleaseIdentity="old",
    f=>f.ledgers[1].records.pop(),f=>f.result.arms[1].initialDenoiserStateSha256="b".repeat(64)]){
    const f=fixture();mutate(f);assert.throws(()=>run(f));
  }
});
test("all six outputs including regional regressions are retained",()=>{
  const f=fixture();f.result.rows[11].measurements.semanticRegions.object_rock.rgbMae=3;
  const summary=run(f);assert.equal(summary.candidateVersusControl.object_rock.worseCount,1);
  const d=decide(summary,{path:"review.json",sha256:hash});assert.equal(d.applied,false);
  for(const mutate of [f=>f.result.rows.pop(),f=>f.result.rows.reverse(),f=>f.result.rows[0].targetUsedForInitialization=true,
    f=>f.result.rows[0].steps=25,f=>f.result.rows[0].baseline=metrics(1),f=>f.result.rows[0].image.path="previous.png",
    f=>f.result.rows[0].measurements.final.rgbMae=NaN]){
    const g=fixture();mutate(g);assert.throws(()=>run(g));
  }
});
test("interrupted dispatch is unknown, never falsely reported as zero training",()=>{
  const unknown=failureFacts({dispatched:true,progress:{gpuStarted:true,trainingStarted:false,optimizerSteps:0,stepInFlight:true}});
  assert.equal(unknown.gpuStarted,true);assert.equal(unknown.trainingStarted,null);assert.equal(unknown.finalStepCountKnown,false);
  const confirmed=failureFacts({dispatched:true,progress:{gpuStarted:true,trainingStarted:true,optimizerSteps:37,stepInFlight:false}});
  assert.equal(confirmed.optimizerSteps,37);assert.equal(confirmed.finalStepCountKnown,false);
  assert.deepEqual(failureFacts({dispatched:false}),{gpuStarted:false,trainingStarted:false,optimizerSteps:0,stepInFlight:false,finalStepCountKnown:true});
});
test("terminal failure preserves actual optimizer count and uncertainty",()=>{
  const facts={gpuStarted:true,trainingStarted:true,optimizerSteps:91,stepInFlight:true,finalStepCountKnown:false};
  assert.deepEqual(failureFacts({dispatched:true,result:facts}),facts);
});

function asV2(){
  const f=fixture(),{identity,outputRoot,...payload}=f.request;
  f.request=sealEndpointV2Request({...payload,schemaVersion:"ai-painter-endpoint-ab-request-v2",
    mode:"bounded_paired_endpoint_training",training:TRAINING_V2,resources:RESOURCES});
  f.result.schemaVersion="ai-painter-endpoint-ab-result-v2";f.result.training=TRAINING_V2;f.result.runId=f.request.identity;
  f.result.gpuProbes.forEach(p=>{if(p.route==="endpoint_rgb")p.route="full_plus_endpoint";});
  f.result.arms.forEach(a=>a.checkpoint.path=`${f.request.outputRoot}/${a.arm}.pt`);
  f.result.rows.forEach((r,n)=>r.image.path=`${f.request.outputRoot}/${r.arm}-${Math.floor((n%6)/3)}-${n%3}.png`);
  f.ledgers.forEach((data,a)=>data.records.forEach((r,n)=>{
    data.ledger.steps[n].datasetReleaseIdentity=f.request.identity;
    const extra=a===1&&r.epoch%2===1;r.route=extra?"full_plus_endpoint":"single_step";r.teacherTimestep=n;
    r.fullObjectiveTerms=18;r.endpointObjectiveTerms=extra?11:0;
    if(extra){r.fullObjectiveValue=.6;r.endpointObjectiveValue=.4;r.endpointNoiseSha256=hash;}
  }));
  return f;
}
test("v2 keeps all 400 full objectives and exactly 100 additive endpoint objectives",()=>{
  const f=asV2();run(f);
  assert.equal(f.ledgers.flatMap(l=>l.records).filter(r=>r.fullObjectiveTerms===18).length,400);
  assert.equal(f.ledgers.flatMap(l=>l.records).filter(r=>r.endpointObjectiveTerms===11).length,100);
  for(const mutate of [f=>f.ledgers[1].records[2].fullObjectiveTerms=0,
    f=>f.ledgers[1].records[2].route="endpoint_rgb",f=>f.ledgers[1].records[2].endpointObjectiveValue=2,
    f=>f.ledgers[1].records[2].teacherTimestep=null,f=>f.result.arms[1].frozenStateUnchanged=false,
    f=>f.result.schemaVersion="ai-painter-endpoint-ab-result-v1"]){const g=asV2();mutate(g);assert.throws(()=>run(g));}
});
test("v2 schema training and identity cannot be substituted for v1",()=>{
  const f=asV2();validateRequestStrategy(f.request);
  for(const patch of [{schemaVersion:"ai-painter-endpoint-ab-request-v1"},{training:TRAINING},
    {identity:"painter-endpoint-ab-v2-"+hash},{resources:{...RESOURCES,automaticRetries:1}}])
    assert.throws(()=>validateRequestStrategy({...f.request,...patch}));
});
test("read-only v2 builder binds current program bytes and rejects post-seal changes",()=>{
  const fixtureRoot=path.resolve(process.env.AI_PAINTER_ENDPOINT_TEST_FIXTURE_ROOT??".runtime/t-q3-01-20260913/fixtures");fs.mkdirSync(fixtureRoot,{recursive:true});
  const root=fs.mkdtempSync(path.join(fixtureRoot,"request-"));
  const put=(file,value)=>{const p=path.join(root,file);fs.mkdirSync(path.dirname(p),{recursive:true});
    fs.writeFileSync(p,typeof value==="string"?value:JSON.stringify(value));return {path:file,sha256:crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex")};};
  const files=["scripts/lib/ai-painter-endpoint-ab-v1.mjs","ml/ai-painter/scripts/painter_endpoint_ab_experiment.py",
    "scripts/tests/test-ai-painter-endpoint-ab.mjs","ml/ai-painter/tests/test_endpoint_ab_experiment.py",
    "ml/ai-painter/src/ai_painter/complete_world/endpoint_rgb_experiment.py","ml/ai-painter/tests/test_endpoint_rgb_experiment.py",...OWNED_FILES];
  const receipts=files.map(p=>put(p,"fixture program v1"));
  const old={...fixture().request,schemaVersion:"ai-painter-endpoint-ab-request-v1",mode:"bounded_paired_endpoint_training",
    training:TRAINING,resources:RESOURCES,inputReceipts:receipts,boundaries:{}};
  const sourceRequest=put("old-request.json",old), sourceResult=put("old-result.json",{
    schemaVersion:"ai-painter-endpoint-ab-result-v1",request:sourceRequest,runId:old.identity,executionState:"completed",
    optimizerSteps:400,checkpointSelected:false,formalQualificationAllowed:false,parentCheckpoint:checkpoint,training:TRAINING});
  const options={sourceRequest,sourceResult,expectedPreviousRevision:1,expectedPreviousSha256:hash,latestTrainingRunId:"latest"};
  const before=fs.readdirSync(root);const request=buildEndpointAbV2Request(root,options);
  assert.deepEqual(fs.readdirSync(root),before);assert.equal(request.parentCheckpoint.sha256,checkpoint.sha256);
  const binding=put(`${request.outputRoot}/experiment-request.json`,request);
  const context={projectRoot:root,packageIdentity:request.identity,outputRoot:request.outputRoot,inputEvidence:[binding]};
  requestOf(context);
  for(const file of OWNED_FILES){put(file,"tampered owned dependency");assert.throws(()=>requestOf(context));put(file,"fixture program v1");}
  const {identity:oldIdentity,outputRoot:oldOutput,...newPayload}=request;
  for(const file of OWNED_FILES){
    const missing=sealEndpointV2Request({...newPayload,inputReceipts:request.inputReceipts.filter(b=>b.path!==file)});
    const missingBinding=put(`${missing.outputRoot}/experiment-request.json`,missing);
    assert.throws(()=>requestOf({...context,packageIdentity:missing.identity,outputRoot:missing.outputRoot,inputEvidence:[missingBinding]}));
  }
  put(files[1],"changed program v2");assert.throws(()=>requestOf(context));
  const revised=buildEndpointAbV2Request(root,options);assert.notEqual(revised.identity,request.identity);
  assert.throws(()=>buildEndpointAbV2Request(root,{...options,sourceRequest:{...sourceRequest,sha256:"0".repeat(64)}}));
  // Retain tiny synthetic evidence; no production files or recursive cleanup.
});

function asV3(){
  const f=asV2(),{identity,outputRoot,...payload}=f.request;
  f.request=sealEndpointV3Request({...payload,schemaVersion:"ai-painter-endpoint-ab-request-v3",training:TRAINING_V3});
  f.result.schemaVersion="ai-painter-endpoint-ab-result-v3";f.result.training=TRAINING_V3;f.result.runId=f.request.identity;
  f.result.arms.forEach(a=>a.checkpoint.path=`${f.request.outputRoot}/${a.arm}.pt`);
  f.result.rows.forEach((r,n)=>r.image.path=`${f.request.outputRoot}/${r.arm}-${Math.floor((n%6)/3)}-${n%3}.png`);
  f.ledgers.forEach((data,a)=>data.records.forEach((r,n)=>{
    data.ledger.steps[n].datasetReleaseIdentity=f.request.identity;
    const extra=a===1&&r.epoch%4===3;r.route=extra?"full_plus_endpoint":"single_step";
    r.endpointObjectiveTerms=extra?11:0;
    if(!extra){delete r.fullObjectiveValue;delete r.endpointObjectiveValue;delete r.endpointNoiseSha256;}
  }));
  return f;
}
test("v3 requires 400 full objectives and 50 additions at epoch mod4 equals 3",()=>{
  const f=asV3();run(f);
  assert.equal(f.ledgers.flatMap(l=>l.records).filter(r=>r.fullObjectiveTerms===18).length,400);
  assert.equal(f.ledgers.flatMap(l=>l.records).filter(r=>r.endpointObjectiveTerms===11).length,50);
  for(const mutate of [f=>f.ledgers[1].records[2].route="full_plus_endpoint",f=>f.ledgers[1].records[6].route="single_step",
    f=>f.ledgers[1].records[6].fullObjectiveTerms=0,f=>f.ledgers[1].records[6].endpointObjectiveValue=2,
    f=>f.result.schemaVersion="ai-painter-endpoint-ab-result-v2",f=>f.result.training=TRAINING_V2]){
    const g=asV3();mutate(g);assert.throws(()=>run(g));
  }
});
test("v3 builder preserves original parent, rejects old predecessor and stale program receipts",()=>{
  const base=path.resolve(process.env.AI_PAINTER_ENDPOINT_TEST_FIXTURE_ROOT??".runtime/t-q4-01/fixtures");fs.mkdirSync(base,{recursive:true});
  const root=fs.mkdtempSync(path.join(base,"v3-request-"));
  const put=(file,value)=>{const p=path.join(root,file);fs.mkdirSync(path.dirname(p),{recursive:true});
    fs.writeFileSync(p,typeof value==="string"?value:JSON.stringify(value));return {path:file,sha256:crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex")};};
  const files=["scripts/lib/ai-painter-endpoint-ab-v1.mjs","ml/ai-painter/scripts/painter_endpoint_ab_experiment.py",
    "scripts/tests/test-ai-painter-endpoint-ab.mjs","ml/ai-painter/tests/test_endpoint_ab_experiment.py",
    "ml/ai-painter/src/ai_painter/complete_world/endpoint_rgb_experiment.py","ml/ai-painter/tests/test_endpoint_rgb_experiment.py",...OWNED_FILES];
  const receipts=files.map(p=>put(p,"fixture v2 program"));
  const f=asV2(),{identity,outputRoot,...payload}=f.request;
  const old=sealEndpointV2Request({...payload,inputReceipts:receipts,boundaries:{},parentCheckpoint:checkpoint});
  const sourceRequest=put("old-v2-request.json",old);
  const result={schemaVersion:"ai-painter-endpoint-ab-result-v2",runId:old.identity,request:sourceRequest,executionState:"completed",
    optimizerSteps:400,checkpointSelected:false,formalQualificationAllowed:false,parentCheckpoint:checkpoint,training:TRAINING_V2,
    arms:[{arm:ARMS[1],checkpoint:{path:"failed-v2-candidate.pt",sha256:"b".repeat(64)}}]};
  const sourceResult=put("old-v2-result.json",result);
  const options={sourceRequest,sourceResult,expectedPreviousRevision:2,expectedPreviousSha256:hash,latestTrainingRunId:old.identity};
  const before=fs.readdirSync(root);const request=buildEndpointAbV3Request(root,options);assert.deepEqual(fs.readdirSync(root),before);
  assert.deepEqual(request.parentCheckpoint,checkpoint);assert.notDeepEqual(request.parentCheckpoint,result.arms[0].checkpoint);
  assert.equal(request.boundaries.candidateLoss,"200_old_full_single_step_plus_50_existing_11_RGB_endpoint_objectives");
  const binding=put(`${request.outputRoot}/experiment-request.json`,request);
  const context={projectRoot:root,packageIdentity:request.identity,outputRoot:request.outputRoot,inputEvidence:[binding]};
  requestOf(context);
  for(const file of OWNED_FILES){put(file,"tampered v3 owned dependency");assert.throws(()=>requestOf(context));put(file,"fixture v2 program");}
  for(const patch of [{schemaVersion:"ai-painter-endpoint-ab-request-v2"},{training:TRAINING_V2},{parentCheckpoint:result.arms[0].checkpoint}])
    assert.throws(()=>validateRequestStrategy({...request,...patch}));
  put(files[1],"fixture v3 program");assert.throws(()=>requestOf(context));
  assert.notEqual(buildEndpointAbV3Request(root,options).identity,request.identity);
  const bad=put("wrong-parent-result.json",{...result,parentCheckpoint:result.arms[0].checkpoint});
  assert.throws(()=>buildEndpointAbV3Request(root,{...options,sourceResult:bad}));
  const legacy=put("v1-result.json",{...result,schemaVersion:"ai-painter-endpoint-ab-result-v1"});
  assert.throws(()=>buildEndpointAbV3Request(root,{...options,sourceResult:legacy}));
});

function asV4(){
  const f=asV3(),{identity,outputRoot,...payload}=f.request;
  f.request=sealEndpointV4Request({...payload,schemaVersion:"ai-painter-endpoint-ab-request-v4",training:TRAINING_V4});
  f.result.schemaVersion="ai-painter-endpoint-ab-result-v4";f.result.training=TRAINING_V4;f.result.runId=f.request.identity;
  f.result.arms.forEach(a=>a.checkpoint.path=`${f.request.outputRoot}/${a.arm}.pt`);
  f.result.rows.forEach((r,n)=>r.image.path=`${f.request.outputRoot}/${r.arm}-${Math.floor((n%6)/3)}-${n%3}.png`);
  f.result.gpuProbes.forEach((p,n)=>{p.route=n<2?"full_plus_endpoint":"full_plus_endpoint_phase4";if(n>=2)p.phase4GradientL2=1;});
  f.ledgers.forEach((data,a)=>data.records.forEach((r,n)=>{
    data.ledger.steps[n].datasetReleaseIdentity=f.request.identity;
    r.route=expectedEndpointRoute('v4',ARMS[a],r.epoch);
    const endpoint=r.epoch%4===3,phase=endpoint&&a===1;
    r.endpointObjectiveTerms=endpoint?11:0;r.phase4ObjectiveTerms=phase?1:0;
    if(endpoint){r.fullObjectiveValue=.6;r.endpointObjectiveValue=phase?.5:.4;r.endpointNoiseSha256=hash;r.loss=phase?1.1:1;}
    if(phase){r.phase4Loss=.1;r.phase4Coefficient=1;r.existingEndpointObjectiveValue=.4;}
  }));
  return f;
}
test("v4 keeps equal endpoint schedule and changes only one candidate loss",()=>{
  const f=asV4();run(f);
  for(const l of f.ledgers)assert.equal(l.records.filter(r=>r.endpointObjectiveTerms===11).length,50);
  assert.equal(f.ledgers[0].records.filter(r=>r.phase4ObjectiveTerms).length,0);
  assert.equal(f.ledgers[1].records.filter(r=>r.phase4ObjectiveTerms).length,50);
  for(const mutate of [f=>f.ledgers[0].records[6].route='single_step',
    f=>f.ledgers[0].records[6].phase4Loss=.1,f=>f.ledgers[1].records[6].phase4Coefficient=2,
    f=>f.ledgers[1].records[6].phase4Loss=.9,f=>f.ledgers[1].records[6].phase4ObjectiveTerms=0,
    f=>f.result.gpuProbes[0].route='single_step',f=>f.result.training=TRAINING_V3]){
    const g=asV4();mutate(g);assert.throws(()=>run(g));
  }
  const d=decide(run(f),{path:'review.json',sha256:hash});
  assert.equal(d.formalQualificationAllowed,false);assert.equal(d.automaticRetrainingAllowed,false);
});
test("v4 Python/Node formula constants and immutable policy agree",()=>{
  const request=asV4().request;
  const raw=execFileSync(process.env.AI_PAINTER_CPU_TEST_PYTHON??"ml/ai-painter/.venv/Scripts/python.exe",["-c",
    "import json,sys,painter_endpoint_ab_experiment as p;print(json.dumps([p.TRAINING_V4,p.request_strategy(json.loads(sys.argv[1]))]))",JSON.stringify(request)],{
    cwd:process.cwd(),windowsHide:true,timeout:10000,encoding:'utf8',env:{...process.env,CUDA_VISIBLE_DEVICES:'',PYTHONDONTWRITEBYTECODE:'1',
      PYTHONPATH:[path.resolve('ml/ai-painter/src'),path.resolve('ml/ai-painter/scripts')].join(path.delimiter)}});
  assert.deepEqual(JSON.parse(raw),[TRAINING_V4,'v4']);
  const b={path:PHASE4_POLICY,sha256:crypto.createHash('sha256').update(fs.readFileSync(PHASE4_POLICY)).digest('hex')};
  const policy=validatePhase4Policy(process.cwd(),b);assert.equal(policy.executionLimit,1);assert.equal(policy.coefficient,1);
  assert.throws(()=>validatePhase4Policy(process.cwd(),{...b,sha256:hash}));
});

test("GPU recheck requires zero updates all current proofs and no checkpoint",()=>{
  const f=asV4(),request={...f.request,executionMode:'gpu_qualification_only'};
  const b={path:'request.json',sha256:hash};
  const r={...f.result,schemaVersion:'ai-painter-endpoint-ab-gpu-qualification-v4',
    request:b,status:'endpoint_ab_v4_zero_update_gpu_qualified',optimizerCreated:false,optimizerSteps:0,
    trainingStarted:false,arms:[],peakAllocatedMiB:4000,peakReservedMiB:4500};
  assert.equal(validateGpuRecheckResult(r,request,b).optimizerSteps,0);
  for(const patch of [{optimizerCreated:true},{optimizerSteps:1},{trainingStarted:true},{arms:[{}]},
    {request:{}},{gpuProbes:r.gpuProbes.slice(1)},{formalQualificationAllowed:true},
    {resources:{...RESOURCES,cudaMemoryFraction:.9}},{gpuSeconds:600}])
    assert.throws(()=>validateGpuRecheckResult({...r,...patch},request,b));
  const wrong=structuredClone(r);wrong.gpuProbes[2].phase4GradientL2=0;
  assert.throws(()=>validateGpuRecheckResult(wrong,request,b));
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync(GPU_RECHECK_POLICY.path)).digest('hex'),GPU_RECHECK_POLICY.sha256);
  assert.throws(()=>validateRequestStrategy({...request,executionMode:'train_anyway'}));
});

test("controlled successor keeps exactly the v4 formula and frozen 400 update policy",()=>{
  const {identity,outputRoot,...payload}=asV4().request;
  const request=sealEndpointV4Request({...payload,executionMode:'bounded_training_after_gpu_recheck',controlledTrainingPolicy:CONTROLLED_TRAINING_POLICY});
  validateRequestStrategy(request);assert.deepEqual(request.training,TRAINING_V4);
  const raw=fs.readFileSync(CONTROLLED_TRAINING_POLICY.path);
  assert.equal(crypto.createHash('sha256').update(raw).digest('hex'),CONTROLLED_TRAINING_POLICY.sha256);
  const policy=JSON.parse(raw);assert.equal(policy.executionLimit,1);assert.equal(policy.totalOptimizerStepLimit,400);
  assert.equal(policy.automaticRetries,0);assert.equal(policy.cudaMemoryFraction,.7);assert.equal(policy.freshCurrentPackageGpuProbesRequired,true);
  assert.equal(policy.formalQualificationAllowed,false);
  for(const patch of [{executionMode:'gpu_qualification_only'},{training:{...TRAINING_V4,phase4Coefficient:2}}])
    assert.throws(()=>validateRequestStrategy({...request,...patch}));
});
