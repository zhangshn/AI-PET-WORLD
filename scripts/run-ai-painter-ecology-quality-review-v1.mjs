// A child of the existing native Job, not an independently owned background.
// Python inference and unchanged JS machine audits share one review deadline.
import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import {fileURLToPath} from 'node:url'
import path from 'node:path'
import sharp from 'sharp'
import {loadContext,inside,read,json,bind,write,CAPABILITY,EXECUTION_PROFILE}
 from './lib/ai-painter-ecology-quality-package-chain-v1.mjs'
import {auditAiAssistedConditionAlignment} from './lib/ai-assisted-condition-alignment.mjs'
import {auditMvp256DetailSufficiency} from './lib/ai-painter-mvp-detail-sufficiency-v1.mjs'
import {auditProfessionalAestheticFromFrozenContract} from './lib/ai-painter-stage4-v2-machine-review-execution-v1.mjs'
import {decodeV17ResponsibilityArtifact} from './lib/ai-painter-stage4-mvp-v17-responsibility-artifact.mjs'
import {decideMvp256DryReview} from './lib/ai-painter-mvp256-dry-review-decision-v1.mjs'

export async function auditReviewCore(ready,reportBinding){
 const {root,plan,packageBinding}=ready,output=plan.outputRoot+'/dry-review'
 const report=json(root,reportBinding),candidate=json(root,plan.sourceCandidate),scope=json(root,candidate.frozenBindings.dryScope)
 assert.equal(report.schema,'ecology-regime-native-review-input-v1');assert.equal(report.capabilityVersion,CAPABILITY)
 assert.equal(report.executionProfile,EXECUTION_PROFILE);assert.deepEqual(report.executionPackage,packageBinding)
 assert.equal(report.modelForwardCalls,16);assert.equal(report.optimizerSteps,0);assert.equal(report.gpuInitialized,false)
 const ids=json(root,plan.validationSplit).sampleIds;
 assert.ok(Array.isArray(report.validationImages)&&report.validationImages.length===8);
 assert.deepEqual(report.validationImages.map(row=>row.sampleId),ids);
 assert.deepEqual(report.validationImages.map(row=>row.binding),report.artifacts);
 for(const row of report.validationImages){
  assert.equal(row.split,'validation');assert.equal(row.epoch,12);assert.equal(row.optimizerStep,576);
  assert.equal(row.purpose,'prediction');assert.deepEqual(row.checkpoint,report.selectedCheckpoint);
  read(root,row.binding);read(root,row.condition);read(root,row.originalRgb);
 }
 assert.equal(report.subject.sampleId,candidate.scope.subjectSampleId);assert.equal(report.subject.split,'validation')
 for(const key of ['worldId','regionId','tick','factHash','conditionPack'])assert.deepEqual(report.subject[key],scope.preselectedSubject[key])
 const roles=decodeV17ResponsibilityArtifact({archiveBytes:read(root,report.responsibility.archive),evidence:report.responsibility.evidence,
  expectedIdentity:{worldId:report.subject.worldId,regionId:report.subject.regionId,tick:report.subject.tick,factHash:report.subject.factHash,
   visualFactManifestSha256:report.subject.visualFactManifestSha256,conditionPackSha256:report.subject.conditionPack.sha256,
   modelStateSha256:report.subject.modelStateSha256},schemaBytes:read(root,report.responsibility.interface),
  schemaSha256:report.responsibility.interface.sha256,candidatePackSchemaVersion:json(root,report.responsibility.interface).candidatePackSchemaVersion})
 const bytes=read(root,report.candidateRgb),metadata=await sharp(bytes).metadata()
 assert.deepEqual([metadata.width,metadata.height],[256,192])
 // The unchanged 1024 condition auditor needs this projection only; it is not
 // a model output, a higher-resolution qualification, or a Runtime frame.
 const projection=write(root,output+'/auditor-input-1024.png',await sharp(bytes).resize(1024,768,{kernel:'nearest'}).png().toBuffer())
 const thresholds=json(root,candidate.frozenBindings.numericReview),manifest=json(root,plan.datasetManifest)
 const source=json(root,manifest.sourceIndex),rows=source.samples.filter(row=>row.sampleId===report.subject.sampleId)
 assert.equal(rows.length,1);const row=rows[0]
 assert.equal(row.split,'validation');assert.deepEqual(row.image,report.subject.referenceRgb)
 const detail=await auditMvp256DetailSufficiency({candidatePath:inside(root,report.candidateRgb.path),referencePath:inside(root,row.image.path),
  contract:json(root,candidate.frozenBindings.detailReview)})
 const aesthetic=await auditProfessionalAestheticFromFrozenContract({imagePath:inside(root,report.candidateRgb.path),thresholdContract:thresholds,
  styleFingerprintPath:inside(root,thresholds.styleFingerprint.path),expectedStyleFingerprintSha256:thresholds.styleFingerprint.sha256})
 const alignment=await auditAiAssistedConditionAlignment({record:{recordId:plan.runId+'-dry-review',
  conditionBinding:{conditionPackPath:report.subject.conditionPack.path,worldId:report.subject.worldId,tick:report.subject.tick},
  classification:{monsoonSeason:row.monsoonSeason,regionalLandscapeType:null}},imagePath:inside(root,projection.path),referenceImagePath:inside(root,row.image.path)})
 const decision=decideMvp256DryReview({scope:scope.preselectedSubject,candidate:{sampleId:report.subject.sampleId,split:'validation',resolution:[256,192]},
  detail,aesthetic,alignment,responsibilityRoleCount:roles.roleOrder.length})
 assert.equal(typeof report.validationImprovedWithoutMeanRgbRegression,'boolean')
 if(!report.validationImprovedWithoutMeanRgbRegression){
  decision.status='dry_single_world_review_failed_closed';decision.issueCodes.push('validation_not_improved_without_mean_rgb_regression')
 }
 return write(root,output+'/machine-audit-core.json',{...decision,schema:'ecology-regime-machine-audit-core-v1',
  capabilityVersion:CAPABILITY,executionProfile:EXECUTION_PROFILE,runId:plan.runId,packageId:plan.packageId,
  selectedCheckpoint:report.selectedCheckpoint,executionPackage:packageBinding,input:reportBinding,validationImages:report.validationImages,
  validationImprovedWithoutMeanRgbRegression:report.validationImprovedWithoutMeanRgbRegression,detail,aesthetic,alignment})
}

