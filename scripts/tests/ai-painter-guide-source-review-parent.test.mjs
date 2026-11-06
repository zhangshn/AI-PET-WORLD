import assert from "node:assert/strict"
import {createHash} from "node:crypto"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import {spawnSync} from "node:child_process"
import {fileURLToPath,pathToFileURL} from "node:url"
import test from "node:test"

const self=fileURLToPath(import.meta.url),project=path.resolve(path.dirname(self),"../..")
const digest=b=>createHash("sha256").update(b).digest("hex")
const program="scripts/lib/ai-painter-guide-source-review.mjs",oldReviewer="a7e51c58ad35ca260d79bb23624e8baab37002decb07e4b282312b72beeaced2"
const mod=n=>import(pathToFileURL(path.join(project,n)).href)
async function exercise(){
 const {registerHooks}=await import("node:module")
 const {createReader}=await mod("scripts/lib/ai-painter-stage4-dataset-audit.mjs")
 const {appendAiPainterProgramEvent}=await mod("scripts/lib/ai-painter-program-event-store.mjs")
 const {indexArtifact,openStorageCatalog}=await mod("scripts/lib/ai-pet-world-storage-catalog.mjs")
 const {THRESHOLD}=await mod("scripts/lib/ai-painter-source-correction-review-v1.mjs")
 const root=process.cwd(),id="test-source-parent",directory="data/world-samples/original-image-library/natural-home-v1/complete-maps/"+id
 const ref=p=>{const b=fs.readFileSync(p);return {path:p,sha256:digest(b),bytes:b.length}}
 const write=(p,bytes)=>{fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,bytes);return ref(p)}
 const put=(p,obj)=>write(p,Buffer.from(JSON.stringify(obj,null,2)+"\n"))
 const checks={style:{passed:false,issues:[{code:"style_x"}]},condition:{passed:true,issues:[]},frame:{passed:true,issues:[]}}
 const mock={
  "./ai-painter-source-correction-intake-v2.mjs":"export async function verifyGuideOnlySourceCorrection(){return {verifyStable(){},receipt:globalThis.fixtureReceipt}}",
  "./ai-assisted-style-fingerprint.mjs":"export async function extractStyleFeatures(){return {imageSha256:globalThis.fixtureReceipt.image.sha256}}; export function auditStyleFeatures(){return globalThis.fixtureChecks.style}",
  "./ai-assisted-condition-alignment.mjs":"export async function auditAiAssistedConditionAlignment(){return globalThis.fixtureChecks.condition}",
  "./complete-map-world-frame-integrity.mjs":"export async function auditCompleteMapWorldFrameIntegrity(){return globalThis.fixtureChecks.frame}"
 }
 registerHooks({resolve(s,c,next){if(/\/ai-painter-guide-source-(review|failure)\.mjs$/.test(c.parentURL??"")&&mock[s]){
  return {url:"data:text/javascript,"+encodeURIComponent(mock[s]),shortCircuit:true}
 }return next(s,c)}})
 const {verifyGuideReviewParent,reviewGuideSource}=await mod(program)
 const currentBytes=fs.readFileSync(path.join(project,program));write(program,currentBytes)
 const rulesPath="docs/game-world-generation/REVIEW_AUTOMATION_AND_STORAGE_SPEC.md"
 const rulesRef=write(rulesPath,fs.readFileSync(path.join(project,rulesPath)))
 const rules={path:rulesPath,sha256:rulesRef.sha256}
 write(THRESHOLD.path,fs.readFileSync(path.join(project,THRESHOLD.path)))
 const threshold=JSON.parse(fs.readFileSync(THRESHOLD.path))
 const fixturePaths=[threshold.styleFingerprint,...["conditionAlignment","styleFeatureExtractor"].map(k=>threshold.implementationProvenance[k])]
 // The caller has no authority to alter the bound thresholds or artifact hashes.
 for(const r of fixturePaths)write(r.path,fs.readFileSync(path.join(project,r.path)))
 write("scripts/lib/complete-map-world-frame-integrity.mjs",fs.readFileSync(path.join(project,"scripts/lib/complete-map-world-frame-integrity.mjs")))
 const imagePath=directory+"/source/original.png",image=write(imagePath,"synthetic fixture byte string")
 const request=put(directory+"/request.json",{recordId:id,classification:{},conditionBinding:{},worldBinding:{},aiAssistedColdStart:{}})
 globalThis.fixtureChecks=checks
 const received={schemaVersion:"source-correction-intake-evidence-v2",split:"train",image,conditionPack:image,parentDataset:image,guide:image,worldFacts:image,
   programBindings:[],checkedAtUtc:"2026-11-01T01:00:00.000Z"};globalThis.fixtureReceipt=received
 const intake=put(directory+"/source-intake-evidence.json",received)
 const recordPath=directory+"/record.json",recordObj={recordId:id,recordPath,relativeDirectory:directory,categoryId:"complete-maps",
   sourceCorrection:{schemaVersion:"source-correction-original-record-v1",intakeRequest:request,intakeEvidence:intake},
   originalImage:{path:"source/original.png",sha256:image.sha256},classification:{},conditionBinding:{},worldBinding:{},aiAssistedColdStart:{},
   status:"ai_assisted_cold_start_intake",independentTrainingEligible:false,aiAssistedColdStartEligible:false}
 const record=put(recordPath,recordObj),idx="data/world-samples/original-image-library/natural-home-v1/index.json"
 put(idx,{records:[{recordId:id,recordPath,originalImage:{sha256:image.sha256}}]})
 const evidence=[record,request,intake,image,ref(THRESHOLD.path),rulesRef,{path:program,sha256:oldReviewer,bytes:7199}].sort((a,b)=>a.path.localeCompare(b.path))
 const make=(payload,overrides={})=>{
  const reviewId="source-guide-review-"+digest(JSON.stringify(payload))
  const report={schemaVersion:"ai-assisted-cold-start-machine-review-v1",recordId:id,reviewId,identityPayload:payload,reviewerType:"local_deterministic_program",reviewerProgramPath:program,
    inputImageSha256:image.sha256,reviewRules:rules,styleFingerprintAudit:checks.style,semanticConditionAudit:checks.condition,worldFrameIntegrityAudit:checks.frame,
    evidencePaths:payload.evidencePaths,issues:checks.style.issues,passed:false,status:"review_failed",trainingEligible:false,runtimeEligibility:false,datasetReleased:false,aiAssistedColdStartEligible:false,independentTrainingEligible:false,...overrides}
  return {report,ref:put(directory+"/reviews/machine/"+reviewId+".json",report)}
 }
 const payload={recordId:id,evidencePaths:evidence,parentReview:null,...checks},first=make(payload)
 function commit(item){
  const b=item.ref,r=item.report
  indexArtifact({logicalPath:b.path,physicalUri:fs.realpathSync(b.path),storageLayer:"hot",runId:r.reviewId,artifactType:"source_machine_review",
    byteSize:b.bytes,modifiedAtUtc:fs.statSync(b.path).mtime.toISOString(),sha256:b.sha256})
  appendAiPainterProgramEvent({id:r.reviewId,runId:r.reviewId,action:"review_ai_assisted_cold_start_image",script:program,archiveId:id,evidencePath:b.path,kind:"step_failed",status:"failed"})
 }
 const verify=(parent,overrides={})=>verifyGuideReviewParent({reader:createReader(root),directory,recordId:id,imagePath,imageSha256:image.sha256,parentReview:parent,checks,...overrides})
 assert.throws(()=>verify(first.ref),/committed artifact/)
 commit(first)
 assert.equal(verify(first.ref).reviewId,first.report.reviewId)
 assert.throws(()=>verify({...first.ref,sha256:"0".repeat(64)}),/SHA mismatch/)
 assert.throws(()=>verify({...first.ref,reviewId:"source-guide-review-"+"0".repeat(64)}),/ID differs/)
 assert.throws(()=>verify({...first.ref,path:directory+"/reviews/machine/../machine/"+path.basename(first.ref.path)}),/noncanonical/)
 assert.throws(()=>verify(first.ref,{imageSha256:"f".repeat(64)}))
 const badState=make(payload,{status:"review_passed",passed:true});assert.throws(()=>verify(badState.ref))
 const fake=make({...payload,style:{passed:true,issues:[]}});assert.throws(()=>verify(fake.ref))
 const foreign=make({...payload,recordId:"other-source"});assert.throws(()=>verify(foreign.ref))
 const unverified=make({...payload,parentReview:{path:first.ref.path,sha256:first.ref.sha256,reviewId:first.report.reviewId}})
 assert.throws(()=>verify(unverified.ref),/legacy reviewer/)
 const fakeIdentity=make(payload,{reviewId:"source-guide-review-"+"a".repeat(64)});assert.throws(()=>verify(fakeIdentity.ref))
 const good=make(payload);assert.deepEqual(good,first)
 const firstBytes=fs.readFileSync(first.ref.path),child=await reviewGuideSource({recordId:id,parentReview:first.ref})
 assert.equal(child.parentReviewId,first.report.reviewId);assert.deepEqual(child.identityPayload.parentReview,{path:first.ref.path,sha256:first.ref.sha256,reviewId:first.report.reviewId})
 assert.notEqual(child.reviewId,first.report.reviewId);assert.equal(child.status,"review_failed")
 const failure=child.failureCase;assert.equal(failure.ledgerEventId,child.reviewId+"-failure-case");assert.equal(JSON.parse(fs.readFileSync(failure.observation.path)).parentReviewId,first.report.reviewId)
 const shaped={path:child.reviewPath,sha256:child.reviewSha256,reviewId:child.reviewId};assert.equal(verify(shaped).reviewId,child.reviewId)
 const childBytes=fs.readFileSync(shaped.path)
 const fakeSelf=JSON.parse(childBytes)
 fakeSelf.identityPayload.parentReview=shaped;fakeSelf.identityPayload.parentReviewId=shaped.reviewId
 fakeSelf.parentReviewId=shaped.reviewId
 const altered=put(shaped.path,fakeSelf)
 assert.throws(()=>verify(altered),/content identity differs/)
 fs.writeFileSync(shaped.path,childBytes)
 const priorIndex=JSON.parse(fs.readFileSync(idx));priorIndex.records.push({recordId:"unrelated-record"})
 put(idx,priorIndex)
 const duplicate=await reviewGuideSource({recordId:id,parentReview:{path:first.ref.path,sha256:first.ref.sha256}})
 assert.equal(duplicate.reviewId,child.reviewId);assert.equal(duplicate.reviewSha256,child.reviewSha256);assert.deepEqual(duplicate.failureCase,failure)
 assert.deepEqual(fs.readFileSync(first.ref.path),firstBytes);assert.deepEqual(fs.readFileSync(child.reviewPath),childBytes)
 const db=openStorageCatalog();assert.equal(db.prepare("select count(*) n from program_events where event_id=?").get(child.reviewId).n,1)
 const forged=make({...child.identityPayload,parentReviewId:null});assert.throws(()=>verify(forged.ref))
 assert.throws(()=>verify({...shaped,path:shaped.path.replace(id,"other-source")}),/noncanonical/)
 const third=await reviewGuideSource({recordId:id,parentReview:shaped})
 assert.equal(third.parentReviewId,child.reviewId);assert.equal(third.failureCase.caseId,failure.caseId)
 assert.notEqual(third.failureCase.observation.path,failure.observation.path)
 assert.equal(db.prepare("select count(*) n from program_events where event_id=?").get(failure.ledgerEventId).n,1)
 globalThis.fixtureChecks={...checks,style:{passed:true,issues:[]}}
 const passed=await reviewGuideSource({recordId:id})
 assert(passed.passed);assert.equal(passed.parentReviewId,null);assert(!Object.hasOwn(passed,"failureCase"))
 assert.equal(db.prepare("select count(*) n from program_events where event_id=?").get(passed.reviewId+"-failure-case").n,0)
 console.log("isolated native program events and artifacts verified; genuine parent, two generations, unchanged source bytes, 1 idempotent child event, failure capture, tampering all checked")
}

if(process.argv[2]==="--fixture"){await exercise()}
else test("only a committed, reproduced, canonical same-source parent can acquire an idempotent child",()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),"guide-review-parent-"))
 try{
  const result=spawnSync(process.execPath,[self,"--fixture"],{cwd:root,env:{...process.env,AI_PET_WORLD_DATA_ROOT:path.join(root,"private-storage")},encoding:"utf8",timeout:30000})
  assert.equal(result.status,0,result.stdout+result.stderr)
 }finally{assert(path.dirname(root)===path.resolve(os.tmpdir())&&path.basename(root).startsWith("guide-review-parent-"));fs.rmSync(root,{recursive:true})}
})
