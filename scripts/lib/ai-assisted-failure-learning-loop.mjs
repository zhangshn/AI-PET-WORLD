const ISSUE_DEFINITIONS = {
  condition_terrain_path_ground_coverage_mismatch: {
    family: "terrain_path_topology",
    labelZh: "道路可视覆盖与条件范围不一致",
    repairTarget: "route_coverage_consistency",
  },
  condition_terrain_path_ground_uncontracted_boundary_contact: {
    family: "terrain_path_topology",
    labelZh: "道路接触了条件包未授权的地图边界",
    repairTarget: "route_boundary_contact_consistency",
  },
  condition_terrain_path_ground_spatial_distribution_mismatch: {
    family: "terrain_path_topology",
    labelZh: "道路空间分布与条件范围不一致",
    repairTarget: "route_spatial_distribution_consistency",
  },
  condition_terrain_path_ground_centroid_drift: {
    family: "terrain_path_topology",
    labelZh: "道路可视质心偏离条件质心",
    repairTarget: "route_centroid_consistency",
  },
  condition_terrain_path_ground_required_boundary_contact_missing: {
    family: "terrain_path_topology",
    labelZh: "道路缺少条件要求的地图边界接触",
    repairTarget: "route_required_boundary_contact_consistency",
  },
  condition_terrain_water_coverage_mismatch: {
    family: "hydrology_spatial_alignment",
    labelZh: "水体可视覆盖与条件范围不一致",
    repairTarget: "water_coverage_consistency",
  },
  condition_terrain_water_spatial_distribution_mismatch: {
    family: "hydrology_spatial_alignment",
    labelZh: "水体空间分布与条件范围不一致",
    repairTarget: "water_spatial_distribution_consistency",
  },
  condition_terrain_water_centroid_drift: {
    family: "hydrology_spatial_alignment",
    labelZh: "水体可视质心偏离条件质心",
    repairTarget: "water_centroid_consistency",
  },
  condition_object_footprints_reference_semantic_mismatch: {
    family: "object_semantic_alignment",
    labelZh: "对象占地语义与留出参考不一致",
    repairTarget: "object_footprints_masked_semantics",
  },
  condition_object_tree_reference_semantic_mismatch: {
    family: "object_semantic_alignment",
    labelZh: "树木对象语义与留出参考不一致",
    repairTarget: "object_tree_masked_semantics",
  },
  condition_object_rock_reference_semantic_mismatch: {
    family: "object_semantic_alignment",
    labelZh: "岩石对象语义与留出参考不一致",
    repairTarget: "object_rock_masked_semantics",
  },
  condition_object_vegetation_reference_semantic_mismatch: {
    family: "object_semantic_alignment",
    labelZh: "植被对象语义与留出参考不一致",
    repairTarget: "object_vegetation_masked_semantics",
  },
}

const STAGE4_DIAGNOSTIC_OBJECT_CHANNELS = ["Footprints", "Tree", "Rock", "Vegetation"]
const STAGE4_DIAGNOSTIC_ROUTE_METRICS = [
  "stage4DiagnosticRouteActivationMassRatio",
  "stage4DiagnosticRouteSpatialDistributionL1",
  "stage4DiagnosticRouteCentroidDrift",
  "stage4DiagnosticRouteRequiredBoundaryContactMinimum",
]

export function analyzeFailureLearningLoop({
  review,
  finalization,
  overlay,
  sourcePaths,
  proposedBoundedRepairVersion = "v7_bounded_repair_r3_candidate",
  repairProfile = "legacy_smoke",
  diagnosticEvidence = null,
}) {
  assert(review && Array.isArray(review.reviews), "failure_learning_review_rows_missing")
  assert(review.reviews.length >= 2, "failure_learning_timeline_too_short")
  const timeline = [...review.reviews]
    .map((row) => normalizeTimelineRow(row))
    .sort((left, right) => left.epoch - right.epoch)
  const finalRow = timeline.at(-1)
  const issueCodes = [...new Set(timeline.flatMap((row) => row.issueCodes))].sort()
  const issueClusters = issueCodes.map((code) => buildIssueCluster(code, timeline))
  const familyGroups = groupFamilies(issueClusters)
  const diagnosticInterpretation = diagnosticEvidence === null
    ? null
    : diagnosticEvidence?.schemaVersion === "stage4-bounded-repair-smoke-diagnostic-evidence-v1"
      ? interpretStage4TrainingDiagnosticTimeline(diagnosticEvidence)
      : interpretStage4DiagnosticEvidence(diagnosticEvidence)
  const diagnosticVisualDifferential = diagnosticInterpretation?.evidenceMode === "post_training_epoch_timeline"
    ? buildStage4TrainingTimelineVisualDifferential(timeline, diagnosticInterpretation)
    : null
  const rootCauseCandidates = buildRootCauseCandidates({ timeline, issueClusters, familyGroups })
  if (diagnosticInterpretation) rootCauseCandidates.push(...buildDiagnosticEvidenceCandidates(diagnosticInterpretation))
  if (diagnosticVisualDifferential) rootCauseCandidates.push(...diagnosticVisualDifferential.rootCauseCandidates)
  const currentTraining = overlay?.patch?.training ?? {}
  const sourceSmokePolicy = currentTraining.fixedEpochPreviewPolicy?.smoke ?? []
  const repairContract = buildRepairContract({
    timeline,
    issueClusters,
    rootCauseCandidates,
    currentTraining,
    sourceSmokePolicy,
    sourcePaths,
    proposedBoundedRepairVersion,
    repairProfile,
    diagnosticInterpretation,
  })

  return {
    schemaVersion: "local-ai-failure-learning-report-v1",
    status: "failure_evidence_analyzed_repair_contract_ready_owner_review_required",
    sourceRunId: finalization?.runId ?? review.runId ?? null,
    sourceStatus: finalization?.status ?? review.status ?? "unknown",
    sourceReviewStatus: review.status,
    summary: {
      previewCount: timeline.length,
      failedPreviewCount: timeline.filter((row) => !row.passed).length,
      passedPreviewCount: timeline.filter((row) => row.passed).length,
      finalEpoch: finalRow.epoch,
      finalPreviewPassed: finalRow.passed,
      finalPassingStreak: trailingPassCount(timeline),
      uniqueIssueCodeCount: issueClusters.length,
      persistentAtFinalCount: issueClusters.filter((cluster) => cluster.presentAtFinal).length,
      recurrentIssueCount: issueClusters.filter((cluster) => cluster.episodeCount > 1).length,
      conclusionZh: buildConclusion(timeline, issueClusters),
    },
    timeline,
    issueClusters,
    familyGroups,
    rootCauseCandidates,
    diagnosticInterpretation,
    ...(diagnosticVisualDifferential ? { diagnosticVisualDifferential } : {}),
    repairContract,
    closure: {
      evidenceNormalized: true,
      temporalTrendClassified: true,
      rootCauseCandidatesGenerated: true,
      boundedRepairContractGenerated: true,
      configurationPatchProposed: true,
      configurationPatchApplied: false,
      trainingStarted: false,
      validationStarted: false,
      ownerReviewRequired: true,
      nextState: "waiting_for_owner_review_of_bounded_repair_contract",
    },
  }
}

