import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import crypto from "node:crypto"
import test from "node:test"
import { Linter } from "eslint"
import { initializeIsolatedRegistry, commitIsolatedPackage, directoryIdentity, requireSameDirectory, validateIsolationParent } from "../run-ai-painter-mvp256-dry-appearance-regime-cpu-acceptance.mjs"
import { buildBasePackage, PROGRAMS, run, validateNumericCpuReport, FROZEN_REGISTRY_INPUT, readNumericInput } from "../run-ai-painter-mvp256-dry-appearance-regime-training.mjs"
import { CAPABILITY } from "../lib/ai-painter-mvp256-dry-appearance-regime-package-chain-v1.mjs"
import { boundJson, writeExclusive } from "../run-ai-painter-mvp256-dry-v24-training.mjs"
import { readCurrentExecutionRegistry, advanceCurrentExecutionRegistry } from "../../src/server/ai-painter-current-execution-registry.mjs"
import { readBoundTrainingPresentation } from "../../src/server/ai-console/bound-training-presentation.mjs"
const root = path.resolve(import.meta.dirname,"../..")
const evidence = JSON.parse(fs.readFileSync(path.join(root,
  ".runtime/ai-painter/stage4-mvp256-dry-v27-v3-executions/mvp256-dry-v27-v3-43ec72f180bd1a412baf3aa8de15a36de9730f65bebf8117/dry-review/diagnostics/generalization-034fbef2a60847e3e2b7d9ec6a7c830dee89e1c11a1e77fbf306fc86bae13e72/season-managed-execution-t-q4-36/lifecycle-workorder.json")))
const parent = JSON.parse(fs.readFileSync(path.join(root,"data/ai-painter/system-governance/stage4-mvp256-dry-v24-closed-loop-candidate-v1.json")))
function temporary() {
  const base = path.join(process.env.AI_PAINTER_TEST_EVIDENCE_ROOT ?? path.join(root,evidence.evidenceRoot),"synthetic-tests")
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
test("real short alias and physical task evidence have the same nonzero directory identity",()=>{
  const evidenceRoot=path.join(root,evidence.evidenceRoot)
  const alias=process.env.AI_PAINTER_TEST_EVIDENCE_ROOT ?? evidenceRoot
  const physical=fs.realpathSync(evidenceRoot)
  assert.deepEqual(directoryIdentity(alias),directoryIdentity(physical))
  requireSameDirectory(alias,evidenceRoot)
  const different=temporary()
  assert.throws(()=>requireSameDirectory(different,evidenceRoot),/different directory identity/u)
})
test("isolation parent is the exact bound receipt directory and exact task evidence child",()=>{
  const alias=process.env.AI_PAINTER_TEST_EVIDENCE_ROOT ?? path.join(root,evidence.evidenceRoot)
  const name="acceptance-"+crypto.randomBytes(12).toString("hex")
  const other="acceptance-"+crypto.randomBytes(12).toString("hex")
  const receipt=writeExclusive(root,evidence.evidenceRoot+"/"+name+"/synthetic-tests-receipt.json",{synthetic:true})
  writeExclusive(root,evidence.evidenceRoot+"/"+other+"/synthetic-tests-receipt.json",{synthetic:true})
  const fixture=path.join(alias,name,"isolated-project")
  const expected=validateIsolationParent(root,fixture,receipt)
  assert.equal(expected.evidenceRoot,evidence.evidenceRoot)
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
    globals:{process:"readonly"}},rules:{"no-undef":"error"}}])
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
  const outputRoot=".runtime/ai-painter/stage4-mvp256-dry-v28-executions/fixture"
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
  const claim=writeExclusive(directory,".runtime/ai-painter/stage4-mvp256-dry-v28-executions/single-training-attempt-claim.json",{synthetic:true})
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
