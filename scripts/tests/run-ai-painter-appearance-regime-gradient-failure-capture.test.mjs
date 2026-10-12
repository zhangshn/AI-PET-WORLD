import { describePolicy, POLICY_PATH, HISTORICAL_DOCUMENTS, validateV28Review, managedChild, closeDecision as closeDecisionForTest } from "../run-ai-painter-appearance-regime-gradient-failure-capture.mjs"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import crypto from "node:crypto"
import test from "node:test"
import { Linter } from "eslint"
import { initializeIsolatedRegistry, commitIsolatedPackage, directoryIdentity, requireSameDirectory, validateIsolationParent } from "../run-ai-painter-appearance-regime-gradient-failure-capture.mjs"
import { buildBasePackage, PROGRAMS, run, validateNumericCpuReport, FROZEN_REGISTRY_INPUT, readNumericInput } from "../run-ai-painter-appearance-regime-gradient-failure-capture.mjs"
import { CAPABILITY } from "../lib/ai-painter-mvp256-dry-appearance-regime-package-chain-v1.mjs"
import { boundJson, writeExclusive } from "../run-ai-painter-mvp256-dry-v24-training.mjs"
import { readCurrentExecutionRegistry, advanceCurrentExecutionRegistry } from "../../src/server/ai-painter-current-execution-registry.mjs"
import { readBoundTrainingPresentation } from "../../src/server/ai-console/bound-training-presentation.mjs"
import { SNAPSHOT_ANALYSIS, snapshotProgramBindings, snapshotCanonical, dispatchClosedFailureAnalysis } from "../run-ai-painter-appearance-regime-gradient-failure-capture.mjs"
const root = path.resolve(import.meta.dirname,"../..")
const evidence = JSON.parse(fs.readFileSync(path.join(root,
  ".runtime/ai-painter/stage4-mvp256-dry-v27-v3-executions/mvp256-dry-v27-v3-43ec72f180bd1a412baf3aa8de15a36de9730f65bebf8117/dry-review/diagnostics/generalization-034fbef2a60847e3e2b7d9ec6a7c830dee89e1c11a1e77fbf306fc86bae13e72/gradient-failure-capture-t-q4-37/lifecycle-workorder.json")))
const isolationEvidenceRoot = evidence.outputRoot
if (process.env.AI_PAINTER_TEST_EVIDENCE_LOGICAL_ROOT) evidence.outputRoot = process.env.AI_PAINTER_TEST_EVIDENCE_LOGICAL_ROOT
const parent = JSON.parse(fs.readFileSync(path.join(root,"data/ai-painter/system-governance/stage4-mvp256-dry-v24-closed-loop-candidate-v1.json")))
function temporary() {
  const alias = process.env.AI_PAINTER_TEST_EVIDENCE_ROOT ?? path.join(root,evidence.outputRoot)
  requireSameDirectory(alias,path.join(root,evidence.outputRoot))
  const base = path.join(alias,"synthetic-tests")
  fs.mkdirSync(base,{recursive:true})
  const directory=path.join(base,"case-"+crypto.randomBytes(4).toString("hex"))
  fs.mkdirSync(directory)
  return directory
}
function ready(directory) {
  const programBindings = Object.fromEntries(Object.keys(PROGRAMS).map(role =>
    [role,writeExclusive(directory,"fixture/"+role+".json",{synthetic:true,role})]))
  const policyBinding = writeExclusive(directory,"fixture/policy.json",{synthetic:true})
  const policy = { predecessorCandidate: writeExclusive(directory,"data/ai-painter/system-governance/stage4-mvp256-dry-v24-closed-loop-candidate-v1.json",parent),
    cpuAcceptance:writeExclusive(directory,"fixture/cpu.json",{synthetic:true}),
    modelCpuEvidence:writeExclusive(directory,"fixture/model-cpu.json",{synthetic:true}), programBindings }
  return {root:directory,parent,policy,policyBinding,programBindings}
}