export function interpretStage4TrainingDiagnosticTimeline(evidence) {
  assert(evidence?.schemaVersion === "stage4-bounded-repair-smoke-diagnostic-evidence-v1", "failure_learning_training_timeline_schema_invalid")
  assert(evidence?.metricCount === 17 && evidence?.allMetricsPresent === true, "failure_learning_training_timeline_metric_contract_invalid")
  const objectMetricNames = STAGE4_DIAGNOSTIC_OBJECT_CHANNELS.flatMap((channel) => [
    `stage4DiagnosticObject${channel}IndependentLoss`,
    `stage4DiagnosticObject${channel}GradientContribution`,
    `stage4DiagnosticObject${channel}DecodedResponsePrototypeMae`,
  ])
  const requiredMetricNames = [...objectMetricNames, "stage4DiagnosticObjectGradientAvailable", ...STAGE4_DIAGNOSTIC_ROUTE_METRICS]
  assert(sameSet(evidence.metricNames, requiredMetricNames), "failure_learning_training_timeline_metric_identity_invalid")
  assert(Array.isArray(evidence.epochs), "failure_learning_training_timeline_epochs_missing")
  assert(JSON.stringify(evidence.epochs.map((row) => row.epoch)) === JSON.stringify([1, 5, 10, 20, 30]), "failure_learning_training_timeline_epoch_identity_invalid")
  for (const row of evidence.epochs) {
    const metrics = row?.metrics
    assert(metrics && typeof metrics === "object" && !Array.isArray(metrics), `failure_learning_training_timeline_epoch_${row.epoch}_metrics_missing`)
    assert(sameSet(Object.keys(metrics), requiredMetricNames), `failure_learning_training_timeline_epoch_${row.epoch}_metric_identity_invalid`)
    for (const name of requiredMetricNames) assert(Number.isFinite(metrics[name]) && metrics[name] >= 0, `failure_learning_training_timeline_epoch_${row.epoch}_metric_value_invalid:${name}`)
    assert(metrics.stage4DiagnosticObjectGradientAvailable === 1, `failure_learning_training_timeline_epoch_${row.epoch}_object_gradient_unavailable`)
  }

  const first = evidence.epochs[0]
  const final = evidence.epochs.at(-1)
  const objectChannels = STAGE4_DIAGNOSTIC_OBJECT_CHANNELS.map((name) => {
    const prefix = `stage4DiagnosticObject${name}`
    const independentLossStart = first.metrics[`${prefix}IndependentLoss`]
    const independentLossFinal = final.metrics[`${prefix}IndependentLoss`]
    const decodedResponseStart = first.metrics[`${prefix}DecodedResponsePrototypeMae`]
    const decodedResponseFinal = final.metrics[`${prefix}DecodedResponsePrototypeMae`]
    return {
      channel: name.toLowerCase(),
      independentLoss: independentLossFinal,
      gradientContribution: final.metrics[`${prefix}GradientContribution`],
      decodedResponsePrototypeMae: decodedResponseFinal,
      independentLossStart,
      independentLossDelta: independentLossFinal - independentLossStart,
      decodedResponsePrototypeMaeStart: decodedResponseStart,
      decodedResponsePrototypeMaeDelta: decodedResponseFinal - decodedResponseStart,
      decodedResponseImprovementRatio: decodedResponseStart === 0 ? null : (decodedResponseStart - decodedResponseFinal) / decodedResponseStart,
    }
  })
  const byLoss = descendingRank(objectChannels, "independentLoss")
  const byGradient = descendingRank(objectChannels, "gradientContribution")
  const byDecodedResponse = descendingRank(objectChannels, "decodedResponsePrototypeMae")
  const gradientMinimum = Math.min(...objectChannels.map((row) => row.gradientContribution))
  for (const row of objectChannels) {
    row.lossRankDescending = byLoss.indexOf(row.channel) + 1
    row.gradientContributionRankDescending = byGradient.indexOf(row.channel) + 1
    row.decodedResponsePrototypeMaeRankDescending = byDecodedResponse.indexOf(row.channel) + 1
    row.gradientContributionRelativeToMinimum = gradientMinimum === 0 ? null : row.gradientContribution / gradientMinimum
  }
  const routeTimeline = evidence.epochs.map((row) => ({
    epoch: row.epoch,
    activationMassRatio: row.metrics.stage4DiagnosticRouteActivationMassRatio,
    spatialDistributionL1: row.metrics.stage4DiagnosticRouteSpatialDistributionL1,
    centroidDrift: row.metrics.stage4DiagnosticRouteCentroidDrift,
    requiredBoundaryContactMinimum: row.metrics.stage4DiagnosticRouteRequiredBoundaryContactMinimum,
  }))
  const finalRoute = routeTimeline.at(-1)
  return {
    schemaVersion: "local-ai-stage4-training-diagnostic-timeline-interpretation-v1",
    status: "post_training_five_epoch_diagnostic_timeline_interpreted_read_only",
    evidenceMode: "post_training_epoch_timeline",
    metricCount: requiredMetricNames.length,
    epochCount: evidence.epochs.length,
    epochs: evidence.epochs.map((row) => row.epoch),
    objectMetrics: {
      gradientAvailableAtEveryEpoch: true,
      channels: objectChannels,
      highestIndependentLossChannel: byLoss[0],
      highestGradientContributionChannel: byGradient[0],
      highestDecodedResponsePrototypeMaeChannel: byDecodedResponse[0],
      finding: "All object diagnostics remained available during the existing Smoke. Lower loss or prototype MAE describes the training diagnostic response only; it does not imply that the separately generated fixed preview passes held-out semantic review.",
    },
    routeMetrics: {
      activationMassRatio: finalRoute.activationMassRatio,
      activationMassDifferenceFromTarget: finalRoute.activationMassRatio - 1,
      activationMassPercentDifferenceFromTarget: (finalRoute.activationMassRatio - 1) * 100,
      activationDirectionRelativeToTarget: finalRoute.activationMassRatio > 1 ? "above_target" : finalRoute.activationMassRatio < 1 ? "below_target" : "equal_target",
      spatialDistributionL1: finalRoute.spatialDistributionL1,
      centroidDrift: finalRoute.centroidDrift,
      requiredBoundaryContactMinimum: finalRoute.requiredBoundaryContactMinimum,
      requiredBoundaryContactState: finalRoute.requiredBoundaryContactMinimum > 0 ? "positive_internal_response_not_visual_acceptance" : "absent_internal_response",
      timeline: routeTimeline,
      finding: "The training diagnostic records a positive internal route response. Machine review evaluates visible pixels in separately generated fixed previews, so internal response magnitude is not a visual boundary-contact pass and must not be compared as if both values used the same acceptance domain.",
    },
    sourceMutationContext: {
      sourceWeightsChangedDuringExistingSmoke: true,
      analyzerReadsEvidenceOnly: true,
      analyzerChangesWeights: false,
      representedAsWeightsUnchangedDiagnostic: false,
    },
    evidenceLimits: {
      fixedSingleSampleOnly: true,
      trainingEpochTimelineOnly: true,
      machineReviewThresholdPassFailInferredFromMetrics: false,
      datasetWideCausalityEstablished: false,
      executionValueSelected: false,
    },
  }
}

