import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import fs from "node:fs";
import {registerHooks} from "node:module";
import os from "node:os";
import path from "node:path";
import {fileURLToPath,pathToFileURL} from "node:url";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import {FIRST_WEATHER_SCOPED_PATH as releasePath, FIRST_WEATHER_SCOPED_VERSION as version,ROLLING_WEATHER_VERSION,
  FIRST_WEATHER_SCOPED_POLICY_PATH as policyPath, REQUIRED_BINDING_ROLES as roles,
  RUNTIME_AUTONOMY_POLICY_PATH, TRUSTED_RELEASE_REGISTRY_PATH as registryPath, sha256Of, deriveRuntimeCapabilityTicket,
  loadAndValidateReleasedCapabilityBinding as readRelease, verifyFirstWeatherReleaseForLifecycle,
  verifyScopedWeatherReleaseForLifecycle,verifyScopedWeatherReleaseLifecycle,weatherReleaseProfile} from "../lib/ai-painter-autonomous-package-decision-core-v3.mjs";
import {publishMachineAdjudicatedCapability as publish,reconcilePublishedFirstWeatherLifecycle as reconcileWeather,
  reconcilePublishedScopedWeatherLifecycle} from "../lib/ai-painter-machine-capability-release-orchestrator-v1.mjs";
import {CAPABILITY_LIFECYCLE_CONTRACT_PATH,createCapabilityCandidate,advanceCapabilityLifecycle} from "../lib/ai-painter-capability-lifecycle-v1.mjs";

const sourceRoot=path.resolve(import.meta.dirname,"../..");
const scoped={requiredCapabilityScope:"world_evolution"};
const fixed={capabilityReleaseIdentity:version};

function privateLifecycleReadFixture(t) {
  const root=fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(),"capability-lifecycle-read-")));
  t.after(()=>{
    assert.equal(path.dirname(root),fs.realpathSync.native(os.tmpdir()));
    assert(path.basename(root).startsWith("capability-lifecycle-read-"));
    fs.rmSync(root,{recursive:true,force:true});
  });
  const write=(relative,bytes)=>{
    const absolute=path.join(root,relative);fs.mkdirSync(path.dirname(absolute),{recursive:true});
    fs.writeFileSync(absolute,bytes,{flag:"wx"});return absolute;
  };
  const policy=fs.readFileSync(path.join(sourceRoot,policyPath));write(policyPath,policy);
  const lifecycle=`.runtime/ai-painter/capability-lifecycle/${version}`;
  const evidencePath="evidence/006-machine_release_adjudicated.json";
  const evidence=Buffer.from(JSON.stringify({capabilityVersion:version,targetState:"machine_release_adjudicated",status:"passed"}));
  const state={schemaVersion:"ai-painter-capability-lifecycle-state-v1",capabilityVersion:version,changeClass:"runtime_interface",
    state:"machine_release_adjudicated",sequence:6,latestEvidence:{path:evidencePath,sha256:sha256Of(evidence)}};
  write(`${lifecycle}/state.json`,JSON.stringify(state));
  write(`${lifecycle}/candidate.json`,JSON.stringify({capabilityVersion:version,changeClass:"runtime_interface",sourceEvidence:[{path:policyPath,sha256:sha256Of(policy)}]}));
  const evidenceFile=write(`${lifecycle}/${evidencePath}`,evidence),database=path.join(root,lifecycle,"lifecycle.sqlite");
  const db=new DatabaseSync(database);
  try {
    db.exec("CREATE TABLE capabilities(capability_version TEXT PRIMARY KEY,state TEXT,change_class TEXT); CREATE TABLE lifecycle_transitions(capability_version TEXT,sequence INTEGER,from_state TEXT,to_state TEXT,evidence_sha256 TEXT);");
    db.prepare("INSERT INTO capabilities VALUES(?,?,?)").run(version,state.state,state.changeClass);
    db.prepare("INSERT INTO lifecycle_transitions VALUES(?,?,?,?,?)").run(version,6,"independent_regression_completed",state.state,state.latestEvidence.sha256);
  } finally {db.close();}
  return {root,state,database,evidenceFile,read:()=>verifyScopedWeatherReleaseLifecycle(root,version,[state.state])};
}

