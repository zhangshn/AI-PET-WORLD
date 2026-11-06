import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {randomUUID} from "node:crypto";
import {isDeepStrictEqual} from "node:util";
import sharp from "sharp";
import {BASELINE_IDENTITY as id,baselineSha256 as sha,baselineDigest} from "./natural-world-baseline-proof.mjs";
import {currentSpatialChannels} from "./natural-world-current-model-input.mjs";
import {createEvolutionInputReader} from "./natural-world-evolution-input.mjs";
import {runtime} from "./world-initialized-evolution.mjs";
import {loadAndValidateReleasedCapabilityBinding,TRUSTED_RELEASE_REGISTRY_PATH,weatherReleaseProfile} from "./ai-painter-autonomous-package-decision-core-v3.mjs";

const STORE="data/world-runtime/"+id.ownerId+"/"+id.worldId+".json";
const ARCHIVE=".runtime/ai-painter/natural-world-live-map-inputs/"+id.worldId;
const CONTRACT="data/ai-painter/system-governance/ai-painter-complete-map-condition-contract-v1.json";
const HASH=/^[a-f0-9]{64}$/;
const width=1024,height=768;
const same=(a,b,reason)=>assert.deepEqual(a,b,reason);
const encode=x=>Buffer.from(JSON.stringify(x,null,2)+"\n");
const ref=(p,bytes)=>({path:p,sha256:sha(bytes)});

function plainRuntimeDirectory(){
  const mount=fs.realpathSync.native(".runtime");
  let current=mount;
  for(const segment of ARCHIVE.slice(".runtime/".length).split("/")){
    current=path.join(current,segment);
    try{fs.mkdirSync(current);}catch(e){if(e.code!=="EEXIST")throw e;}
    assert(fs.lstatSync(current).isDirectory()&&fs.realpathSync.native(current)===current,"live input archive directory redirected");
  }
  return current;
}

// The only mutable path is an unadvertised unique staging directory. Identical concurrent
// publishers compare the winner's bytes. A corrupt/mismatched old archive is never replaced.
export function publishImmutableMapInputs(parent,hash,entries,confirmHead){
  assert(HASH.test(hash),"invalid snapshot hash");
  const parentReal=fs.realpathSync.native(parent),target=path.join(parentReal,hash);
  const validate=()=>{
    assert(fs.lstatSync(target).isDirectory()&&fs.realpathSync.native(target)===target,"snapshot directory redirected");
    const sub=path.join(target,"channels");
    assert(fs.lstatSync(sub).isDirectory()&&fs.realpathSync.native(sub)===sub,"snapshot channel directory redirected");
    same(fs.readdirSync(target).sort(),["channels","input.json"]);
    same(fs.readdirSync(sub).sort(),[...entries.keys()].filter(p=>p.startsWith("channels/")).map(p=>p.slice(9)).sort());
    for(const [name,b] of entries){
      const p=path.join(target,name),st=fs.lstatSync(p);
      assert(st.isFile()&&st.nlink===1&&st.size===b.length&&fs.realpathSync.native(p)===p&&fs.readFileSync(p).equals(b),
        "immutable live input differs: "+name);
    }
  };
  for(const name of entries.keys())assert(name==="input.json"||/^channels\/[a-z][a-z0-9_]+\.png$/.test(name),"invalid archive entry");
  confirmHead();
  if(fs.existsSync(target)){validate();confirmHead();return;}
  const stage=path.join(parentReal,".staging-"+randomUUID());
  fs.mkdirSync(stage);let promoted=false;
  try{
    fs.mkdirSync(path.join(stage,"channels"));
    for(const [name,b] of entries)fs.writeFileSync(path.join(stage,name),b,{flag:"wx"});
    confirmHead();
    try{fs.renameSync(stage,target);promoted=true;}
    catch(e){if(!fs.existsSync(target)||!["EEXIST","ENOTEMPTY","EPERM","EACCES"].includes(e.code))throw e;}
    validate();confirmHead();
  }finally{
    if(!promoted && fs.existsSync(stage)){
      assert(path.dirname(stage)===parentReal && fs.realpathSync.native(stage)===stage && path.basename(stage).startsWith(".staging-"));
      fs.rmSync(stage,{recursive:true});
    }
  }
}

