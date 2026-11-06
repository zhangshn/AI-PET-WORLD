import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'
import {auditAiAssistedConditionAlignment} from './ai-assisted-condition-alignment.mjs'
import {auditMvp256DetailSufficiency} from './ai-painter-mvp-detail-sufficiency-v1.mjs'
import {auditProfessionalAestheticFromFrozenContract} from './ai-painter-stage4-v2-machine-review-execution-v1.mjs'
import {decodeV17ResponsibilityArtifact} from './ai-painter-stage4-mvp-v17-responsibility-artifact.mjs'
import {decideMvp256DryReview} from './ai-painter-mvp256-dry-review-decision-v1.mjs'

const name='stage0-native-256-formal-229'
const run='.runtime/ai-painter/native-stage0-formal-training/'+name
const governance='data/ai-painter/system-governance/'
const source='data/world-samples/ai-assisted-cold-start-dataset-packages/stage4-src64-4c32aee371b5fcaaa36b316199c7e7560892af7c0a5b908cfd6a6d44b4f0e6f7/'
const prior='.runtime/ai-painter/controller-repair-reviews/terrain-ecology-all-samples-079-20261027/'
const old='.runtime/ai-painter/ecology-terrain-detail-weight-quality-executions/terrain-detail-quality-v2-619740d4-4192-49b9-ae23-7d7083f1e95d/dry-review/cpu-review.json'
const fixed=(path,sha256)=>({path,sha256})
const manifest=fixed(source+'manifest.json','499daf40061da91ce1e367ee5c4e3493491b5e5c1701806d8c4246502e73cd23')
const split=fixed(source+'splits/validation.json','257ea164c153236e2855417455fce795bd177c9b5ac38775c438e0db18d48707')
const dryCandidate=fixed(governance+'stage4-mvp256-dry-v24-closed-loop-candidate-v1.json','ec33965acc69ca6f2e2463a6552d6a560489a8e8d2d21c7de77a7153c7d04566')
const originalComparison=fixed(old,'aa523ab5ec01bd772b37957354d47b36bb4e7c72b3e7b1a79553af6be952bce3')
const resizedRegistry=fixed(prior+'report-binding.json','5c8ea243d4d6507385c3110bc14f10b9e32a35d9e6ad9ef22f6b9f00a84dba02')
const interfaceRef=fixed(governance+'stage4-mvp-structured-object-v17-review-pack-schema-v1.json','5bbb8527c272e8f6f44425290569abace6bb86fa81883b54ae5f95f44a84d674')
const roles=['object_footprints','object_tree','object_rock','object_vegetation']
const hash=b=>createHash('sha256').update(b).digest('hex'),isHash=h=>typeof h==='string'&&/^[0-9a-f]{64}$/.test(h)
const json=b=>JSON.parse(b.toString('utf8').replace(/^\uFEFF/,'')),MiB=1024**2
function sources(root){
  const runtime=fs.realpathSync(path.resolve(root,'.runtime')),started=Date.now()
  let bytes=0,reads=0
  function physical(p){
    assert(typeof p==='string'&&p.length<=1000&&!/[\\:\0]/.test(p)&&p.split('/').every(s=>s&&s!=='.'&&s!=='..'),'review path')
    let at=p.startsWith('.runtime/')?runtime:fs.realpathSync(root)
    for(const part of (p.startsWith('.runtime/')?p.slice(9):p).split('/')){
      at=path.join(at,part);assert(!fs.lstatSync(at).isSymbolicLink()&&fs.realpathSync(at)===at,'review file boundary')
    }
    return at
  }
  const raw=(p,limit=4*MiB)=>{
    assert(Date.now()-started<120000&&++reads<=512,'review read deadline or count exceeded')
    const fp=physical(p),s=fs.statSync(fp)
    assert(s.isFile()&&s.nlink===1&&s.size<=limit&&(bytes+=s.size)<=240*MiB,'review read byte bound')
    const data=fs.readFileSync(fp),end=fs.statSync(fp)
    assert.equal(s.ino,end.ino);assert.equal(s.mtimeMs,end.mtimeMs);assert.equal(data.length,s.size)
    return data
  }
  const bound=(b,expected=b?.path,limit)=>{
    assert.equal(b?.path,expected);assert(isHash(b.sha256))
    const bytes=raw(expected,limit);assert.equal(hash(bytes),b.sha256,'review binding '+expected)
    if(b.bytes!==undefined)assert.equal(b.bytes,bytes.length)
    return bytes
  }
  return {physical,raw,bound,get:b=>json(bound(b)),started}
}
export function rankNativeDevelopment(epoch,ids,rows){
  assert(Number.isSafeInteger(epoch)&&Array.isArray(ids)&&ids.length===8&&new Set(ids).size===8)
  assert.deepEqual(rows.map(r=>r.sampleId),ids)
  const counts=Object.fromEntries(roles.map(k=>[k,0]))
  let mae=0,worst=Infinity
  for(const row of rows){
    assert.equal(row.split,'validation');assert.equal(row.epoch,epoch)
    assert(Number.isFinite(row.fullRgbMae)&&row.fullRgbMae>=0&&row.fullRgbMae<=1);mae+=row.fullRgbMae
    assert.deepEqual(Object.keys(row.objectCorrelations).sort(),[...roles].sort())
    for(const k of roles){
      const value=row.objectCorrelations[k]
      if(value===null)continue
      assert(Number.isFinite(value)&&value>=-1&&value<=1);worst=Math.min(worst,value);counts[k]++
    }
  }
  assert(Object.values(counts).every(n=>n>0),'validation missing an entire object class')
  return {epoch,worstApplicableObjectCorrelation:worst,meanValidationRgbMae:mae/8,applicableImageCounts:counts,rank:[worst,-mae/8,-epoch]}
}
function assertRanking(actual,expected){
  for(const [k,v] of Object.entries(expected))assert.deepEqual(actual[k],v,'native fixed-eight metric '+k)
}
export function compareNativeDevelopment(candidate,baseline){
  const checks={meanRgbDoesNotRegress:candidate.meanValidationRgbMae<=baseline.meanValidationRgbMae,
    worstObjectStrictlyImproves:candidate.worstApplicableObjectCorrelation>baseline.worstApplicableObjectCorrelation}
  return {...checks,passed:checks.meanRgbDoesNotRegress&&checks.worstObjectStrictlyImproves}
}
function comparable(s){
  const current=s.get(manifest),ids=s.get(split).sampleIds,index=s.get(current.sourceIndex)
  assert(roles.every(k=>!current.identityPayload.continuousChannelIds.includes(k)),'original object masks require nearest-neighbor sampling')
  const historic=s.get(originalComparison).baseline,oldTerminal=s.get(historic.trainingTerminal),oldPackage=s.get(oldTerminal.executionPackage)
  assert.deepEqual(oldPackage.datasetManifest,current.identityPayload.parentDatasetRelease)
  assert.deepEqual(oldPackage.candidateContract,dryCandidate)
  const oldManifest=s.get(oldPackage.datasetManifest),oldIndex=s.get(oldManifest.sourceIndex)
  assert.deepEqual(s.get(oldPackage.validationSplit).sampleIds,ids)
  const audit=s.get(historic.audit);assert.deepEqual(audit.selectedCheckpoint,historic.checkpoint)
  s.bound(historic.checkpoint,historic.checkpoint.path,32*MiB)
  const review=s.get(resizedRegistry),identityIndex=s.get(review.inputs.find(b=>b.path===prior+'result.json'))
  const samples=ids.map(id=>{
    const currentRows=index.samples.filter(r=>r.sampleId===id),oldRows=oldIndex.samples.filter(r=>r.sampleId===id)
    assert.equal(currentRows.length,1);assert.equal(oldRows.length,1)
    const row=currentRows[0],parent=oldRows[0]
    assert.equal(row.split,'validation');assert.equal(parent.split,'validation')
    for(const k of ['image','conditionPack'])assert.deepEqual({path:row[k].path,sha256:row[k].sha256},{path:parent[k].path,sha256:parent[k].sha256})
    const observed=identityIndex.rows.find(r=>r.sampleId===id&&r.arm==='candidate')
    assert(observed&&observed.split==='validation');assert.equal(observed.identity.image.sha256,row.image.sha256);assert.equal(observed.identity.conditionPack.sha256,row.conditionPack.sha256)
    const rendered=review.resizedReferences.find(b=>b.path===prior+observed.slot+'-target-256.png')
    assert(rendered);return {row,rendered}
  })
  const reference=rankNativeDevelopment(36,ids,historic.rows);assertRanking(historic.selectionCpu,reference)
  assert.equal(reference.meanValidationRgbMae,0.06140733743086457);assert.equal(reference.worstApplicableObjectCorrelation,-0.08459185063838959)
  return {ids,samples,historic,reference}
}
export function readNativeStage0ReviewReferences({root=process.cwd()}={}){
  const {ids,reference,historic}=comparable(sources(root))
  return {source:manifest,split,ids,reference,baselineCpuReport:originalComparison,baselineCheckpoint:historic.checkpoint,subject: 'ai-cold-start-v7-v7-capacity-slot-189-bamboo-grove-v2'}
}
async function rgb(bytes,width,height){
  const im=sharp(bytes,{limitInputPixels:width*height,failOn:'error'}),m=await im.metadata()
  assert.equal(m.format,'png');assert.equal(m.width,width);assert.equal(m.height,height);assert.equal(m.channels,3);assert(!m.hasAlpha)
  return im.raw().toBuffer()
}
async function checkPrediction(s,folder,row,sample,seen){
  assert.equal(row.sourceImage.path,sample.row.image.path);assert.equal(row.sourceImage.sha256,sample.row.image.sha256)
  assert.equal(row.conditionPack.path,sample.row.conditionPack.path);assert.equal(row.conditionPack.sha256,sample.row.conditionPack.sha256)
  s.bound(row.sourceImage);const pack=s.get(row.conditionPack)
  assert(row.image.path.startsWith(folder+'/')&&row.image.path.endsWith('.png')&&!seen.has(row.image.path),'prediction location or duplicate')
  seen.add(row.image.path)
  const candidate=await rgb(s.bound(row.image,row.image.path,MiB),256,192)
  const reference=await rgb(s.bound(sample.rendered,sample.rendered.path,MiB),256,192)
  let sum=0;for(let i=0;i<candidate.length;i++)sum+=Math.abs(candidate[i]-reference[i])
  const byteMae=sum/(255*candidate.length)
  // The actual float predictions are ranked. An 8-bit PNG can differ by at most one quantization level.
  assert(Math.abs(byteMae-row.fullRgbMae)<=1/255+1e-6,'stored prediction and float RGB observation disagree')
  const measured={}
  for(const role of roles){
    const ref=pack.channels.find(c=>c.id===role)
    const source=await sharp(s.bound(ref),{limitInputPixels:1024*768}).greyscale().raw().toBuffer({resolveWithObject:true})
    assert.equal(source.info.width,1024);assert.equal(source.info.height,768);assert.equal(source.info.channels,1)
    let n=0,sx=0,sy=0,sxx=0,syy=0,sxy=0
    for(let y=0;y<192;y++)for(let x=0;x<256;x++){
      if(source.data[(4*y+2)*1024+4*x+2]<=127)continue
      const p=(y*256+x)*3
      const lum=b=>(b[p]*0.2126+b[p+1]*0.7152+b[p+2]*0.0722)/255
      const u=lum(candidate),v=lum(reference)
      n++;sx+=u;sy+=v;sxx+=u*u;syy+=v*v;sxy+=u*v
    }
    assert.equal(row.maskPixels[role],n,'independent object mask size '+role)
    const ex=n?Math.max(0,sxx-sx*sx/n):0,ey=n?Math.max(0,syy-sy*sy/n):0
    const valid=n>=2&&ey>=1e-8,reported=row.objectCorrelations[role]
    assert.equal(reported!==null,valid,'applicability of source target '+role)
    const corr=valid?(sxy-sx*sy/n)/Math.sqrt(ex*ey+1e-8):null
    // The metric operates on float RGB. Bound the displacement of the centered
    // luminance vector after PNG quantization; near-constant candidates have no informative bound.
    const delta=Math.sqrt(n)/255,slack=Math.sqrt(ex)>delta?Math.min(2,2*delta/(Math.sqrt(ex)-delta)):2
    if(valid)assert(Math.abs(corr-reported)<=slack+1e-5,'original class correlation incompatible with PNG '+role)
    measured[role]={pixels:n,applicable:valid,pngCorrelation:corr}
  }
  return {byteMae,measured}
}
async function subjectAudit(s,root,folder,v,src,epoch){
  const c=s.get(dryCandidate),scope=s.get(c.frozenBindings.dryScope).preselectedSubject
  const idx=src.ids.indexOf(scope.sampleId);assert(idx>=0)
  const row=v.rows[idx],reference=src.samples[idx].row,{archive,interface:schema,evidence,subject}=v.responsibility
  assert.deepEqual(fixed(schema.path,schema.sha256),interfaceRef)
  for(const key of ['worldId','regionId','tick','factHash','visualFactManifestSha256'])assert.equal(subject[key],scope[key])
  assert.equal(subject.conditionPackSha256,scope.conditionPack.sha256);assert.equal(subject.conditionPackSha256,row.conditionPack.sha256)
  assert.equal(subject.sampleId,scope.sampleId);assert.equal(subject.split,'validation')
  assert(isHash(subject.modelStateSha256),'invalid responsibility generator identity')
  const schemaBytes=s.bound(schema),tensorBytes=s.bound(archive,folder+'/responsibilities.f32.zlib',16*MiB)
  assert.equal(evidence.tensorArchive.path,archive.path);assert.equal(evidence.tensorArchive.sha256,archive.sha256)
  const decoded=decodeV17ResponsibilityArtifact({archiveBytes:tensorBytes,evidence,expectedIdentity:subject,schemaBytes,schemaSha256:schema.sha256,candidatePackSchemaVersion:json(schemaBytes).candidatePackSchemaVersion})
  const native=s.bound(row.image),transport=s.bound(v.auditProjection,folder+'/auditor-input-1024.png',2*MiB)
  const projected=await sharp(native).resize(1024,768,{kernel:'nearest'}).raw().toBuffer()
  assert(projected.equals(await rgb(transport,1024,768)),'condition auditor projection must be exact nearest-neighbor transport')
  const thresholds=s.get(c.frozenBindings.numericReview);s.bound(thresholds.styleFingerprint,thresholds.styleFingerprint.path,4*MiB)
  const detail=await auditMvp256DetailSufficiency({candidatePath:s.physical(row.image.path),referencePath:s.physical(reference.image.path),contract:s.get(c.frozenBindings.detailReview)})
  const aesthetic=await auditProfessionalAestheticFromFrozenContract({imagePath:s.physical(row.image.path),thresholdContract:thresholds,styleFingerprintPath:s.physical(thresholds.styleFingerprint.path),expectedStyleFingerprintSha256:thresholds.styleFingerprint.sha256})
  // The legacy condition auditor resolves project-logical paths against its actual installation.
  assert.equal(fs.realpathSync(root),fs.realpathSync(process.cwd()),'existing condition auditor is bound to the installed project')
  const pack=s.get(row.conditionPack);assert.equal(pack.channels.length,23);for(const channel of pack.channels)s.bound(channel,channel.path,2*MiB)
  const alignment=await auditAiAssistedConditionAlignment({record:{recordId:name+'-epoch-'+epoch,conditionBinding:{conditionPackPath:row.conditionPack.path,worldId:scope.worldId,tick:scope.tick},
    classification:{monsoonSeason:reference.monsoonSeason,regionalLandscapeType:null}},imagePath:v.auditProjection.path,referenceImagePath:reference.image.path})
  const decision=decideMvp256DryReview({scope,candidate:{sampleId:scope.sampleId,split:'validation',resolution:[256,192]},detail,aesthetic,alignment,responsibilityRoleCount:decoded.roleOrder.length})
  return {scopeId:scope.sampleId,decision,detail,aesthetic,alignment,archive,interface:schema,projection:v.auditProjection,
    numericContract:c.frozenBindings.numericReview,detailContract:c.frozenBindings.detailReview,projectionPurpose:'legacy_auditor_transport_only'}
}

