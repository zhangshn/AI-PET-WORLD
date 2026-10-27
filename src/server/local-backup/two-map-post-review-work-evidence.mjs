import assert from 'node:assert/strict'

export function readTwoMapPostReviewWorkEvidence({terminal,read}) {
 if(terminal.schemaVersion!=='ai-painter-two-map-post-review-terminal-v1')return null
 assert.ok(['completed','failed_closed'].includes(terminal.executionState))
 for(const k of ['formalQualificationGranted','checkpointPromotable','runtimePublicationAllowed','automaticNextTraining'])assert.equal(terminal[k],false)
 assert.equal(terminal.optimizerUpdates,0);assert.equal(terminal.gpuInitialized,false)
 const pkg=read(terminal.executionPackage.path,terminal.executionPackage.sha256)
 assert.equal(pkg.value.schemaVersion,'ai-painter-two-map-post-review-package-v1')
 assert.equal(pkg.value.reviewId,terminal.runId);assert.equal(terminal.packageId,terminal.runId)
 assert.deepEqual(pkg.value.sourceTerminal,terminal.sourceTerminal)
 const source=read(terminal.sourceTerminal.path,terminal.sourceTerminal.sha256)
 assert.equal(source.value.runId,terminal.sourceRunId);assert.equal(source.value.executionState,'completed')
 if(terminal.executionState==='failed_closed'){
  assert.equal(terminal.status,'post_training_review_execution_failed');assert.equal(terminal.visualOutcome,'unknown')
  return {pkg,source,report:null,executionResult:'failed',failedSamples:null,issueCodes:[]}
 }
 const report=read(terminal.report.path,terminal.report.sha256)
 assert.equal(terminal.report.path,pkg.value.outputRoot+'/review.json')
 assert.equal(report.value.schemaVersion,'ai-painter-two-map-post-review-result-v1')
 assert.equal(report.value.reviewId,terminal.runId);assert.deepEqual(report.value.executionPackage,terminal.executionPackage)
 assert.deepEqual(report.value.sourceTerminal,terminal.sourceTerminal);assert.equal(report.value.visualOutcome,terminal.visualOutcome)
 assert.deepEqual(report.value.sourceCheckpoint,pkg.value.sourceCheckpoint)
 const inference=read(report.value.inference.path,report.value.inference.sha256).value
 assert.equal(report.value.inference.path,pkg.value.outputRoot+'/inference.json')
 assert.equal(inference.reviewId,terminal.runId);assert.deepEqual(inference.executionPackage,terminal.executionPackage)
 assert.deepEqual(inference.sourceCheckpoint,pkg.value.sourceCheckpoint)
 assert.deepEqual(inference.actualCalls,{generatorForwards:10,criticForwards:0,optimizerAttempts:0,autogradAttempts:0,cudaAttempts:0})
 assert.deepEqual(inference.stateBefore,inference.stateAfter);assert.equal(inference.optimizerUpdates,0);assert.equal(inference.gpuInitialized,false)
 for(const k of ['formalQualificationGranted','checkpointPromotable','runtimePublicationAllowed','automaticNextTraining'])assert.equal(report.value[k],false)
 const rows=report.value.audits;assert.equal(rows.length,10)
 assert.deepEqual(rows.map(r=>r.sampleId),[...pkg.value.trainSampleIds,...pkg.value.validationSampleIds])
 assert.deepEqual(inference.observations.map(r=>r.sampleId),rows.map(r=>r.sampleId))
 const failures=rows.filter(r=>!r.passed)
 assert.equal(terminal.visualOutcome,failures.length?'failed':'component_checks_passed_not_qualified')
 assert.equal(terminal.status,failures.length?'post_training_visual_review_failed':'post_training_component_checks_passed_not_qualified')
 for(const [index,row] of rows.entries()){
  assert.equal(typeof row.passed,'boolean');assert.equal(row.passed,row.issueCodes.length===0)
  assert.equal(row.split,index<2?'train':'validation')
  const detail=read(row.evidence.path,row.evidence.sha256).value
  assert.equal(detail.sampleId,row.sampleId);assert.equal(detail.split,row.split)
  assert.deepEqual(detail.prediction,inference.observations[index].prediction)
  assert.deepEqual(detail.reference,inference.observations[index].identity.image)
  assert.deepEqual(detail.condition,inference.observations[index].identity.conditionPack)
  assert.deepEqual(row.issueCodes,[...detail.detail.issueCodes,...detail.aesthetic.issues.map(i=>i.code),...detail.alignment.issues.map(i=>i.code)])
  assert.equal(row.passed,detail.detail.passed&&detail.aesthetic.passed&&detail.alignment.passed)
 }
 assert.deepEqual(report.value.issueCodes,[...new Set(failures.flatMap(r=>r.issueCodes))])
 return {pkg,source,report,executionResult:'succeeded',failedSamples:failures.length,issueCodes:report.value.issueCodes}
}