function ownedReceipt(exitCode) {
  return { cleanupConfirmed:true, liveOwnerCleanupConfirmed:true, ownerClosed:true,
    ownerIdentity:{pid:123}, proof:{ownerPid:123,assignedBeforeResume:true,
      activeProcessesAfterCleanup:0,exitCode,bindingBase64:"synthetic-owned-binding"} }
}
function dispatchFixture() {
  const directory=temporary(), programs=snapshotProgramBindings(root)
  for(const row of [...programs,SNAPSHOT_ANALYSIS.formalSpecification]) {
    // A synthetic policy exercises the hook's exact frozen contract, independently
    // of the newer live specification. Never substitute a different SHA/version.
    const source=row === SNAPSHOT_ANALYSIS.formalSpecification && process.env.AI_PAINTER_TEST_FROZEN_FORMAL
      ? process.env.AI_PAINTER_TEST_FROZEN_FORMAL : path.join(root,row.path)
    assert.equal(crypto.createHash("sha256").update(fs.readFileSync(source)).digest("hex"),row.sha256)
    const target=path.join(directory,row.path);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(source,target)
  }
  const outputRoot=".runtime/ai-painter/stage4-mvp256-dry-appearance-regime-gradient-failure-capture-v1-executions/synthetic-new-run"
  const identity={runId:"synthetic-new-run",packageId:"synthetic-new-package",capabilityVersion:CAPABILITY}
  const policy=writeExclusive(directory,"fixture/policy.json",{formalSpecification:SNAPSHOT_ANALYSIS.formalSpecification,
    failureSnapshotAnalysis:{...SNAPSHOT_ANALYSIS,programBindings:programs}})
  const base=writeExclusive(directory,outputRoot+"/execution-package.json",{...identity,outputRoot,candidateContract:policy})
  const counts={generator:419,discriminator:420},location={epoch:9,trainPosition:36,sampleId:"synthetic-row"}
  const originalError={type:"builtins.ValueError",message:"actual total gradient identity differs at parameter 56"}
  const primary=writeExclusive(directory,outputRoot+"/failure-capture/gradient-failure-primary.json",{counts,location,originalError})
  const tensors=writeExclusive(directory,outputRoot+"/failure-capture/gradient-failure-tensors.pt",{synthetic:true,notTensorPayload:true})
  const absolute=b=>({path:path.join(directory,b.path),sha256:b.sha256,bytes:fs.statSync(path.join(directory,b.path)).size})
  const manifest=writeExclusive(directory,outputRoot+"/failure-capture/gradient-failure-manifest.json",{
    status:"failure_evidence_captured",counts,location,originalError,executionBinding:base})
  const capture={originalError:originalError.message,captureReceipt:{status:"failure_evidence_captured",executionQualified:false,
    counts,location,originalError,artifacts:{primary:absolute(primary),manifest:absolute(manifest),tensors:absolute(tensors)}}}
  const worker=writeExclusive(directory,outputRoot+"/phase-terminal.json",{...identity,executionPackage:base,failureCapture:capture})
  const failure=writeExclusive(directory,outputRoot+"/failure.json",{...identity,status:"experiment_failed_closed",executionState:"failed_closed",
    executionVersion:"appearance_regime_gradient_failure_capture_v1",executionPackage:base,workerTerminal:worker,
    failureCapture:capture,optimizerStepsGenerator:419,optimizerStepsDiscriminator:420})
  const registry={read:async()=>({ok:true,registry:{runId:identity.runId,activeExecution:null,latestTrainingTerminal:failure}})}
  return {root:directory,failureBinding:failure,...identity,registry,trainingError:{code:1,ownedReceipt:ownedReceipt(1)},
    parentDeadlineUnixMs:Date.now()+120000,policy,programs}
}

test("snapshot hook default production runner refuses unverified resource budget without dispatch",async()=>{
  const f=dispatchFixture(),before=fs.readFileSync(path.join(f.root,f.failureBinding.path))
  const result=await dispatchClosedFailureAnalysis(f)
  assert.equal(result.status,"dispatch_unavailable_original_training_failed")
  assert.equal(result.reason,"production_owned_resource_budget_unverified")
  assert.deepEqual(result.counts,{generator:419,discriminator:420})
  assert.equal(result.trainingRetryStarted,false)
  assert.equal(result.qualificationGranted,false)
  assert.ok(fs.readFileSync(path.join(f.root,f.failureBinding.path)).equals(before))
  const directory=path.dirname(path.join(f.root,result.terminal.path))
  assert.equal(fs.existsSync(path.join(directory,"dispatch-request.json")),false)
  assert.equal(fs.existsSync(path.join(f.root,".runtime/ai-painter/owned-worker-guards")),false)
  assert.equal(boundJson(f.root,result.terminal).dispatchSummary.reason,result.reason)
})