export function interpretStage4DiagnosticEvidence(report) {
  assert(report?.schemaVersion === "v7-r5-stage4-readonly-single-sample-gpu-diagnostic-report-v1", "failure_learning_diagnostic_schema_invalid")
  assert(report?.status === "read_only_single_sample_gpu_diagnostic_completed_weights_unchanged", "failure_learning_diagnostic_status_invalid")
  const metrics = report?.diagnosticMetrics
  assert(metrics && typeof metrics === "object" && !Array.isArray(metrics), "failure_learning_diagnostic_metrics_missing")
  const objectMetricNames = STAGE4_DIAGNOSTIC_OBJECT_CHANNELS.flatMap((channel) => [
    `stage4DiagnosticObject${channel}IndependentLoss`,
    `stage4DiagnosticObject${channel}GradientContribution`,
    `stage4DiagnosticObject${channel}DecodedResponsePrototypeMae`,
  ])
  const requiredMetricNames = [...objectMetricNames, "stage4DiagnosticObjectGradientAvailable", ...STAGE4_DIAGNOSTIC_ROUTE_METRICS]
  assert(Object.keys(metrics).length === requiredMetricNames.length, "failure_learning_diagnostic_metric_count_invalid")
  assert(requiredMetricNames.every((name) => Object.hasOwn(metrics, name)), "failure_learning_diagnostic_metric_identity_invalid")
  for (const name of requiredMetricNames) assert(Number.isFinite(metrics[name]) && metrics[name] >= 0, `failure_learning_diagnostic_metric_value_invalid:${name}`)
  assert(metrics.stage4DiagnosticObjectGradientAvailable === 1, "failure_learning_diagnostic_object_gradient_unavailable")
  assert(report.integrity?.autoencoderStateSha256Before === report.integrity?.autoencoderStateSha256After, "failure_learning_diagnostic_autoencoder_state_changed")
  assert(report.integrity?.denoiserStateSha256Before === report.integrity?.denoiserStateSha256After, "failure_learning_diagnostic_denoiser_state_changed")
  assert(report.integrity?.parameterGradientsAbsentAfterDiagnostic === true, "failure_learning_diagnostic_parameter_gradients_present")
  assert(report.optimizerCreated === false && report.lossBackwardExecuted === false && report.modelWeightsModified === false, "failure_learning_diagnostic_mutation_boundary_invalid")
  assert(report.checkpointWritten === false && report.trainingStarted === false && report.fullTrainingStarted === false, "failure_learning_diagnostic_training_boundary_invalid")

  const objectChannels = STAGE4_DIAGNOSTIC_OBJECT_CHANNELS.map((name) => {
    const prefix = `stage4DiagnosticObject${name}`
    return {
      channel: name.toLowerCase(),
      independentLoss: metrics[`${prefix}IndependentLoss`],
      gradientContribution: metrics[`${prefix}GradientContribution`],
      decodedResponsePrototypeMae: metrics[`${prefix}DecodedResponsePrototypeMae`],
    }
  })
  const byLoss = descendingRank(objectChannels, "independentLoss")
  const byGradient = descendingRank(objectChannels, "gradientContribution")
  const byDecodedResponse = descendingRank(objectChannels, "decodedResponsePrototypeMae")
  const gradientMinimum = Math.min(...objectChannels.map((row) => row.gradientContribution))
  for (const row of objectChannels) {
    row.lossRankDescending = byLoss.indexOf(row.channel) + 1
    row.gradientContributionRankDescending = byGradient.indexOf(row.channel) + 1
    row.decodedResponsePrototypeMaeRankDescending = byDecodedResponse.indexOf(row.channel) + 1
    row.gradientContributionRelativeToMinimum = gradientMinimum === 0 ? null : row.gradientContribution / gradientMinimum
  }

  const activationMassRatio = metrics.stage4DiagnosticRouteActivationMassRatio
  const boundaryContactMinimum = metrics.stage4DiagnosticRouteRequiredBoundaryContactMinimum
  return {
    schemaVersion: "local-ai-stage4-diagnostic-evidence-interpretation-v1",
    status: "single_sample_diagnostic_metrics_interpreted_read_only",
    metricCount: requiredMetricNames.length,
    objectMetrics: {
      gradientAvailable: true,
      channels: objectChannels,
      highestIndependentLossChannel: byLoss[0],
      highestGradientContributionChannel: byGradient[0],
      highestDecodedResponsePrototypeMaeChannel: byDecodedResponse[0],
      finding: "All four object channels expose non-zero diagnostic gradients. Rock has the highest independent loss, gradient contribution, and decoded-response prototype MAE in this fixed sample; this supports an isolated rock-channel bounded candidate, but does not prove a dataset-wide weight choice.",
    },
    routeMetrics: {
      activationMassRatio,
      activationMassDifferenceFromTarget: activationMassRatio - 1,
      activationMassPercentDifferenceFromTarget: (activationMassRatio - 1) * 100,
      activationDirectionRelativeToTarget: activationMassRatio > 1 ? "above_target" : activationMassRatio < 1 ? "below_target" : "equal_target",
      spatialDistributionL1: metrics.stage4DiagnosticRouteSpatialDistributionL1,
      centroidDrift: metrics.stage4DiagnosticRouteCentroidDrift,
      requiredBoundaryContactMinimum: boundaryContactMinimum,
      requiredBoundaryContactState: boundaryContactMinimum > 0 ? "present" : "absent",
      finding: "The fixed sample has route activation mass above the target, non-zero spatial-distribution error and centroid drift, and zero required-boundary contact. The raw values are evidence for isolated bounded repair design; no machine-review threshold is changed or reinterpreted.",
    },
    evidenceLimits: {
      fixedSingleSampleOnly: true,
      fixedTimestepOnly: true,
      fixedSeedOnly: true,
      datasetWideCausalityEstablished: false,
      acceptanceThresholdPassFailInferred: false,
      executionValueSelected: false,
    },
  }
}

