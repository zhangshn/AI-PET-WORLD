import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {DatabaseSync} from 'node:sqlite'
import {test} from 'node:test'
import {verifyScheduledWeatherReleaseDomain} from '../lib/world-weather-scheduled-qualification.mjs'
import {recomputeScopedWeatherReleaseDomain,loadAndValidateReleasedCapabilityBinding,TRUSTED_RELEASE_REGISTRY_PATH,
  FIRST_WEATHER_SCOPED_PATH,ROLLING_WEATHER_RELEASE_PATH,SCHEDULED_WEATHER_RELEASE_PATH,SCHEDULED_WEATHER_VERSION} from '../lib/ai-painter-autonomous-package-decision-core-v3.mjs'
import {publishMachineAdjudicatedCapability} from '../lib/ai-painter-machine-capability-release-orchestrator-v1.mjs'

const root=fs.realpathSync(process.cwd()),trial='.runtime/ai-painter/controller-repair-reviews/world-service-scheduled-runtime-210-20261103'
test('existing released v3 and v4 remain readable; v5 recomputes the standard five roles and only immutable publisher fields',()=>{
  for(const capabilityReleasePath of [FIRST_WEATHER_SCOPED_PATH,ROLLING_WEATHER_RELEASE_PATH]){
    const r=loadAndValidateReleasedCapabilityBinding({projectRoot:root,capabilityReleasePath,trustedReleaseRegistryPath:TRUSTED_RELEASE_REGISTRY_PATH,requiredCapabilityScope:'world_evolution'})
    assert.equal(r.verificationStatus,'verified_from_machine_adjudication_and_trusted_registry')
  }
  const d=recomputeScopedWeatherReleaseDomain(root,SCHEDULED_WEATHER_VERSION)
  assert.equal(d.bindings.modelArtifact.sha256,'36a5e5973228295f38392b50680868331caab7b1588e3fc10f54d2f084ce05c8')
  assert.equal(d.bindings.conditionContract.path,'scripts/lib/world-weather-scheduled-history.mjs')
  assert.equal(Object.keys(d.bindings).length,5)
  for(const ref of d.releaseEvidence)assert.deepEqual(Object.keys(ref).sort(),['path','sha256'])
})
test('v5 denies fabricated approvals, caller evidence, a generic scope or an unknown release identity',()=>{
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'weather-v5-empty-'))
  try{
    const opts={root:tmp,requiredCapabilityScope:'world_evolution',expectedRegistryRevision:2},fixed={capabilityReleaseIdentity:SCHEDULED_WEATHER_VERSION}
    for(const extra of [{passed:true},{sourceSha256:'a'.repeat(64)},{bindings:{}},{releaseEvidence:[]}]){
      assert.throws(()=>publishMachineAdjudicatedCapability({...fixed,...extra},opts),/caller evidence rejected/)
    }
    assert.throws(()=>publishMachineAdjudicatedCapability(fixed,opts),/fixed weather policy is missing/)
    assert.throws(()=>publishMachineAdjudicatedCapability(fixed,{root:tmp}),/explicit world_evolution/)
    assert.throws(()=>loadAndValidateReleasedCapabilityBinding({projectRoot:tmp,capabilityReleasePath:SCHEDULED_WEATHER_RELEASE_PATH}),/requires explicit/)
    assert.throws(()=>publishMachineAdjudicatedCapability({capabilityReleaseIdentity:SCHEDULED_WEATHER_VERSION+'-copy'},{root:tmp}),/reserved weather identity/)
    assert.deepEqual(fs.readdirSync(tmp),[])
  }finally{fs.rmdirSync(tmp)}
})
test('a disposable independent copy rejects a substituted output, native cleanup, lease ledger or self-declared report',t=>{
  const mount=fs.realpathSync(path.join(root,'.runtime')),opened=new Set(),originalOpen=fs.openSync
  const watch=t.mock.method(fs,'openSync',function(file,...args){
    if(typeof file==='string'&&path.isAbsolute(file))opened.add(file)
    return originalOpen(file,...args)
  })
  try{verifyScheduledWeatherReleaseDomain(root)}finally{watch.mock.restore()}
  const copy=fs.mkdtempSync(path.join(os.tmpdir(),'weather-v5-check-'))
  try{
    for(const file of opened){
      const rel=file.startsWith(mount+path.sep)?path.join('.runtime',path.relative(mount,file)):path.relative(root,file)
      assert(!rel.startsWith('..')&&!path.isAbsolute(rel))
      const dst=path.join(copy,rel);fs.mkdirSync(path.dirname(dst),{recursive:true});fs.copyFileSync(file,dst)
    }
    assert.doesNotThrow(()=>verifyScheduledWeatherReleaseDomain(copy))
    const evidence=JSON.parse(fs.readFileSync(path.join(copy,trial,'qualification-evidence.json')))
    for(const ref of [evidence.steps[0].outputRef,evidence.steps[1].cleanupRef,{path:trial+'/qualification-evidence.json'}]){
      const p=path.join(copy,ref.path),raw=fs.readFileSync(p)
      fs.writeFileSync(p,JSON.stringify({status:'passed',sha256:'a'.repeat(64)}))
      try{assert.throws(()=>verifyScheduledWeatherReleaseDomain(copy),e=>e.message.includes(ref.path))}
      finally{fs.writeFileSync(p,raw)}
    }
    const db=new DatabaseSync(path.join(copy,trial,'qualification/accounting/accounting.sqlite'))
    try{db.exec("UPDATE slots SET status='reserved' WHERE target_tick=5")}finally{db.close()}
    assert.throws(()=>verifyScheduledWeatherReleaseDomain(copy),/reserved/)
  }finally{
    assert.equal(path.dirname(copy),fs.realpathSync(os.tmpdir()));assert.equal(fs.realpathSync(copy),copy)
    fs.rmSync(copy,{recursive:true})
  }
})