test("snapshot hook calls fake owned analyzer once, preserves original failure and reads lost receipt without rerun",async()=>{
  const f=dispatchFixture(),before=fs.readFileSync(path.join(f.root,f.failureBinding.path));let calls=0
  const fake=async(_exe,args,options)=>{
    calls++;assert.ok(options.timeout<=120000);assert.equal(options.env.OMP_NUM_THREADS,"2")
    const requestBinding={path:args[args.indexOf("--dispatch")+1],sha256:args[args.indexOf("--dispatch-sha256")+1]}
    const request=boundJson(f.root,requestBinding)
    assert.equal(request.dispatchIdentity,crypto.createHash("sha256").update(snapshotCanonical(Object.fromEntries(Object.entries(request).filter(([k])=>!["dispatchIdentity","outputRoot"].includes(k))))).digest("hex"))
    assert.deepEqual(request.programBindings,f.programs)
    const report={status:"snapshot_analysis_complete_diagnostic_only",identity:"1".repeat(64),terminalBinding:f.failureBinding,
      programBindings:f.programs,dispatchSummary:{status:"diagnostic_complete_original_training_failed",sourceFailure:f.failureBinding,
        counts:{generator:419,discriminator:420},originalTrainingError:"actual total gradient identity differs at parameter 56",qualificationGranted:false}}
    const terminal=writeExclusive(f.root,request.outputRoot+"/analysis-terminal.json",report)
    writeExclusive(f.root,request.outputRoot+"/analysis-commit-intent.json",{identity:report.identity,
      terminal:{path:path.join(f.root,terminal.path),sha256:terminal.sha256}})
    throw Object.assign(new Error("synthetic lost CLI receipt"),{ownedReceipt:ownedReceipt(0)})
  }
  const result=await dispatchClosedFailureAnalysis({...f,ownedAnalysis:fake})
  assert.equal(result.status,"diagnostic_complete_original_training_failed");assert.match(result.transportError,/lost CLI/u)
  const repeat=await dispatchClosedFailureAnalysis({...f,ownedAnalysis:()=>assert.fail("no repeated worker")})
  assert.equal(repeat.status,result.status);assert.equal(calls,1)
  assert.ok(fs.readFileSync(path.join(f.root,f.failureBinding.path)).equals(before))
})

test("snapshot hook declines legacy policy, abort, timeout, uncertain cleanup, stale registry and short outer deadline",async()=>{
  for(const mode of ["legacy","abort","timeout","unknown","registry","deadline"]) {
    const f=dispatchFixture()
    if(mode==="legacy") { const value=boundJson(f.root,f.policy);delete value.failureSnapshotAnalysis;fs.writeFileSync(path.join(f.root,f.policy.path),JSON.stringify(value));
      // Rebind this isolated future fixture, never a production package.
      const base=boundJson(f.root,boundJson(f.root,f.failureBinding).executionPackage);base.candidateContract.sha256=crypto.createHash("sha256").update(fs.readFileSync(path.join(f.root,f.policy.path))).digest("hex")
      const failure=boundJson(f.root,f.failureBinding),basePath=failure.executionPackage.path;fs.writeFileSync(path.join(f.root,basePath),JSON.stringify(base));failure.executionPackage.sha256=crypto.createHash("sha256").update(fs.readFileSync(path.join(f.root,basePath))).digest("hex");fs.writeFileSync(path.join(f.root,f.failureBinding.path),JSON.stringify(failure));f.failureBinding.sha256=crypto.createHash("sha256").update(fs.readFileSync(path.join(f.root,f.failureBinding.path))).digest("hex") }
    if(mode==="abort") f.signal=AbortSignal.abort("synthetic cancellation")
    if(mode==="timeout") f.trainingError.code="ETIMEDOUT"
    if(mode==="unknown") f.trainingError.ownedReceipt.cleanupConfirmed=false
    if(mode==="registry") f.registry={read:async()=>({ok:true,registry:{runId:f.runId,activeExecution:{runId:f.runId}}})}
    if(mode==="deadline") f.parentDeadlineUnixMs=Date.now()+10
    const result=await dispatchClosedFailureAnalysis({...f,ownedAnalysis:()=>assert.fail("must not dispatch")})
    assert.equal(result.status,"dispatch_unavailable_original_training_failed",mode)
    assert.equal(result.trainingRetryStarted,false)
  }
})

