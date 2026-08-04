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

export function analyzeFailureLearningLoop({
  review,
  finalization,
  overlay,
  sourcePaths,
  proposedBoundedRepairVersion = "v7_bounded_repair_r3_candidate",
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
  const rootCauseCandidates = buildRootCauseCandidates({ timeline, issueClusters, familyGroups })
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
    candidates.push({
      id: "uneven_object_semantic_learning_rate",
      category: "training_supervision",
      confidence: 0.86,
      titleZh: "不同对象通道的语义学习速度不均衡",
      findingZh: `对象语义错误均在终态前收敛，但${slowest.labelZh}持续到Epoch ${slowest.lastSeenEpoch}，说明模型能够学习，不应把对象通道整体判为不可学习。`,
      evidenceIssueCodes: objectClusters.map((cluster) => cluster.issueCode),
      evidenceEpochs: [...new Set(objectClusters.flatMap((cluster) => cluster.occurrenceEpochs))].sort((a, b) => a - b),
      proposedTarget: "增加对象通道独立Loss观测，并只对持续最久的岩石/对象语义监督建立有界权重搜索。",
    })
  }
  const pathFamily = familyGroups.find((group) => group.family === "terrain_path_topology")
  if (pathFamily) {
    const recurrent = issueClusters.filter((cluster) => cluster.family === pathFamily.family && cluster.episodeCount > 1)
    candidates.push({
      id: "route_topology_training_trajectory_instability",
      category: "training_trajectory",
      confidence: recurrent.length > 0 ? 0.96 : 0.9,
      titleZh: "道路覆盖和边界接触在训练轨迹中不稳定",
      findingZh: recurrent.length > 0
        ? `道路边界错误分成${recurrent[0].episodeCount}段出现，曾消失后在Epoch ${recurrent[0].lastSeenEpoch}复发；这不是固定条件包错误，而是训练轨迹回归。`
        : `道路错误持续到Epoch ${pathFamily.lastSeenEpoch}才消失，需要专门的覆盖与边界一致性监督。`,
      evidenceIssueCodes: pathFamily.issueCodes,
      evidenceEpochs: [...new Set(issueClusters.filter((cluster) => cluster.family === pathFamily.family).flatMap((cluster) => cluster.occurrenceEpochs))].sort((a, b) => a - b),
      proposedTarget: "保留现有道路审核阈值，增加道路覆盖/边界一致性Loss诊断与末段稳定性复验。",
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
}) {
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