function descendingRank(rows, field) {
  return [...rows].sort((left, right) => right[field] - left[field] || left.channel.localeCompare(right.channel)).map((row) => row.channel)
}

function sameSet(left, right) {
  return Array.isArray(left) && left.length === right.length && [...left].sort().every((value, index) => value === [...right].sort()[index])
}

function buildStage4TrainingTimelineVisualDifferential(timeline, interpretation) {
  const finalRow = timeline.at(-1)
  const finalIssues = new Set(finalRow.issueCodes)
  const routeCoverageFailed = finalIssues.has("condition_terrain_path_ground_coverage_mismatch")
  const routeBoundaryFailed = finalIssues.has("condition_terrain_path_ground_required_boundary_contact_missing")
  const rockReviewFailed = finalIssues.has("condition_object_rock_reference_semantic_mismatch")
  const rock = interpretation.objectMetrics.channels.find((row) => row.channel === "rock")
  const rootCauseCandidates = []
  if (routeCoverageFailed || routeBoundaryFailed) {
    rootCauseCandidates.push({
      id: "route_internal_metric_and_fixed_preview_visual_review_domain_gap",
      category: "evidence_domain_mismatch",
      confidence: 0.91,
      titleZh: "道路内部响应指标与固定预览视觉审核不在同一判定域",
      findingZh: `Epoch ${finalRow.epoch}内部道路激活量比为${interpretation.routeMetrics.activationMassRatio.toFixed(6)}、边界接触最小响应为${interpretation.routeMetrics.requiredBoundaryContactMinimum.toFixed(6)}，但固定预览仍报告${[routeCoverageFailed ? "覆盖量不匹配" : null, routeBoundaryFailed ? "west边界可见接触缺失" : null].filter(Boolean).join("、")}。内部响应衡量训练诊断张量，机器审核衡量另行生成预览中的可见像素；正内部响应不能替代视觉通过。`,
      evidenceIssueCodes: [...finalIssues].filter((code) => code.startsWith("condition_terrain_path_ground_")),
      evidenceEpochs: interpretation.epochs,
      proposedTarget: "保持审核阈值不变，分离记录训练诊断域与固定预览视觉域，并仅提出未激活的跨域一致性候选。",
    })
  }
  if (rockReviewFailed) {
    rootCauseCandidates.push({
      id: "rock_training_diagnostic_improvement_without_heldout_visual_acceptance",
      category: "cross_evidence_non_convergence",
      confidence: 0.88,
      titleZh: "Rock训练诊断改善但未达到留出视觉语义验收",
      findingZh: `Rock独立Loss从${rock.independentLossStart.toFixed(6)}降至${rock.independentLoss.toFixed(6)}，解码响应Prototype MAE从${rock.decodedResponsePrototypeMaeStart.toFixed(6)}降至${rock.decodedResponsePrototypeMae.toFixed(6)}，但Epoch ${finalRow.epoch}留出视觉审核仍失败。该结果说明训练响应改善真实存在，但尚不能代表留出掩码颜色、边缘与亮度相关结构已经收敛。`,
      evidenceIssueCodes: ["condition_object_rock_reference_semantic_mismatch"],
      evidenceEpochs: interpretation.epochs,
      proposedTarget: "保持其他对象通道与审核阈值不变，只形成Rock跨证据一致性的有界未激活候选。",
    })
  }
  return {
    schemaVersion: "local-ai-stage4-training-metric-visual-review-differential-v1",
    status: "training_metric_and_fixed_preview_visual_review_domains_compared_read_only",
    finalEpoch: finalRow.epoch,
    route: {
      internalActivationMassRatio: interpretation.routeMetrics.activationMassRatio,
      internalSpatialDistributionL1: interpretation.routeMetrics.spatialDistributionL1,
      internalCentroidDrift: interpretation.routeMetrics.centroidDrift,
      internalRequiredBoundaryContactMinimum: interpretation.routeMetrics.requiredBoundaryContactMinimum,
      visualCoverageReviewFailed: routeCoverageFailed,
      visualRequiredWestBoundaryContactReviewFailed: routeBoundaryFailed,
      conclusion: "internal_training_response_does_not_establish_fixed_preview_visual_topology_acceptance",
    },
    rock: {
      independentLossStart: rock.independentLossStart,
      independentLossFinal: rock.independentLoss,
      decodedResponsePrototypeMaeStart: rock.decodedResponsePrototypeMaeStart,
      decodedResponsePrototypeMaeFinal: rock.decodedResponsePrototypeMae,
      heldoutVisualSemanticReviewFailed: rockReviewFailed,
      conclusion: "training_diagnostic_improved_but_heldout_visual_semantics_not_accepted",
    },
    thresholdsReinterpreted: false,
    executionValuesSelected: false,
    sourceWeightsChangedByExistingSmoke: true,
    analyzerModifiedSourceWeights: false,
    rootCauseCandidates,
  }
}