export function validateWeatherVisualState(current,before,event){
  same(Object.fromEntries(Object.keys(id).map(k=>[k,current[k]])),id,"foreign live world");
  same(Object.fromEntries(Object.keys(id).map(k=>[k,before[k]])),id,"foreign prior world");
  same(event.identity,id);
  assert(event.eventKind==="evolution" && event.evidence?.kind==="evolution","unsupported visual event: "+event.eventKind);
  assert(weatherReleaseProfile(event.evidence.capabilityRef?.version),"unsupported visual event capability");
  same([event.fromTick,event.fromStateVersion,event.toTick,event.toStateVersion,event.cursor],
    [before.tick,before.stateVersion,current.tick,current.stateVersion,current.eventCursor],"event clock differs");
  same([current.tick,current.stateVersion,current.eventCursor],[before.tick+1,before.stateVersion+1,before.eventCursor+1],"weather transition is not one committed step");
  same([current.worldFacts.tick,current.worldState.tick],[current.tick,current.tick],"snapshot tick differs");
  const facts=current.worldFacts.payload;
  same(Object.keys(facts).sort(),["collisionRegions","objectFootprints","terrainRegions","walkableRegions"],"unsupported named geometry");
  for(const o of facts.objectFootprints)assert(["tree","rock","shrub","grass_detail"].includes(o.kind),"unsupported object kind: "+o.kind);
  for(const region of facts.terrainRegions)assert(["grass","water","path_ground","shoreline","natural_boundary","mud_patch","tall_grass"].includes(region.kind),
    "unsupported terrain kind: "+region.kind);
  for(const key of Object.keys(facts)){
    const old=before.worldFacts.payload[key];
    if(!Array.isArray(old)||facts[key].length!==old.length)throw Error("weather event changed spatial collection size: "+key);
    const i=facts[key].findIndex((v,index)=>!isDeepStrictEqual(v,old[index]));
    if(i!==-1)throw Error("weather event modified "+key+": "+(facts[key][i].objectId??facts[key][i].sourceId??i));
  }
  const state=current.worldState.payload,prior=before.worldState.payload;
  for(const k of ["objects","resources"])same(state[k],prior[k],"weather event modified "+k);
  same(state.objects,current.worldFacts.payload.objectFootprints,"object state diverges from facts");
  assert(Array.isArray(state.resources)&&state.resources.length===0,"unsupported visual state: resource instances");
  same(Object.keys(state).sort(),["environment","objects","resources"],"unsupported visual world-state field");
  const {evolution,...env}=state.environment,{evolution:previous,...oldEnv}=prior.environment;
  same(env,oldEnv,"weather event modified visual environment outside weather");
  const {commit,logicalEndUtc,weather,...rest}=evolution;
  const {commit:priorCommit,logicalEndUtc:priorEnd,weather:priorWeather,...oldRest}=previous;
  same(rest,oldRest,"weather event changed unsupported evolution state");
  assert(priorWeather && event.previousEventSha256===priorCommit.eventSha256 && event.businessKey===commit.businessKey
    && event.eventSha256===commit.eventSha256 && commit.historyHead.cursor===current.eventCursor
    && commit.historyHead.eventSha256===event.eventSha256,"weather history chain differs");
  same(weather.period,event.interval,"weather interval differs");assert.equal(priorEnd,weather.period.logicalStartUtc);
  assert.equal(logicalEndUtc,weather.period.logicalEndUtc);
  same(weather.fieldOrder,["PRECTOTCORR","RH2M","T2M","WS2M"]);same(weather.units,["mm/day","%","C","m/s"]);
  assert(weather.origin==="model_predicted" && weather.values.length===4 && weather.values.every(Number.isFinite),"uncommitted weather values");
  same(current.sourceBindings,before.sourceBindings,"weather event modified source lineage");
  return {facts,weather,env,logicalEndUtc};
}

