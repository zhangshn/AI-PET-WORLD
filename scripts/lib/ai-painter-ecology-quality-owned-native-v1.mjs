// Independent quality version; original transport/framing/resource reserves.
// Versioned ecology binding of the existing private Windows Job transport.
// The receipt schema identifies the Job protocol, never model qualification.
// IO and AsyncLocalStorage accounting are shared with the existing store.
// No legacy plan admission, retry, review recovery or resource successor.
// Extracted from frozen detail-weight capture transport SHA-256
// 9b1d4516045fd80d53b2812ce2c3864b31a6c887b653e22c61b7011fccfa5e1e.
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import crypto from "node:crypto"
import { spawn } from "node:child_process"
import { fileURLToPath } from "node:url"
import { DatabaseSync } from "node:sqlite"
import { createOwnedStopNativeControl, initializeOwnedStopControlEvidence } from "./ai-painter-owned-stop-native-control-v1.mjs"
import { processIdentity } from "../run-ai-painter-mvp256-dry-v24-training.mjs"
import { createNativeOwnerCommand, nativeOwnerSourceIdentity, nativeBuildFailureObservation } from "./ai-painter-owned-worker-native-v1.mjs"
import { inside, read, json, bind, write, sha, withOutputBudget, directoryBytes } from "./ai-painter-ecology-quality-package-chain-v1.mjs"
import { validatePlan, ROLES, runtimeIdentity, finalProgramBindings, SPECIFICATION, CANDIDATE, deriveConfiguration } from "./ai-painter-ecology-quality-package-chain-v1.mjs"
const SELF=fileURLToPath(import.meta.url),STREAM=8*1024*1024
const PROOF_BYTES=65536,OUTER_TERMINAL_BYTES=65536
const CAPABILITY="stage4_mvp256_dry_factorized_ecology_quality_v1"
const PROFILE="factorized_ecology_quality_execution_v1"
const ownedStopLedgers=new Map()

function stopEvidenceRoot(root,plan,packageBinding) {
  const parent=fs.realpathSync(inside(root,plan.outputRoot))
  const evidenceRoot=path.join(parent,"operator-stop-control")
  const key=JSON.stringify([plan.runId,plan.packageId,packageBinding.path,packageBinding.sha256])
  const pinned=ownedStopLedgers.get(evidenceRoot)
  if(pinned){
    const actual=fs.lstatSync(evidenceRoot,{bigint:true})
    assert.equal(pinned.key,key,"owned stop ledger package changed")
    assert.ok(actual.isDirectory()&&!actual.isSymbolicLink(),"owned stop ledger redirected")
    assert.equal(fs.realpathSync(evidenceRoot),evidenceRoot)
    assert.equal(actual.dev,pinned.dev);assert.equal(actual.ino,pinned.ino)
  }else{
    initializeOwnedStopControlEvidence(evidenceRoot)
    const actual=fs.lstatSync(evidenceRoot,{bigint:true})
    ownedStopLedgers.set(evidenceRoot,Object.freeze({key,dev:actual.dev,ino:actual.ino}))
  }
  return evidenceRoot
}

export function operatorStopControlAvailability(environment=process.env) {
  return Buffer.byteLength(environment.AI_PET_WORLD_OPERATOR_SESSION_SECRET?.trim()??"")>=32
    ? {available:true,status:"stable_operator_secret_configured_not_authenticated"}
    : {available:false,status:"unavailable_stable_operator_secret_missing"}
}