for(const [label,primary,failQuery,failClose,badEvidence] of [
  ["normal",null,false,false,false],
  ["frozen query and close",Object.freeze(new Error("private lifecycle query")),true,true,false],
  ["undefined query and close",undefined,true,true,false],
  ["null query and close",null,true,true,false],
  ["false query and close",false,true,true,false],
  ["query alone",new Error("private lifecycle query alone"),true,false,false],
  ["close alone",null,false,true,false],
  ["invalid evidence and close",null,false,true,true],
  ["invalid evidence alone",null,false,false,true],
]) test(`scoped lifecycle private read retains ${label}`,t=>{
  const f=privateLifecycleReadFixture(t),prepare=DatabaseSync.prototype.prepare,close=DatabaseSync.prototype.close;
  const cleanup=new Error("private lifecycle close");
  if(badEvidence)fs.writeFileSync(f.evidenceFile,"changed evidence");
  const databaseBytes=fs.readFileSync(f.database),evidenceBytes=fs.readFileSync(f.evidenceFile);
  let closed=0,caught,threw=false,value;
  try {
    DatabaseSync.prototype.prepare=function(sql,...args){if(failQuery&&sql.startsWith("SELECT c.state,c.change_class"))throw primary;return prepare.call(this,sql,...args);};
    DatabaseSync.prototype.close=function(){close.call(this);closed++;if(failClose)throw cleanup;};
    try{value=f.read();}catch(error){caught=error;threw=true;}
  }finally{DatabaseSync.prototype.prepare=prepare;DatabaseSync.prototype.close=close;}
  assert.equal(closed,1);assert.equal(threw,failQuery||failClose||badEvidence);
  if((failQuery||badEvidence)&&failClose){
    assert.equal(caught.name,"AggregateError");assert.equal(caught.errors.length,2);assert.equal(caught.errors[1],cleanup);
    assert.equal(caught.cause,caught.errors[0]);if(failQuery)assert.equal(caught.cause,primary);else assert.match(caught.cause.message,/evidence bytes differ/);
  }else if(failQuery)assert.equal(caught,primary);
  else if(failClose)assert.equal(caught,cleanup);
  else if(badEvidence)assert.match(caught.message,/evidence bytes differ/);
  else assert.deepEqual(value,f.state);
  assert.deepEqual(fs.readFileSync(f.database),databaseBytes);assert.deepEqual(fs.readFileSync(f.evidenceFile),evidenceBytes);
  if(!badEvidence)assert.deepEqual(f.read(),f.state);
});

