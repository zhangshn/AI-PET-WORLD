import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import {parse} from '@babel/parser'

const sourcePath='scripts/lib/natural-world-rolling-head.mjs'
const source=fs.readFileSync(sourcePath,'utf8')
const declaration=parse(source,{sourceType:'module'}).program.body
  .find(n=>n.type==='ExportNamedDeclaration'&&n.declaration?.id?.name==='readDisplayRelease').declaration
const body=source.slice(declaration.start,declaration.end)
const sha=value=>crypto.createHash('sha256').update(value).digest('hex')

// Execute the actual reader body against private byte inputs and a strict
// validator double. This checks the display cache, not real release eligibility.
function fixture(){
  const version='private-weather',releasePath='private/release.json',registryPath='private/registry.json'
  const files=new Map(),state={deepProgram:'original-program',failure:null,calls:0}
  const put=(name,value)=>{const bytes=Buffer.from(typeof value==='string'?value:JSON.stringify(value));files.set(name,bytes);return{path:name,sha256:sha(bytes)}}
  const roles=['conditionContract','datasetRelease','modelArtifact','reviewContract','runtimeInterfaceContract']
  const entry={bindings:Object.fromEntries(roles.map(role=>[role,put('private/'+role,role)])),
    machineReleaseAdjudication:put('private/adjudication','adjudicated'),runtimeAutonomyPolicy:put('private/autonomy','bounded')}
  const release=put(releasePath,entry)
  const registry=put(registryPath,{releaseRecords:[{releasePath,releaseSha256:release.sha256,capabilityReleaseIdentity:version,capabilityScope:'world_evolution'}]})
  const read=logical=>{if(!files.has(logical))throw Object.assign(Error('missing '+logical),{code:'ENOENT'});return Buffer.from(files.get(logical))}
  const verify=()=>{
    state.calls++
    assert.equal(state.deepProgram,'original-program','transitive program identity changed')
    if(state.failure)throw state.failure
    return {verificationStatus:'verified_from_machine_adjudication_and_trusted_registry',
      release:{modelCapabilityVersion:version,capabilityReleaseIdentity:version,capabilityScope:'world_evolution'},
      capabilityReleaseSha256:release.sha256,trustedReleaseRegistrySha256:registry.sha256}
  }
  const reader=new Function('createEvolutionInputReader','loadAndValidateReleasedCapabilityBinding','TRUSTED_RELEASE_REGISTRY_PATH','need','equal','sha','hashPattern','path','memo','Date',
    body+'\nreturn readDisplayRelease;')(
      ()=>({read}),verify,registryPath,(ok,code)=>assert(ok,code),(a,b)=>JSON.stringify(a)===JSON.stringify(b),sha,/^[a-f0-9]{64}$/,path,new Map(),{now:()=>1000})
  return{state,files,entry,call:()=>reader(process.cwd(),releasePath,version,logical=>{const bytes=read(logical);return{bytes,sha256:sha(bytes)}})}
}

test('weather display rejects changed transitive program bytes even when cached outer identities are unchanged',()=>{
  const f=fixture();assert.equal(f.call().value.release.capabilityScope,'world_evolution')
  f.state.deepProgram='modified-program'
  assert.throws(f.call,/transitive program identity changed/)
})

test('weather display cannot reuse a previous success after the full validator rejects its evidence',()=>{
  const f=fixture();f.call();const failure=Error('private full evidence rejected')
  f.state.failure=failure;assert.throws(f.call,e=>e===failure)
})

test('mutating a previous weather display result cannot poison the next verified result',()=>{
  const f=fixture(),first=f.call();first.value.release.capabilityScope='tampered';first.at=-1
  const next=f.call();assert.equal(next.value.release.capabilityScope,'world_evolution');assert.equal(next.at,1000)
})

test('failed weather verification is retried against current evidence without retaining a failed result',()=>{
  const f=fixture(),failure=Error('temporarily missing proof');f.state.failure=failure
  assert.throws(f.call,e=>e===failure);f.state.failure=null
  assert.equal(f.call().value.release.modelCapabilityVersion,'private-weather')
})

test('weather display still rejects altered bound role bytes before full validation',()=>{
  const f=fixture();f.call();const before=f.state.calls
  f.files.set(f.entry.bindings.modelArtifact.path,Buffer.from('changed model binding'))
  assert.throws(f.call,/head_release_binding/);assert.equal(f.state.calls,before)
})
