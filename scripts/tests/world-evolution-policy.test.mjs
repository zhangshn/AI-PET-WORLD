import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {createRequire} from 'node:module'
import ts from 'typescript'
const require=createRequire(import.meta.url)
function load(filename,imports){
 const source=fs.readFileSync(new URL('../../src/world/runtime/'+filename,import.meta.url),'utf8'),compiled=ts.transpileModule(source,{reportDiagnostics:true,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}})
 assert.equal(compiled.diagnostics.filter(d=>d.category===ts.DiagnosticCategory.Error).length,0)
 const loaded={exports:{}};new Function('require','exports','module',compiled.outputText)(id=>{if(Object.hasOwn(imports,id))return imports[id];throw Error('Unexpected I/O/dependency: '+id)},loaded.exports,loaded);return loaded.exports
}
const clock=load('world-evolution-clock.ts',{}),api=load('world-evolution-policy.ts',{'node:crypto':require('node:crypto'),'node:util':require('node:util'),'./world-evolution-clock':clock})
const {validateWorldEvolutionPolicy:validate,computeWorldEvolutionPolicySha:compute,validateFixedEnvironmentPolicyFields:environment,FIXED_ENVIRONMENT_FIELD_DESCRIPTORS:descriptors}=api
const ref=id=>({id:'synthetic-'+id,version:'fixture-v1',sha256:'a'.repeat(64)})
const identity={ownerId:'fixture-owner',playerId:'fixture-player',worldId:'fixture-world',worldSeed:'fixture-seed',worldProfileId:'fixture-profile',regionId:'fixture-region'}
// Explicitly synthetic shape examples, never production data/range qualification.
const content=()=>({schemaVersion:'world-evolution-policy-v1',policyId:'synthetic-policy',policyVersion:'fixture-v1',scopeId:'synthetic-scope',ruleVersion:'fixture-rule-v1',identity:{...identity},capabilityRef:ref('capability'),modelRef:ref('model'),validatorRef:ref('validator'),inputSchemaRef:ref('input'),domainFields:descriptors.map(d=>({...d,constraints:{min:0,max:1000},missingPolicy:'reject',allowedOps:['set','replace'],evidenceRefs:[ref('range-fixture')]})),timePolicy:{simulationEpochUtc:'2020-01-01T00:00:00.000Z',stepSeconds:86400,scheduleIntervalSeconds:2,modelHorizonSeconds:86400,downtimeMode:'freeze',maxCatchupSteps:0,maxCatchupLogicalSeconds:0},historyPolicy:{selectorId:'synthetic-selector',selectorVersion:'fixture-v1',maxEvents:7,maxBytes:8192,minimumContextEvents:0,summaryMode:'none',evidenceRefs:[ref('history')]},executionPolicyRef:ref('execution'),resourceContractRef:ref('resources'),maintenancePolicy:{mode:'none',reason:'Synthetic parser fixture, no migration.'},registrationEvidenceRefs:[ref('synthetic-unverified')]})
const seal=p=>({...p,contentSha256:compute(p)})
const bad=change=>{const p=content();change(p);assert.throws(()=>compute(p),/world_evolution_(?:policy|clock)_invalid/)}
test('valid shape preserves full policy and recursively freezes it without granting evidence/production',()=>{
 const source=seal(content()),r=validate(source,identity);assert.deepEqual(r.policy,source);assert.deepEqual(Object.keys(r).sort(),['evidenceVerified','policy','productionAdmitted','shapeOnly','shapeValid'].sort());assert.equal(r.shapeValid,true);assert.equal(r.shapeOnly,true);assert.equal(r.productionAdmitted,false);assert.equal(r.evidenceVerified,false)
 const frozen=v=>{if(v&&typeof v==='object'){assert(Object.isFrozen(v));Object.values(v).forEach(frozen)}};frozen(r)
 source.identity.worldId='changed';source.domainFields[0].constraints.max=999;assert.equal(r.policy.identity.worldId,identity.worldId);assert.equal(r.policy.domainFields[0].constraints.max,1000)
 assert.throws(()=>{r.policy.identity.worldId='changed'},TypeError)
})
test('canonical hash ignores object insertion order but not content or array order',()=>{
 const p=content(),reversed=Object.fromEntries(Object.entries(p).reverse());assert.equal(compute(p),compute(reversed));const c=seal(p);c.contentSha256='b'.repeat(64);assert.throws(()=>validate(c),/content_sha256/);p.domainFields.reverse();assert.notEqual(compute(p),compute(content()));assert.throws(()=>compute(seal(content())),/fields/)
})
test('six exact nonempty identities and expected Store identity are required',()=>{bad(p=>delete p.identity.regionId);bad(p=>p.identity.ownerId=' ');bad(p=>p.identity.extra='x');assert.throws(()=>validate(seal(content()),{...identity,worldId:'foreign'}),/identity_mismatch/);assert.throws(()=>validate(seal(content()),{...identity,tick:0}),/fields/)})
for(const value of ['latest','LATEST','current','Current','head','HEAD'])test('reject mutable exact reference '+value,()=>{bad(p=>p.modelRef.version=value);bad(p=>p.modelRef.id=value)})
test('legitimate immutable version strings containing current/latest are not overblocked',()=>{const p=content();p.modelRef.version='current-study-v1';p.modelRef.id='latest-paper-v2';assert.equal(validate(seal(p)).shapeValid,true)})
test('refs require exact id/version/lowercaseSHA, reject paths and duplicate ambiguous refs',()=>{bad(p=>delete p.modelRef.sha256);bad(p=>p.modelRef.sha256='A'.repeat(64));bad(p=>p.modelRef.path='../model');bad(p=>p.registrationEvidenceRefs=[]);bad(p=>p.registrationEvidenceRefs=[ref('same'),ref('same')])})
test('time compatibility delegates existing clock validation with no speed defaults',()=>{bad(p=>p.timePolicy.modelHorizonSeconds=3600);bad(p=>p.timePolicy.stepSeconds=0);bad(p=>p.timePolicy.scheduleIntervalSeconds=Infinity);bad(p=>p.timePolicy.simulationEpochUtc='2020-02-30T00:00:00.000Z');bad(p=>p.timePolicy.maxCatchupSteps=1);bad(p=>p.timePolicy.downtimeMode='bounded_catchup');const p=content();p.timePolicy={...p.timePolicy,downtimeMode:'bounded_catchup',maxCatchupSteps:2,maxCatchupLogicalSeconds:172800};assert.equal(validate(seal(p)).shapeValid,true)})
test('history bounds and registered summary both exact refs required',()=>{
 bad(p=>p.historyPolicy.maxEvents=0);bad(p=>p.historyPolicy.maxBytes=1.1);bad(p=>p.historyPolicy.minimumContextEvents=8);bad(p=>p.historyPolicy.summaryMode='registered_summary');bad(p=>p.historyPolicy.summarizerRef=ref('unused'))
 const p=content();p.historyPolicy={...p.historyPolicy,summaryMode:'registered_summary',summarizerRef:ref('summary'),sourceValidationRef:ref('source-validator')};assert.equal(validate(seal(p)).shapeValid,true)
})
test('none migration requires reason and rejects stale migration fields; migration requires explicit refs',()=>{
 bad(p=>p.maintenancePolicy.reason='');bad(p=>p.maintenancePolicy.migrationEvidenceRef=ref('stale'));bad(p=>p.maintenancePolicy={mode:'migration',compatibleFromVersions:['v1'],migrationEvidenceRef:ref('migration'),resumeRule:'auto'})
 const p=content();p.maintenancePolicy={mode:'migration',compatibleFromVersions:['fixture-v0'],migrationEvidenceRef:ref('migration'),resumeRule:ref('resume')};assert.equal(validate(seal(p)).shapeValid,true)
})
test('unknown fields at every policy level and unsupported operations reject',()=>{for(const key of ['identity','timePolicy','historyPolicy','maintenancePolicy','modelRef'])bad(p=>p[key].extra=true);bad(p=>p.extra=true);bad(p=>p.domainFields[0].allowedOps=['delete']);bad(p=>p.domainFields[0].allowedOps=['replace','replace']);bad(p=>p.domainFields[0].adapterFieldId='../state');bad(p=>p.domainFields[1].fieldId=p.domainFields[0].fieldId)})
test('domain types have disjoint constraint structures and explicit non-dimensional units',()=>{
 bad(p=>p.domainFields[0].constraints={min:2,max:1});bad(p=>p.domainFields[0].dataType='blob');bad(p=>p.domainFields[0].constraints={min:0,max:1,values:['x']});bad(p=>p.domainFields[0].unit='')
 for(const dataType of ['boolean','string','enum','integer']){const p=content();p.domainFields=[{...p.domainFields[0],fieldId:'synthetic.'+dataType,adapterFieldId:'synthetic.'+dataType,dataType,unit:'dimensionless',constraints:dataType==='enum'?{values:['a','b']}:dataType==='integer'?{min:0,max:5}:{}}];assert.equal(validate(seal(p)).shapeValid,true);assert.throws(()=>environment(p.domainFields),/fixed_environment_descriptor/)}
 bad(p=>{p.domainFields[0].dataType='integer';p.domainFields[0].constraints={min:0.5,max:3}});bad(p=>{p.domainFields[0].dataType='enum';p.domainFields[0].constraints={values:['x','x']}})
})
test('dataType is an original string enum, never coerced from arrays or objects',()=>{
 for(const kind of ['number','integer','boolean','string','enum']){
  for(const value of [[kind],[[kind]],{value:kind},{type:kind}]){
   bad(p=>{p.domainFields[0].dataType=value;p.domainFields[0].constraints={};p.domainFields[0].unit='dimensionless'})
   const p=content();p.domainFields[0].dataType=value;p.domainFields[0].constraints={};p.domainFields[0].unit='dimensionless'
   assert.throws(()=>environment(p.domainFields),/data_type/)
  }
 }
 for(const value of [null,true,false,0,1,[],{}])bad(p=>{p.domainFields[0].dataType=value;p.domainFields[0].constraints={};p.domainFields[0].unit='dimensionless'})
 let coercions=0;const value={toString(){coercions++;return 'number'}};bad(p=>{p.domainFields[0].dataType=value;p.domainFields[0].constraints={};p.domainFields[0].unit='dimensionless'});assert.equal(coercions,0)
})
test('fixed four-field adapter rejects swapped units, unknown IDs and nonnumeric fields without supplying ranges',()=>{
 assert(descriptors.every(d=>!Object.hasOwn(d,'constraints')&&!Object.hasOwn(d,'min')&&!Object.hasOwn(d,'max')));const p=content(),r=environment(p.domainFields);assert.equal(r.shapeOnly,true);assert.equal(r.productionAdmitted,false);assert(Object.isFrozen(r.fields[0].constraints));p.domainFields[0].unit='C';assert.throws(()=>environment(p.domainFields),/fixed_environment_descriptor/);p.domainFields[0].unit='mm/day';p.domainFields[0].adapterFieldId='environment.unknown';assert.throws(()=>environment(p.domainFields),/fixed_environment_descriptor/)
})
test('explicit unavailable is only a missing-policy declaration, not synthetic zero/value acceptance',()=>{const p=content();p.domainFields[0].missingPolicy='explicit_unavailable';assert.equal(validate(seal(p)).shapeValid,true);bad(p=>p.domainFields[0].missingPolicy={status:'unavailable',reason:'x',value:0})})
test('ordinary JSON snapshot rejects getters without execution, Proxy traps, prototype pollution and toJSON',()=>{
 let calls=0;const p=content();Object.defineProperty(p,'policyId',{get(){calls++;return 'evil'},enumerable:true});assert.throws(()=>compute(p),/object_accessor/);assert.equal(calls,0)
 const proxy=new Proxy(content(),{getPrototypeOf(){calls++;throw Error('trap')}});assert.throws(()=>compute(proxy),/ordinary_json/);assert.equal(calls,0)
 bad(p=>Object.setPrototypeOf(p,{inherited:1}));bad(p=>p.toJSON=()=>({}));bad(p=>p.identity=JSON.parse('{"__proto__":{}}'))
})
test('cycles, undefined, nonfinite values, sparse/accessor arrays and oversized JSON reject before hashing',()=>{
 bad(p=>p.cycle=p);bad(p=>p.policyId=undefined);bad(p=>p.domainFields[0].constraints.max=NaN);bad(p=>p.domainFields[0].constraints.max=Infinity);bad(p=>p.domainFields[0].constraints.max=9007199254740992);bad(p=>p.policyId='x'.repeat(300000));bad(p=>delete p.domainFields[0]);bad(p=>Object.defineProperty(p.domainFields,'0',{get(){throw Error('must not run')},enumerable:true}));bad(p=>p.registrationEvidenceRefs=Array(257).fill(ref('x')))
})
