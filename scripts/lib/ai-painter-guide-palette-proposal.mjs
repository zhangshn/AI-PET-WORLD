import assert from "node:assert/strict"
import {createHash} from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import {createReader} from "./ai-painter-stage4-dataset-audit.mjs"
import {verifyAiPainterProgramEventCommitted} from "./ai-painter-program-event-store.mjs"
import {openStorageCatalog} from "./ai-pet-world-storage-catalog.mjs"
import {verifyGuideReviewParent} from "./ai-painter-guide-source-review.mjs"
import {THRESHOLD} from "./ai-painter-source-correction-review-v1.mjs"
import {auditStyleFeatures, buildStyleFingerprintModel, extractStyleFeatures} from "./ai-assisted-style-fingerprint.mjs"
import {auditAiAssistedConditionAlignment} from "./ai-assisted-condition-alignment.mjs"
import {auditCompleteMapWorldFrameIntegrity} from "./complete-map-world-frame-integrity.mjs"

const base = ".runtime/ai-painter/ai-assisted-cold-start/source-failure-cases/"
const styleIssue = "style_fingerprint_outside_approved_envelope"
const pair = ({path,sha256}) => ({path,sha256})
const mean = xs => xs.reduce((s,x) => s + x, 0) / xs.length
const digest = obj => createHash("sha256").update(JSON.stringify(obj)).digest("hex")

function percentile(values, q) {
  const sorted = [...values].sort((a,b) => a-b), at = q * (sorted.length-1)
  return sorted[Math.floor(at)] + (at % 1) * (sorted[Math.ceil(at)] - sorted[Math.floor(at)])
}

// Each term sums back to the auditor's mean normalized RMS distance. Support
// for a color instruction comes from its signed raw frequency, not its squared distance.
function paletteAttribution(features, fingerprint, audit) {
  const names = features.featureNames, vector = features.vector
  const {scale} = fingerprint.model.normalization
  const neighbors = audit.metrics.nearestApprovedRecordIds.map(id => {
    const reference = fingerprint.positiveSamples.filter(x => x.recordId === id)
    assert.equal(reference.length, 1)
    const values = reference[0].features.vector
    const z = vector.map((v,i) => (v-values[i])/scale[i])
    return {values,z,distance:Math.sqrt(mean(z.map(x => x*x)))}
  })
  assert.equal(neighbors.length, 3)
  const distance = mean(neighbors.map(n => n.distance))
  assert(distance > 0 && Math.abs(distance - audit.metrics.nearestApprovedDistance) <= 0.00000051)
  const terms = names.map((_,i) => mean(neighbors.map(n => n.distance ? n.z[i]**2/(names.length*n.distance) : 0)))
  assert(Math.abs(terms.reduce((s,n) => s+n,0) - distance) < 1e-10)
  const bins = []
  for (const [i,name] of names.entries()) {
    if (!/^color_hist_\d{2}$/.test(name)) continue
    const bin = Number(name.slice(-2))
    assert(bin < 64)
    const values = fingerprint.positiveSamples.map(x => x.features.vector[i])
    const low = percentile(values,0.1), high = percentile(values,0.9)
    const nearestMean = mean(neighbors.map(n => n.values[i]))
    const direction = vector[i] > high && vector[i] > nearestMean ? "reduce"
      : vector[i] < low && vector[i] < nearestMean ? "increase" : "no_direction"
    const rgbRanges = [bin >> 4,(bin >> 2)&3,bin&3].map(n => [n*64,n*64+63])
    bins.push({feature:name,rgbRanges,fraction:vector[i],approvedP10:low,approvedP90:high,
      nearestApprovedMean:nearestMean,distanceShare:terms[i]/distance,direction})
  }
  assert.equal(bins.length, 64)
  bins.sort((a,b) => b.distanceShare-a.distanceShare || a.feature.localeCompare(b.feature))
  return {nearestApprovedRecordIds:audit.metrics.nearestApprovedRecordIds,dimensions:names.length,
    distance,paletteDistanceShare:bins.reduce((s,b) => s+b.distanceShare,0),bins}
}