function buildDiagnosticEvidenceCandidates(interpretation) {
  if (interpretation.evidenceMode === "post_training_epoch_timeline") {
    return [
      {
        id: "training_timeline_object_residual_single_sample",
        category: "diagnostic_evidence_pattern",
        confidence: 0.74,
        titleZh: "训练期对象诊断残差时间线",
        findingZh: `五个固定Epoch的对象诊断均完整；终态最高独立Loss通道为${interpretation.objectMetrics.highestIndependentLossChannel}。该排序只用于形成未激活候选，不选择执行参数。`,
        evidenceIssueCodes: ["condition_object_rock_reference_semantic_mismatch"],
        evidenceEpochs: interpretation.epochs,
        proposedTarget: "保留其他对象通道，仅形成跨证据一致性修复候选并等待独立Owner授权。",
      },
      {
        id: "training_timeline_route_internal_response_single_sample",
        category: "diagnostic_evidence_pattern",
        confidence: 0.8,
        titleZh: "训练期道路内部响应时间线",
        findingZh: `终态激活量相对目标偏差${interpretation.routeMetrics.activationMassPercentDifferenceFromTarget.toFixed(4)}%，内部边界响应为${interpretation.routeMetrics.requiredBoundaryContactMinimum.toFixed(6)}；这些数值不重新解释机器审核阈值。`,
        evidenceIssueCodes: [
          "condition_terrain_path_ground_coverage_mismatch",
          "condition_terrain_path_ground_required_boundary_contact_missing",
        ],
        evidenceEpochs: interpretation.epochs,
        proposedTarget: "保持机器审核阈值不变，仅形成道路内部响应与固定预览可见结果的一致性候选。",
      },
    ]
  }
  return [
    {
      id: "diagnostic_object_rock_dominant_residual_single_sample",
      category: "diagnostic_evidence_pattern",
      confidence: 0.72,
      titleZh: "固定单样本中岩石对象残差最高",
      findingZh: "四类对象均有非零诊断梯度；岩石的独立Loss、梯度贡献和解码响应Prototype MAE均为四类最高。该证据只支持隔离、有界候选，不支持直接选择执行参数。",
      evidenceIssueCodes: ["condition_object_rock_reference_semantic_mismatch"],
      evidenceEpochs: [],
      proposedTarget: "仅为岩石对象通道建立相对当前值的有界候选区间，其他对象通道保持不变；在新的独立授权前不应用。",
    },
    {
      id: "diagnostic_route_mass_above_target_and_required_contact_absent_single_sample",
      category: "diagnostic_evidence_pattern",
      confidence: 0.78,
      titleZh: "固定单样本道路激活偏高且必需边界接触缺失",
      findingZh: `道路激活量相对目标为${interpretation.routeMetrics.activationMassPercentDifferenceFromTarget.toFixed(4)}%，空间分布L1与质心漂移均非零，必需边界接触最小值为0。单样本证据不能替代完整训练或机器审核。`,
      evidenceIssueCodes: [
        "condition_terrain_path_ground_coverage_mismatch",
        "condition_terrain_path_ground_spatial_distribution_mismatch",
        "condition_terrain_path_ground_centroid_drift",
        "condition_terrain_path_ground_required_boundary_contact_missing",
      ],
      evidenceEpochs: [],
      proposedTarget: "保留审核阈值，隔离评估激活量校准与必需边界接触Loss的有界候选；不从本次单样本直接选择权重。",
    },
  ]
}

function normalizeTimelineRow(row) {
  assert(Number.isInteger(row.epoch) && row.epoch > 0, "failure_learning_epoch_invalid")
  assert(typeof row.recordedAtUtc === "string" && row.recordedAtUtc, `failure_learning_epoch_${row.epoch}_utc_missing`)
  assert(typeof row.recordedAtAsiaShanghai === "string" && row.recordedAtAsiaShanghai, `failure_learning_epoch_${row.epoch}_shanghai_time_missing`)
  const issueCodes = [...new Set(Array.isArray(row.issueCodes) ? row.issueCodes : [])].sort()
  return {
    epoch: row.epoch,
    passed: row.passed === true,
    recordedAtUtc: row.recordedAtUtc,
    recordedAtAsiaShanghai: row.recordedAtAsiaShanghai,
    issueCodes,
    previewPath: row.previewPath ?? null,
    previewSha256: row.previewSha256 ?? null,
  }
}

function buildIssueCluster(code, timeline) {
  const positions = timeline
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => row.issueCodes.includes(code))
  const episodeCount = positions.reduce((count, value, index) => {
    if (index === 0 || value.index !== positions[index - 1].index + 1) return count + 1
    return count
  }, 0)
  const first = positions[0]
  const last = positions.at(-1)
  const presentAtFinal = last.index === timeline.length - 1
  let trend = "persistent_at_final"
  if (!presentAtFinal && episodeCount > 1) trend = "recurred_then_resolved"
  else if (!presentAtFinal && first.index === 0) trend = "learned_then_resolved"
  else if (!presentAtFinal) trend = "emerged_then_resolved"
  const definition = ISSUE_DEFINITIONS[code] ?? {
    family: "unclassified_machine_issue",
    labelZh: code,
    repairTarget: "manual_dictionary_extension_required",
  }
  return {
    issueCode: code,
    labelZh: definition.labelZh,
    family: definition.family,
    repairTarget: definition.repairTarget,
    occurrenceCount: positions.length,
    occurrenceEpochs: positions.map(({ row }) => row.epoch),
    firstSeenEpoch: first.row.epoch,
    lastSeenEpoch: last.row.epoch,
    episodeCount,
    presentAtFinal,
    resolvedByFinal: !presentAtFinal,
    trend,
  }
}

