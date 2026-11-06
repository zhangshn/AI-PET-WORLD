import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {ENVIRONMENT_EVIDENCE_MANIFEST,ENVIRONMENT_EVIDENCE_MANIFEST_SHA} from '../../lib/world-environment-evidence.mjs'
import {ENVIRONMENT_QUALIFICATION_MANIFEST,ENVIRONMENT_QUALIFICATION_MANIFEST_SHA} from '../../lib/world-environment-qualification.mjs'

const root=path.resolve(import.meta.dirname,'../../..')
const registry='data/ai-painter/system-governance/ai-painter-capability-release-registry-v2.json'
export const HISTORICAL_WORLD_PATH='data/world-runtime/mvp-natural-owner-001/mvp-natural-world-001.json'
export const HISTORICAL_WORLD_SHA='93a6202c69b470ac79094ed1686889e7a85605a3554f5728be8df414ca569868'
const before='.runtime/ai-painter/controller-repair-reviews/natural-world-maintenance-policy-179-20261103/bootstrap-before.json'
const registrySha='05f9be0a495e1b48d7634e8ac9cefa26dc94aebd6d973b0f01fbd55de8ae6daf'
const hash=b=>createHash('sha256').update(b).digest('hex')

export function readHistoricalWeatherRegistry() {
  // This exact blob is from the historical release registry at the reviewed code baseline.
  // A current checkout can have valid newer releases. Reconstructing an "empty" JSON object
  // would lose the original bytes and could accidentally drop a real policy field.
  const raw=execFileSync('git',['cat-file','blob','85984c7c1c2e593094ef9d7f7f510f69e93eb87f'],{cwd:root,maxBuffer:4096,windowsHide:true})
  assert.equal(hash(raw),registrySha,'historical weather registry provenance')
  return raw
}

export function createHistoricalWeatherFixture() {
  function original(file,digest) {
    const p=path.join(root,file),stat=fs.statSync(p)
    assert(stat.isFile()&&stat.size>0&&stat.size<=4*1024**2,'historical source outside file budget: '+file)
    const raw=fs.readFileSync(p)
    assert.equal(hash(raw),digest,'historical source mismatch: '+file)
    return raw
  }
  const m162=original(ENVIRONMENT_EVIDENCE_MANIFEST,ENVIRONMENT_EVIDENCE_MANIFEST_SHA)
  const m165=original(ENVIRONMENT_QUALIFICATION_MANIFEST,ENVIRONMENT_QUALIFICATION_MANIFEST_SHA)
  const legacy=JSON.parse(m162),manifest=JSON.parse(m165)
  // Only the two changing live locations are resolved through pre-existing immutable bytes.
  // Every path, size and SHA still comes from the original pinned manifests.
  const refs=new Map()
  for(const ref of [...legacy.refs,...manifest.references]){
    const existing=refs.get(ref.path)
    if(existing)assert.deepEqual([ref.bytes,ref.sha256],[existing.bytes,existing.sha256],'conflicting historical manifests')
    refs.set(ref.path,ref)
  }
  assert.equal(refs.get(registry).sha256,registrySha)
  assert.equal(refs.get(HISTORICAL_WORLD_PATH).sha256,HISTORICAL_WORLD_SHA)
  const prefix=path.join(fs.realpathSync(os.tmpdir()),'historical-weather-')
  const fixture=fs.mkdtempSync(prefix)
  const cleanup=()=>{
    if(!fs.existsSync(fixture))return
    assert.equal(fs.realpathSync(fixture),fixture)
    assert.equal(path.dirname(fixture),path.dirname(prefix))
    assert(path.basename(fixture).startsWith(path.basename(prefix)))
    fs.rmSync(fixture,{recursive:true,force:true})
  }
  function put(logical,bytes){
    assert(logical.split('/').every(s=>s&&s!=='.'&&s!=='..'&&!s.includes('\\')&&!s.includes(':')))
    const target=path.join(fixture,logical)
    fs.mkdirSync(path.dirname(target),{recursive:true})
    fs.writeFileSync(target,bytes,{flag:'wx'})
  }
  try{
    for(const {path:file,sha256,bytes} of refs.values()){
      const raw=file===registry?readHistoricalWeatherRegistry():original(file===HISTORICAL_WORLD_PATH?before:file,sha256)
      assert.equal(raw.length,bytes);assert.equal(hash(raw),sha256)
      put(file,raw)
    }
    // The 165 manifest also binds the 162 manifest as a dependency.
    if(!refs.has(ENVIRONMENT_EVIDENCE_MANIFEST))put(ENVIRONMENT_EVIDENCE_MANIFEST,m162)
    if(!refs.has(ENVIRONMENT_QUALIFICATION_MANIFEST))put(ENVIRONMENT_QUALIFICATION_MANIFEST,m165)
    return {fixture,manifest,cleanup}
  }catch(error){cleanup();throw error}
}
