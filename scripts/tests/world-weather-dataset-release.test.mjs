import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import {verifyWeatherDatasetRelease,publishWeatherDataset,WEATHER_PACKAGE_PATH} from '../lib/world-weather-dataset-release.mjs'
import {createEvolutionInputReader} from '../lib/natural-world-evolution-input.mjs'
import {readWeatherFieldDomain} from '../lib/world-weather-field-domain.mjs'

test('repeated publication reproduces all membership and artifact hashes without replacing the package',()=>{
  const before=verifyWeatherDatasetRelease()
  const {created,...after}=publishWeatherDataset()
  assert.equal(created,false)
  assert.deepEqual(after,before)
  assert.deepEqual(before.counts,{train:724,validation:358,challenge:358,regression:717})
})

test('missing, damaged or reassigned members cannot be accepted as the frozen dataset',t=>{
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'weather-dataset-'))
  t.after(()=>fs.rmSync(temp,{recursive:true,force:true}))
  const copy=p=>{
    const dst=path.join(temp,p)
    fs.mkdirSync(path.dirname(dst),{recursive:true})
    fs.copyFileSync(p,dst)
  }
  const contractPath='data/ai-painter/system-governance/sakaerat-weather-dataset-release-contract-v1.json'
  const contract=JSON.parse(fs.readFileSync(contractPath))
  const recipe=JSON.parse(fs.readFileSync(contract.trainingContract.path))
  const domain=readWeatherFieldDomain(createEvolutionInputReader().read)
  copy(contractPath)
  for(const ref of [contract.trainingContract,contract.checkpoint,contract.trainingResult,contract.rights.reviewedEvidence,
    contract.fitProgram,contract.parser,contract.fieldMetadata,domain.metadataRef,domain.receiptRef,...recipe.codeBindings,
    ...contract.inputs.flatMap(i=>[i.response,i.receipt,i.historicalDataset])])copy(ref.path)
  const pkg=path.join(temp,WEATHER_PACKAGE_PATH)
  fs.mkdirSync(path.dirname(pkg),{recursive:true})
  assert.equal(verifyWeatherDatasetRelease(temp,{allowAbsent:true}),null)
  fs.cpSync(WEATHER_PACKAGE_PATH,pkg,{recursive:true})
  assert.equal(verifyWeatherDatasetRelease(temp).counts.train,724)
  const members=path.join(pkg,'splits/train.json'),saved=fs.readFileSync(members)
  const corrupt=JSON.parse(saved);corrupt.sampleIds[0]='sakaerat-day-20250108'
  fs.writeFileSync(members,JSON.stringify(corrupt))
  assert.throws(()=>verifyWeatherDatasetRelease(temp),/bytes differ/)
  fs.writeFileSync(members,saved)
  fs.unlinkSync(path.join(pkg,'source-index.json'))
  assert.throws(()=>verifyWeatherDatasetRelease(temp,{allowAbsent:true}),/ENOENT/)
})