function groupFamilies(issueClusters) {
  return [...new Set(issueClusters.map((cluster) => cluster.family))]
    .sort()
    .map((family) => {
      const clusters = issueClusters.filter((cluster) => cluster.family === family)
      return {
        family,
        issueCodes: clusters.map((cluster) => cluster.issueCode),
        firstSeenEpoch: Math.min(...clusters.map((cluster) => cluster.firstSeenEpoch)),
        lastSeenEpoch: Math.max(...clusters.map((cluster) => cluster.lastSeenEpoch)),
        allResolvedByFinal: clusters.every((cluster) => cluster.resolvedByFinal),
        hasRecurrence: clusters.some((cluster) => cluster.episodeCount > 1),
      }
    })
}

function buildRootCauseCandidates({ timeline, issueClusters, familyGroups }) {
  const candidates = []
  const objectClusters = issueClusters.filter((cluster) => cluster.family === "object_semantic_alignment")
  if (objectClusters.length > 0) {
    const slowest = [...objectClusters].sort((left, right) => right.lastSeenEpoch - left.lastSeenEpoch)[0]
    const persistentObjectClusters = objectClusters.filter((cluster) => cluster.presentAtFinal)
    candidates.push({
      id: persistentObjectClusters.length > 0 ? "persistent_object_semantic_non_convergence" : "uneven_object_semantic_learning_rate",
      category: "training_supervision",
      confidence: persistentObjectClusters.length > 0 ? 0.99 : 0.86,
      titleZh: persistentObjectClusters.length > 0 ? "对象语义监督在终态仍未收敛" : "不同对象通道的语义学习速度不均衡",
      findingZh: persistentObjectClusters.length > 0
        ? `${persistentObjectClusters.length}类对象语义从首次预览持续失败至Epoch ${timeline.at(-1).epoch}，不能判为已学习或稳定收敛。`
        : `对象语义错误均在终态前收敛，但${slowest.labelZh}持续到Epoch ${slowest.lastSeenEpoch}，说明模型能够学习，不应把对象通道整体判为不可学习。`,
      evidenceIssueCodes: objectClusters.map((cluster) => cluster.issueCode),
      evidenceEpochs: [...new Set(objectClusters.flatMap((cluster) => cluster.occurrenceEpochs))].sort((a, b) => a - b),
      proposedTarget: persistentObjectClusters.length > 0
        ? "先增加四类对象通道独立Loss、梯度贡献与解码响应诊断，再决定是否建立有界权重搜索；不得直接提高全部对象权重。"
        : "增加对象通道独立Loss观测，并只对持续最久的岩石/对象语义监督建立有界权重搜索。",
    })
  }
  const hydrologyFamily = familyGroups.find((group) => group.family === "hydrology_spatial_alignment")
  if (hydrologyFamily) {
    const hydrologyClusters = issueClusters.filter((cluster) => cluster.family === hydrologyFamily.family)
    candidates.push({
      id: hydrologyFamily.allResolvedByFinal ? "hydrology_learned_before_terminal" : "hydrology_spatial_alignment_non_convergence",
      category: "training_trajectory",
      confidence: hydrologyFamily.allResolvedByFinal ? 0.96 : 0.99,
      titleZh: hydrologyFamily.allResolvedByFinal ? "水体空间响应在训练中收敛" : "水体空间响应在终态仍未收敛",
      findingZh: hydrologyFamily.allResolvedByFinal
        ? `水体问题最晚在Epoch ${hydrologyFamily.lastSeenEpoch}后消失，当前证据不支持降低水体审核门槛或优先扩大水体Loss。`
        : `水体问题持续至Epoch ${hydrologyFamily.lastSeenEpoch}，必须保持失败关闭并补充空间响应诊断。`,
      evidenceIssueCodes: hydrologyFamily.issueCodes,
      evidenceEpochs: [...new Set(hydrologyClusters.flatMap((cluster) => cluster.occurrenceEpochs))].sort((a, b) => a - b),
      proposedTarget: hydrologyFamily.allResolvedByFinal
        ? "保留现有水体合同与阈值，把水体收敛轨迹作为对象/道路修复的历史回归保护。"
        : "增加水体覆盖、空间网格与质心响应的独立训练诊断，不使用审核阈值作为训练目标。",
    })
  }
  const pathFamily = familyGroups.find((group) => group.family === "terrain_path_topology")
  if (pathFamily) {
    const recurrent = issueClusters.filter((cluster) => cluster.family === pathFamily.family && cluster.episodeCount > 1)
    const persistent = issueClusters.filter((cluster) => cluster.family === pathFamily.family && cluster.presentAtFinal)
    candidates.push({
      id: persistent.length > 0 ? "route_topology_terminal_non_convergence" : "route_topology_training_trajectory_instability",
      category: "training_trajectory",
      confidence: persistent.length > 0 ? 0.99 : (recurrent.length > 0 ? 0.96 : 0.9),
      titleZh: persistent.length > 0 ? "道路拓扑响应在终态仍未收敛" : "道路覆盖和边界接触在训练轨迹中不稳定",
      findingZh: persistent.length > 0
        ? `${persistent.map((cluster) => cluster.labelZh).join("、")}持续至Epoch ${timeline.at(-1).epoch}；道路问题在末段出现且未全部恢复，不能判为已收敛。`
        : recurrent.length > 0
        ? `道路边界错误分成${recurrent[0].episodeCount}段出现，曾消失后在Epoch ${recurrent[0].lastSeenEpoch}复发；这不是固定条件包错误，而是训练轨迹回归。`
        : `道路错误持续到Epoch ${pathFamily.lastSeenEpoch}才消失，需要专门的覆盖与边界一致性监督。`,
      evidenceIssueCodes: pathFamily.issueCodes,
      evidenceEpochs: [...new Set(issueClusters.filter((cluster) => cluster.family === pathFamily.family).flatMap((cluster) => cluster.occurrenceEpochs))].sort((a, b) => a - b),
      proposedTarget: persistent.length > 0
        ? "保留现有道路审核阈值，增加道路覆盖、空间分布、质心和必需边界接触的末段回归诊断；未取得诊断证据前不选择新权重。"
        : "保留现有道路审核阈值，增加道路覆盖/边界一致性Loss诊断与末段稳定性复验。",
    })
  }
  const finalPassingStreak = trailingPassCount(timeline)
  if (timeline.at(-1).passed && finalPassingStreak < 3) {
    candidates.push({
      id: "terminal_pass_without_stability_window",
      category: "acceptance_evidence_gap",
      confidence: 0.99,
      titleZh: "终态通过但缺少连续稳定通过证据",
      findingZh: `Epoch ${timeline.at(-1).epoch}通过，但末段只有${finalPassingStreak}个连续通过预览；上一条保存的预览仍失败，因此不能把单次终态通过等同于稳定收敛。`,
      evidenceIssueCodes: [],
      evidenceEpochs: timeline.slice(-2).map((row) => row.epoch),
      proposedTarget: "不降低机器门禁；在训练末段补足连续三个固定预览点，并要求全部通过后Smoke才可合格。",
    })
  }
  return candidates
}