test("snapshot hook refuses missing, cross-Run, changed SHA, partial, unknown identity and over-budget analysis",async()=>{
  const f=dispatchFixture()
  const bad=await dispatchClosedFailureAnalysis({...f,failureBinding:{...f.failureBinding,sha256:"0".repeat(64)},ownedAnalysis:()=>assert.fail("no dispatch")})
  assert.equal(bad.status,"dispatch_unavailable_original_training_failed")
  const cross=await dispatchClosedFailureAnalysis({...f,runId:"other",ownedAnalysis:()=>assert.fail("no cross Run")})
  assert.equal(cross.status,"dispatch_unavailable_original_training_failed")
  const result=await dispatchClosedFailureAnalysis({...f,ownedAnalysis:async()=>{throw Object.assign(new Error("synthetic analysis timeout"),{ownedReceipt:ownedReceipt(1)})}})
  assert.equal(result.status,"diagnostic_failed_closed_original_training_failed")
  const repeat=await dispatchClosedFailureAnalysis({...f,ownedAnalysis:()=>assert.fail("failed identity must not retry")})
  assert.equal(repeat.status,result.status)
})

test("unknown analysis cleanup never writes fallback or retries, even with a committed report",async()=>{
  for(const committed of [false,true]) {
    const f=dispatchFixture();let directory
    const result=await dispatchClosedFailureAnalysis({...f,ownedAnalysis:async(_exe,args)=>{
      const request=boundJson(f.root,{path:args[args.indexOf("--dispatch")+1],sha256:args[args.indexOf("--dispatch-sha256")+1]})
      directory=request.outputRoot
      if(committed) writeExclusive(f.root,directory+"/analysis-terminal.json",{immutableSynthetic:true})
      throw Object.assign(new Error("synthetic cleanup unknown"),{ownedReceipt:{cleanupConfirmed:false}})
    }})
    assert.equal(result.reason,"analysis_cleanup_unknown")
    assert.equal(fs.existsSync(path.join(f.root,directory,"analysis-terminal.json")),committed)
    if(committed) assert.deepEqual(boundJson(f.root,{path:directory+"/analysis-terminal.json",sha256:result.observedTerminal.sha256}),{immutableSynthetic:true})
  }
})
test("real short alias and physical task evidence have the same nonzero directory identity",()=>{
  const evidenceRoot=path.join(root,evidence.outputRoot)
  const alias=process.env.AI_PAINTER_TEST_EVIDENCE_ROOT ?? evidenceRoot
  const physical=fs.realpathSync(evidenceRoot)
  assert.deepEqual(directoryIdentity(alias),directoryIdentity(physical))
  requireSameDirectory(alias,evidenceRoot)
  const different=temporary()
  assert.throws(()=>requireSameDirectory(different,evidenceRoot),/different directory identity/u)
})
test("isolation parent is the exact bound receipt directory and exact task evidence child",()=>{
  const alias=process.env.AI_PAINTER_TEST_ISOLATION_ALIAS ?? path.join(root,isolationEvidenceRoot)
  requireSameDirectory(alias,path.join(root,isolationEvidenceRoot))
  const name="acceptance-"+crypto.randomBytes(12).toString("hex")
  const other="acceptance-"+crypto.randomBytes(12).toString("hex")
  const receipt=writeExclusive(root,isolationEvidenceRoot+"/"+name+"/synthetic-tests-receipt.json",{synthetic:true})
  writeExclusive(root,isolationEvidenceRoot+"/"+other+"/synthetic-tests-receipt.json",{synthetic:true})
  writeExclusive(temporary(),"isolation-root-fixture.json",{synthetic:true,isolationEvidenceRoot,
      paths:[path.join(root,isolationEvidenceRoot,name),path.join(root,isolationEvidenceRoot,other)]})
  const fixture=path.join(alias,name,"isolated-project")
  const expected=validateIsolationParent(root,fixture,receipt)
  assert.equal(expected.evidenceRoot,isolationEvidenceRoot)
  assert.deepEqual(expected.parentIdentity,directoryIdentity(path.dirname(fixture)))
  assert.throws(()=>validateIsolationParent(root,path.join(alias,other,"isolated-project"),receipt),/different directory identity/u)
  assert.throws(()=>validateIsolationParent(root,fixture,{...receipt,path:"data/outside-receipt.json"}),/receipt must be bound/u)
  fs.appendFileSync(path.join(root,receipt.path)," ")
  assert.throws(()=>validateIsolationParent(root,fixture,receipt),/bound evidence changed/u)
  assert.equal(fs.existsSync(fixture),false)
})
test("actual CPU admission entry has no unresolved lexical variables after parent validation extraction",()=>{
  const source=fs.readFileSync(path.join(root,PROGRAMS.cpuAcceptance),"utf8")
  const errors=new Linter().verify(source,[{languageOptions:{ecmaVersion:"latest",sourceType:"module",
    globals:{structuredClone:"readonly",process:"readonly",Buffer:"readonly",setInterval:"readonly",clearInterval:"readonly",AbortController:"readonly"}},rules:{"no-undef":"error"}}])
  assert.deepEqual(errors,[])
})

