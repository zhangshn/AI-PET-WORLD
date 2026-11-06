import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import {baselineSha256, baselineDigest, baselineJson} from './natural-world-baseline-proof.mjs'
import {createEvolutionInputReader} from './natural-world-evolution-input.mjs'
import {DAILY_FIELDS, readPowerDailySource, buildCausalWindows} from './natural-world-temporal-data.mjs'
import {readWeatherFieldDomain} from './world-weather-field-domain.mjs'

const contractRef = {path:'data/ai-painter/system-governance/sakaerat-weather-dataset-release-contract-v1.json',sha256:'2c0abc22ba9c4f3ba63f35ffc36212cb795e0c7b09436f9e4e0106c7a90243d2'}
export const WEATHER_PACKAGE_PATH = 'data/world-samples/dataset-packages/sakaerat-daily-weather-153-v1'
const encode = value => Buffer.from(JSON.stringify(value)+'\n')
const fields = Object.keys(DAILY_FIELDS)
const roles = ['train','validation','challenge','regression']
const vector = day => fields.map(f=>day.values[f])

function derivePackage(root) {
  const {read} = createEvolutionInputReader(root)
  function bound(ref) {
    const bytes = read(ref.path,4*1024*1024)
    assert.equal(baselineSha256(bytes),ref.sha256,'weather dataset binding changed: '+ref.path)
    return bytes
  }
  const contract = baselineJson(bound(contractRef))
  const fit = baselineJson(bound(contract.trainingResult))
  const recipe = baselineJson(bound(contract.trainingContract))
  assert.equal(fit.checkpoint.sha256,contract.checkpoint.sha256)
  assert.equal(fit.contractSha256,contract.trainingContract.sha256)
  assert.deepEqual(recipe.trainingDataset,contract.inputs[0].historicalDataset)
  assert.deepEqual(fit.trainingDataset,recipe.trainingDataset)
  assert.deepEqual(fit.additionalExposedDataset,contract.inputs[1].historicalDataset)
  assert.equal(fit.fitCount,1)
  assert.equal(fit.onlyFittedColumn,'RH2M')
  assert.ok(fit.codeBindings.some(b=>b.sha256===contract.fitProgram.sha256))
  recipe.codeBindings.forEach(bound)
  bound(contract.checkpoint);bound(contract.fitProgram);bound(contract.parser)
  const rights=baselineJson(bound(contract.rights.reviewedEvidence))
  assert.equal(rights.requestedUrl,contract.rights.statementUrl)
  const target=baselineJson(bound(contract.fieldMetadata))
  assert.equal(target.modelSha256,contract.checkpoint.sha256)
  const domain=readWeatherFieldDomain(read)
  const members=Object.fromEntries(roles.map(role=>[role,[]]))
  const indexed=[], sources=[], dates=new Set()
  let normalizationDates, normalizationValues
  for(const [index,input] of contract.inputs.entries()){
    const bytes=bound(input.response), receipt=baselineJson(bound(input.receipt))
    const saved=baselineJson(bound(input.historicalDataset))
    const source=readPowerDailySource(bytes,receipt,{...contract.requestPoint,start:input.sets[0].start,end:input.sets.at(-1).end})
    const splits=input.sets.map(s=>({name:s.parserRole,start:s.start,end:s.end}))
    const windows=buildCausalWindows(source,{historyDays:contract.historyDays,splits}).windows
    assert.equal(windows.length,saved.windows.length)
    assert.deepEqual(saved.fieldOrder,fields)
    assert.deepEqual(saved.units,Object.values(DAILY_FIELDS))
    for(const day of source.records){
      assert(!dates.has(day.date),'source periods overlap');dates.add(day.date)
      for(const [column,rule] of domain.domainFields.entries()){
        const value=day.values[fields[column]]
        assert(value>=rule.constraints.min && value<=rule.constraints.max,'outside daily field domain')
      }
    }
    if(index===0){
      const days=source.records.filter(day=>day.date<=input.sets[0].end)
      normalizationDates=days.map(day=>day.date);normalizationValues=days.map(vector)
      assert.deepEqual(normalizationDates,saved.trainDates);assert.deepEqual(normalizationValues,saved.trainDays)
    }
    if(input.sets.some(s=>s.releaseRole==='challenge'))assert(Date.parse(receipt.acquiredAtUtc)>Date.parse(fit.finishedAtUtc),'challenge predates fixed checkpoint')
    const service=JSON.parse(bytes).header.api
    sources.push({response:input.response,receipt:input.receipt,historicalDataset:input.historicalDataset,
      service:service.name,version:service.version,acquiredAtUtc:receipt.acquiredAtUtc,url:receipt.url,calendarDays:source.records.length})
    for(const [i,w] of windows.entries()){
      const split=input.sets.find(s=>s.parserRole===w.split)
      const original={split:split.originalRole,history:w.input.history.map(vector),historyDates:w.input.history.map(day=>day.date),
        target:vector(w.target),targetDate:w.target.date}
      assert.deepEqual(original,saved.windows[i],'historical selection or values differ at '+w.target.date)
      const sampleId='sakaerat-day-'+w.target.date
      members[split.releaseRole].push(sampleId)
      indexed.push({sampleId,role:split.releaseRole,sourceSha256:input.response.sha256,...original})
    }
  }
  const counts=Object.fromEntries(roles.map(r=>[r,members[r].length]))
  assert.deepEqual(counts,{train:724,validation:358,challenge:358,regression:717})
  assert.equal(new Set(indexed.map(r=>r.sampleId)).size,indexed.length)
  const files = new Map()
  function add(name,value){const bytes=encode(value);files.set(name,bytes);return {path:WEATHER_PACKAGE_PATH+'/'+name,sha256:baselineSha256(bytes)}}
  const selectionSha=baselineDigest({members,normalizationDates,normalizationValues})
  const sourceIndex=add('source-index.json',{schemaVersion:'world-weather-source-index-v1',fields,units:Object.values(DAILY_FIELDS),
    sources,records:indexed,trainNormalization:{dates:normalizationDates,values:normalizationValues}})
  const splits=Object.fromEntries(roles.map(role=>[role,add('splits/'+role+'.json',{role,sampleIds:members[role],exposure:contract.exposure[role]})]))
  const audit=add('reports/data-sufficiency-audit.json',{scope:contract.usage,dates:dates.size,counts,fieldMetadata:domain.metadataRef,
    initializationHorizonDays:contract.historyDays,selectionSha,fitCheckpoint:contract.checkpoint,trainingDataset:fit.trainingDataset,
    originalTrainingRowsMatched:counts.train,originalNormalizationDaysMatched:normalizationDates.length,
    rights:contract.rights,exposure:contract.exposure,modelReleaseGranted:false})
  const payload={packageId:contract.packageId,contractRef,sourceIndex,splits,audit,selectionSha,model:contract.checkpoint,
    historicalTrainingDataset:fit.trainingDataset}
  const datasetReleaseIdentity='weather-data-'+baselineDigest(payload)
  const manifest=add('manifest.json',{schemaVersion:'world-weather-dataset-manifest-v1',...payload,datasetReleaseIdentity,
    counts,usage:contract.usage,sourceOrigin:contract.sourceOrigin,publishedAtUtc:contract.publishedAtUtc,exposure:contract.exposure})
  const descriptor={schemaVersion:'world-weather-dataset-release-v1',datasetReleaseIdentity,packageId:contract.packageId,
    manifest,sourceIndex,splits,audit,datasetSelectionReproductionSha256:selectionSha,trainingDatasetSha256:fit.trainingDataset.sha256,
    checkpointSha256:contract.checkpoint.sha256}
  const packageRef=add('dataset-package.json',descriptor)
  return {files,release:{...descriptor,packageRef,counts}}
}

