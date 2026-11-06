import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {createHash} from 'node:crypto'
import {createRequire} from 'node:module'
import ts from 'typescript'
const require=createRequire(import.meta.url)
function load(file,imports){const source=fs.readFileSync(new URL('../../src/world/runtime/'+file,import.meta.url),'utf8'),compiled=ts.transpileModule(source,{reportDiagnostics:true,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}});assert.equal(compiled.diagnostics.filter(d=>d.category===ts.DiagnosticCategory.Error).length,0);const loaded={exports:{}};new Function('require','exports','module',compiled.outputText)(id=>{if(Object.hasOwn(imports,id))return imports[id];throw Error('Unexpected dependency or I/O '+id)},loaded.exports,loaded);return loaded.exports}
const crypto=require('node:crypto'),util=require('node:util'),clock=load('world-evolution-clock.ts',{}),policyApi=load('world-evolution-policy.ts',{'node:crypto':crypto,'node:util':util,'./world-evolution-clock':clock})
const {validateWorldEnvironmentDelta:validate}=load('world-environment-validator.ts',{'node:crypto':crypto,'node:util':util,'./world-evolution-policy':policyApi})
const descriptors=policyApi.FIXED_ENVIRONMENT_FIELD_DESCRIPTORS,ids=descriptors.map(d=>d.fieldId),hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex'),ref=id=>({id:'synthetic-'+id,version:'fixture-v1',sha256:'a'.repeat(64)})
const identity={ownerId:'fixture-owner',playerId:'fixture-player',worldId:'fixture-world',worldSeed:'fixture-seed',worldProfileId:'fixture-profile',regionId:'fixture-region'}
function seal(p){const v=structuredClone(p);delete v.contentSha256;return {...v,contentSha256:policyApi.computeWorldEvolutionPolicySha(v)}}
// Synthetic component ranges, identity and hashes; they are not production evidence.
function fixture(){
 const policy=seal({schemaVersion:'world-evolution-policy-v1',policyId:'synthetic-policy',policyVersion:'fixture-v1',scopeId:'synthetic-environment',ruleVersion:'fixture-v1',identity:{...identity},capabilityRef:ref('capability'),modelRef:ref('model'),validatorRef:ref('validator'),inputSchemaRef:ref('input'),domainFields:descriptors.map((d,i)=>({...d,constraints:{min:[0,0,-50,0][i],max:[200,100,50,50][i]},missingPolicy:'reject',allowedOps:['replace'],evidenceRefs:[ref('synthetic-range')]})),timePolicy:{simulationEpochUtc:'2020-01-01T00:00:00.000Z',stepSeconds:86400,scheduleIntervalSeconds:2,modelHorizonSeconds:86400,downtimeMode:'freeze',maxCatchupSteps:0,maxCatchupLogicalSeconds:0},historyPolicy:{selectorId:'synthetic-selector',selectorVersion:'fixture-v1',maxEvents:7,maxBytes:8192,minimumContextEvents:0,summaryMode:'none',evidenceRefs:[ref('history')]},executionPolicyRef:ref('execution'),resourceContractRef:ref('resources'),maintenancePolicy:{mode:'none',reason:'Synthetic fixture only'},registrationEvidenceRefs:[ref('not-production')]})
 const beforeValues=Object.fromEntries(ids.map((id,i)=>[id,[1,50,20,2][i]])),changes=ids.map((id,i)=>({fieldId:id,operation:'replace',beforeValueSha256:hash(beforeValues[id]),newValue:[2,51,21,3][i],reasonRefs:['b'.repeat(64)]}))
 return {policy,identity:{...identity},interval:{logicalStartUtc:'2020-01-08T00:00:00.000Z',logicalEndUtc:'2020-01-09T00:00:00.000Z',durationSeconds:86400},beforeValues,changes,result:'changes'}
}
const bad=change=>{const v=fixture();change(v);assert.throws(()=>validate(v),/world_(?:environment_delta|evolution_policy|evolution_clock)_invalid/)}
test('four valid replacements produce exact immutable values without mutating input or admitting production',()=>{const v=fixture(),before=structuredClone(v),r=validate(v);assert.deepEqual(v,before);assert.deepEqual(r,{nextValues:Object.fromEntries(ids.map((id,i)=>[id,[2,51,21,3][i]])),domainValid:true,productionAdmitted:false,evidenceVerified:false});assert(Object.isFrozen(r));assert(Object.isFrozen(r.nextValues));v.changes[0].newValue=3;assert.equal(r.nextValues[ids[0]],2);assert.throws(()=>{r.nextValues[ids[0]]=4},TypeError)})
test('partial replacement retains all untouched values and exact policy min/max is inclusive',()=>{const v=fixture();v.changes=[v.changes[1]];v.changes[0].newValue=100;const r=validate(v);assert.equal(r.nextValues[ids[1]],100);assert.equal(r.nextValues[ids[0]],1);v.changes[0].newValue=0;assert.equal(validate(v).nextValues[ids[1]],0)})
test('no_change requires empty changes and returns existing finite in-range values',()=>{const v=fixture();v.result='no_change';v.changes=[];assert.deepEqual(validate(v).nextValues,v.beforeValues);bad(v=>v.result='no_change');bad(v=>v.result=['no_change']);bad(v=>v.result={value:'changes'})})
test('changes requires nonempty differences, rejects equal-value-only replacements',()=>{bad(v=>v.changes=[]);bad(v=>v.changes.forEach(c=>c.newValue=v.beforeValues[c.fieldId]));const v=fixture();v.changes[0].newValue=v.beforeValues[ids[0]];assert.equal(validate(v).domainValid,true)})
test('policy is revalidated, caller shapeValid and invalid digest never bypass it',()=>{bad(v=>v.policy={shapeValid:true,policy:v.policy});bad(v=>v.policy.contentSha256='0'.repeat(64));bad(v=>v.policy.shapeValid=true);bad(v=>{v.policy.domainFields[0].constraints.max=1;v.policy=seal(v.policy)});bad(v=>{v.policy.domainFields[1].unit='C';v.policy=seal(v.policy)})})
test('requires all four unique number field mappings and replace-capable reject-missing policies',()=>{
 for(const change of [p=>p.domainFields.pop(),p=>p.domainFields[0].adapterFieldId='environment.WRONG',p=>p.domainFields[0].fieldId='environment.WRONG',p=>p.domainFields[0].allowedOps=['set'],p=>p.domainFields[0].missingPolicy='explicit_unavailable'])bad(v=>{change(v.policy);v.policy=seal(v.policy)})
 bad(v=>{v.policy.domainFields[0].dataType='integer';v.policy=seal(v.policy)})
 const v=fixture();v.policy.domainFields[0].allowedOps=['set','replace'];v.policy=seal(v.policy);assert.equal(validate(v).domainValid,true);v.changes[0].operation='set';assert.throws(()=>validate(v),/operation/)
})
test('identity exact six keys must match policy; no extra tick or missing world',()=>{for(const id of Object.keys(identity))bad(v=>v.identity[id]='foreign');bad(v=>delete v.identity.worldId);bad(v=>v.identity.tick=0);bad(v=>v.identity=null)})
test('interval canonical UTC, valid calendar, positive integer milliseconds and matching horizon',()=>{
 for(const change of [v=>v.interval.logicalStartUtc='2020-01-08T00:00:00Z',v=>v.interval.logicalStartUtc='2020-02-30T00:00:00.000Z',v=>v.interval.logicalEndUtc=v.interval.logicalStartUtc,v=>v.interval.durationSeconds=0,v=>v.interval.durationSeconds=86400.0001,v=>v.interval.durationSeconds='86400',v=>v.interval.logicalEndUtc='2020-01-10T00:00:00.000Z',v=>v.interval.extra=true])bad(change)
 bad(v=>{v.policy.timePolicy.stepSeconds=3600;v.policy.timePolicy.modelHorizonSeconds=3600;v.policy=seal(v.policy)})
 const v=fixture();v.policy.timePolicy.stepSeconds=0.001;v.policy.timePolicy.modelHorizonSeconds=0.001;v.policy=seal(v.policy);v.interval={logicalStartUtc:'2020-01-08T00:00:00.000Z',logicalEndUtc:'2020-01-08T00:00:00.001Z',durationSeconds:0.001};assert.equal(validate(v).domainValid,true)
})
test('before values have exactly4 finite numeric entries in policy range, not missing/zero substitutes',()=>{bad(v=>delete v.beforeValues[ids[0]]);bad(v=>v.beforeValues.extra=1);for(const value of [null,undefined,'1',true,[1],{status:'unavailable',reason:'missing'},NaN,Infinity,-Infinity,201])bad(v=>v.beforeValues[ids[0]]=value)})
test('old value digest binds exact canonical scalar including fractional numbers',()=>{bad(v=>v.changes[0].beforeValueSha256='a'.repeat(64));bad(v=>v.changes[0].beforeValueSha256=hash('1'));bad(v=>v.changes[0].beforeValueSha256=hash(1).toUpperCase());const v=fixture();v.beforeValues[ids[0]]=0.000004825542730548925;v.changes[0].beforeValueSha256=hash(v.beforeValues[ids[0]]);assert.equal(validate(v).domainValid,true)})
test('unknown fields, arbitrary paths, duplicate writes and forbidden operations reject',()=>{
 for(const field of ['../environment','/environment/RH2M','worldState.payload.environment.RH2M','environment.__proto__','environment.UNKNOWN',[ids[0]],{id:ids[0]}])bad(v=>v.changes[0].fieldId=field)
 bad(v=>v.changes[1].fieldId=v.changes[0].fieldId);bad(v=>v.changes.push(v.changes[0]));bad(v=>v.changes[0].path='/x');bad(v=>v.extra=true)
 for(const operation of ['set','delete','move',['replace'],{value:'replace'},null])bad(v=>v.changes[0].operation=operation)
})
test('new values remain finite original numbers in supplied range; no coercion or unavailable values',()=>{for(const value of ['2',true,null,[2],{value:2},{status:'unavailable',reason:'missing'},NaN,Infinity,-1,201])bad(v=>v.changes[0].newValue=value)})
test('nonempty bounded unique reason SHA strings required but not attested',()=>{for(const value of [[],['a'],['A'.repeat(64)],['b'.repeat(64),'b'.repeat(64)],Array(65).fill('b'.repeat(64)),[ref('reason')],null])bad(v=>v.changes[0].reasonRefs=value);assert.equal(validate(fixture()).evidenceVerified,false)})
test('getter, proxy, cyclic, sparse and prototype input rejected without execution or mutation',()=>{
 let calls=0;const v=fixture();Object.defineProperty(v.beforeValues,ids[0],{enumerable:true,get(){calls++;return 1}});assert.throws(()=>validate(v),/accessor/);assert.equal(calls,0)
 const proxy=new Proxy(fixture(),{getPrototypeOf(){calls++;throw Error('trap')}});assert.throws(()=>validate(proxy),/ordinary_json/);assert.equal(calls,0)
 bad(v=>v.changes[0].newValue=v);bad(v=>delete v.changes[0]);bad(v=>Object.setPrototypeOf(v.beforeValues,{extra:1}));bad(v=>v.policyId='x'.repeat(600000));bad(v=>v.changes[0].toJSON=()=>({}));bad(v=>Object.defineProperty(v,'hidden',{value:1,enumerable:false}))
})
test('failed validation leaves source bytes and references untouched',()=>{const v=fixture();v.changes[2].newValue=1000;const before=JSON.stringify(v),refs=v.changes;assert.throws(()=>validate(v));assert.equal(JSON.stringify(v),before);assert.equal(v.changes,refs)})
