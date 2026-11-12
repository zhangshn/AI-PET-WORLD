import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { createHash, randomUUID } from "node:crypto"
import { createReader } from "./ai-painter-stage4-dataset-audit.mjs"
import { verifyGuideReviewParent } from "./ai-painter-guide-source-review-parent.mjs"
import { auditStyleFeatures, extractStyleFeatures } from "./ai-assisted-style-fingerprint.mjs"
import { auditAiAssistedConditionAlignment } from "./ai-assisted-condition-alignment.mjs"
import { auditCompleteMapWorldFrameIntegrity } from "./complete-map-world-frame-integrity.mjs"
import { THRESHOLD } from "./ai-painter-source-correction-review-v1.mjs"
import { appendAiPainterProgramEvent } from "./ai-painter-program-event-store.mjs"
import { indexArtifact } from "./ai-pet-world-storage-catalog.mjs"

const base = ".runtime/ai-painter/ai-assisted-cold-start/source-failure-cases"
const program = "scripts/lib/ai-painter-guide-source-failure.mjs"
const sha = bytes => createHash("sha256").update(bytes).digest("hex")
const pair = ({path,sha256}) => ({path,sha256})

function saveCaseFile(logical, runId, value, artifactType = "source_review_failure_case") {
  const bytes = Buffer.from(JSON.stringify(value,null,2)+"\n")
  const temp = logical+"."+randomUUID()+".tmp"
  fs.writeFileSync(temp,bytes,{flag:"wx",flush:true})
  try {
    try { fs.linkSync(temp,logical) }
    catch (e) { if (e.code !== "EEXIST") throw e }
    const stat = fs.lstatSync(logical)
    assert(stat.isFile() && !stat.isSymbolicLink() && fs.readFileSync(logical).equals(bytes),"immutable case conflicts")
    indexArtifact({logicalPath:logical,physicalUri:fs.realpathSync(logical),storageLayer:"hot",
      artifactType,runId,byteSize:bytes.length,modifiedAtUtc:stat.mtime.toISOString(),sha256:sha(bytes)})
  } finally { fs.unlinkSync(temp) }
  return {path:logical,sha256:sha(bytes)}
}