function isolatedTransportFixture(withRolling=false) {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),"weather-scoped-184-"));
  const dir=(rel)=>path.join(root,rel);
  const put=(rel,bytes)=>{
    fs.mkdirSync(path.dirname(dir(rel)),{recursive:true});
    fs.writeFileSync(dir(rel),bytes);
    return {path:rel,sha256:sha256Of(Buffer.from(bytes))};
  };
  try {
    for(const p of [RUNTIME_AUTONOMY_POLICY_PATH,CAPABILITY_LIFECYCLE_CONTRACT_PATH]) put(p,fs.readFileSync(path.join(sourceRoot,p)));
    const registry=JSON.parse(fs.readFileSync(path.join(sourceRoot,registryPath),"utf8"));
    put(registryPath,JSON.stringify({...registry,status:"active_no_capability_release",registryRevision:0,releaseRecords:[]}));
    const verifiers=new Map();
    function createFixtureDomain(id){
      const p=weatherReleaseProfile(id);
      const policy=put(p.policyPath,JSON.stringify({fixture:id}));
      const budget=put(`data/ai-painter/system-governance/${p.budget}.json`,JSON.stringify({fixtureBudget:id}));
      const bindings=Object.fromEntries(roles.map(role=>[role,{identity:`fixture-${role}`,...put(`data/fixture/${id}/${role}.json`,JSON.stringify({role,id}))}]));
      bindings.reviewContract={identity:id,...policy};
      bindings.runtimeInterfaceContract={identity:p.budget,...budget};
      const domain={bindings,releaseEvidence:[policy,budget],programLineage:{fixture:policy.sha256}};
      // The real policy and verifier are not replaced outside this disposable process.
      const verifier=dir(`fixture-${id}.mjs`);
      const domainFile=dir(`fixture-${id}.json`);
      fs.writeFileSync(domainFile,JSON.stringify(domain));
      fs.writeFileSync(verifier,`import fs from 'node:fs';export const ${p.policyExport}=${JSON.stringify(p.policyPath)};
export const ${p.rolesExport}=${JSON.stringify(roles)};
export function ${p.verify}(root){if(root!==${JSON.stringify(root)})throw Error("fixture root mismatch");return JSON.parse(fs.readFileSync(${JSON.stringify(domainFile)},'utf8'))}`);
      verifiers.set(p.module,pathToFileURL(verifier).href);
      return {policy,bindings,domain,domainFile};
    }
    const {policy,bindings}=createFixtureDomain(version);
    const hook=registerHooks({resolve(specifier,context,next){
      return verifiers.has(specifier) && context.parentURL?.endsWith("/ai-painter-autonomous-package-decision-core-v3.mjs")
        ? {url:verifiers.get(specifier),shortCircuit:true}:next(specifier,context);
    }});
    try {
      createCapabilityCandidate({schemaVersion:"ai-painter-capability-change-candidate-v1",capabilityVersion:version,
        changeClass:"runtime_interface",sourceEvidence:[policy],ownerAuthorizationRequired:false,ownerInLifecycle:false},{root});
      const advance=(targetState)=>advanceCapabilityLifecycle({root,capabilityVersion:version,targetState,evidence:{
        schemaVersion:"ai-painter-capability-stage-evidence-v1",capabilityVersion:version,targetState,status:"passed",bindings:[policy]}});
      const options={root,...scoped,expectedRegistryRevision:0};
      assert.throws(()=>publish(fixed,options),/weather lifecycle state rejected/);
      for(const stage of ["isolated_implementation","cpu_contract_verified","controlled_smoke_completed",
        "formal_stage_validation_completed","independent_regression_completed","machine_release_adjudicated"]) advance(stage);
      const stateFile=dir(`.runtime/ai-painter/capability-lifecycle/${version}/state.json`);
      const previousState=fs.readFileSync(stateFile);
      const published=publish(fixed,options);
      assert.equal(published.registryRevision,1);
      assert.equal(published.lifecycleState,"released");
      const readOptions={projectRoot:root,capabilityReleasePath:releasePath,trustedReleaseRegistryPath:registryPath};
      assert.throws(()=>readRelease(readOptions),/requires explicit/);
      const committedRegistry=fs.readFileSync(dir(registryPath));
      fs.writeFileSync(stateFile,previousState); // SQLite committed, state projection interrupted
      assert.throws(()=>readRelease({...readOptions,...scoped}),/weather lifecycle state rejected/);
      assert.equal(reconcileWeather(root).registryWrites,0);
      assert.deepEqual(fs.readFileSync(dir(registryPath)),committedRegistry);
      const verified=readRelease({...readOptions,...scoped});
      assert.deepEqual(verified.release.runtimeAutonomyPolicy.allowedInternalActions,[]);
      assert.equal(verified.ticketIssuer,null);
      assert.equal(verified.release.outputRoot,null);
      assert.equal(verified.release.modelCapabilityVersion,version);
      const modelFile=dir(bindings.modelArtifact.path);
      const modelBytes=fs.readFileSync(modelFile);
      fs.writeFileSync(modelFile,Buffer.from("changed fixture weights"));
      assert.throws(()=>readRelease({...readOptions,...scoped}),/SHA/);
      fs.writeFileSync(modelFile,modelBytes);
      assert.throws(()=>deriveRuntimeCapabilityTicket({...readOptions,...scoped,action:"runtime_frame.create"}),/requires explicit/);
      assert.deepEqual(Object.keys(verifyFirstWeatherReleaseForLifecycle(readOptions).release).sort(),["capabilityReleaseIdentity","modelCapabilityVersion"]);
      assert.throws(()=>publish(fixed,{...options,expectedRegistryRevision:1}));
      const ledger=dir(".runtime/ai-painter/capability-release-ledger.sqlite");
      fs.renameSync(ledger,`${ledger}.saved`);
      assert.throws(()=>readRelease({...readOptions,...scoped}));
      fs.renameSync(`${ledger}.saved`,ledger);
      const registryFile=dir(registryPath);
      const savedRegistry=fs.readFileSync(registryFile);
      const tampered=JSON.parse(savedRegistry);
      tampered.releaseRecords[0].ticketIssuerIdentity="injected-issuer";
      put(registryPath,JSON.stringify(tampered));
      assert.throws(()=>readRelease({...readOptions,...scoped}),/scoped weather registry/);
      put(registryPath,savedRegistry);
      if(withRolling){
        const rolling=weatherReleaseProfile(ROLLING_WEATHER_VERSION);
        const r= createFixtureDomain(rolling.version);
        const opts={projectRoot:root,capabilityReleasePath:rolling.releasePath,trustedReleaseRegistryPath:registryPath,...scoped};
        const step=(targetState)=>advanceCapabilityLifecycle({root,capabilityVersion:rolling.version,targetState,
          evidence:{schemaVersion:"ai-painter-capability-stage-evidence-v1",capabilityVersion:rolling.version,targetState,status:"passed",bindings:[r.policy]}});
        createCapabilityCandidate({schemaVersion:"ai-painter-capability-change-candidate-v1",capabilityVersion:rolling.version,
          changeClass:"runtime_interface",sourceEvidence:[r.policy],ownerAuthorizationRequired:false,ownerInLifecycle:false},{root});
        for(const target of ["isolated_implementation","cpu_contract_verified","controlled_smoke_completed","formal_stage_validation_completed",
          "independent_regression_completed","machine_release_adjudicated"])step(target);
        const rollingState=dir(`.runtime/ai-painter/capability-lifecycle/${rolling.version}/state.json`);
        const precommit=fs.readFileSync(rollingState);
        assert.throws(()=>readRelease(opts),/exactly one trusted registry record/);
        assert.throws(()=>verifyScopedWeatherReleaseForLifecycle(rolling.version,readOptions),/fixed weather lifecycle release path required/);
        for(const role of ["reviewContract","runtimeInterfaceContract"]){
          const swapped=structuredClone(r.domain);
          swapped.bindings[role]=bindings[role];
          fs.writeFileSync(r.domainFile,JSON.stringify(swapped));
          assert.throws(()=>publish({capabilityReleaseIdentity:rolling.version},{...options,expectedRegistryRevision:1}),/belongs to another version/);
          assert.deepEqual(fs.readFileSync(dir(registryPath)),savedRegistry);
        }
        fs.writeFileSync(r.domainFile,JSON.stringify(r.domain));
        const next=publish({capabilityReleaseIdentity:rolling.version},{...options,expectedRegistryRevision:1});
        assert.equal(next.registryRevision,2);
        assert.equal(readRelease({...readOptions,...scoped}).capabilityReleaseSha256,published.releaseSha256);
        // An older release must be able to recover its original receipt even when
        // the live registry now contains another release and has different bytes.
        const bothRegistered=fs.readFileSync(dir(registryPath));
        fs.writeFileSync(stateFile,previousState);
        assert.throws(()=>readRelease({...readOptions,...scoped}),/weather lifecycle state rejected/);
        assert.equal(reconcileWeather(root).registryWrites,0);
        assert.deepEqual(fs.readFileSync(dir(registryPath)),bothRegistered);
        fs.writeFileSync(rollingState,precommit);
        assert.throws(()=>readRelease(opts),/weather lifecycle state rejected/);
        assert.equal(reconcilePublishedScopedWeatherLifecycle(root,rolling.version).registryWrites,0);
        const current=readRelease(opts);
        assert.equal(current.verifiedBindings.reviewContract.path,rolling.policyPath);
        assert.equal(current.ticketIssuer,null);
        assert.throws(()=>verifyFirstWeatherReleaseForLifecycle(opts),/fixed weather lifecycle/);
        assert.throws(()=>deriveRuntimeCapabilityTicket({...opts,action:"runtime_frame.create"}),/requires explicit/);
        step("rolled_back");
        assert.throws(()=>readRelease(opts),/weather lifecycle state rejected/);
        assert.equal(readRelease({...readOptions,...scoped}).capabilityReleaseSha256,published.releaseSha256);
      }
      advance("rolled_back");
      assert.throws(()=>readRelease({...readOptions,...scoped}),/weather lifecycle state rejected/);
      assert.throws(()=>reconcileWeather(root),/weather lifecycle state rejected/);
    } finally {hook.deregister();}
  } finally {
    assert.ok(root.startsWith(path.join(os.tmpdir(),"weather-scoped-184-")));
    fs.rmSync(root,{recursive:true,force:true});
  }
}