function instructions(bin) {
  const range = bin.rgbRanges.map(([lo,hi]) => `${lo}–${hi}`).join(" / ")
  const color = ({color_hist_40:"黄橄榄色",color_hist_56:"偏金黄的色块"})[bin.feature] ?? "这一色段"
  return `${bin.direction === "reduce" ? "减少" : "适当增加"}${color}（R/G/B ${range}）覆盖的面积，保持原材料和地形位置。`
}

export async function proposeGuidePaletteCorrection(options) {
  assert.deepEqual(Object.keys(options).sort(),["observation","problem"],"only captured case and observation accepted")
  const {problem,observation} = options
  for (const ref of [problem,observation]) {
    assert.deepEqual(Object.keys(ref).sort(),["path","sha256"])
    assert.match(ref.sha256,/^[a-f0-9]{64}$/)
  }
  const caseId = path.posix.basename(path.posix.dirname(problem.path))
  assert.match(caseId,/^source-failure-[a-f0-9]{64}$/)
  assert.equal(problem.path,base+caseId+"/case.json","noncanonical case path")
  const reviewId = path.posix.basename(observation.path,".json")
  assert.match(reviewId,/^source-guide-review-[a-f0-9]{64}$/)
  assert.equal(observation.path,base+caseId+"/"+reviewId+".json","noncanonical observation path")
  const registered = openStorageCatalog().prepare("SELECT run_id, artifact_type, physical_uri, byte_size, sha256 FROM artifacts WHERE logical_path=?")
  for (const ref of [problem,observation]) {
    const row = registered.get(ref.path)
    assert(row && row.run_id === caseId && row.artifact_type === "source_review_failure_case"
      && row.sha256 === ref.sha256 && row.physical_uri === fs.realpathSync(ref.path)
      && row.byte_size === fs.statSync(ref.path).size,"case artifact does not match its committed identity")
  }
  const reader = createReader(process.cwd())
  const captured = reader.bound(problem), observed = reader.bound(observation)
  assert.equal(captured.schemaVersion,"guide-source-failure-case-v1")
  assert.equal(observed.schemaVersion,"guide-source-failure-observation-v1")
  assert.equal(captured.caseId,caseId); assert.equal("source-failure-"+digest(captured.identity),caseId)
  assert.equal(captured.executionGranted,false)
  assert.deepEqual(observed.problem,problem); assert.equal(observed.sourceEventId,reviewId)
  assert.equal(observed.review.reviewId,reviewId)
  const identity = captured.identity, recordId = identity.recordId
  assert.match(recordId,/^[a-z0-9][a-z0-9_-]{1,95}$/)
  verifyAiPainterProgramEventCommitted({id:reviewId+"-failure-case",runId:caseId,action:"capture_guide_source_review_failure",
    script:"scripts/lib/ai-painter-guide-source-failure.mjs",archiveId:recordId,evidencePath:observation.path,kind:"step_failed",status:"failed"})
  const directory = "data/world-samples/original-image-library/natural-home-v1/complete-maps/"+recordId
  assert.equal(identity.record.path,directory+"/record.json")
  const record = reader.bound(identity.record), intake = reader.bound(record.sourceCorrection.intakeEvidence)
  assert.equal(record.recordId,recordId); assert.equal(intake.schemaVersion,"source-correction-intake-evidence-v2")
  assert.equal(intake.split,"train"); assert.equal(intake.trainingQualified,false)
  const imagePath = directory+"/"+record.originalImage.path
  assert.equal(record.originalImage.sha256,identity.imageSha256)
  assert.equal(intake.image.sha256,identity.imageSha256)
  reader.bytes(imagePath,identity.imageSha256)
  assert.deepEqual(identity.threshold,THRESHOLD)
  const threshold = reader.bound(THRESHOLD), fingerprint = reader.bound(threshold.styleFingerprint)
  assert.deepEqual(identity.fingerprint,threshold.styleFingerprint)
  const extractor = threshold.implementationProvenance.styleFeatureExtractor
  reader.bytes(extractor.path,extractor.sha256)
  assert.deepEqual(buildStyleFingerprintModel(fingerprint.positiveSamples,fingerprint.negativeSamples),fingerprint.model)
  const features = await extractStyleFeatures(imagePath)
  assert.equal(features.imageSha256,identity.imageSha256)
  const style = auditStyleFeatures(features,fingerprint)
  const condition = await auditAiAssistedConditionAlignment({record,imagePath})
  const frame = await auditCompleteMapWorldFrameIntegrity({record,imagePath})
  const review = verifyGuideReviewParent({reader,directory,recordId,imagePath,imageSha256:features.imageSha256,
    parentReview:observed.review,checks:{style,condition,frame}})
  const report = reader.bound(review)
  assert.equal(observed.parentReviewId,report.parentReviewId ?? null)
  assert.deepEqual(identity.rule,report.reviewRules); reader.bytes(identity.rule.path,identity.rule.sha256)
  assert.deepEqual(identity.issueCodes,[styleIssue]); assert.deepEqual(report.issues.map(i => i.code),[styleIssue])
  assert.equal(condition.passed,true); assert.equal(frame.passed,true)
  assert.deepEqual(captured.observations,{stylePassed:false,conditionPassed:true,framePassed:true,styleMetrics:style.metrics})
  assert.deepEqual(captured.invariants,{parentDataset:pair(intake.parentDataset),worldFacts:pair(intake.worldFacts),guide:pair(intake.guide),split:"train"})
  assert.deepEqual(identity.condition,pair(intake.conditionPack))
  for (const field of ["parentDataset","worldFacts","task","guideManifest","guide","promptEvidence","conditionPack"]) {
    const ref = intake[field]
    reader.bytes(ref.path,ref.sha256)
  }
  const originalPrompt = reader.bound(intake.promptEvidence)
  assert.equal(originalPrompt.generationMethod,"built_in_image_generation_authoritative_guide_only")
  assert.deepEqual(originalPrompt.toolReferenceImages,[intake.guide.path])
  assert.equal(originalPrompt.sourceSampleId,intake.parentSampleId)
  const pack = reader.bound(intake.conditionPack)
  assert.equal(pack.channels.length,23)
  const attribution = paletteAttribution(features,fingerprint,style)
  const selected = attribution.bins.filter(b => b.direction !== "no_direction").slice(0,2)
  const directives = selected.map(instructions)
  reader.verifyStable()
  return {schema:"guide-palette-proposal-v1",status:"inconclusive",executionGranted:false,caseId,review,problem,observation,
    calibration:{threshold:THRESHOLD,fingerprint:threshold.styleFingerprint,extractor,metrics:style.metrics,
      approvedCount:fingerprint.positiveSamples.length,rejectedCount:fingerprint.negativeSamples.length,
      scope:"失败图仅用于数值诊断，校准仅使用已绑定的特征向量；直方图不能定位产生偏色的物体。"},
    attribution,repairInstructions:directives,
    invariants:{split:"train",parentSampleId:intake.parentSampleId,parentDataset:intake.parentDataset,
      worldFacts:intake.worldFacts,task:intake.task,conditionPack:intake.conditionPack,guideManifest:intake.guideManifest,guide:intake.guide,
      worldId:pack.worldId,tick:pack.tick,originalPrompt:intake.promptEvidence,
      objectInstances:pack.objectInstanceTable.map(({value,objectId,kind,footprint})=>({value,objectId,kind,footprint}))},
    candidatePrompt:directives.length ? {referenceImages:[intake.guide.path],
      text:[originalPrompt.prompt,"只调整全图配色。"+directives.join(""),"保持原引导图内的道路走向、边界接点、每个石块与植被的位置、范围和可辨轮廓。"].join("\n")} : null,
    comparison:{baseline:review,measure:"使用同一阈值、指纹及实现比较全图风格距离和拒绝样式分离率；同时重做原条件响应和完整画幅审核。",
      acceptedOnlyIf:"三个原分项均通过。仅相对距离改善不足以通过。来源通过后仍需独立数据发布。"},
    stopConditions:["未验证适用于来源动作的策略登记、能力版本、累计预算与生成传输时停止在建议。","预算耗尽或外部调用结果不明时保留尝试，不重发。",
      "无一致方向的颜色项时不产生提示；输入身份、规则或校准不一致时拒绝。","后继仍未通过则保留新失败，不据此自动继续生成。"]}
}