// Capture evidence only. Execution needs a separately registered capability, strategy and budget.
export async function captureGuideSourceFailure({recordId,reviewPath,reviewSha256}) {
  assert(/^[a-z0-9][a-z0-9_-]{1,95}$/.test(recordId),"invalid source id")
  const directory = "data/world-samples/original-image-library/natural-home-v1/complete-maps/"+recordId
  const reader = createReader(process.cwd()),recordPath=directory+"/record.json",record=reader.json(recordPath)
  assert.equal(record.recordPath,recordPath); assert.equal(record.recordId,recordId)
  const intake=reader.bound(record.sourceCorrection.intakeEvidence)
  assert.equal(intake.schemaVersion,"source-correction-intake-evidence-v2")
  assert.equal(intake.split,"train"); assert.equal(intake.image.sha256,record.originalImage.sha256)
  const imagePath=directory+"/"+record.originalImage.path
  reader.bytes(imagePath,intake.image.sha256)
  const threshold=reader.bound(THRESHOLD), fingerprint=reader.bound(threshold.styleFingerprint)
  const features=await extractStyleFeatures(imagePath)
  assert.equal(features.imageSha256,intake.image.sha256)
  const style=auditStyleFeatures(features,fingerprint)
  const condition=await auditAiAssistedConditionAlignment({record,imagePath})
  const frame=await auditCompleteMapWorldFrameIntegrity({record,imagePath})
  const parentReview={path:reviewPath,sha256:reviewSha256}
  const receipt=verifyGuideReviewParent({reader,directory,recordId,imagePath,imageSha256:features.imageSha256,
    parentReview,checks:{style,condition,frame}})
  const review=reader.bound(receipt)
  assert.equal(review.status,"review_failed","no failure case for a successful review")
  const codes=[...new Set(review.issues.map(issue=>issue.code))].sort()
  assert(codes.length>0 && codes.every(code=>typeof code==="string" && code.length>0))
  const identity={recordId,record:pair(reader.receipts().find(r=>r.path===recordPath)),imageSha256:features.imageSha256,
    condition:pair(intake.conditionPack),rule:review.reviewRules,threshold:THRESHOLD,fingerprint:threshold.styleFingerprint,issueCodes:codes}
  const caseId="source-failure-"+sha(JSON.stringify(identity))
  const root=fs.realpathSync(".runtime")
  for(const segment of ["ai-painter","ai-painter/ai-assisted-cold-start",base.slice(9),base.slice(9)+"/"+caseId]){
    const dir=path.join(".runtime",segment)
    fs.mkdirSync(dir,{recursive:true})
    assert.equal(fs.realpathSync(dir),path.join(root,segment),"case directory escaped runtime")
  }
  reader.verifyStable()
  const folder=base+"/"+caseId
  const styleOnly=codes.length===1 && codes[0]==="style_fingerprint_outside_approved_envelope" && condition.passed && frame.passed
  const problem=saveCaseFile(folder+"/case.json",caseId,{schemaVersion:"guide-source-failure-case-v1",caseId,identity,
    affectedRegions:[...new Set(review.issues.map(issue=>issue.affectedRegion))].sort(),
    observations:{stylePassed:style.passed,conditionPassed:condition.passed,framePassed:frame.passed,styleMetrics:style.metrics},
    hypothesis:styleOnly?"A change to the distribution of colors may improve style distance while preserving the guide layout.":null,
    invariants:{parentDataset:pair(intake.parentDataset),worldFacts:pair(intake.worldFacts),guide:pair(intake.guide),split:intake.split},
    executionGranted:false})
  const observation=saveCaseFile(folder+"/"+receipt.reviewId+".json",caseId,{
    schemaVersion:"guide-source-failure-observation-v1",problem,review:receipt,sourceEventId:receipt.reviewId,
    parentReviewId:review.parentReviewId??null})
  const event=appendAiPainterProgramEvent({id:receipt.reviewId+"-failure-case",runId:caseId,
    action:"capture_guide_source_review_failure",kind:"step_failed",status:"failed",script:program,
    archiveId:recordId,currentStep:"source_failure_evidence",evidencePath:observation.path,
    title:"Source review failure recorded",titleZh:"训练来源审核问题已登记",
    detail:"Verified source review; retained failed checks and source invariants.",detailZh:"已绑定原审核、失败分项及不可变世界条件。",
    error:codes[0],finalGameMapSuccess:false,canEnterWorld:false})
  const result = {caseId,problem,observation,ledgerEventId:event.id}
  if (styleOnly) {
    const source = "scripts/lib/ai-painter-guide-palette-proposal.mjs"
    const producer = {path:source,sha256:sha(fs.readFileSync(source))}
    const {proposeGuidePaletteCorrection} = await import("./ai-painter-guide-palette-proposal.mjs")
    let proposal
    try {
      proposal = await proposeGuidePaletteCorrection({problem,observation})
    } catch (error) {
      // The review and case are already committed. Preserve a separate unsuccessful
      // analysis so a missing calibration cannot invalidate the original failure.
      proposal = {schema:"guide-palette-proposal-unavailable-v1",caseId,problem,observation,
        status:"inconclusive",executionGranted:false,reason:String(error.message).slice(0,500)}
    }
    assert.equal(proposal.executionGranted,false)
    const value={producer,proposal}, key=sha(JSON.stringify(value))
    result.paletteProposal=saveCaseFile(folder+"/palette-"+key+".json",caseId,value,"source_palette_proposal")
    const unavailable=proposal.schema==="guide-palette-proposal-unavailable-v1"
    const written=appendAiPainterProgramEvent({id:"source-palette-"+key,runId:caseId,
      action:"prepare_source_palette_proposal",kind:unavailable?"step_failed":"artifact_created",
      status:unavailable?"failed":"info",script:source,archiveId:recordId,currentStep:"source_repair_proposal",
      evidencePath:result.paletteProposal.path,title:"Source palette proposal",titleZh:"训练来源配色建议",
      detail:"Source execution remains separately bounded.",detailZh:unavailable?"无法复核配色依据，已记录原因。":"配色建议已保存，未派发生成。",
      error:unavailable?"palette_evidence_unavailable":null,finalGameMapSuccess:false,canEnterWorld:false})
    result.paletteProposalEventId=written.id
  }
  return result
}