function buildRepairContract({
  timeline,
  issueClusters,
  rootCauseCandidates,
  currentTraining,
  sourceSmokePolicy,
  sourcePaths,
  proposedBoundedRepairVersion,
  repairProfile,
  diagnosticInterpretation,
}) {
  if (repairProfile === "stage4_progressive") {
    return buildStage4ProgressiveRepairContract({
      timeline,
      issueClusters,
      rootCauseCandidates,
      currentTraining,
      sourcePaths,
      proposedBoundedRepairVersion,
      diagnosticInterpretation,
    })
  }
  const proposedSmokePolicy = [...new Set([...sourceSmokePolicy, 100, 110, timeline.at(-1).epoch])].sort((a, b) => a - b)
  return {
    schemaVersion: "local-ai-bounded-repair-contract-proposal-v1",
    status: "owner_review_required_not_applied",
    objectiveZh: "证明道路拓扑和对象语义在训练末段稳定收敛，而不是用一次终态通过掩盖中间回归。",
    evidenceBasis: {
      sourcePaths,
      issueCodes: issueClusters.map((cluster) => cluster.issueCode),
      rootCauseCandidateIds: rootCauseCandidates.map((candidate) => candidate.id),
    },
    allowedChangeTargets: [
      "训练器按对象通道输出独立Loss与梯度贡献",
      "道路覆盖和授权边界接触一致性监督",
      "Smoke末段固定预览密度与连续通过稳定性门禁",
      "有界权重搜索范围及对应回退点",
    ],
    forbiddenChanges: [
      "降低或删除现有机器审核阈值",
      "改写六张失败预览、拒绝码或时间戳",
      "用训练原图替换模型预览",
      "未授权直接修改正式V7配置或Checkpoint",
      "单样本Smoke通过后自动晋级完整训练",
    ],
    configurationPatchProposal: {
      status: "proposal_only_not_applied",
      baseBoundedRepairVersion: currentTraining.boundedRepairVersion ?? null,
      proposedBoundedRepairVersion,
      proposedValues: {
        fixedEpochPreviewPolicy: {
          smoke: proposedSmokePolicy,
        },
        smokeStabilityGate: {
          requiredConsecutiveTailPasses: 3,
          requireAllMachineReviewsPassed: true,
          preserveReviewThresholds: true,
        },
        diagnosticLossBreakdown: {
          enabled: true,
          channels: ["terrain_path_ground", "object_footprints", "object_tree", "object_rock", "object_vegetation"],
          recordPerOptimizerStep: true,
        },
      },
      boundedSearchRanges: {
        pathBoundaryRgb: { current: currentTraining.denoiserLossWeights?.pathBoundaryRgb ?? null, minimum: 1.5, maximum: 2.0 },
        rolloutPathBoundaryRgbMae: { current: currentTraining.rolloutCheckpointMetricWeights?.rolloutPathBoundaryRgbMae ?? null, minimum: 1.5, maximum: 2.0 },
        objectRockSemanticWeight: { current: null, minimum: 1.0, maximum: 1.5, requiresCodeSupport: true },
      },
    },
    regressionContract: {
      positive: [
        "同一条件包和固定seed的末段三个预览必须连续通过全部现有机器门禁",
        "道路覆盖、授权边界接触和四类对象语义均不得在末段复发",
        "Loss、对象通道贡献、时间戳、Token和预览必须自动保存",
      ],
      negative: [
        `对既有${timeline.filter((row) => !row.passed).length}张失败图重新读取时必须保留原拒绝码，不得因修复降低门槛而消失`,
        "构造未授权道路边界接触时仍必须被拒绝",
        "删除或破坏岩石对象语义时仍必须被拒绝",
      ],
      promotionBoundary: "单样本Smoke只验证可学习性和稳定性，不证明64张泛化；完整训练和严格复验仍需独立Owner授权。",
    },
    applicationGate: {
      ownerAuthorizationRequired: true,
      immutableAuthorizationConsumptionRequired: true,
      applyConfigurationNow: false,
      startTrainingNow: false,
    },
  }
}