// Inspection is read-only. It never installs an IO permission or a budget scope.
export const CPU_LINK_RESERVE_BYTES=3*16384
export function cpuNegativeInputLayout(outputRoot){
  const base=outputRoot+"/cpu-negative-inputs"
  return Object.freeze({root:base,links:Object.freeze([
    Object.freeze({name:"reader",path:base+"/reader-link",target:base+"/reader-target"}),
    Object.freeze({name:"snapshot",path:base+"/snapshot-link",target:base+"/snapshot-target"}),
    Object.freeze({name:"program",path:base+"/program-project/scripts/lib",target:base+"/program-target"})])})
}
const nodeIdentity=s=>`${s.dev}:${s.ino}`
function inputError(logical,message,cause){return Object.assign(new Error(`${message}: ${logical}`,{cause}),{logicalPath:logical})}
export function validateCpuNegativeLink(logical,stat,target,expected,previousIdentity){
  if(!stat.isSymbolicLink())throw inputError(logical,"registered input must be a directory link")
  if(path.toNamespacedPath(path.resolve(target))!==path.toNamespacedPath(path.resolve(expected)))throw inputError(logical,"CPU input link target differs")
  if(previousIdentity!==undefined&&nodeIdentity(stat)!==previousIdentity)throw inputError(logical,"CPU input link identity replaced")
  return nodeIdentity(stat)
}
export class CpuNegativeInputInspector {
  #root;#layout;#directories=new Map();#files=new Map();#links=new Map();#removed=new Set()
  constructor(root,layout){
    assert.deepEqual(layout,cpuNegativeInputLayout(layout.root.replace(/\/cpu-negative-inputs$/u,"")))
    this.#root=root;this.#layout=layout
    for(const logical of [layout.root,...layout.links.map(v=>v.target),layout.root+"/program-project",layout.root+"/program-project/scripts",layout.root+"/program-data",layout.root+"/program-data/hot",layout.root+"/program-data/hot/runtime"]){
      const stat=fs.lstatSync(inside(root,logical),{bigint:true})
      if(!stat.isDirectory()||stat.isSymbolicLink())throw inputError(logical,"CPU input directory must be ordinary")
      this.#directories.set(logical,nodeIdentity(stat))
    }
  }
  scan({requireRemoved=false,requireObserved=false}={}){
    const base=inside(this.#root,this.#layout.root),slots=new Map(this.#layout.links.map(v=>[v.path,v]));let actualFileBytes=0
    const seenFiles=new Set(),seenDirectories=new Set(),present=new Set()
    const walk=(physical,logical)=>{
      let before;try{before=fs.lstatSync(physical,{bigint:true})}catch(error){throw inputError(logical,"CPU input directory missing",error)}
      if(!before.isDirectory()||before.isSymbolicLink())throw inputError(logical,"CPU input directory redirected")
      const identity=nodeIdentity(before),previous=this.#directories.get(logical)
      if(previous!==undefined&&previous!==identity)throw inputError(logical,"CPU input directory identity replaced")
      this.#directories.set(logical,identity);seenDirectories.add(logical)
      for(const entry of fs.readdirSync(physical,{withFileTypes:true})){
        const child=path.join(physical,entry.name),name=logical+"/"+entry.name,slot=slots.get(name);let stat
        try{stat=fs.lstatSync(child,{bigint:true})}catch(error){if(slot&&error.code==="ENOENT"){this.#removed.add(name);continue}throw inputError(name,"CPU input vanished during accounting",error)}
        if(slot){
          if(this.#removed.has(name))throw inputError(name,"removed CPU link reappeared")
          const target=inside(this.#root,slot.target)
          const targetBefore=fs.lstatSync(target,{bigint:true})
          if(!targetBefore.isDirectory()||targetBefore.isSymbolicLink()||nodeIdentity(targetBefore)!==this.#directories.get(slot.target))
            throw inputError(slot.target,"CPU link ordinary target identity replaced")
          let redirect;try{redirect=fs.readlinkSync(child)}catch(error){if(error.code==="ENOENT"){this.#removed.add(name);continue}throw inputError(name,"registered CPU input link invalid",error)}
          let after;try{after=fs.lstatSync(child,{bigint:true})}catch(error){if(error.code==="ENOENT"){this.#removed.add(name);continue}throw inputError(name,"CPU link observation failed",error)}
          const linkIdentity=validateCpuNegativeLink(name,after,redirect,target,this.#links.get(name))
          if(nodeIdentity(stat)!==linkIdentity)throw inputError(name,"CPU link changed during observation")
          if(nodeIdentity(fs.lstatSync(target,{bigint:true}))!==nodeIdentity(targetBefore))throw inputError(slot.target,"CPU link target changed during observation")
          this.#links.set(name,linkIdentity);present.add(name);continue
        }
        if(stat.isSymbolicLink())throw inputError(name,"unregistered CPU input link refused")
        if(stat.isDirectory())walk(child,name)
        else if(stat.isFile()){
          const identity=nodeIdentity(stat),prior=this.#files.get(name)
          if(prior!==undefined&&prior!==identity)throw inputError(name,"CPU input file identity replaced")
          const after=fs.lstatSync(child,{bigint:true});if(nodeIdentity(after)!==identity||after.size!==stat.size)throw inputError(name,"CPU input file changed during accounting")
          this.#files.set(name,identity);seenFiles.add(name);actualFileBytes+=Number(after.size)
        }else throw inputError(name,"unsupported CPU input file type")
      }
      if(nodeIdentity(fs.lstatSync(physical,{bigint:true}))!==identity)throw inputError(logical,"CPU input directory changed during accounting")
    }
    walk(base,this.#layout.root)
    for(const logical of this.#directories.keys())if(!seenDirectories.has(logical))throw inputError(logical,"CPU input directory disappeared")
    for(const [logical,identity]of this.#directories){const current=fs.lstatSync(inside(this.#root,logical),{bigint:true});
      if(!current.isDirectory()||current.isSymbolicLink()||nodeIdentity(current)!==identity)throw inputError(logical,"CPU input directory identity replaced")}
    for(const logical of this.#files.keys())if(!seenFiles.has(logical))throw inputError(logical,"ordinary CPU input file disappeared")
    for(const logical of this.#links.keys())if(!present.has(logical))this.#removed.add(logical)
    if(requireRemoved&&present.size)throw inputError([...present][0],"CPU fixture cleanup incomplete")
    if(requireObserved&&this.#links.size!==3)throw inputError(this.#layout.root,"all three CPU links must be observed by this retained call")
    return {schema:"cpu-negative-input-observation-v1",root:this.#layout.root,actualFileBytes,
      linkMetadataReserveBytes:CPU_LINK_RESERVE_BYTES,reserveIsMeasurement:false,totalBytes:actualFileBytes+CPU_LINK_RESERVE_BYTES,
      links:this.#layout.links.map(v=>({...v,observedIdentity:this.#links.get(v.path)??null,present:present.has(v.path)})),
      directoryIdentities:[...this.#directories].map(([logical,identity])=>({path:logical,identity})),
      fixtureLinksRemoved:present.size===0}
  }
}
const cpuScopes=new WeakMap()
function mintCpuInputs(root,outputRoot,executable,args,callIdentity){
  if(args.length!==6||args[2]!=="--cpu-request")return null
  assert.deepEqual(args.slice(0,3),["-B",inside(root,ROLES.cpuHarness),"--cpu-request"])
  assert.equal(args[4],"--sha256");const requestBinding={path:args[3],sha256:args[5]},request=json(root,requestBinding)
  assert.equal(requestBinding.path,outputRoot+"/cpu-request.json");assert.equal(request.schema,"ecology-regime-quality-cpu-request-v1")
  assert.equal(outputRoot,".runtime/ai-painter/ecology-regime-quality-executions/"+request.runId)
  assert.equal(request.outputRoot,outputRoot+"/cpu-entry");assert.match(request.packageId,/^[a-z0-9][a-z0-9-]{7,127}$/u);assert.notEqual(request.packageId,request.runId)
  assert.deepEqual(request.formalSpecification,SPECIFICATION);read(root,SPECIFICATION)
  assert.deepEqual(request.configuration,deriveConfiguration(json(root,CANDIDATE)))
  assert.deepEqual(request.programBindings,finalProgramBindings(root),"exact current source closure required")
  assert.deepEqual(request.runtimeIdentity,runtimeIdentity(root));assert.equal(path.resolve(executable),path.resolve(request.runtimeIdentity.python.absolutePath))
  for(const [role,logical]of Object.entries(ROLES))assert.equal(request.programBindings[role]?.path,logical)
  for(const value of Object.values(request.programBindings))read(root,value)
  const layout=cpuNegativeInputLayout(outputRoot);assert.equal(fs.existsSync(inside(root,layout.root)),false,"old CPU input arena cannot mint current scope")
  for(const logical of [layout.root,...layout.links.map(v=>v.target),layout.root+"/program-project/scripts",layout.root+"/program-data/hot/runtime"])
    fs.mkdirSync(inside(root,logical),{recursive:true})
  const inspector=new CpuNegativeInputInspector(root,layout)
  const runtime=path.join(root,".runtime"),physicalRuntime=fs.realpathSync.native(runtime)
  const declarationBinding=write(root,layout.root+"/input-declaration.json",{schema:"cpu-negative-input-declaration-v1",request:requestBinding,runId:request.runId,packageId:request.packageId,
    programBindings:request.programBindings,callIdentity,layout,formalMapping:{projectPhysical:fs.realpathSync.native(root),projectIdentity:nodeIdentity(fs.lstatSync(root,{bigint:true})),
      runtimeIdentity:nodeIdentity(fs.lstatSync(runtime,{bigint:true})),physicalRuntime,physicalRuntimeIdentity:nodeIdentity(fs.lstatSync(physicalRuntime,{bigint:true})),physicalInputRoot:inside(root,layout.root)},
    linkMetadataReserveBytes:CPU_LINK_RESERVE_BYTES,reserveIsMeasurement:false})
  return {root,outputRoot,requestBinding,declarationBinding,programBindings:request.programBindings,callIdentity,inspector,layout,acknowledged:new Set(),closed:false}
}
function cpuDiskBytes(scope,roots){
  read(scope.root,scope.requestBinding);read(scope.root,scope.declarationBinding)
  const observation=scope.inspector.scan();let total=observation.totalBytes
  for(const logical of roots){
    if(logical!==scope.outputRoot){total+=directoryBytes(inside(scope.root,logical));continue}
    const base=inside(scope.root,logical)
    for(const entry of fs.readdirSync(base,{withFileTypes:true})){
      const child=logical+"/"+entry.name;if(child===scope.layout.root)continue
      const physical=inside(scope.root,child),stat=fs.lstatSync(physical)
      if(stat.isSymbolicLink())throw inputError(child,"ordinary output link refused")
      if(stat.isDirectory())total+=directoryBytes(physical)
      else if(stat.isFile())total+=stat.size
      else throw inputError(child,"unsupported ordinary output type")
    }
  }
  return total+(scope.registryKeeper?.closedSidecarDebitBytes()??0)
}
function cpuPersist(scope,roots,maximum,logical,value){
  assert.ok(roots.some(r=>logical.startsWith(r+"/")),"CPU write outside accounting roots")
  assert.ok(!logical.startsWith(scope.layout.root+"/"),"ordinary output cannot write negative inputs")
  const physical=inside(scope.root,logical),raw=Buffer.from(JSON.stringify(value)+"\n")
  assert.ok(raw.length<=2097152,"single JSON budget")
  assertCpuNegativeInputBudget(cpuDiskBytes(scope,roots),raw.length,maximum)
  fs.mkdirSync(path.dirname(physical),{recursive:true});const fd=fs.openSync(physical,"wx")
  try{fs.writeFileSync(fd,raw);fs.fsyncSync(fd)}finally{fs.closeSync(fd)}
  const binding={path:logical,sha256:sha(raw)};read(scope.root,binding);return binding
}
export function assertCpuNegativeInputBudget(diskBytes,newBytes,maximum){
  for(const value of [diskBytes,newBytes,maximum])assert.ok(Number.isSafeInteger(value)&&value>=0)
  assert.ok(maximum<=8*1024**2,"CPU ceiling may not expand")
  assert.ok(diskBytes+newBytes<=maximum,"CPU combined output budget")
}
export function hasLiveCpuFixtureCleanup(receipt){
  const scope=cpuScopes.get(receipt)
  if(!scope||!scope.closed||receipt.cpuNegativeInputs?.fixtureLinksRemoved!==true)return false
  scope.inspector.scan({requireRemoved:true,requireObserved:true});return true
}

// These ordinary CPU-fixture connections do not grant IO exceptions or native
// authority. Retain failed/unknown calls strongly; never close through GC.
const retainedRegistryKeepers=new Set()
const registryFixtureNames=Object.freeze(["dispatch","finalization","failure"])
export function cpuRegistryFixtureBudgetTotal({diskBytes,closedSidecarDebitBytes=0,streamBytes=0,guardBytes=0,linkReserveBytes=0,reserveBytes=0}){
  const values=[diskBytes,closedSidecarDebitBytes,streamBytes,guardBytes,linkReserveBytes,reserveBytes]
  for(const value of values)assert.ok(Number.isSafeInteger(value)&&value>=0,"CPU fixture accounting requires actual nonnegative byte charges")
  const total=values.reduce((a,b)=>a+b,0);assert.ok(Number.isSafeInteger(total));return total
}
export function validateCpuRegistryFixtureLeaseRequest(context,value){
  assert.deepEqual(Object.keys(value).sort(),["callIdentity","declaration","name","request","root","rootIdentity","schema"].sort(),"exact CPU registry request fields")
  assert.equal(value.schema,"cpu-registry-fixture-keeper-request-v1")
  assert.ok(registryFixtureNames.includes(value.name),"exact CPU registry fixture name")
  assert.equal(value.callIdentity,context.callIdentity,"current CPU registry call required")
  assert.deepEqual(value.request,context.request,"current CPU registry request required")
  assert.deepEqual(value.declaration,context.declaration,"current CPU registry declaration required")
  assert.equal(value.root,context.entryRoot+"/registry-fixtures/"+value.name,"exact CPU registry fixture root")
  assert.match(value.rootIdentity,/^[1-9][0-9]*:[1-9][0-9]*$/u,"actual ordinary fixture root identity required")
  return value
}
export class CpuRegistryFixtureKeeper {
  #root;#context;#persist;#measure;#ceased;#monitorEnded;#slots=new Map();#receipt;#source
  constructor({root,entryRoot,requestBinding,declarationBinding,callIdentity,persist,measure,ceased,monitorEnded}){
    assert.equal(typeof persist,"function");assert.equal(typeof measure,"function")
    assert.equal(typeof ceased,"function");assert.equal(typeof monitorEnded,"function")
    const request=json(root,requestBinding),declaration=json(root,declarationBinding)
    assert.match(callIdentity,/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/u)
    assert.equal(declaration.callIdentity,callIdentity);assert.deepEqual(declaration.request,requestBinding)
    assert.equal(request.outputRoot,entryRoot);assert.deepEqual(request.formalSpecification,SPECIFICATION)
    const component=request.schema==="cpu-negative-input-component-request-v1"
    if(component){
      assert.equal(request.taskId,"T-QV12-01");assert.equal(request.nativeOwnerAllowed,false)
      assert.equal(entryRoot,".runtime/ai-painter/controller-parallel-20261011/training-cpu-negative-inputs/quality-v1-t-qv12-01")
      assert.equal(request.callIdentity,callIdentity);assert.equal(requestBinding.path,entryRoot+"/component-request.json")
      assert.equal(declaration.schema,"cpu-negative-input-component-declaration-v1")
      assert.equal(declarationBinding.path,entryRoot+"/cpu-negative-inputs/input-declaration.json")
    }else{
      assert.equal(request.schema,"ecology-regime-quality-cpu-request-v1")
      assert.equal(entryRoot,".runtime/ai-painter/ecology-regime-quality-executions/"+request.runId+"/cpu-entry")
      assert.equal(requestBinding.path,entryRoot.replace(/\/cpu-entry$/u,"")+"/cpu-request.json")
      assert.equal(declaration.schema,"cpu-negative-input-declaration-v1")
      assert.equal(declaration.runId,request.runId);assert.equal(declaration.packageId,request.packageId)
      assert.equal(declarationBinding.path,entryRoot.replace(/\/cpu-entry$/u,"")+"/cpu-negative-inputs/input-declaration.json")
    }
    const inputOwner=component?entryRoot:entryRoot.replace(/\/cpu-entry$/u,"")
    assert.deepEqual(declaration.layout,cpuNegativeInputLayout(inputOwner),"exact current CPU fixture layout")
    const runtime=path.join(root,".runtime"),physicalRuntime=fs.realpathSync.native(runtime)
    assert.deepEqual(declaration.formalMapping,{projectPhysical:fs.realpathSync.native(root),projectIdentity:nodeIdentity(fs.lstatSync(root,{bigint:true})),
      runtimeIdentity:nodeIdentity(fs.lstatSync(runtime,{bigint:true})),physicalRuntime,
      physicalRuntimeIdentity:nodeIdentity(fs.lstatSync(physicalRuntime,{bigint:true})),physicalInputRoot:inside(root,declaration.layout.root)},"actual CPU keeper formal mapping")
    assert.deepEqual(declaration.programBindings,request.programBindings)
    const currentPrograms=finalProgramBindings(root)
    assert.deepEqual(request.programBindings,currentPrograms,"current CPU registry source closure")
    assert.equal(Object.keys(request.programBindings).length,Object.keys(currentPrograms).length)
    assert.equal(new Set(Object.values(request.programBindings).map(b=>b.path)).size,
      new Set(Object.values(currentPrograms).map(b=>b.path)).size)
    assert.ok(Object.keys(currentPrograms).length<=256,"CPU registry source role ceiling")
    const sourcePaths=new Set();let sourceBytes=0
    for(const binding of Object.values(request.programBindings)){
      const raw=read(root,binding)
      assert.ok(raw.length<=1048576,"CPU registry source file byte ceiling")
      if(!sourcePaths.has(binding.path)){sourcePaths.add(binding.path);sourceBytes+=raw.length}
      assert.ok(sourceBytes<=16*1024**2,"CPU registry unique source byte ceiling")
    }
    this.#root=root;this.#source=request.programBindings
    this.#context={callIdentity,request:requestBinding,declaration:declarationBinding,entryRoot}
    this.#persist=persist;this.#measure=measure;this.#ceased=ceased;this.#monitorEnded=monitorEnded
    const entry=fs.lstatSync(inside(root,entryRoot),{bigint:true})
    assert.ok(entry.isDirectory()&&!entry.isSymbolicLink(),"ordinary current CPU entry")
    this.#receipt={schema:"cpu-registry-fixture-keeper-lifecycle-v1",...this.#context,entryIdentity:nodeIdentity(entry),
      opened:[],scans:0,peakCountedBytes:0,peakObservedDiskBytes:0,lastLiveScanBytes:null,preCloseBytes:null,postCloseBytes:null,
      closedSidecarDebitBytes:0,closedSidecarMeasurements:[],lastAccounting:null,preCloseAccounting:null,postCloseAccounting:null,
      closeErrors:[],evidenceErrors:[],consumptionErrors:[],childConsumptions:[],releaseConfirmed:false,processCeased:false,activeMonitoringEnded:false,nativeAuthorityClaimed:false}
  }
  context(){return structuredClone(this.#context)}
  closedSidecarDebitBytes(){return this.#receipt.closedSidecarDebitBytes}
  receipt(){return {...structuredClone(this.#receipt),handleStates:[...this.#slots.values()].map(s=>({name:s.name,
    activationComplete:s.activationComplete,closed:s.closed===true,activationError:s.activationError??null}))}}
  recordEvidenceError(stage,error){this.#receipt.evidenceErrors.push({stage,error:String(error).slice(0,2048)});retainedRegistryKeepers.add(this)}
  #origin(){
    read(this.#root,this.#context.request);read(this.#root,this.#context.declaration)
    const entry=fs.lstatSync(inside(this.#root,this.#context.entryRoot),{bigint:true})
    assert.ok(entry.isDirectory()&&!entry.isSymbolicLink()&&nodeIdentity(entry)===this.#receipt.entryIdentity,"CPU registry entry replaced")
  }
  #check(slot){
    for(const item of [...slot.identities,...slot.notifications]){
      const s=fs.lstatSync(inside(this.#root,item.path),{bigint:true})
      assert.ok(!s.isSymbolicLink()&&(item.directory?s.isDirectory():s.isFile())&&nodeIdentity(s)===item.identity,"CPU registry keeper file/root identity changed: "+item.path)
    }
    assert.equal(slot.database.isTransaction,false,"CPU registry keeper must not hold a read/write transaction")
    for(const binding of slot.protocolBindings)read(this.#root,binding)
  }
  service(){
    assert.equal(this.#receipt.releaseConfirmed,false,"released CPU registry keeper cannot be reused")
    this.#origin()
    const allowedNotifications=new Set(registryFixtureNames.flatMap(name=>["request-"+name+".json","request-"+name+".ready",
      "ack-"+name+".json","ack-"+name+".ready","consumed-"+name+".json"]).map(n=>"sqlite-keeper-"+n))
    for(const entry of fs.readdirSync(inside(this.#root,this.#context.entryRoot)))
      if(entry.startsWith("sqlite-keeper-"))assert.ok(allowedNotifications.has(entry),"unknown CPU registry keeper notification")
    for(const name of registryFixtureNames){
      if(this.#slots.has(name)){this.#check(this.#slots.get(name));continue}
      const ready=this.#context.entryRoot+"/sqlite-keeper-request-"+name+".ready",readyPath=inside(this.#root,ready)
      if(!fs.existsSync(readyPath))continue // A not-yet-created fixed notification, never a vanished output.
      const readyStat=fs.lstatSync(readyPath,{bigint:true});assert.ok(readyStat.isFile()&&!readyStat.isSymbolicLink()&&readyStat.size===0n,"ordinary keeper ready notification")
      const logical=this.#context.entryRoot+"/sqlite-keeper-request-"+name+".json",binding=bind(this.#root,logical)
      assert.ok(fs.lstatSync(inside(this.#root,logical)).size<=4096,"bounded keeper request")
      const value=validateCpuRegistryFixtureLeaseRequest(this.#context,json(this.#root,binding))
      assert.equal(value.name,name)
      const fixture=inside(this.#root,value.root),before=fs.lstatSync(fixture,{bigint:true})
      assert.ok(before.isDirectory()&&!before.isSymbolicLink()&&nodeIdentity(before)===value.rootIdentity,"fresh ordinary keeper fixture root")
      assert.deepEqual(fs.readdirSync(fixture),[],"keeper fixture root must still be empty")
      assert.deepEqual(finalProgramBindings(this.#root),this.#source,"source changed before keeper activation")
      const registry=value.root+"/.runtime/ai-painter/current-execution-registry",physical=inside(this.#root,registry)
      fs.mkdirSync(physical,{recursive:true});const databasePath=registry+"/registry.sqlite"
      assert.equal(fs.existsSync(inside(this.#root,databasePath)),false,"old SQLite fixture refused")
      const database=new DatabaseSync(inside(this.#root,databasePath))
      const slot={database,identities:[],notifications:[{path:ready,directory:false,identity:nodeIdentity(readyStat)}],
        protocolBindings:[binding],name,request:binding,activationComplete:false}
      this.#slots.set(name,slot);retainedRegistryKeepers.add(this)
      for(const [p,directory]of [[value.root,true],[value.root+"/.runtime",true],[value.root+"/.runtime/ai-painter",true],[registry,true],[databasePath,false]]){
        const s=fs.lstatSync(inside(this.#root,p),{bigint:true});assert.ok(!s.isSymbolicLink()&&(directory?s.isDirectory():s.isFile()),"ordinary keeper activation root/database")
        slot.identities.push({path:p,directory,identity:nodeIdentity(s)})
      }
      // Establish a real WAL connection before acknowledging. No keeper SQL
      // runs after activation until the confirmed synchronous final close.
      try{database.exec("PRAGMA journal_mode = WAL; PRAGMA user_version = 0;")
      assert.equal(database.prepare("PRAGMA journal_mode").get().journal_mode,"wal")
      assert.equal(database.prepare("SELECT COUNT(*) AS count FROM sqlite_schema").get().count,0,"empty real keeper schema required")
      assert.equal(database.isTransaction,false,"keeper activation left a transaction")
      for(const [p,directory]of [[databasePath+"-wal",false],[databasePath+"-shm",false]]){
        const s=fs.lstatSync(inside(this.#root,p),{bigint:true});assert.ok(!s.isSymbolicLink()&&(directory?s.isDirectory():s.isFile()),"ordinary SQLite keeper artifact")
        slot.identities.push({path:p,directory,identity:nodeIdentity(s)})
      }
      assert.equal(slot.identities[0].identity,value.rootIdentity);slot.activationComplete=true
      }catch(error){slot.activationError=String(error);throw error}
      const ackLogical=this.#context.entryRoot+"/sqlite-keeper-ack-"+name+".json"
      const ack={schema:"cpu-registry-fixture-keeper-ack-v1",...this.#context,name,root:value.root,rootIdentity:value.rootIdentity,
        childRequest:binding,readyIdentity:nodeIdentity(readyStat),identities:slot.identities,walActivated:true,emptySchema:true,
        activeTransaction:false,keeperWritesWhileChildActive:0,nativeAuthorityClaimed:false}
      this.#persist(ackLogical,ack)
      const notify=inside(this.#root,this.#context.entryRoot+"/sqlite-keeper-ack-"+name+".ready"),fd=fs.openSync(notify,"wx")
      try{fs.fsyncSync(fd)}finally{fs.closeSync(fd)}
      const ackBinding=bind(this.#root,ackLogical);slot.protocolBindings.push(ackBinding)
      slot.notifications.push({path:this.#context.entryRoot+"/sqlite-keeper-ack-"+name+".ready",directory:false,
        identity:nodeIdentity(fs.lstatSync(notify,{bigint:true}))})
      slot.ack=ack;slot.ackBinding=ackBinding
      this.#receipt.opened.push({...ack,acknowledgement:ackBinding})
      this.#check(slot)
    }
  }
  recordScan(observation){
    const charges={...observation,closedSidecarDebitBytes:this.closedSidecarDebitBytes()}
    const bytes=cpuRegistryFixtureBudgetTotal(charges)
    assertCpuNegativeInputBudget(bytes,0,8*1024**2)
    this.#receipt.scans++;this.#receipt.lastLiveScanBytes=bytes;this.#receipt.peakCountedBytes=Math.max(this.#receipt.peakCountedBytes,bytes)
    this.#receipt.peakObservedDiskBytes=Math.max(this.#receipt.peakObservedDiskBytes,charges.diskBytes)
    this.#receipt.lastAccounting={...charges,accountedBytes:bytes,closedSidecarDebitIsCurrentDiskMeasurement:false}
    return this.#receipt.lastAccounting
  }
  release(){
    this.#receipt.processCeased=this.#ceased()===true;this.#receipt.activeMonitoringEnded=this.#monitorEnded()===true
    assert.ok(this.#receipt.processCeased&&this.#receipt.activeMonitoringEnded,"CPU keeper release requires retained ceased child and ended monitoring")
    assert.equal(this.#receipt.releaseConfirmed,false,"CPU keeper double release")
    this.#origin();assert.deepEqual(finalProgramBindings(this.#root),this.#source,"CPU source changed at keeper release")
    for(const slot of this.#slots.values())this.#check(slot)
    this.#receipt.preCloseAccounting=this.recordScan(this.#measure());this.#receipt.preCloseBytes=this.#receipt.preCloseAccounting.accountedBytes
    const sidecars=[]
    for(const slot of this.#slots.values())for(const item of slot.identities.filter(x=>/registry\.sqlite-(wal|shm)$/u.test(x.path))){
      const s=fs.lstatSync(inside(this.#root,item.path),{bigint:true})
      assert.ok(s.isFile()&&!s.isSymbolicLink()&&nodeIdentity(s)===item.identity,"actual owned sidecar before close")
      sidecars.push({slot,path:item.path,identity:item.identity,beforeBytes:Number(s.size)})
    }
    // Hold every measured sidecar before closing. Only a successfully observed
    // same-inode post-close file may remove overlap with current physical disk.
    this.#receipt.closedSidecarDebitBytes+=sidecars.reduce((n,s)=>n+s.beforeBytes,0)
    for(const slot of this.#slots.values()){
      const logical=this.#context.entryRoot+"/sqlite-keeper-consumed-"+slot.name+".json"
      if(!fs.existsSync(inside(this.#root,logical)))continue // No child completion proof was published.
      try{const binding=bind(this.#root,logical),consumed=json(this.#root,binding)
        assert.equal(consumed.schema,"cpu-registry-fixture-keeper-consumed-v1")
        for(const key of ["callIdentity","entryRoot","request","declaration"])assert.deepEqual(consumed[key],this.#context[key])
        assert.equal(consumed.name,slot.name);assert.equal(consumed.root,slot.ack.root);assert.equal(consumed.rootIdentity,slot.ack.rootIdentity)
        assert.deepEqual(consumed.childRequest,slot.request);assert.deepEqual(consumed.acknowledgement,slot.ackBinding)
        assert.deepEqual(consumed.identities,slot.identities);assert.equal(consumed.nativeAuthorityClaimed,false)
        this.#receipt.childConsumptions.push({name:slot.name,binding,acknowledgement:slot.ackBinding,rootIdentity:consumed.rootIdentity})
      }catch(error){this.#receipt.consumptionErrors.push({name:slot.name,error:String(error)})}
    }
    for(const slot of this.#slots.values()){
      try{slot.database.close();slot.closed=true}catch(error){this.#receipt.closeErrors.push({name:slot.name,error:String(error)})}
    }
    for(const item of sidecars){
      try{
        let afterBytes,absent=false
        try{const s=fs.lstatSync(inside(this.#root,item.path),{bigint:true})
          assert.ok(s.isFile()&&!s.isSymbolicLink()&&nodeIdentity(s)===item.identity,"owned sidecar replaced at close")
          afterBytes=Number(s.size)
        }catch(error){if(error.code!=="ENOENT"||item.slot.closed!==true)throw error;afterBytes=0;absent=true}
        const overlap=Math.min(item.beforeBytes,afterBytes),retainedDebit=item.beforeBytes-overlap
        this.#receipt.closedSidecarDebitBytes-=overlap
        this.#receipt.closedSidecarMeasurements.push({name:item.slot.name,path:item.path,identity:item.identity,
          beforeBytes:item.beforeBytes,afterBytes,absentAfterVerifiedClose:absent,retainedDebitBytes:retainedDebit,
          retainedDebitIsCurrentDiskMeasurement:false})
      }catch(error){this.#receipt.closeErrors.push({stage:"owned_sidecar_after_close",path:item.path,error:String(error)})}
    }
    try{this.#receipt.postCloseAccounting=this.recordScan(this.#measure());this.#receipt.postCloseBytes=this.#receipt.postCloseAccounting.accountedBytes
      const current=this.#receipt.postCloseAccounting,reserveBytes=OUTER_TERMINAL_BYTES
      const physicalOnly=cpuRegistryFixtureBudgetTotal({...current,closedSidecarDebitBytes:0,reserveBytes})
      const proposedWriteBytes=8*1024**2-physicalOnly
      if(this.closedSidecarDebitBytes()>0&&proposedWriteBytes>=0){
        assert.throws(()=>assertCpuNegativeInputBudget(current.accountedBytes+reserveBytes,proposedWriteBytes,8*1024**2),/combined output/u)
        this.#receipt.actualCloseBudgetBoundary={physicalDiskBytes:current.diskBytes,closedSidecarDebitBytes:this.closedSidecarDebitBytes(),
          streamBytes:current.streamBytes,guardBytes:current.guardBytes,linkReserveBytes:current.linkReserveBytes,reserveBytes,
          proposedWriteBytes,physicalOnlyFits:true,retainedLedgerRejected:true,bytesActuallyWritten:0,
          basis:"current retained-call real sidecar close measurements; pre-write rejection only"}
      }
    }
    catch(error){this.#receipt.closeErrors.push({stage:"post_close_scan",error:String(error)})}
    this.#receipt.releaseConfirmed=this.#receipt.closeErrors.length===0&&[...this.#slots.values()].every(s=>s.closed===true)
    if(this.#receipt.releaseConfirmed)retainedRegistryKeepers.delete(this)
    assert.ok(this.#receipt.releaseConfirmed,"CPU SQLite keeper close/accounting failed")
    return this.receipt()
  }
}

// Identity checks here remain independent even if the shape validator changes.
// A valid budget is not GPU, production, checkpoint or release admission.
export function nativeBudget(phase,{root,plan}={}) {
  assert.ok(["cpu","qualification","training","review"].includes(phase),"unknown native phase")
  if(phase==="training") assert.ok(plan,"training native budget requires its own immutable ecology plan")
  if(plan) {
    assert.equal(plan.schema,"ecology-regime-quality-plan-v1")
    assert.equal(plan.capabilityVersion,CAPABILITY)
    assert.equal(plan.executionProfile,PROFILE)
    assert.ok(["bounded-quality-training","synthetic-cpu-bootstrap"].includes(plan.executionMode))
    if(phase==="training") assert.equal(plan.executionMode,"bounded-quality-training","bootstrap is not training admission")
    for(const key of ["runId","packageId"]) assert.match(plan[key],/^[a-z0-9][a-z0-9-]{7,127}$/u)
    assert.notEqual(plan.runId,plan.packageId)
    assert.equal(plan.outputRoot,".runtime/ai-painter/ecology-regime-quality-executions/"+plan.runId)
    assert.equal(plan.historicalCheckpointMayInitialize,false)
    assert.equal(plan.trainingRestartAllowed,false)
    assert.equal(Object.hasOwn(plan,"resourcePolicy"),false,"resource successor is not ecology budget authority")
    assert.equal(Object.hasOwn(plan,"effectiveExecutionCeiling"),false,"caller ceiling override prohibited")
    const config=plan.configuration
    assert.equal(config?.capabilityVersion,CAPABILITY)
    for(const [key,value] of Object.entries({maxWallSeconds:2700,maxOutputMiB:128,cpuThreads:2,trainingAttempts:1,automaticRetries:0}))
      assert.equal(config.executionCeiling?.[key],value,"own ecology ceiling differs: "+key)
    assert.equal(config.gpuAdmissionSeconds,600)
    // Source/configuration/program byte verification is the owner's new plan
    // validator. It provides budget shape and integrity, never qualification.
    validatePlan(root,plan)
  }
  return {timeoutMs:phase==="training"?2700000:phase==="qualification"?600000:phase==="cpu"?240000:120000,streamBytes:STREAM,outputBytes:phase==="training"?128*1024**2:phase==="cpu"?8*1024**2:16*1024**2}
}

export function validateNativeReceipt({proof,ownerPid,bindingBase64,ownerClosed,protocolError,stdoutBytes,stderrBytes}) {
  return ownerClosed===true && !protocolError && proof!==null && typeof proof==="object" && Number.isInteger(ownerPid) && ownerPid>0 && proof.ownerPid===ownerPid && Number.isInteger(proof.rootPid) && proof.rootPid>0 && typeof proof.rootCreationDateUtc==="string" && proof.rootCreationDateUtc.length>0 && proof.bindingBase64===bindingBase64
    && proof.assignedBeforeResume===true && proof.killOnJobClose===true && proof.activeProcessesAfterCleanup===0
    && !proof.observationError && !proof.cleanupError && proof.stdoutBytes===stdoutBytes && proof.stderrBytes===stderrBytes
}
const liveReceipts=new WeakSet();
export function hasLiveOwnedProof(receipt){return receipt!==null && typeof receipt==="object" && liveReceipts.has(receipt)}
export function cleanupForCurrentCall(error,lastReceipt){const receipt=Object.hasOwn(error,"ownedReceipt")?error.ownedReceipt:lastReceipt;return hasLiveOwnedProof(receipt)}

function nativeEvidenceNamespace(root,outputRoot,currentScope){
  const logical=outputRoot+"/native-evidence-root.json",file=inside(root,logical)
  const key=sha(outputRoot).slice(0,32),namespace=[key.slice(0,8),key.slice(8,12),key.slice(12,16),key.slice(16,20),key.slice(20)].join("-")
  const expectedRoot=`.runtime/ai-painter/owned-worker-guards/${namespace}`
  if(!fs.existsSync(file)){
    const siblings=fs.readdirSync(inside(root,outputRoot)).filter(name=>name.startsWith("owned-")&&outputRoot+"/"+name!==currentScope)
    assert.equal(siblings.length,0,"previous call exists but namespace pointer is missing")
    const nativeEvidenceRoot=expectedRoot
    assert.equal(fs.existsSync(inside(root,nativeEvidenceRoot)),false,"existing namespace cannot be silently replaced")
    fs.mkdirSync(inside(root,nativeEvidenceRoot),{recursive:false})
    const value={schema:"detail-weight-native-evidence-root-v1",outputRoot,nativeEvidenceRoot}
    write(root,nativeEvidenceRoot+"/binding.json",value);write(root,logical,value)
  }
  const binding=bind(root,logical),value=json(root,binding)
  assert.deepEqual(Object.keys(value).sort(),["nativeEvidenceRoot","outputRoot","schema"])
  assert.equal(value.schema,"detail-weight-native-evidence-root-v1");assert.equal(value.outputRoot,outputRoot)
  assert.equal(value.nativeEvidenceRoot,expectedRoot,"namespace identity must derive from this Run outputRoot")
  assert.match(value.nativeEvidenceRoot,/^\.runtime\/ai-painter\/owned-worker-guards\/[a-f0-9-]{36}$/u)
  assert.deepEqual(read(root,bind(root,value.nativeEvidenceRoot+"/binding.json")),read(root,binding))
  return value.nativeEvidenceRoot
}
export function nativeAccountingRoots(root,outputRoot,nativeEvidenceRoot,cpuAccountingRoot=null,phase="cpu"){
  const roots=cpuAccountingRoot?[cpuAccountingRoot]:phase==="review"?[outputRoot,outputRoot.replace(/-owned$/u,"")]:[outputRoot]
  const namespaces=new Set(nativeEvidenceRoot?[nativeEvidenceRoot]:[])
  if(cpuAccountingRoot){
    assert.ok(outputRoot.startsWith(cpuAccountingRoot+"/"),"CPU output must belong to its accounting task")
    // Only this explicitly bound CPU task is inspected, never historical GPU
    // directories or alternative current execution registries.
    const visit=logical=>{const entries=fs.readdirSync(inside(root,logical),{withFileTypes:true})
      if(entries.some(entry=>entry.isDirectory()&&entry.name.startsWith("owned-cpu-")))assert.ok(entries.some(entry=>entry.isFile()&&entry.name==="native-evidence-root.json"),"prior CPU owned call is missing its namespace pointer")
      for(const entry of entries){
      const child=logical+"/"+entry.name;assert.equal(fs.lstatSync(inside(root,child)).isSymbolicLink(),false,"output junction prohibited")
      if(entry.isDirectory())visit(child)
      else if(entry.isFile()&&entry.name==="native-evidence-root.json"){
        const value=json(root,bind(root,child)),runRoot=logical,key=sha(runRoot).slice(0,32)
        const expected=".runtime/ai-painter/owned-worker-guards/"+[key.slice(0,8),key.slice(8,12),key.slice(12,16),key.slice(16,20),key.slice(20)].join("-")
        assert.deepEqual(Object.keys(value).sort(),["nativeEvidenceRoot","outputRoot","schema"])
        assert.equal(value.schema,"detail-weight-native-evidence-root-v1");assert.equal(value.outputRoot,runRoot);assert.equal(value.nativeEvidenceRoot,expected,"CPU namespace must derive from its Run")
        assert.deepEqual(read(root,bind(root,child)),read(root,bind(root,expected+"/binding.json")))
        namespaces.add(expected);assert.ok(namespaces.size<=31,"CPU namespace bound exceeded")
      }
    }}
    if(fs.existsSync(inside(root,cpuAccountingRoot)))visit(cpuAccountingRoot)
  }
  return [...new Set([...roots,...namespaces])]
}
export async function withNativeReceiptBudget(root,receipt,action,files=[]){
  assert.ok(Array.isArray(receipt.outputAccountingRoots)&&receipt.outputAccountingRoots.length<=32)
  const streams=receipt.streamBytes??{stdout:0,stderr:0};assert.ok(Number.isInteger(streams.stdout)&&streams.stdout>=0&&Number.isInteger(streams.stderr)&&streams.stderr>=0)
  const guardBytes=receipt.guard?.state==="retained"&&typeof receipt.guard.path==="string"&&fs.existsSync(receipt.guard.path)?fs.statSync(receipt.guard.path).size:0
  if(cpuScopes.has(receipt))assert.ok(hasLiveCpuFixtureCleanup(receipt),"current CPU fixture cleanup required")
  const heldSidecars=cpuScopes.get(receipt)?.registryKeeper.closedSidecarDebitBytes()??0
  const maximum=receipt.budget.outputBytes-streams.stdout-streams.stderr-guardBytes-(cpuScopes.has(receipt)?CPU_LINK_RESERVE_BYTES:0)-heldSidecars
  assert.ok(Array.isArray(files)&&files.length<=2)
  const fileBytes=files.reduce((n,r)=>{const f=inside(root,r);if(!fs.existsSync(f))return n;const stat=fs.lstatSync(f);assert.ok(stat.isFile()&&!stat.isSymbolicLink(),"explicit terminal file must be regular");return n+stat.size},0)
  if(!Number.isInteger(receipt.budget.terminalReserveBytes))return withOutputBudget({projectRoot:root,roots:receipt.outputAccountingRoots,files,maximum,reserveBytes:65536},action)
  const disk=receipt.outputAccountingRoots.reduce((n,r)=>n+directoryBytes(inside(root,r)),0)+fileBytes
  return withOutputBudget({projectRoot:root,roots:receipt.outputAccountingRoots,files,maximum:Math.min(maximum,disk+OUTER_TERMINAL_BYTES),reserveBytes:0},action)
}
export async function withNativeOrdinaryBudget(root,receipt,action){
  assert.ok(Array.isArray(receipt.outputAccountingRoots)&&receipt.outputAccountingRoots.length<=32)
  const streams=receipt.streamBytes??{stdout:0,stderr:0}
  assert.ok(Number.isSafeInteger(streams.stdout)&&streams.stdout>=0&&Number.isSafeInteger(streams.stderr)&&streams.stderr>=0)
  const guardBytes=receipt.guard?.state==="retained"&&typeof receipt.guard.path==="string"&&fs.existsSync(receipt.guard.path)?fs.statSync(receipt.guard.path).size:0
  if(cpuScopes.has(receipt))assert.ok(hasLiveCpuFixtureCleanup(receipt),"current CPU fixture cleanup required")
  const heldSidecars=cpuScopes.get(receipt)?.registryKeeper.closedSidecarDebitBytes()??0
  const maximum=Math.min(receipt.budget.outputBytes,receipt.budget.ordinaryOutputLimitBytes??receipt.budget.outputBytes)-streams.stdout-streams.stderr-guardBytes-(cpuScopes.has(receipt)?CPU_LINK_RESERVE_BYTES:0)-heldSidecars
  return withOutputBudget({projectRoot:root,roots:receipt.outputAccountingRoots,maximum,reserveBytes:65536},action)
}

export async function runNative(options) {
  assert.ok(options && typeof options === "object")
  const supported = ["root","outputRoot","phase","executable","args","onHeartbeat","abortReason","executionPlan"]
  for (const key of Object.keys(options)) assert.ok(supported.includes(key), "unsupported native option: "+key)
  const {root,outputRoot,phase,executable,args,onHeartbeat=()=>{},abortReason=()=>null,executionPlan=null}=options
  assert.equal(process.platform,"win32")
  assert.equal(typeof root,"string");assert.ok(path.isAbsolute(root))
  assert.equal(typeof executable,"string");assert.ok(path.isAbsolute(executable))
  assert.ok(Array.isArray(args)&&args.every(arg=>typeof arg==="string"&&!arg.includes("\0")))
  assert.equal(typeof onHeartbeat,"function");assert.equal(typeof abortReason,"function")
  assert.match(outputRoot,/^\.runtime\/ai-painter\/ecology-regime-quality-executions\/[a-z0-9][a-z0-9-]{7,127}(?:\/dry-review-owned)?$/u)
  assert.equal(outputRoot.endsWith("/dry-review-owned"),phase==="review")
  if(executionPlan) assert.equal(outputRoot,executionPlan.outputRoot+(phase==="review"?"/dry-review-owned":""))
  const budget=nativeBudget(phase,executionPlan?{root,plan:executionPlan}:undefined)
  const started=Date.now(),deadline=started+budget.timeoutMs-1000
  const guardRoot=inside(root,".runtime/ai-painter/owned-worker-guards"),guardPath=path.join(guardRoot,"active.json")
  fs.mkdirSync(guardRoot,{recursive:true});const id=crypto.randomUUID(),scope=`${outputRoot}/owned-${phase}-${id}`
  if(fs.existsSync(guardPath))throw Object.assign(new Error("existing unknown guard refused"),{code:"OWNED_GUARD_BUSY",ownedReceipt:{cleanupConfirmed:false,guard:{path:guardPath,state:"existing_guard_refused"}}})
  fs.mkdirSync(inside(root,scope),{recursive:true})
  const cpuInputs=phase==="cpu"?mintCpuInputs(root,outputRoot,executable,args,id):null
  // Reuse the existing guard store's per-call namespace, not a long Run path.
  // Legacy csc creates temporary resources next to its output executable.
  const nativeEvidenceRoot=nativeEvidenceNamespace(root,outputRoot,scope)
  const record={identity:id,runnerPid:process.pid,recordedAtUtc:new Date().toISOString(),executable,
    executableSha256:sha(fs.readFileSync(executable)),helperSha256:sha(fs.readFileSync(SELF)),nativeOwnerSource:nativeOwnerSourceIdentity(),
    commandSha256:sha(JSON.stringify(args)),startedEvidence:inside(root,nativeEvidenceRoot+`/${id}-started.json`)},guardBytes=JSON.stringify(record)
  const accountingRoots=[...new Set(nativeAccountingRoots(root,outputRoot,nativeEvidenceRoot,null,phase))]
  // Review's known final-output root may not yet exist. Materialize the exact
  // phase accounting roots once; live scans never treat vanished roots as empty.
  for(const logical of accountingRoots)fs.mkdirSync(inside(root,logical),{recursive:true})
  let retainedStreamBytes=0,registryKeeper=null,keeperActive=true,keeperCanClose=false,keeperMonitoringEnded=true
  const diskBytes=()=>cpuInputs?cpuDiskBytes(cpuInputs,accountingRoots):accountingRoots.reduce((n,r)=>n+directoryBytes(inside(root,r)),0)
  const persist=(logical,value,maximum)=>cpuInputs?cpuPersist(cpuInputs,accountingRoots,maximum,logical,value):
    withOutputBudget({projectRoot:root,roots:accountingRoots,maximum,reserveBytes:0},()=>write(root,logical,value))
  const outputBytes=()=>{
    if(registryKeeper&&keeperActive)registryKeeper.service()
    let bytes=diskBytes()
    if(cpuInputs){
      for(const link of cpuInputs.inspector.scan().links)if(link.observedIdentity&&!cpuInputs.acknowledged.has(link.name)){
        persist(outputRoot+"/cpu-entry/negative-observation-"+link.name+".json",{schema:"cpu-negative-input-live-observation-v1",callIdentity:id,request:cpuInputs.requestBinding,
          link,observedAtUtc:new Date().toISOString()},(budget.ordinaryOutputLimitBytes??budget.outputBytes)-retainedStreamBytes-Buffer.byteLength(guardBytes))
        cpuInputs.acknowledged.add(link.name)
      }
      bytes=diskBytes()
    }
    const total=bytes+Buffer.byteLength(guardBytes)
    registryKeeper?.recordScan({diskBytes:bytes-CPU_LINK_RESERVE_BYTES-registryKeeper.closedSidecarDebitBytes(),
      streamBytes:retainedStreamBytes,guardBytes:Buffer.byteLength(guardBytes),linkReserveBytes:CPU_LINK_RESERVE_BYTES})
    return total
  }
  if(cpuInputs){
    const entryRoot=outputRoot+"/cpu-entry";fs.mkdirSync(inside(root,entryRoot),{recursive:true})
    registryKeeper=new CpuRegistryFixtureKeeper({root,entryRoot,requestBinding:cpuInputs.requestBinding,
      declarationBinding:cpuInputs.declarationBinding,callIdentity:id,
      persist:(logical,value)=>persist(logical,value,budget.ordinaryOutputLimitBytes-retainedStreamBytes-Buffer.byteLength(guardBytes)),
      measure:()=>({diskBytes:diskBytes()-CPU_LINK_RESERVE_BYTES-registryKeeper.closedSidecarDebitBytes(),
        streamBytes:retainedStreamBytes,guardBytes:Buffer.byteLength(guardBytes),linkReserveBytes:CPU_LINK_RESERVE_BYTES}),
      ceased:()=>keeperCanClose,monitorEnded:()=>keeperMonitoringEnded})
    cpuInputs.registryKeeper=registryKeeper
  }
  let command
  try{
    command=createNativeOwnerCommand(executable,args,root,Math.min(deadline,started+budget.timeoutMs-1000),1000,record,guardBytes)
    // Reserve worst-case serialized live receipts, native observation, and
    // bounded outer terminal records. This partitions, never enlarges, the
    // existing hard ceiling. JSON string escaping needs at most six bytes per
    // retained UTF-16 code unit. Native proof frames are independently bounded.
    const template={schema:"detail-weight-live-native-owner-receipt-v1",phase,budget,ownerIdentity:{pid:4294967295,identitySource:"retained_child_handle"},ownerClosed:false,proof:null,protocolError:null,ownerError:"",workerStderrTail:"",stopReason:null,streamBytes:{stdout:STREAM,stderr:STREAM},nativeBuild:command.nativeBuild,outputAccountingRoots:accountingRoots,guard:{path:guardPath,identity:id,state:"released_after_live_empty_job",nativeEvidenceRoot},cleanupConfirmed:false,elapsedMs:budget.timeoutMs}
    const maximumReceiptBytes=Buffer.byteLength(JSON.stringify(template)+"\n")+2*PROOF_BYTES+6*(8192+8192+2048+2048)+2048+(cpuInputs?PROOF_BYTES:0)
    const startedBytes=Buffer.byteLength(JSON.stringify({...record,ownerPid:4294967295,commandBinding:command.bindingBase64})+"\n")
    budget.maximumReceiptBytes=maximumReceiptBytes
    budget.terminalReserveBytes=Math.ceil((2*maximumReceiptBytes+PROOF_BYTES+OUTER_TERMINAL_BYTES+startedBytes)/65536)*65536
    budget.ordinaryOutputLimitBytes=budget.outputBytes-budget.terminalReserveBytes
    assert.ok(budget.ordinaryOutputLimitBytes>65536,"native terminal reservation exceeds phase ceiling")
    assert.ok(outputBytes()+startedBytes<=budget.ordinaryOutputLimitBytes,"native finalization capacity unavailable before guard")
  }
  catch(error){
    const compilerFailure=nativeBuildFailureObservation(error)
    const compilerExited=Boolean(command)||Boolean(compilerFailure&&compilerFailure.runnerPid===process.pid&&compilerFailure.guardIdentity===id&&compilerFailure.guardSha256===sha(guardBytes))
    error.ownedReceipt={schema:"detail-weight-pre-spawn-failure-v1",phase,budget,outputAccountingRoots:accountingRoots,cleanupConfirmed:false,guard:{path:guardPath,identity:id,state:"not_acquired"},nativeOwnerSpawnAttempted:false,workerStarted:false,compilerExited,compilerFailure,nativeBuild:command?.nativeBuild??null,error:String(error)}
    try{
      const finalReceipt={...error.ownedReceipt,cleanupConfirmed:true,cleanupBasis:"same_live_call_no_guard_or_native_owner_created"}
      const serialized=Buffer.byteLength(JSON.stringify(error.ownedReceipt)+"\n")+(compilerExited?Buffer.byteLength(JSON.stringify(finalReceipt)+"\n"):0)
      assert.ok(outputBytes()+serialized<=budget.outputBytes-OUTER_TERMINAL_BYTES,"pre-spawn final receipts must fit with reserve")
      const persistFailure=(logical,value)=>persist(logical,value,budget.outputBytes-OUTER_TERMINAL_BYTES)
      persistFailure(scope+"/original-receipt.json",error.ownedReceipt)
      if(compilerExited){
        error.receiptBinding=persistFailure(scope+"/release-receipt.json",finalReceipt);error.ownedReceipt=finalReceipt;liveReceipts.add(finalReceipt)
      }
    }catch(secondary){error.secondaryEvidenceError=String(secondary);error.ownedReceipt.cleanupConfirmed=false}
    throw error
  }
  // Compilation consumes only CPU and private UUID evidence. The GPU/worker
  // lease is acquired afterwards, atomically, and always before owner spawn.
  try{fs.writeFileSync(guardPath,guardBytes,{flag:"wx"})}
  catch(error){error.code="OWNED_GUARD_BUSY";error.ownedReceipt={phase,cleanupConfirmed:false,guard:{path:guardPath,state:"existing_guard_refused"},nativeOwnerSpawnAttempted:false};throw error}
  const workerEnvironment={...process.env,DETAIL_WEIGHT_OUTPUT_ROOTS:JSON.stringify(accountingRoots),DETAIL_WEIGHT_BUDGET_PROJECT_ROOT:root,DETAIL_WEIGHT_OUTPUT_MAX:String(budget.ordinaryOutputLimitBytes-(cpuInputs?CPU_LINK_RESERVE_BYTES:0)),OMP_NUM_THREADS:"2",MKL_NUM_THREADS:"2",OPENBLAS_NUM_THREADS:"2",PYTHONDONTWRITEBYTECODE:"1"}
  if(cpuInputs)for(const key of ["T_Q4_112_COMPONENT_ROOT","T_Q4_112_COMPONENT_CALL","T_Q4_112_COMPONENT_REQUEST","T_Q4_88_REGISTRY_FIXTURE_ROOT"])delete workerEnvironment[key]
  return new Promise((resolve,reject)=>{
    let child;try{child=spawn(command.executable,command.args,{cwd:root,env:workerEnvironment,windowsHide:true,shell:false,stdio:["pipe","pipe","pipe"]})}catch(error){error.ownedReceipt={phase,budget,outputAccountingRoots:accountingRoots,streamBytes:{stdout:0,stderr:0},cleanupConfirmed:false,error:String(error),guard:{path:guardPath,state:"retained"}};try{error.receiptBinding=persist(scope+"/original-receipt.json",error.ownedReceipt,budget.outputBytes-OUTER_TERMINAL_BYTES)}catch(secondary){error.secondaryEvidenceError=String(secondary)}reject(error);return}
    let timer,force,final,stopFastTimer,stopSlowTimer,stopPrepareDeadline;let pending="",proof=null,protocolError=null,ownerError="",closed=false,stopReason=null,settled=false,primaryError=null,failedCpuReceipt=null,retainedGuardReleased=false
    let stopControl=null,stopPreparing=false,operatorStopControl=operatorStopControlAvailability()
    if(operatorStopControl.available&&executionPlan&&["qualification","training"].includes(phase)) {
      try {
        const packagePath=".runtime/ai-painter/autonomous-closed-loop-packages/"+executionPlan.packageId+"/package.json"
        const packageBinding=bind(root,packagePath),registered=json(root,bind(root,".runtime/ai-painter/current-execution-registry/current.json")).activeExecution
        assert.equal(registered?.processId,process.pid,"stop supervisor differs from current process")
        const creation=processIdentity(process.pid)
        assert.equal(registered.processStartIdentity,creation,"stop supervisor creation differs")
        assert.equal(registered.runId,executionPlan.runId);assert.equal(registered.packageId,executionPlan.packageId)
        const descriptor=Object.freeze({callId:id,runId:executionPlan.runId,packageId:executionPlan.packageId,
          executionPackageSha256:packageBinding.sha256,supervisorProcessId:process.pid,
          supervisorProcessStartIdentity:creation,phase})
        const {callId,...callContext}=descriptor
        const readRetainedNativeCall=()=>child&&!closed&&!settled?descriptor:null
        const evidenceRoot=stopEvidenceRoot(root,executionPlan,packageBinding)
        stopControl=createOwnedStopNativeControl({projectRoot:root,evidenceRoot,
          expectedContext:Object.freeze({...callContext,executionPackagePath:packagePath}),readRetainedNativeCall})
        operatorStopControl={available:true,status:"same_retained_call_control_active",callId:id}
      } catch(error) {operatorStopControl={available:false,status:"unavailable_control_initialization_refused",error:String(error.message??error).slice(0,256)}}
    } else if(operatorStopControl.available) operatorStopControl={available:false,status:"unavailable_no_active_training_call"}
    keeperMonitoringEnded=false
    const buffers={stdout:[],stderr:[]},counts={stdout:0,stderr:0}
    const cpuEvidenceMaximum=()=>{
      assert.ok(cpuInputs,"CPU-only retained-call evidence accounting")
      let guardCharge=0
      if(!retainedGuardReleased){const stat=fs.lstatSync(guardPath)
        assert.ok(stat.isFile()&&!stat.isSymbolicLink(),"retained CPU guard must remain ordinary")
        assert.equal(fs.readFileSync(guardPath,"utf8"),guardBytes,"current CPU guard bytes changed")
        guardCharge=stat.size
      }
      const maximum=budget.outputBytes-counts.stdout-counts.stderr-guardCharge-OUTER_TERMINAL_BYTES
      assert.ok(Number.isSafeInteger(maximum)&&maximum>=0,"retained CPU streams/guard exhausted evidence budget")
      return maximum // cpuPersist additionally charges links and exact closed sidecars.
    }
    const stop=reason=>{if(reason instanceof Error)primaryError??=reason;if(!stopReason){stopReason=String(reason).slice(0,2048);if(!child.stdin.destroyed){try{child.stdin.write(Buffer.from(stopReason).toString("base64")+"\n")}catch(error){protocolError??=String(error)}}}}
    const finish=()=>{
      if(settled)return;settled=true;
      // A closed retained owner cannot consume any newly activated fixture.
      if(cpuInputs&&closed)keeperActive=false
      const confirmed=validateNativeReceipt({proof,ownerPid:child.pid,bindingBase64:command.bindingBase64,ownerClosed:closed,protocolError,stdoutBytes:counts.stdout,stderrBytes:counts.stderr})
      // An unknown CPU child retains its existing monitor and keeper. Deadline
      // failure must not turn into an unproved connection close while alive.
      if(!cpuInputs||confirmed||closed){clearInterval(timer);keeperMonitoringEnded=true}
      clearTimeout(force);clearTimeout(final);clearInterval(stopFastTimer);clearInterval(stopSlowTimer);clearTimeout(stopPrepareDeadline);child.stdin.destroy();child.stdout.destroy();child.stderr.destroy()
      const receipt={schema:"detail-weight-live-native-owner-receipt-v1",phase,budget,processCleanupConfirmed:confirmed,ownerIdentity:{pid:child.pid,identitySource:"retained_child_handle"},ownerClosed:closed,
        proof,protocolError,ownerError,workerStderrTail:Buffer.concat(buffers.stderr).toString("utf8").slice(-8192),stopReason,streamBytes:counts,nativeBuild:command.nativeBuild,outputAccountingRoots:accountingRoots,guard:{path:guardPath,identity:id,state:"retained",nativeEvidenceRoot},cleanupConfirmed:false,elapsedMs:Date.now()-started,operatorStopControl}
      let fixtureCleanup=true
      if(cpuInputs){
        failedCpuReceipt=receipt
        keeperCanClose=confirmed&&closed
        try{
          if(keeperCanClose&&keeperMonitoringEnded){keeperActive=false;receipt.cpuRegistryFixtures=registryKeeper.release()}
          else {receipt.cpuRegistryFixtures=registryKeeper.receipt();throw new Error("CPU registry keeper child cleanup unknown; connections retained")}
          assert.equal(receipt.cpuRegistryFixtures.opened.length,3,"all three current SQLite fixture keepers required")
          assert.equal(receipt.cpuRegistryFixtures.childConsumptions.length,3,"all three current child keeper consumptions required")
          assert.deepEqual(receipt.cpuRegistryFixtures.consumptionErrors,[],"CPU registry keeper consumption invalid")
        }catch(error){fixtureCleanup=false;receipt.cpuRegistryFixtures=registryKeeper.receipt();receipt.cpuRegistryKeeperError=String(error);stopReason??=String(error)}
        try{assert.deepEqual(cpuInputs.programBindings,finalProgramBindings(root),"CPU source closure changed in current call");read(root,cpuInputs.requestBinding);read(root,cpuInputs.declarationBinding);
          receipt.cpuNegativeInputs={...cpuInputs.inspector.scan({requireRemoved:true,requireObserved:true}),declaration:cpuInputs.declarationBinding};cpuInputs.closed=true}
        catch(error){fixtureCleanup=false;receipt.cpuNegativeInputs={root:cpuInputs.layout.root,fixtureLinksRemoved:false,linkMetadataReserveBytes:CPU_LINK_RESERVE_BYTES,reserveIsMeasurement:false,error:String(error),logicalPath:error.logicalPath??cpuInputs.layout.root};stopReason??=String(error)}
        receipt.stopReason=stopReason;cpuScopes.set(receipt,cpuInputs)
      }
      try{
        // Original compact live receipt is persisted before optional audits.
        const finalShape={...receipt,cleanupConfirmed:confirmed,guard:{...receipt.guard,state:confirmed?"released_after_live_empty_job":"retained"}}
        const originalBytes=Buffer.byteLength(JSON.stringify(receipt)+"\n"),finalBytes=Buffer.byteLength(JSON.stringify(finalShape)+"\n")
        assert.ok(originalBytes<=budget.maximumReceiptBytes&&finalBytes<=budget.maximumReceiptBytes,"live receipt envelope exceeded")
        assert.ok(outputBytes()+counts.stdout+counts.stderr+originalBytes+finalBytes<=budget.outputBytes-OUTER_TERMINAL_BYTES,"final live receipts must fit reserved capacity")
        const persistReceipt=(logical,value)=>persist(logical,value,cpuInputs?cpuEvidenceMaximum():budget.outputBytes-counts.stdout-counts.stderr-OUTER_TERMINAL_BYTES)
        persistReceipt(scope+"/original-receipt.json",receipt)
        if(confirmed){assert.equal(fs.readFileSync(guardPath,"utf8"),guardBytes);fs.unlinkSync(guardPath);retainedGuardReleased=true;receipt.cleanupConfirmed=true;receipt.guard.state="released_after_live_empty_job"}
        persistReceipt(scope+"/release-receipt.json",receipt)
        assert.ok(outputBytes()+counts.stdout+counts.stderr<=budget.outputBytes,"owned phase total output budget")
      }catch(error){receipt.cleanupConfirmed=false;receipt.persistenceError=String(error);receipt.secondaryEvidenceError=String(error)}
      let receiptBinding=null
      try{receiptBinding=bind(root,scope+"/release-receipt.json")}catch(error){receipt.persistenceError??=String(error);receipt.secondaryBindingError=String(error)}
      if(confirmed && receipt.cleanupConfirmed && !receipt.persistenceError && receiptBinding)liveReceipts.add(receipt);
      const value={stdout:Buffer.concat(buffers.stdout).toString("utf8"),stderr:Buffer.concat(buffers.stderr).toString("utf8"),ownedReceipt:receipt,receiptBinding}
      if(receipt.persistenceError || !receiptBinding || !receipt.cleanupConfirmed || !fixtureCleanup || protocolError || stopReason || proof?.exitCode!==0 || counts.stdout>STREAM || counts.stderr>STREAM){const error=primaryError??new Error(stopReason??protocolError??(proof?.exitCode ? `worker_exit_${proof.exitCode}` : receipt.persistenceError)??"native worker failed or cleanup unknown");Object.assign(error,value);if(receipt.persistenceError)error.secondaryEvidenceError=receipt.persistenceError;if(receipt.secondaryBindingError)error.secondaryBindingError=receipt.secondaryBindingError;reject(error)}else resolve(value)
    }
    child.stdout.on("data",chunk=>{
      pending+=chunk.toString("ascii");let index
      while((index=pending.indexOf("\n"))>=0){const line=pending.slice(0,index).trimEnd();pending=pending.slice(index+1)
        try{if(line.startsWith("O:")||line.startsWith("E:")){const name=line[0]==="O"?"stdout":"stderr",raw=Buffer.from(line.slice(2),"base64");assert.equal(raw.toString("base64"),line.slice(2));counts[name]+=raw.length;retainedStreamBytes=counts.stdout+counts.stderr;if(counts.stdout+counts.stderr>STREAM)stop("stream_limit");else{buffers[name].push(raw);if(outputBytes()+counts.stdout+counts.stderr>budget.ordinaryOutputLimitBytes)stop("output_budget")}}
          else if(line.startsWith("R:")){assert.equal(proof,null);const raw=Buffer.from(line.slice(2),"base64");assert.equal(raw.toString("base64"),line.slice(2));assert.ok(raw.length<=PROOF_BYTES,"native proof envelope exceeded");proof=JSON.parse(raw.toString("utf8"))}else throw new Error("unknown native frame")
        }catch(error){primaryError??=error;protocolError=String(error).slice(0,2048);stop("native_protocol_error")}}
      if(pending.length>65536){protocolError="native_frame_overflow";pending="";stop(protocolError)}
    })
    child.stderr.on("data",raw=>{ownerError=(ownerError+raw.toString()).slice(0,8192)})
    child.stdin.on("error",error=>{primaryError??=error;protocolError??=String(error).slice(0,2048)})
    child.on("error",error=>{primaryError??=error;protocolError=String(error).slice(0,2048);stop(error)})
    child.once("close",()=>{closed=true;clearInterval(stopFastTimer);clearInterval(stopSlowTimer);clearTimeout(stopPrepareDeadline);
      try{stopControl?.dispose()}catch(error){operatorStopControl={...operatorStopControl,disposeError:String(error.message??error).slice(0,256)}}
      if(pending.trim())protocolError??="incomplete_frame";
      if(settled&&cpuInputs){
        keeperCanClose=validateNativeReceipt({proof,ownerPid:child.pid,bindingBase64:command.bindingBase64,ownerClosed:closed,protocolError,stdoutBytes:counts.stdout,stderrBytes:counts.stderr})
        if(!keeperCanClose){
          // A closed owner can no longer deliver a proof. End this observer,
          // retain unknown cleanup/guard/handles, and never turn it into a daemon.
          clearInterval(timer);keeperMonitoringEnded=true;keeperActive=false
          registryKeeper.recordEvidenceError("closed_owner_terminal_unknown_cleanup","owner closed without a usable current empty-Job proof; handles and guard retained")
          try{persist(scope+"/cpu-registry-terminal-unknown.json",{ownerClosed:true,processTreeCleanupConfirmed:false,
            observerEnded:true,handlesRetained:true,qualificationGranted:false,lifecycle:registryKeeper.receipt()},cpuEvidenceMaximum())}
          catch(error){registryKeeper.recordEvidenceError("terminal_unknown_evidence",error)}
          if(failedCpuReceipt)failedCpuReceipt.cpuRegistryFixtures=registryKeeper.receipt()
          return
        }
        clearInterval(timer);keeperMonitoringEnded=true;keeperActive=false
        // The earlier deadline path never attempted release. Complete only
        // that pending cleanup, once, with this call's real empty-Job proof.
        try{const cleanup=registryKeeper.release();persist(scope+"/late-cpu-registry-cleanup.json",cleanup,cpuEvidenceMaximum())}
        catch(error){registryKeeper.recordEvidenceError("late_cleanup",error)
          try{persist(scope+"/late-cpu-registry-cleanup-error.json",{error:String(error).slice(0,2048),lifecycle:registryKeeper.receipt()},cpuEvidenceMaximum())}
          catch(secondary){registryKeeper.recordEvidenceError("late_cleanup_error_persistence",secondary)}}
        if(failedCpuReceipt)failedCpuReceipt.cpuRegistryFixtures=registryKeeper.receipt()
        return
      }
      finish()})
    if(stopControl){
      stopFastTimer=setInterval(()=>{try{const reason=stopControl.abortReason();if(reason)stop(reason)}catch(error){stop(error)}},100)
      stopSlowTimer=setInterval(()=>{
        if(stopPreparing||closed||settled)return
        stopPreparing=true
        stopPrepareDeadline=setTimeout(()=>{
          try{stopControl.dispose()}catch{}
          operatorStopControl={...operatorStopControl,available:false,status:"unavailable_prepare_deadline"}
          clearInterval(stopFastTimer);clearInterval(stopSlowTimer)
        },2000)
        Promise.resolve().then(()=>stopControl.preparePending()).catch(error=>{
          operatorStopControl={...operatorStopControl,lastPrepareError:String(error.message??error).slice(0,256)}
        }).finally(()=>{clearTimeout(stopPrepareDeadline);stopPreparing=false})
      },500)
    }
    timer=setInterval(()=>{try{onHeartbeat();const reason=abortReason();if(reason)stop(reason);if(Date.now()>=deadline)stop("wall_timeout");if(outputBytes()+counts.stdout+counts.stderr>budget.ordinaryOutputLimitBytes)stop("output_budget")}catch(error){stop(error)}},1000)
    force=setTimeout(()=>{stop("wall_timeout");try{child.kill("SIGKILL")}catch{}},Math.max(1,started+budget.timeoutMs-Date.now()-250))
    final=setTimeout(()=>{stop("cleanup_deadline");finish()},Math.max(1,started+budget.timeoutMs-Date.now()))
    try{persist(nativeEvidenceRoot+`/${id}-started.json`,{...record,ownerPid:child.pid,commandBinding:command.bindingBase64},budget.ordinaryOutputLimitBytes-Buffer.byteLength(guardBytes)-retainedStreamBytes)}catch(error){primaryError??=error;protocolError=String(error).slice(0,2048);stop(error)}
  })
}