export async function readNativeStage0FormalReview(epoch,{root=process.cwd()}={}){
  assert([12,24].includes(epoch),'only immutable development epochs 12 and 24')
  const s=sources(root),folder=run+'/segments/'+(epoch*2),sealBytes=s.raw(folder+'/seal.json'),seal=json(sealBytes)
  assert.equal(seal.schema,'native-stage0-durable-segment-v1');assert.equal(seal.runId,name)
  assert.equal(seal.segment,epoch*2);assert.equal(seal.endPair,epoch*48)
  const result=json(s.bound(seal.result,folder+'/result.json')),ticket=json(s.bound(seal.ticket,folder+'/ticket.json'))
  const guard=json(s.bound(seal.ownership,folder+'/ownership.json'))
  assert.equal(result.schema,'native-stage0-formal-segment-result-v1');assert.equal(result.runId,name);assert.equal(ticket.runId,name)
  assert.equal(result.phase,'train');assert.equal(result.phase,seal.mode);assert.equal(result.phase,ticket.phase)
  assert.equal(result.policySha256,hash(s.raw(governance+'ai-painter-native-stage0-formal-training-v1.json')))
  assert.equal(ticket.policySha256,result.policySha256);assert.equal(result.segment,seal.segment);assert.equal(result.endPair,seal.endPair)
  assert.deepEqual(result.counts,{generator:epoch*48,discriminator:epoch*48});assert.deepEqual(result.checkpoint,seal.checkpoint)
  assert.deepEqual(result.ticket,seal.ticket);assert.deepEqual(result.checkpointVerification.checkpoint,seal.checkpoint)
  assert.equal(result.checkpointVerification.deviceRngBytesVerified,true)
  assert(guard.ok&&guard.receipt.cleanupConfirmed&&guard.receipt.proof.rootPid===result.workerPid&&guard.receipt.proof.rootPid===seal.workerPid&&
    guard.receipt.proof.activeProcessesAfterCleanup===0&&guard.receipt.proof.exitCode===0,'unreleased or different worker')
  s.bound(seal.checkpoint,folder+'/recovery.pt',40*MiB)
  const v=result.validation;assert.equal(v.epoch,epoch);assert.deepEqual(v.checkpoint,seal.checkpoint)
  assert.equal(v.eligibility,epoch===12?'observation_only':'sole_selection_candidate')
  assert.deepEqual(Object.keys(v.stateBefore).sort(),['adamw','counts','cudaRng','history','modes','networks','rng'])
  assert(Object.values(v.stateBefore).every(isHash));assert.deepEqual(v.stateBefore,v.stateAfter);assert.deepEqual(v.stateAfter,result.stateDigest)
  if(epoch===24){
    assert.equal(result.checkpointVerification.independentCpuReconstruction,true)
    assert(isHash(result.checkpointVerification.generatorStateSha256))
    assert.equal(result.checkpointVerification.generatorStateSha256,v.responsibility.subject.modelStateSha256,'independent restored generator differs')
  }
  const measured=await measureDevelopmentImages(s,root,epoch,folder,v)
  const qualityPassed=epoch===24&&measured.retention.passed&&measured.absolute.decision.status==='dry_single_world_numeric_passed_visual_approval_pending'
  assert(s.raw(folder+'/seal.json').equals(sealBytes)&&hash(s.raw(folder+'/result.json'))===seal.result.sha256&&Date.now()-s.started<120000,'review source changed or deadline exceeded')
  return {...measured,schema:'native-stage0-fixed-development-review-v1',runId:name,epoch,status:epoch===12?'observation_only':qualityPassed?'stage0_quality_passed':'stage0_quality_rejected',
    trainingMayContinue:epoch===12,checkpointEligibleForSelection:epoch===24,qualityPassed,stageAdvanceAllowed:false,worldEntryAllowed:false,
    trainingOutcome:'separately_decided_from_native_training_receipts',checkpoint:seal.checkpoint,segmentSeal:fixed(folder+'/seal.json',hash(sealBytes)),workerResult:seal.result}
}