export async function runReview(packageBinding,terminalBinding,{root=process.cwd()}={}){
 const started=Date.now(),spec=json(root,packageBinding)
 const ready=loadContext({projectRoot:root,packageIdentity:spec.packageIdentity,capabilityVersion:spec.capabilityVersion,
  outputRoot:spec.outputRoot,inputEvidence:spec.inputEvidence})
 assert.deepEqual(ready.packageBinding,packageBinding)
 assert.equal(terminalBinding.path,ready.plan.outputRoot+'/worker-terminal.json');read(root,terminalBinding)
 const remaining=120000-(Date.now()-started)-1000
 assert.ok(remaining>0,'review setup deadline exhausted')
 const result=spawnSync(inside(root,'ml/ai-painter/.venv/Scripts/python.exe'),['-B',inside(root,ready.plan.programBindings.reviewWorker.path),
  '--package',packageBinding.path,'--sha256',packageBinding.sha256,'--terminal',terminalBinding.path,'--terminal-sha256',terminalBinding.sha256],
  {cwd:root,env:{...process.env,CUDA_VISIBLE_DEVICES:'-1'},windowsHide:true,timeout:remaining,maxBuffer:8*1024**2,encoding:'utf8'})
 if(result.error)throw result.error
 assert.equal(result.status,0,result.stderr?.slice(-4096))
 const report=JSON.parse(result.stdout)
 assert.equal(report.path,ready.plan.outputRoot+'/dry-review/cpu-review.json')
 assert.ok(Date.now()-started<120000,'review inference deadline exhausted')
 return auditReviewCore(ready,report)
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2),names=['--package','--sha256','--terminal','--terminal-sha256']
 assert.equal(args.length,8)
 const values={}
 for(let i=0;i<args.length;i+=2){assert.ok(names.includes(args[i])&&!Object.hasOwn(values,args[i]));values[args[i]]=args[i+1]}
 const result=await runReview({path:values['--package'],sha256:values['--sha256']},
  {path:values['--terminal'],sha256:values['--terminal-sha256']})
 process.stdout.write(JSON.stringify(result)+'\n')
}