function buildStage4ProgressiveRepairContract({
  timeline,
  issueClusters,
  rootCauseCandidates,
  currentTraining,
  sourcePaths,
  proposedBoundedRepairVersion,
  diagnosticInterpretation,
}) {
  const objectWeights = currentTraining.objectSemanticChannelWeights ?? {}
  const diagnosticCandidate = diagnosticInterpretation
    ? buildStage4DiagnosticCandidateProposal(diagnosticInterpretation, currentTraining)
    : null
  return {
    schemaVersion: "local-ai-stage4-bounded-repair-contract-proposal-v1",
    status: "owner_review_required_not_applied",
    objectiveZh: "先解释Stage 0对象语义持续失败和道路末段回归，再形成不降低审核门槛、不直接重跑完整训练的最小修复候选。",
    evidenceBasis: {
      sourcePaths,
      epochs: timeline.map((row) => row.epoch),
      issueCodes: issueClusters.map((cluster) => cluster.issueCode),
      rootCauseCandidateIds: rootCauseCandidates.map((candidate) => candidate.id),
      diagnosticMetricCount: diagnosticInterpretation?.metricCount ?? 0,
    },
    preservedContracts: {
      datasetCapacityCount: currentTraining.stage4FullTrainingContract?.datasetCapacityCount ?? null,
      splitCounts: currentTraining.stage4FullTrainingContract?.splitCounts ?? null,
      resolutionStages: currentTraining.stage4FullTrainingContract?.stages ?? null,
      reviewThresholds: "preserved_unchanged",
      failedPreviewPixelsUsedAsTrainingTargets: false,
      stage3SmokeCheckpointInitializationAuthorized: false,
    },
    allowedChangeTargets: [
      "四类对象通道独立Loss、梯度贡献和解码响应诊断",
      "道路覆盖、空间分布、质心和必需边界接触的末段回归诊断",
      "水体已收敛轨迹的历史回归保护",
      "仅在诊断证据支持后建立对象或道路Loss的有界参数选择合同",
      "再次完整训练前的CPU正反回归和独立短Smoke门禁",
    ],
    forbiddenChanges: [
      "降低、删除或重解释现有机器审核阈值",
      "改写六张失败预览、拒绝码、源Manifest或失败终态",
      "把失败预览像素或审核阈值作为训练目标",
      "未经独立证据同时提高全部对象语义权重",
      "读取或加载本次Stage 0失败Checkpoint作为当前分析输入",
      "当前提案自动修改训练配置、启动GPU训练或进入Stage 1",
    ],
    configurationPatchProposal: {
      status: "proposal_only_not_applied",
      baseBoundedRepairVersion: currentTraining.boundedRepairVersion ?? null,
      proposedBoundedRepairVersion,
      selectedExecutionValues: false,
      currentObjectSemanticChannelWeights: objectWeights,
      proposedCapabilities: {
        objectSemanticDiagnostics: {
          enabled: true,
          channels: ["object_footprints", "object_tree", "object_rock", "object_vegetation"],
          measurements: ["independent_loss", "gradient_contribution", "decoded_response"],
          changesTrainingWeightsNow: false,
        },
        routeLateRegressionDiagnostics: {
          enabled: true,
          measurements: ["coverage", "spatial_distribution", "centroid", "required_boundary_contact"],
          preserveExistingPathLossWeights: true,
        },
        hydrologyRegressionProtection: {
          enabled: true,
          measurements: ["coverage", "spatial_distribution", "centroid"],
          changeHydrologyWeightsNow: false,
        },
      },
      boundedParameterSelection: {
        status: "not_selected_requires_separate_evidence_and_owner_authorization",
        objectSemanticWeightSelectionAllowedNow: false,
        pathWeightSelectionAllowedNow: false,
        hydrologyWeightSelectionAllowedNow: false,
      },
      diagnosticEvidenceCandidate: diagnosticCandidate,
    },
    regressionContract: {
      positive: [
        "必须重现六张源预览的全部原始拒绝码和Epoch时间线",
        "对象语义持续失败、水体阶段性收敛和道路末段回归必须分别归类",
        "新增诊断不得改变64/64数据、48/8/4/4划分、分辨率Stage或审核阈值",
      ],
      negative: [
        "缺少任一固定Epoch、源哈希不一致或出现未知失败码时必须拒绝",
        "任何已选择执行参数、训练配置应用、Checkpoint读取或GPU标志必须拒绝",
        "不得把水体早期失败误判为终态持续失败，也不得把对象终态失败误判为已收敛",
      ],
      promotionBoundary: "本提案只进入Owner审核；后续训练器支持、参数选择、Smoke和完整训练分别授权。",
    },
    applicationGate: {
      ownerAuthorizationRequired: true,
      immutableAuthorizationConsumptionRequired: true,
      applyConfigurationNow: false,
      readCheckpointNow: false,
      startGpuNow: false,
      startTrainingNow: false,
    },
  }
}

function buildStage4DiagnosticCandidateProposal(interpretation, currentTraining) {
  const currentObjectWeight = currentTraining.denoiserLossWeights?.objectSemanticRgb ?? null
  const currentActivationWeight = currentTraining.pathActivationMassCalibration?.weight ?? null
  const currentBoundaryWeight = currentTraining.authorizedBoundaryTopology?.weight ?? null
  return {
    status: "bounded_candidate_not_selected_not_applied",
    evidenceScope: "one_fixed_validation_sample_one_timestep_one_seed",
    objectSemanticCandidate: {
      targetChannel: interpretation.objectMetrics.highestIndependentLossChannel,
      reason: "highest independent loss, gradient contribution, and decoded-response prototype MAE in the bound diagnostic sample",
      preserveOtherObjectChannels: true,
      currentSharedObjectSemanticRgbWeight: currentObjectWeight,
      relativeMultiplierRange: { minimum: 1.0, maximum: 1.25, selectedValue: null },
    },
    routeCandidate: {
      activationMassDirection: interpretation.routeMetrics.activationDirectionRelativeToTarget,
      requiredBoundaryContactState: interpretation.routeMetrics.requiredBoundaryContactState,
      preserveSpatialAndCentroidReviewThresholds: true,
      pathActivationMassCalibrationWeight: {
        current: currentActivationWeight,
        minimum: currentActivationWeight,
        maximum: currentActivationWeight === null ? null : Math.min(0.75, currentActivationWeight * 1.2),
        selectedValue: null,
      },
      requiredBoundaryContactLoss: {
        status: "candidate_capability_only_requires_trainer_support_authorization",
        currentForbiddenBoundaryTopologyWeight: currentBoundaryWeight,
        proposedWeightRange: { minimum: 0.25, maximum: 0.75, selectedValue: null },
      },
    },
    activationGate: {
      selectedExecutionValues: false,
      applyConfigurationNow: false,
      createOptimizerNow: false,
      readCheckpointNow: false,
      startGpuNow: false,
      startTrainingNow: false,
      separateOwnerAuthorizationRequired: true,
    },
  }
}

function buildConclusion(timeline, issueClusters) {
  const finalRow = timeline.at(-1)
  const recurrent = issueClusters.filter((cluster) => cluster.episodeCount > 1)
  if (finalRow.passed && trailingPassCount(timeline) < 3) {
    return `模型在Epoch ${finalRow.epoch}能够生成机器通过结果，但只有一次末段通过；${recurrent.length}类问题发生过复发，当前应判为“已学习但稳定性未证明”，不能判为不可学习，也不能直接晋级。`
  }
  if (!finalRow.passed) return "终态仍存在机器拒绝，必须保持失败关闭并生成有界修复合同。"
  return "末段已有稳定通过证据，可进入独立Owner审核，但不自动获得下一阶段权限。"
}

function trailingPassCount(timeline) {
  let count = 0
  for (let index = timeline.length - 1; index >= 0 && timeline[index].passed; index -= 1) count += 1
  return count
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}