test("stale CPU schemas/counts never qualify this capability",()=>{
  for (const report of [{},{capabilityVersion:CAPABILITY,status:"cpu_contract_checked_not_execution_qualified"},
    {capabilityVersion:CAPABILITY,architecture:"fresh_v23_four_heads_zero_season_branch_rgb_bias_fp64_device_v1",
      status:"cpu_execution_bridge_checked_not_gpu_qualified",callCounts:{modelForwardsCompleted:4}}])
    assert.throws(()=>validateNumericCpuReport(report))
})
test("historical input reads committed snapshot after current pointer changes",()=>{
  const directory=temporary()
  for (const key of ["transaction","snapshot","event"]) {
    const binding=FROZEN_REGISTRY_INPUT[key]
    const target=path.join(directory,binding.path)
    fs.mkdirSync(path.dirname(target),{recursive:true})
    fs.copyFileSync(path.join(root,binding.path),target)
  }
  writeExclusive(directory,FROZEN_REGISTRY_INPUT.observed.path,{syntheticCurrentRevision:999})
  const observed=readNumericInput(directory,FROZEN_REGISTRY_INPUT.observed)
  assert.equal(JSON.parse(observed).registryRevision,371)
  assert.throws(()=>readNumericInput(directory,{...FROZEN_REGISTRY_INPUT.observed,sha256:"0".repeat(64)}))
  fs.appendFileSync(path.join(directory,FROZEN_REGISTRY_INPUT.event.path)," ")
  assert.throws(()=>readNumericInput(directory,FROZEN_REGISTRY_INPUT.observed))
})
test("atomic isolated registry readback exposes v28 plan, current progress and terminal",async()=>{
  const directory=temporary(), value=ready(directory)
  const outputRoot=".runtime/ai-painter/stage4-mvp256-dry-appearance-regime-gradient-failure-capture-v1-executions/fixture"
  const base=buildBasePackage({...value,runId:"v28-fixture-run",packageId:"v28-fixture-package",outputRoot})
  const baseBinding=writeExclusive(directory,outputRoot+"/execution-package.json",base)
  await initializeIsolatedRegistry(directory)
  const proof=await commitIsolatedPackage(directory,baseBinding,value.programBindings)
  const progress=writeExclusive(directory,outputRoot+"/progress.json",{
    schemaVersion:"ai-painter-stage4-mvp256-dry-v28-progress-v1",capabilityVersion:CAPABILITY,
    runId:base.runId,packageId:base.packageId,executionState:"executing",actualEpoch:1,completedEpochs:0,
    optimizerStepsGenerator:7,optimizerStepsDiscriminator:6,updatedAtUtc:new Date().toISOString()})
  const presentation=await readBoundTrainingPresentation(directory,proof.readback.registry,
    {evidence:[baseBinding]},boundJson(directory,proof.dispatched))
  assert.equal(presentation.availability,"available",presentation.reasonCode)
  assert.equal(presentation.targetEpochs,48)
  assert.equal(presentation.currentMetrics.availability,"available",presentation.currentMetrics.reasonCode)
  assert.equal(presentation.currentMetrics.optimizationStep,7)
  const worker=writeExclusive(directory,outputRoot+"/phase-terminal.json",{
    schemaVersion:"ai-painter-stage4-mvp256-dry-v28-worker-terminal-v1",capabilityVersion:CAPABILITY,
    runId:base.runId,packageId:base.packageId,status:"experiment_failed_closed",executionState:"failed_closed",
    optimizerStepsGenerator:7,optimizerStepsDiscriminator:6,completedEpochs:0})
  const terminal=writeExclusive(directory,outputRoot+"/training-finalize.json",{
    schemaVersion:"ai-painter-mvp256-dry-v28-training-lifecycle-v1",capabilityVersion:CAPABILITY,
    runId:base.runId,packageId:base.packageId,status:"experiment_failed_closed",executionState:"failed_closed",
    executionPackage:baseBinding,workerTerminal:worker,trainingProgress:progress})
  const capsule=writeExclusive(directory,outputRoot+"/end-capsule.json",{
    schemaVersion:"ai-painter-local-task-capsule-v1",taskId:base.runId,integrity:{status:"verified"},
    evidence:[{...terminal,kind:"synthetic_terminal",sha256Verified:true}]})
  const current=await readCurrentExecutionRegistry(directory)
  const closed=await advanceCurrentExecutionRegistry({projectRoot:directory,
    capabilityVersion:CAPABILITY,packageId:base.packageId,taskId:base.runId,taskKind:"mvp256_dry_v28_bounded_training",
    taskGoal:"Synthetic terminal observation",priority:5,queueStatus:"failed_closed",nextMachineAction:null,
    queuedAtUtc:new Date().toISOString(),runId:base.runId,lifecycleStage:"dry_single_world_256x192",
    executionState:"failed_closed",activity:"failed_closed",taskCapsulePath:capsule.path,
    terminalEvidencePath:terminal.path,activeExecution:null,
    latestTrainingTerminal:{runId:base.runId,...terminal,status:"experiment_failed_closed"},
    expectedPreviousRegistryRevision:current.registry.registryRevision,expectedPreviousRegistrySha256:current.registrySha256})
  assert.equal(closed.ok,true)
  const final=await readCurrentExecutionRegistry(directory)
  const ended=await readBoundTrainingPresentation(directory,final.registry,{evidence:[baseBinding]},boundJson(directory,terminal))
  assert.equal(ended.availability,"available",ended.reasonCode)
  assert.deepEqual(ended.actualOptimizerSteps,{generator:7,critic:6})
  assert.equal(proof.readback.registry.registryRevision,2)
})
test("duplicate attempt cannot issue commands or alter claim",async()=>{
  const directory=temporary(),value=ready(directory)
  await initializeIsolatedRegistry(directory)
  const initial=await readCurrentExecutionRegistry(directory)
  const claim=writeExclusive(directory,".runtime/ai-painter/stage4-mvp256-dry-appearance-regime-gradient-failure-capture-v1-executions/single-training-attempt-claim.json",{synthetic:true})
  const before=fs.readFileSync(path.join(directory,claim.path))
  await assert.rejects(run({execute:true,preflightReady:{...value,registryRevision:initial.registry.registryRevision,registrySha256:initial.registrySha256},
    command:async()=>assert.fail("duplicate child command")}),{code:"EEXIST"})
  assert.deepEqual(fs.readFileSync(path.join(directory,claim.path)),before)
})
test("supervisor cancellation closes genuine isolated registry at explicit child boundary",async()=>{
  const directory=temporary(),value=ready(directory)
  await initializeIsolatedRegistry(directory)
  const initial=await readCurrentExecutionRegistry(directory)
  let callback
  const error=Object.assign(new Error("synthetic heartbeat failure"),{code:"EPERM"})
  const result=await run({execute:true,preflightReady:{...value,registryRevision:initial.registry.registryRevision,registrySha256:initial.registrySha256},
    intervalFactory:fn=>{callback=fn;return 1},intervalClear:()=>{},
    heartbeatUpdater:()=>{throw error},
    command:async({signal})=>{callback();assert.equal(signal.reason,error);throw new Error("synthetic child cancelled")}})
  assert.equal(result.status,"failed_closed")
  const failed=boundJson(directory,result.failure)
  assert.equal(failed.abortReason.message,error.message)
  assert.equal(failed.automaticRetryStarted,false)
  assert.equal(failed.optimizerStepsGenerator,0)
  assert.equal((await readCurrentExecutionRegistry(directory)).registry.activeExecution,null)
})
test("corrupt partial progress cannot mask the causal child error or leave registry active",async()=>{
  const directory=temporary(),value=ready(directory)
  await initializeIsolatedRegistry(directory)
  const initial=await readCurrentExecutionRegistry(directory)
  const original=new Error("synthetic causal admission error")
  const result=await run({execute:true,preflightReady:{...value,
    registryRevision:initial.registry.registryRevision,registrySha256:initial.registrySha256},
    intervalFactory:()=>1,intervalClear:()=>{},
    command:async({args})=>{
      const bindingPath=args[args.indexOf("--package")+1]
      const base=JSON.parse(fs.readFileSync(path.join(directory,bindingPath)))
      fs.writeFileSync(path.join(directory,base.outputRoot,"progress.json"),"{partial",{flag:"wx"})
      throw original
    }})
  assert.equal(result.status,"failed_closed")
  const failure=boundJson(directory,result.failure)
  assert.match(failure.error,/synthetic causal admission error/u)
  assert.equal(failure.diagnosticErrors.length,1)
  assert.equal(failure.trainingProgress,null)
  const damaged=failure.diagnosticEvidence.progress
  assert.equal(fs.readFileSync(path.join(directory,damaged.path),"utf8"),"{partial")
  assert.equal(crypto.createHash("sha256").update("{partial").digest("hex"),damaged.sha256)
  assert.equal(failure.optimizerCountsKnown,true)
  assert.equal(failure.trainingStarted,false)
  assert.equal(failure.schemaVersion,"ai-painter-mvp256-dry-v28-training-lifecycle-v1")
  assert.equal((await readCurrentExecutionRegistry(directory)).registry.activeExecution,null)
  assert.deepEqual((await readCurrentExecutionRegistry(directory)).registry.latestTrainingTerminal.evidence,{})
  assert.equal(fs.existsSync(path.join(directory,path.dirname(result.failure.path),"registry-finalization-failure.json")),false)
})