export async function prepareNaturalWorldLiveMapInput(...args){
  assert(args.length===0,"fixed authoritative local world; no caller-supplied state or output path");
  const {read}=createEvolutionInputReader(process.cwd());
  const jsonBound=(binding,limit=4*1024*1024)=>{
    const bytes=read(binding.path,limit);assert.equal(sha(bytes),binding.sha256,binding.path);return JSON.parse(bytes);
  };
  const api=await runtime(),store=api.store.createProductionWorldRuntimeStore(path.resolve("data/world-runtime"));
  const head=await store.readNatural({ownerId:id.ownerId,worldId:id.worldId,expectedPlayerId:id.playerId});
  assert.equal(head.status,"found","current authoritative Store unavailable");
  const saved=head.record,key=saved.worldState.payload.environment.evolution?.commit?.businessKey;
  assert(HASH.test(key),"no committed visual event");
  const current=await store.readNaturalTransition({identity:id,businessKey:key});assert.equal(current.status,"found","current Store receipt unavailable");
  const {event,receipt}=current;
  assert.equal(receipt.fileSha256,head.fileSha256);assert.equal(receipt.eventSha256,event.eventSha256);
  assert.equal(event.domainAfterSha256,api.transaction.computeWorldEvolutionDomainSha(saved),"current event domain differs");
  const area=STORE+".evolution/";
  const currentSnapshot={path:area+key+"."+head.fileSha256+".record.json",sha256:head.fileSha256};
  same(jsonBound(currentSnapshot),saved,"immutable current snapshot differs from head");
  const previousSnapshot={path:area+key+"."+event.before.expectedFileSha256+".before.json",sha256:event.before.expectedFileSha256};
  const before=jsonBound(previousSnapshot);
  const {facts,weather,env,logicalEndUtc}=validateWeatherVisualState(saved,before,event);
  const priorKey=before.worldState.payload.environment.evolution.commit.businessKey;
  assert(HASH.test(priorKey));
  const prior=await store.readNaturalTransition({identity:id,businessKey:priorKey});assert.equal(prior.status,"found","prior native receipt unavailable");
  same([prior.receipt.fileSha256,prior.event.eventSha256],[previousSnapshot.sha256,event.previousEventSha256],"prior head lineage differs");
  const nativeFile=(relative,value)=>{
    const b=read(relative,2**21);same(JSON.parse(b),value,relative);return ref(relative,b);
  };
  const asRef=v=>({path:v.id,sha256:v.sha256});
  const profile=weatherReleaseProfile(event.evidence.capabilityRef.version);
  const releaseRef=asRef(event.evidence.capabilityRef);
  assert.equal(releaseRef.path,profile.releasePath);
  const release=loadAndValidateReleasedCapabilityBinding({projectRoot:process.cwd(),capabilityReleasePath:releaseRef.path,
    requiredCapabilityScope:"world_evolution",trustedReleaseRegistryPath:TRUSTED_RELEASE_REGISTRY_PATH});
  assert.equal(release.capabilityReleaseSha256,releaseRef.sha256);
  same(asRef(event.policyRef),{path:release.verifiedBindings.reviewContract.path,sha256:release.verifiedBindings.reviewContract.sha256},"event policy is not the released weather policy");
  same(asRef(event.evidence.modelRef),{path:release.verifiedBindings.modelArtifact.path,sha256:release.verifiedBindings.modelArtifact.sha256},"event model is not the released weather model");
  const inputRef=asRef(event.evidence.inputRef),outputRef=asRef(event.evidence.outputRef);
  const modelInput=jsonBound(inputRef),modelOutput=jsonBound(outputRef);
  same(modelInput.identity,id);same(modelInput.interval,event.interval,"weather worker interval differs");
  same([modelInput.before.tick,modelInput.before.stateVersion,modelInput.before.eventCursor,modelInput.before.fileSha256],
    [before.tick,before.stateVersion,before.eventCursor,previousSnapshot.sha256],"weather model used another before-image");
  same(modelOutput.values,weather.values);assert.equal(modelOutput.inputSha256,inputRef.sha256);
  assert.equal(modelOutput.checkpointSha256,event.evidence.modelRef.sha256);assert.equal(modelOutput.modelForwards,1);
  assert.equal(modelOutput.trainingUpdates,0);

  const source=role=>{
    const found=saved.sourceBindings.filter(r=>r.role===role);assert.equal(found.length,1,"world source role: "+role);
    return {path:found[0].uri,sha256:found[0].fileSha256};
  };
  const origins=Object.fromEntries(["natural_source_fact_release","natural_generated_facts","world_director","visual_generation_task","condition_package"]
    .map(k=>[k,source(k)]));
  const origin=jsonBound(origins.natural_source_fact_release),generated=jsonBound(origins.natural_generated_facts),
    director=jsonBound(origins.world_director),task=jsonBound(origins.visual_generation_task),initialPack=jsonBound(origins.condition_package);
  const {sourceFactReleaseIdentity,...originBody}=origin;
  assert.equal(sourceFactReleaseIdentity,"natural-source-facts-"+baselineDigest(originBody));
  assert.equal(origin.generatedFactsBinding.path,origins.natural_generated_facts.path);
  assert.equal(origin.generatedFactsBinding.sha256,origins.natural_generated_facts.sha256);
  same(generated.identity,id);same(task.directorPlan,director);same(task.spatialLayers,facts,"weather-only authority cannot introduce new world geometry");
  for(const k of Object.keys(facts))same(generated.geometry[k],facts[k],"original "+k+" differs from current weather-only geometry");
  same(env,{...generated.environment,resourceInitialization:"no_resource_instances_created",runtimeEvents:"none_created"},
    "unsupported new visual/environment regime outside registered creation and weather domains");
  for(const value of [task,director,initialPack]){
    assert(value.worldId===id.worldId && value.regionId===id.regionId && value.sourceFactReleaseIdentity===sourceFactReleaseIdentity,"foreign visual creation lineage");
  }
  const regimes={season:env.seasonScenario,regionalLandscapeType:director.singleMapEcologyPlan.regionalLandscapeType};
  same(regimes.season,generated.environment.seasonScenario);assert.equal(regimes.regionalLandscapeType,generated.regionalLandscapeType);
  const contract={path:CONTRACT,sha256:initialPack.identityBindings.conditionContractSha256};assert.equal(initialPack.identityBindings.conditionContractPath,CONTRACT);
  const order=jsonBound(contract).tensorContract.channelOrder,channels=currentSpatialChannels(facts);
  same([...channels.keys()],order);
  const instances=facts.objectFootprints.map(({objectId,kind,footprint,blocksMovement},i)=>({value:i+1,objectId,kind,footprint,blocksMovement}));
  same(instances,initialPack.objectInstanceTable);
  const files=new Map(),entries=[],archive=ARCHIVE+"/"+head.fileSha256;
  for(const name of order){
    const pixels=channels.get(name),initial=initialPack.channels.find(c=>c.id===name);assert(initial);
    const nativeSource=source("condition_channel_"+name);assert.equal(nativeSource.path,initial.path);
    const raw=read(nativeSource.path,2**21);assert.equal(sha(raw),nativeSource.sha256);
    const decoded=await sharp(raw).greyscale().raw().toBuffer({resolveWithObject:true});
    same([decoded.info.width,decoded.info.height,decoded.info.channels],[width,height,1]);assert(pixels.equals(decoded.data),"rendered spatial facts diverge from verified weather-invariant source: "+name);
    const png=await sharp(pixels,{raw:{width,height,channels:1}}).toColourspace("b-w").png().toBuffer();
    const filename="channels/"+name+".png";files.set(filename,png);
    entries.push({id:name,...ref(archive+"/"+filename,png),pixelSha256:sha(pixels),initialSpatialSource:nativeSource});
  }
  const desc={schemaVersion:"natural-world-live-map-input-v1",qualification:"current_conditions_only",identity:id,
    head:{path:STORE,sha256:head.fileSha256},currentSnapshot,previousSnapshot,tick:saved.tick,stateVersion:saved.stateVersion,eventCursor:saved.eventCursor,
    factHash:saved.worldFactsPayloadSha256,statePayloadSha256:saved.statePayloadSha256,recordContentSha256:saved.recordContentSha256,geometrySha256:baselineDigest(facts),
    event:nativeFile(area+key+"."+event.eventSha256+".event.json",event),receipt:nativeFile(area+key+".receipt.json",receipt),
    priorEvent:nativeFile(area+priorKey+"."+prior.event.eventSha256+".event.json",prior.event),priorReceipt:nativeFile(area+priorKey+".receipt.json",prior.receipt),
    capabilityRelease:releaseRef,weatherInput:inputRef,weatherOutput:outputRef,creation:origins,contract,weather,logicalEndUtc,renderInputs:regimes,
    nativeShape:[1,23,height,width],stage:2,channels:entries,objectInstanceTable:instances,encodedDailyWeatherFields:[],
    channelSemantics:"Immutable spatial facts and two registered visual regimes. Moisture comes from water geometry; day, precipitation, humidity, temperature and wind are not tensor channels."};
  const bytes=encode(desc);files.set("input.json",bytes);
  publishImmutableMapInputs(plainRuntimeDirectory(),head.fileSha256,files,()=>assert.equal(sha(fs.readFileSync(STORE)),head.fileSha256,"live head advanced during input projection"));
  return {identity:id,tick:saved.tick,stateVersion:saved.stateVersion,eventCursor:saved.eventCursor,head:desc.head,descriptor:ref(archive+"/input.json",bytes),
    channels:entries.length,instances:instances.length,release:releaseRef,executionQualificationGranted:false};
}