// Only the registered package path is eligible. An incomplete existing directory is a conflict.
function packageParent(root){
  let current=fs.realpathSync(root)
  for(const segment of WEATHER_PACKAGE_PATH.split('/').slice(0,-1)){
    current=path.join(current,segment)
    assert(fs.lstatSync(current).isDirectory() && fs.realpathSync(current)===current,'weather package parent redirected')
  }
  return current
}

export function verifyWeatherDatasetRelease(root=process.cwd(),{allowAbsent=false}={}) {
  const parent=packageParent(root), destination=path.join(parent,path.basename(WEATHER_PACKAGE_PATH))
  try { assert(fs.lstatSync(destination).isDirectory(),'weather package path is not an ordinary directory') }
  catch(error){if(allowAbsent && error.code==='ENOENT')return null;throw error}
  const expected=derivePackage(root)
  const {read}=createEvolutionInputReader(root)
  for(const [name,bytes] of expected.files){
    const actual=read(WEATHER_PACKAGE_PATH+'/'+name,4*1024*1024)
    assert(actual.equals(bytes),'weather package bytes differ: '+name)
  }
  return expected.release
}

export function publishWeatherDataset(root=process.cwd()) {
  const existing=verifyWeatherDatasetRelease(root,{allowAbsent:true})
  if(existing)return {created:false,...existing}
  const parent=packageParent(root)
  const expected=derivePackage(root), destination=path.join(parent,path.basename(WEATHER_PACKAGE_PATH))
  const staging=fs.mkdtempSync(path.join(parent,'.stage-weather-153-'))
  // The final directory becomes visible only after all bound bytes verify. Retain failed staging evidence.
  for(const [name,bytes] of expected.files){
    const file=path.join(staging,name)
    fs.mkdirSync(path.dirname(file),{recursive:true})
    fs.writeFileSync(file,bytes,{flag:'wx',flush:true})
    assert(fs.readFileSync(file).equals(bytes),'staging readback failed')
  }
  const interpreter = process.platform==='win32' ? 'Scripts/python.exe' : 'bin/python'
  const selection=JSON.parse(execFileSync(path.join(root,'ml/ai-painter/.venv',interpreter),
    ['-I','-B',path.join(root,'ml/ai-painter/scripts/verify_world_weather_release_selection.py'),staging],
    {cwd:root,windowsHide:true,timeout:30000,maxBuffer:65536,encoding:'utf8',
      env:{...process.env,CUDA_VISIBLE_DEVICES:'',OMP_NUM_THREADS:'2',MKL_NUM_THREADS:'2',OPENBLAS_NUM_THREADS:'2'}}))
  assert.deepEqual(selection,{trainingDatasetSha256:expected.release.trainingDatasetSha256,windows:724,normalizationDays:731,forwards:0,updates:0})
  let created=true
  try {fs.renameSync(staging,destination)}
  catch(error){
    if(!['EEXIST','ENOTEMPTY','EPERM','EACCES'].includes(error.code) || !fs.existsSync(destination))throw error
    const winner=verifyWeatherDatasetRelease(root)
    assert.equal(winner.datasetReleaseIdentity,expected.release.datasetReleaseIdentity)
    created=false
    // Remove only the files created by this invocation in its private staging directory.
    for(const name of expected.files.keys())fs.unlinkSync(path.join(staging,name))
    for(const dir of ['splits','reports'])fs.rmdirSync(path.join(staging,dir))
    fs.rmdirSync(staging)
  }
  return {created,pythonSelection:selection,...verifyWeatherDatasetRelease(root)}
}