test("diagnostic policy and numerical evidence identities remain separate and acyclic",()=>{
  const programs=ready(temporary()).programBindings
  const policy=describePolicy({root,cpuAcceptance:{path:"fixture/cpu.json",sha256:"a".repeat(64)},programBindings:programs})
  assert.equal(policy.executionVersion,"appearance_regime_gradient_failure_capture_v1")
  assert.equal(policy.capabilityVersion,CAPABILITY)
  assert.notEqual(POLICY_PATH,"data/ai-painter/system-governance/stage4-mvp256-dry-appearance-regime-bias-precision-execution-policy-v1.json")
  assert.equal(policy.failureCapture.maxCaptureBytes,64*1024**2)
  assert.equal(policy.failureCapture.maxCombinedBytes,128*1024**2)
  assert.equal(policy.failureCapture.terminalReserveBytes,1024**2)
  const base=buildBasePackage({policy,parent,policyBinding:{path:POLICY_PATH,sha256:"b".repeat(64)},
    runId:"diagnostic-run",packageId:"diagnostic-package",outputRoot:"fixture/output",programBindings:programs})
  for(const name of ["gpuQualification","trainingTicket","managedLock","launchIdentity"])assert.equal(name in base,false)
})
test("historical numeric documents read exact immutable snapshots without accepting current bytes",()=>{
  for(const [logical,snapshot] of Object.entries(HISTORICAL_DOCUMENTS)) {
    const raw=readNumericInput(root,{path:logical,sha256:snapshot.sha256})
    assert.equal(crypto.createHash("sha256").update(raw).digest("hex"),snapshot.sha256)
    assert.throws(()=>readNumericInput(root,{path:logical,sha256:"f".repeat(64)}))
  }
})
test("original completed review gate does not accept old execution identity",()=>{
  assert.throws(()=>validateV28Review({report:{schemaVersion:"ai-painter-mvp256-dry-v28-cpu-review-v1",
    status:"cpu_comparison_completed_visual_review_pending",capabilityVersion:CAPABILITY},execution:{},terminal:{},worker:{},registry:{},policy:{},parent:{},scope:{}}))
})