// CPU-only observations are diagnostic, never an official training verdict. This
// entry accepts only real locally archived component outputs of the fixed run.
export async function inspectNativeStage0ReviewComponent({root=process.cwd(),folder}){
  assert(/^\.runtime\/ai-painter\/controller-repair-reviews\/native-stage0-formal-training-229-20261103\/worker\/cpu-review-component[-a-z0-9]*\/segments\/(24|48)$/.test(folder),'outside component evidence')
  const s=sources(root),v=json(s.raw(folder+'/observation.json')),epoch=Number(folder.split('/').at(-1))/2
  assert.equal(epoch,v.epoch)
  return {scope:'cpu_component_diagnostic',formalRunReviewed:false,...await measureDevelopmentImages(s,root,epoch,folder,v)}
}
async function measureDevelopmentImages(s,root,epoch,folder,v){
  const src=comparable(s),metrics=rankNativeDevelopment(epoch,src.ids,v.rows);assertRanking(v.metrics,metrics)
  const entries=[],seen=new Set()
  for(const [i,row] of v.rows.entries()){
    assert.equal(row.image.path,folder+'/validation-'+String(i).padStart(2,'0')+'.png','fixed image and sample ordering')
    const {byteMae,measured}=await checkPrediction(s,folder,row,src.samples[i],seen),before=src.historic.rows[i]
    const byObject=Object.fromEntries(roles.map(k=>[k,{candidate:row.objectCorrelations[k],baseline:before.objectCorrelations[k],
      difference:row.objectCorrelations[k]===null||before.objectCorrelations[k]===null?null:row.objectCorrelations[k]-before.objectCorrelations[k]}]))
    const worse=roles.filter(k=>byObject[k].difference!==null&&byObject[k].difference<0)
    entries.push({sampleId:row.sampleId,sourceImage:row.sourceImage,conditionPack:row.conditionPack,prediction:row.image,epoch,maskPixels:row.maskPixels,
      floatRgbMae:row.fullRgbMae,pngRgbMae:byteMae,independentMaskReadback:measured,baselineRgbMae:before.fullRgbMae,rgbMaeDelta:row.fullRgbMae-before.fullRgbMae,byObject,
      issues:[...(row.fullRgbMae>before.fullRgbMae?['higher_rgb_mae_than_fixed_baseline']:[]),...worse.map(k=>k+'_correlation_lower')]})
  }
  const retention=compareNativeDevelopment(metrics,src.reference),absolute=epoch===24?await subjectAudit(s,root,folder,v,src,epoch):null
  for(const row of entries){
    if(absolute&&row.sampleId===absolute.scopeId){
      row.absoluteScope='frozen_preselected_dry_subject';row.issues.push(...absolute.decision.issueCodes)
    }else row.absoluteScope=epoch===12?'observation_only':'fixed_eight_metrics_only'
  }
  const issues=[...(!retention.passed?['validation_not_improved_without_mean_rgb_regression']:[]),...(absolute?.decision.issueCodes??[])]
  return {source:manifest,validationSplit:split,metrics,baseline:{source:originalComparison,checkpoint:src.historic.checkpoint,metrics:src.reference},retention,absolute,issues,rows:entries,
    closedSplitsRead:0,independentFinalModelAndRuntimeRelease:'separate_later_qualification',reviewedAtUtc:new Date().toISOString()}
}