if(["--isolated-transport","--isolated-dual-weather"].includes(process.argv[2])) {
  isolatedTransportFixture(process.argv[2]==="--isolated-dual-weather");
} else {
  test("weather accepts only the exact identity and scope, before any domain I/O",()=>{
    for(const requiredCapabilityScope of [undefined,"visual_world_generation","",null]) {
      assert.throws(()=>publish(fixed,{root:"nonexistent",requiredCapabilityScope}),/requires explicit/);
    }
    for(const additions of [{bindings:{}},{productionAdmitted:true},{ticketIssuer:{}},{modelCapabilityVersion:version},{[Symbol("claim")]:true}]) {
      assert.throws(()=>publish({...fixed,...additions},{root:"nonexistent",...scoped}),/caller evidence rejected/);
    }
    assert.throws(()=>publish({capabilityReleaseIdentity:"sakaerat-weather-153-runtime-v4"},{root:"nonexistent"}),/reserved weather identity/);
    assert.throws(()=>publish({capabilityReleaseIdentity:"generic-painter",bindings:{reviewContract:{path:policyPath}}},{root:"nonexistent"}),/fixed weather evidence/);
    assert.throws(()=>readRelease({capabilityReleasePath:releasePath}),/requires explicit/);
    assert.throws(()=>readRelease({capabilityReleasePath:"data/other/release.json",...scoped}),/unsupported_scope/);
  });

  test("missing fixed domain evidence stops before registry or lifecycle writes",()=>{
    const root=fs.mkdtempSync(path.join(os.tmpdir(),"weather-missing-184-"));
    try {
      assert.throws(()=>publish(fixed,{root,expectedRegistryRevision:0,...scoped}),/fixed weather policy is missing/);
      assert.deepEqual(fs.readdirSync(root),[]);
    } finally {fs.rmdirSync(root);}
  });

  test("disposable registry/SQLite transport only admits its scoped release and rejects rollback and tickets",()=>{
    const child=spawnSync(process.execPath,[fileURLToPath(import.meta.url),"--isolated-transport"],{encoding:"utf8"});
    assert.equal(child.status,0,child.stderr);
  });
}