test("managed child preserves primary failure with bounded hashed output logs",async()=>{
  const directory=temporary(),out="run"
  fs.mkdirSync(path.join(directory,out))
  const original=Object.assign(new Error("original child cancellation"),{stdout:"x".repeat(120000),stderr:"stderr"})
  await assert.rejects(managedChild({file:"synthetic child",args:[],root:directory,timeout:180000},
    {root:directory,outputRoot:out,label:"training",execute:async()=>{throw original}}),error=>error===original)
  const target=path.join(directory,out,"child-training.json")
  assert.ok(fs.statSync(target).size<=65536)
  const record=JSON.parse(fs.readFileSync(target))
  assert.equal(record.stdout.bytes,120000);assert.equal(record.stdout.truncated,true)
  assert.equal(record.stdout.sha256,crypto.createHash("sha256").update(original.stdout).digest("hex"))
  assert.match(record.error.text,/original child cancellation/u)
})

test("managed child log publication failure does not replace its primary exception",async()=>{
  const directory=temporary(),out="run"
  fs.mkdirSync(path.join(directory,out))
  fs.writeFileSync(path.join(directory,out,"child-training.json"),"existing")
  const original=new Error("original error preserved")
  await assert.rejects(managedChild({file:"synthetic",args:[],root:directory},
    {root:directory,outputRoot:out,label:"training",execute:async()=>{throw original}}),error=>error===original)
  assert.match(original.childLogPublicationError,/exist|EEXIST/u)
  assert.equal(fs.readFileSync(path.join(directory,out,"child-training.json"),"utf8"),"existing")
})
test("better worst correlation cannot erase failed semantics or worse RGB", () => {
  const result = closeDecisionForTest(...fixture())
  assert.equal(result.routeDecision, "close_appearance_regime_route_no_automatic_retry")
  assert.ok(result.validation.meanRgbMaeDeltaV28MinusV24 > 0)
  assert.ok(result.validation.worstObjectCorrelationDeltaV28MinusV24 > 0)
  assert.equal(result.formalStage4QualificationGranted, false)
})
test("mismatched checkpoint, fake success and nonfinite metrics cannot close as authentic failure", () => {
  for (const mutate of [
    values => { values[1].selectedCheckpoint = { path: "other" } },
    values => { values[1].formalStage4QualificationGranted = true },
    values => { values[1].status = "dry_single_world_numeric_passed_visual_approval_pending" },
    values => { values[0].measurements.v28.selectionCpu.meanValidationRgbMae = NaN },
  ]) {
    const value = fixture()
    mutate(value)
    assert.throws(() => closeDecisionForTest(...value))
  }
})


