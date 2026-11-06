import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { createHash } from "node:crypto"
import { spawnSync } from "node:child_process"
import { fileURLToPath, pathToFileURL } from "node:url"
import test from "node:test"
import sharp from "sharp"
import { fixture } from "./helpers/original-image-source-fixture.mjs"

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")
const programs = ["scripts/intake-original-image.mjs", "scripts/lib/original-image-library-contract.mjs",
  "scripts/lib/ai-painter-source-correction-intake-v2.mjs", "scripts/lib/ai-painter-corrected-parent-replay.mjs",
  "scripts/lib/ai-painter-stage4-dataset-audit.mjs"]

// The parent replay has its own real-byte integration test. This private process
// isolates the downstream CLI and never modifies the project library.
async function scenario(t) {
  const f = await fixture(t), r = f.request, input = r.sourceCorrection
  const get = p => JSON.parse(fs.readFileSync(path.join(f.root,p)))
  const policyPath = input.sourcePolicy.path, doc = fs.readFileSync(path.join(project,policyPath))
  input.sourcePolicy=f.put(policyPath,doc)
  const version=/^文档版本：`([^`]+)`$/m.exec(doc.toString())[1]
  r.aiAssistedColdStart.policyVersion=version
  input.schemaVersion="source-correction-intake-evidence-request-v2"
  const parentRecord = get(input.parentSourceRecord.path), guide=input.guide
  const task=get(input.task.path),semantic=createHash("sha256").update(JSON.stringify(task)).digest("hex")
  input.task=f.put(input.task.path,{...task,taskSha256:semantic})
  input.conditionPack=f.put(input.conditionPack.path,{...get(input.conditionPack.path),taskSha256:semantic})
  f.rows[0].conditionPack=input.conditionPack
  parentRecord.conditionBinding={taskPackagePath:input.task.path,taskSha256:semantic,guidePath:guide.path,guideSha256:guide.sha256}
  input.parentSourceRecord=f.put(input.parentSourceRecord.path,parentRecord);f.rows[0].sourceRecord=input.parentSourceRecord
  const parent=get(input.parentDataset.path)
  parent.sourceIndex=f.put(parent.sourceIndex.path,{sampleCount:64,samples:f.rows})
  input.parentDataset=f.put(input.parentDataset.path,parent)
  const guideManifest={...get(input.guideManifest.path),worldId:'world-0',taskId:'task-0',tick:0}
  input.guideManifest=f.put("data/condition-guide-manifest.json",guideManifest)
  const dir=".runtime/ai-painter/ai-assisted-cold-start/candidates/"+r.recordId+"/"
  input.rawSource=f.put(dir+"raw.png",fs.readFileSync(path.join(f.root,input.rawSource.path)))
  input.image=f.put(dir+"target.png",fs.readFileSync(path.join(f.root,input.image.path)))
  r.imagePath=input.image.path
  const normalization={...get(input.normalization.path),candidateId:r.recordId,raw:input.rawSource,normalized:input.image,
    rawSize:{width:1024,height:768},normalizedSize:{width:1024,height:768}}
  input.normalization=f.put(dir+"normalization.json",normalization)
  const prompt={...f.prompt,sourceSampleId:input.parentSampleId,parentDataset:input.parentDataset,parentSourceRecord:input.parentSourceRecord,
    conditionPack:input.conditionPack,generationMethod:"built_in_image_generation_authoritative_guide_only",challengeRegressionInputs:false}
  input.promptEvidence=f.put(dir+"request.json",prompt)
  for(const p of programs) f.put(p,fs.readFileSync(path.join(project,p)))
  // Only the test subprocess intercepts the static ESM dependency. The normal CLI
  // exposes no replacement parent verifier and accepts no caller-supplied approval.
  const fakeSource="import fs from 'node:fs';export async function verifyPublishedCorrectionParent({binding}){"
    +"if(binding.sha256!=="+JSON.stringify(input.parentDataset.sha256)+")throw new Error('rejected fixture parent');"
    +"const manifest=JSON.parse(fs.readFileSync(binding.path)),source=JSON.parse(fs.readFileSync(manifest.sourceIndex.path));return {manifest,source}}"
  const hook = f.put("data/test-hook.mjs",Buffer.from("import {registerHooks} from 'node:module';\n"
    +"registerHooks({resolve(s,c,next){if(s==='./ai-painter-corrected-parent-replay.mjs')return {shortCircuit:true,url:"
    +JSON.stringify("data:text/javascript,"+encodeURIComponent(fakeSource))+"};return next(s,c)}});"))
  const cli = request => {
    f.put("data/input.json",request)
    return spawnSync(process.execPath,["--import",pathToFileURL(path.join(f.root,hook.path)).href,path.join(project,programs[0]),"--request","data/input.json"],{cwd:f.root,encoding:"utf8",timeout:15000})
  }
  return {f,r,input,prompt,normalization,cli}
}

test("guide-only CLI accepts one isolated source and repeats idempotently without qualifying it",async t=>{
 const {f,r,cli}=await scenario(t)
 const a=cli(r);assert.equal(a.status,0,a.stderr)
 const index=JSON.parse(fs.readFileSync(path.join(f.root,f.library,"index.json")))
 assert.equal(index.records.length,1)
 const record=JSON.parse(fs.readFileSync(path.join(f.root,index.records[0].recordPath)))
 const proof=JSON.parse(fs.readFileSync(path.join(f.root,record.sourceCorrection.intakeEvidence.path)))
 assert.equal(proof.schemaVersion,"source-correction-intake-evidence-v2");assert.equal(proof.programBindings.length,5)
 assert.equal(record.status,"ai_assisted_cold_start_intake");assert.equal(proof.trainingQualified,false);assert.equal(record.independentTrainingEligible,false)
 const b=cli(r);assert.equal(b.status,0,b.stderr);assert.equal(JSON.parse(b.stdout).status,"already_intaked")
})

test("guide-only candidate rejects a forged parent, wrong use, facts, guide, condition, source and pixels",async t=>{
 const {f,r,input,prompt,normalization,cli}=await scenario(t)
 function reject(edit,pattern){
  const v=structuredClone(r);edit(v);const result=cli(v)
  assert.equal(result.status,1)
  const latest=JSON.parse(fs.readFileSync(path.join(f.root,".runtime/ai-painter/original-image-intake-rejections/latest.json")))
  assert.match(latest.reason,pattern)
 }
 reject(v=>{v.sourceCorrection.parentDataset.sha256="0".repeat(64)},/fixture parent/)
 reject(v=>{v.sourceCorrection.parentSampleId="validation-0"},/same train/)
 reject(v=>{v.sourceCorrection.worldFacts=input.task},/WorldFacts/)
 reject(v=>{v.sourceCorrection.conditionPack=input.task},/parent condition/)
 const task=JSON.parse(fs.readFileSync(path.join(f.root,input.task.path)))
 reject(v=>{v.sourceCorrection.task=f.put(input.task.path,{...task,tick:9})},/canonical task payload/)
 f.put(input.task.path,task)
 const channel=JSON.parse(fs.readFileSync(path.join(f.root,input.conditionPack.path))).channels[0]
 const plane=fs.readFileSync(path.join(f.root,channel.path))
 f.put(channel.path,Buffer.concat([plane,Buffer.from([1])]))
 reject(()=>{},/SHA mismatch/)
 f.put(channel.path,plane)
 reject(v=>{v.sourceCorrection.guide=input.image},/guide differs/)
 reject(v=>{v.sourceCorrection.promptEvidence=f.put(input.promptEvidence.path,{...prompt,toolReferenceImages:[input.guide.path,input.image.path]})},/same-sample guide/)
 f.put(input.promptEvidence.path,prompt)
 reject(v=>{v.aiAssistedColdStart.policyVersion="AI-PAINTER-DATA-PROVENANCE-1.8"},/current source policy/)
 reject(v=>{v.source.thirdPartyContentUsed=true},/provenance/)
 reject(v=>{v.sourceCorrection.editTarget=input.image},/edit target/)
 const wrong=await sharp({create:{width:1024,height:768,channels:3,background:"red"}}).png().toBuffer()
 reject(v=>{
  v.sourceCorrection.image=f.put(input.image.path,wrong)
  v.sourceCorrection.normalization=f.put(input.normalization.path,{...normalization,normalized:v.sourceCorrection.image})
 },/actual target pixels/)
 const unchanged=JSON.parse(fs.readFileSync(path.join(f.root,f.library,"index.json")))
 assert.equal(unchanged.records.length,0)
})