test("numeric success with RGB regression closes, not promoted", () => {
  const values = fixture()
  values[1].status = "dry_single_world_numeric_passed_visual_approval_pending"
  values[1].objectSemanticsPassed = true
  values[1].issueCodes = []
  assert.equal(closeDecisionForTest(...values).status, "dry_single_world_review_failed_closed")
  values[0].measurements.v28.selectionCpu.meanValidationRgbMae = 0.05
  const result = closeDecisionForTest(...values)
  assert.equal(result.status, values[1].status)
  assert.equal(result.visualApprovalGranted, false)
  assert.equal(result.formalStage4QualificationGranted, false)
})

function fixture() {
  const comparison = { runId: "v28", selectedCheckpoint: { path: "epoch-24" }, measurements: {
    v24: { selectionCpu: { meanValidationRgbMae: 0.06140733743086457, worstApplicableObjectCorrelation: -0.08459185063838959, } },
    v28: { selectionCpu: { meanValidationRgbMae: 0.07, worstApplicableObjectCorrelation: -0.06 } },
  } }
  const audit = { status: "dry_single_world_review_failed_closed", runId: "v28",
    selectedCheckpoint: comparison.selectedCheckpoint, objectSemanticsPassed: false,
    issueCodes: ["object_failure"], visualApprovalGranted: false,
    formalStage4QualificationGranted: false, runtimePublicationGranted: false }
  return [comparison, audit, { issueCodes: ["prior_failure"] }]
}
