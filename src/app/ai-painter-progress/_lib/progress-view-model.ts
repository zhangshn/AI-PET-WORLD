import type { Progress, TrainingAction } from "./progress-types"

export function buildNaturalHomeStatus(data: Progress | null) {
  const quality = data?.naturalHomeQuality
  if (quality?.status === "blocked") return "质量阻断"
  if (data?.naturalHomeV89QualityAllowlistTraining?.inferenceReady) return "V89 allowlist 训练候选已生成"
  if (data?.naturalHomeV88QualityAllowlistDataset?.inferenceReady) return "V88 allowlist 数据集已准备"
  if (data?.naturalHomeV87QualityLedger?.inferenceReady) return "V87 质量账本已生成"
  if (data?.naturalHomeV51SafeCandidatePack?.inferenceReady) return "V51 严格安全候选包已生成"
  if (data?.naturalHomeV50DiversityWaterGate?.inferenceReady) return "V50 多样性与水体门控已完成"
  if (data?.naturalHomeV49V32DiversitySweep?.inferenceReady) return "V49 多样自然家园候选已生成"
  if (data?.naturalHomeV48SplitExpertMergeGate?.inferenceReady) return "V48 合并门候选已生成"
  if (data?.naturalHomeV47HardFailureStabilization?.inferenceReady) return "V47 候选已生成"
  if (data?.naturalHomeV46V45FailureFocusRepair?.inferenceReady) return "V46 候选已生成"
  if (data?.naturalHomeV45Generalization?.inferenceReady) return "V45 候选已生成"
  if (data?.naturalHomeV44V32StableGeneralization?.inferenceReady) return "V44 候选已生成"
  if (data?.naturalHomeV43V32FailureFocusRepair?.inferenceReady) return "V43 候选已生成"
  if (data?.naturalHomeV42WaterExpertFix?.inferenceReady) return "V42 已归档，未超过 V32"
  if (data?.naturalHomeRefiner?.inferenceReady) return "RGB 细化已完成"
  if (data?.naturalHomeStructure?.inferenceReady) return "结构推理已完成"
  if (data?.naturalHomeTraining?.inferenceReady) return "基础推理已完成"
  if (quality?.canTrainMvpV1) return "MVP 数据可训练"
  if (quality?.canTrainExperiment) return "实验可训练"
  if (data?.naturalHomeReadiness?.canStartTraining) return "可开始训练"
  return `${data?.naturalHomeReadiness?.blockedSampleCount ?? 0} 张阻断`
}

export function buildNaturalHomeDescription(data: Progress | null) {
  const quality = data?.naturalHomeQuality
  if (data?.naturalHomeV89QualityAllowlistTraining?.latest?.summary) {
    const summary = data.naturalHomeV89QualityAllowlistTraining.latest.summary
    return `V89 已用 V88 allowlist 数据训练并生成候选：通过下一轮训练 ${summary.passedForNextTraining ?? 0}/${
      summary.rowCount ?? 0
    }，平均分 ${formatNumber(summary.averageScore, 2)}。仍然是隐藏候选，不进入 /world。`
  }
  if (data?.naturalHomeV88QualityAllowlistDataset?.latest) {
    const latest = data.naturalHomeV88QualityAllowlistDataset.latest
    return `V88 已把 V87 通过图整理成下一轮训练数据集：训练 ${latest.trainSampleCount ?? 0} 张，验证 ${
      latest.validationSampleCount ?? 0
    } 张，失败反例 ${latest.negativeExampleCount ?? 0} 张只保留给 VisualJudge/回归复盘，不允许进入训练 target。`
  }
  if (data?.naturalHomeV87QualityLedger?.latest?.summary) {
    const summary = data.naturalHomeV87QualityLedger.latest.summary
    return `V87 已生成质量账本：允许下一轮训练 ${summary.allowRowCount ?? 0} 条，失败反例 ${
      summary.negativeRowCount ?? 0
    } 条，失败类型 ${summary.failureCodeCount ?? 0} 类。失败图只做门控和复盘，不能成为训练 target。`
  }
  if (data?.naturalHomeV51SafeCandidatePack?.latest?.summary) {
    const summary = data.naturalHomeV51SafeCandidatePack.latest.summary
    return `V51 已把 V50 中严格合格的候选整理成安全候选包：${summary.safeRowCount ?? 0}/${
      summary.requiredSafeRows ?? 0
    }，平均分 ${formatNumber(summary.averageScore, 2)}。它只用于下一阶段训练或审核，不会直接进入 /world。`
  }
  if (data?.naturalHomeBestTrainingCandidate?.stage) {
    const best = data.naturalHomeBestTrainingCandidate
    return `当前最佳候选是 ${best.stage}，通过 ${best.summary?.passedForNextTraining ?? 0}/${
      best.summary?.rowCount ?? 0
    }，平均分 ${formatNumber(best.summary?.averageScore, 2)}。未通过的图只保留记录，不进入 /world。`
  }
  if (data?.naturalHomeRefiner?.inferenceReady) {
    return "纯自然家园本地训练链已跑通：数据、结构条件、RGB 细化和本地推理都已具备。当前任务是继续提高泛化与水体稳定性。"
  }
  if (quality) {
    const optional = quality.optionalLowVarietyChannels?.length ?? 0
    return `质量报告：样本 ${quality.sampleCount ?? 0}/${quality.minimumMvpSampleCount ?? 50}，阻断 ${
      quality.blockedSampleCount ?? 0
    }，可选低变化通道 ${optional}。`
  }
  return (
    data?.naturalHomeReadiness?.goalZh ??
    "当前只允许草地、树木、石头、花草、水体、水岸和自然小径。建筑、施工、人物、动物和动态内容暂不进入这一阶段。"
  )
}

export function buildNaturalHomeAction(data: Progress | null): { label: string; action: TrainingAction } | undefined {
  if (!data?.naturalHomeReadiness?.canStartTraining && !data?.naturalHomeQuality) {
    return { label: "检查源图", action: "report_natural_home" }
  }
  if (!data?.naturalHomeTraining?.inferenceReady) {
    return { label: "开始基础训练", action: "full_natural_home" }
  }
  if (!data.naturalHomeStructure?.inferenceReady) {
    return { label: "继续结构训练", action: "full_natural_home_structure_guided" }
  }
  if (!data.naturalHomeRefiner?.inferenceReady) {
    return { label: "继续 RGB 细化", action: "full_natural_home_rgb_refiner" }
  }
  if (!data.naturalHomeV43V32FailureFocusRepair?.inferenceReady) {
    return { label: "启动 V43 失败样本专项训练", action: "full_natural_home_v43_v32_failure_focus_repair" }
  }
  if (!data.naturalHomeV44V32StableGeneralization?.inferenceReady) {
    return { label: "启动 V44 稳定泛化训练", action: "full_natural_home_v44_v32_stable_generalization" }
  }
  if (!data.naturalHomeV45Generalization?.inferenceReady) {
    return { label: "启动 V45 泛化数据训练", action: "full_natural_home_v45_generalization" }
  }
  if (!data.naturalHomeV46V45FailureFocusRepair?.inferenceReady) {
    return { label: "启动 V46 失败样本修复训练", action: "full_natural_home_v46_v45_failure_focus_repair" }
  }
  if (!data.naturalHomeV47HardFailureStabilization?.inferenceReady) {
    return { label: "启动 V47 硬失败稳定化训练", action: "full_natural_home_v47_hard_failure_stabilization" }
  }
  if (!data.naturalHomeV48SplitExpertMergeGate?.inferenceReady) {
    return { label: "启动 V48 局部专家合并门", action: "full_natural_home_v48_split_expert_merge_gate" }
  }
  if (!data.naturalHomeV49V32DiversitySweep?.inferenceReady) {
    return { label: "启动 V49 多样自然家园扫描", action: "full_natural_home_v49_v32_diversity_sweep" }
  }
  if (!data.naturalHomeV50DiversityWaterGate?.inferenceReady) {
    return { label: "启动 V50 多样性与水体门控", action: "full_natural_home_v50_diversity_water_gate" }
  }
  if (!data.naturalHomeV51SafeCandidatePack?.inferenceReady) {
    return { label: "生成 V51 严格安全候选包", action: "full_natural_home_v51_safe_candidate_pack" }
  }
  if (!data.naturalHomeV87QualityLedger?.inferenceReady) {
    return { label: "启动 V87 质量账本", action: "full_natural_home_v87_quality_ledger" }
  }
  if (!data.naturalHomeV88QualityAllowlistDataset?.inferenceReady) {
    return { label: "准备 V88 allowlist 训练集", action: "full_natural_home_v88_quality_allowlist_dataset" }
  }
  if (!data.naturalHomeV89QualityAllowlistTraining?.inferenceReady) {
    return { label: "启动 V89 allowlist 训练", action: "full_natural_home_v89_quality_allowlist_training" }
  }
  return undefined
}

export function calculateVisiblePercent(data: Progress | null, busy: boolean) {
  if (!data) return 0
  if (!busy) return 100

  if (data.control.action === "full_natural_home") {
    return Math.min(100, Math.round(((data.naturalHomeTraining?.latest?.epoch ?? 0) / 80) * 100))
  }
  if (data.control.action === "full_natural_home_structure_guided") {
    return Math.min(100, Math.round(((data.naturalHomeStructure?.latest?.epoch ?? 0) / 120) * 100))
  }
  if (data.control.action === "full_natural_home_rgb_refiner") {
    return Math.min(100, Math.round(((data.naturalHomeRefiner?.latest?.epoch ?? 0) / 180) * 100))
  }
  if (data.control.action === "full_natural_home_v39_failure_focus_repair") {
    return Math.min(100, Math.round(((data.naturalHomeV39FailureFocusRepair?.trainingLatest?.epoch ?? 0) / 40) * 100))
  }
  if (data.control.action === "full_natural_home_v40_sharpness_lock_repair") {
    return Math.min(100, Math.round(((data.naturalHomeV40SharpnessLockRepair?.trainingLatest?.epoch ?? 0) / 24) * 100))
  }
  if (data.control.action === "full_natural_home_v41_v32_water_rescue") {
    return Math.min(100, Math.round(((data.naturalHomeV41V32WaterRescue?.trainingLatest?.epoch ?? 0) / 18) * 100))
  }
  if (data.control.action === "full_natural_home_v43_v32_failure_focus_repair") {
    return Math.min(100, Math.round(((data.naturalHomeV43V32FailureFocusRepair?.trainingLatest?.epoch ?? 0) / 24) * 100))
  }
  if (data.control.action === "full_natural_home_v44_v32_stable_generalization") {
    return Math.min(100, Math.round(((data.naturalHomeV44V32StableGeneralization?.trainingLatest?.epoch ?? 0) / 16) * 100))
  }
  if (data.control.action === "full_natural_home_v45_generalization") {
    return Math.min(100, Math.round(((data.naturalHomeV45Generalization?.trainingLatest?.epoch ?? 0) / 22) * 100))
  }
  if (data.control.action === "full_natural_home_v46_v45_failure_focus_repair") {
    return Math.min(100, Math.round(((data.naturalHomeV46V45FailureFocusRepair?.trainingLatest?.epoch ?? 0) / 18) * 100))
  }
  if (data.control.action === "full_natural_home_v47_hard_failure_stabilization") {
    return Math.min(100, Math.round(((data.naturalHomeV47HardFailureStabilization?.trainingLatest?.epoch ?? 0) / 16) * 100))
  }
  if (data.control.action === "full_natural_home_v89_quality_allowlist_training") {
    return Math.min(100, Math.round(((data.naturalHomeV89QualityAllowlistTraining?.trainingLatest?.epoch ?? 0) / 8) * 100))
  }
  if (
    data.control.action === "full_natural_home_v42_water_expert_fix" ||
    data.control.action === "full_natural_home_v48_split_expert_merge_gate" ||
    data.control.action === "full_natural_home_v49_v32_diversity_sweep" ||
    data.control.action === "full_natural_home_v50_diversity_water_gate" ||
    data.control.action === "full_natural_home_v51_safe_candidate_pack" ||
    data.control.action === "full_natural_home_v87_quality_ledger" ||
    data.control.action === "full_natural_home_v88_quality_allowlist_dataset"
  ) {
    return 100
  }
  if (data.control.action === "full_natural_home_v18_source_expert_bank") {
    const sourceCount = data.naturalHomeSourceExpertBank?.latest?.sourceCount ?? 0
    return Math.min(100, Math.round((sourceCount / 3) * 100))
  }
  if (data.control.action === "full_natural_home_v19_promoted_source") {
    const sourceCount = data.naturalHomePromotedSource?.latest?.sourceCount ?? 0
    return Math.min(100, Math.round(sourceCount * 100))
  }
  if (data.control.action === "full_natural_home_v20_multisource_generalization") {
    const sourceCount = data.naturalHomeMultisourceGeneralization?.latest?.sourceCount ?? 0
    return Math.min(100, Math.round((sourceCount / 3) * 100))
  }
  if (data.control.action === "full_structure_guided") {
    return Math.min(100, Math.round(((data.structureGuided.latest?.epoch ?? 0) / 160) * 100))
  }
  if (data.control.action === "full_discrete_assets") {
    const epochs = Object.values(data.discreteAssets.latestByCategory ?? {}).reduce(
      (sum, item) => sum + (item?.epoch ?? 0),
      0,
    )
    return Math.min(100, Math.round((epochs / 400) * 100))
  }
  return data.training.percent ?? 0
}

export function calculateMvpPercent(data: Progress | null) {
  if (!data) return 0
  let score = 0
  if (data.naturalHomeReadiness?.canStartTraining || data.naturalHomeQuality) score += 10
  if (data.naturalHomeQuality?.canTrainMvpV1) score += 15
  if (data.naturalHomeTraining?.inferenceReady) score += 15
  if (data.naturalHomeStructure?.inferenceReady) score += 15
  if (data.naturalHomeRefiner?.inferenceReady) score += 10
  if (data.naturalHomeSourceExpertBank?.inferenceReady) score += 5
  if (data.naturalHomePromotedSource?.inferenceReady) score += 5
  if (data.naturalHomeMultisourceGeneralization?.inferenceReady) score += 5
  if (data.naturalHomeV49V32DiversitySweep?.inferenceReady) score += 5
  if (data.naturalHomeV50DiversityWaterGate?.inferenceReady) score += 5
  if (data.naturalHomeV51SafeCandidatePack?.inferenceReady) score += 5
  if (data.naturalHomeV87QualityLedger?.inferenceReady) score += 5
  if (data.naturalHomeV88QualityAllowlistDataset?.inferenceReady) score += 5
  if (data.naturalHomeV89QualityAllowlistTraining?.inferenceReady) score += 5
  if (data.training.inferenceReady) score += 5
  if (data.structureGuided.checkpointReady) score += 5
  if (data.rgbRefiner.checkpointReady) score += 5
  if (data.localAssets.compositeReady) score += 5
  if (data.discreteAssets.compositeReady) score += 5
  if (data.componentReadiness?.canStartAutonomousTraining) score += 5
  if ((data.trainingExpansion.manifest?.sampleCount ?? 0) >= 20) score += 5
  return Math.min(100, score)
}

export function formatNumber(value?: number | null, digits = 2) {
  return typeof value === "number" && Number.isFinite(value) ? value.toFixed(digits) : "--"
}

export function translateQualityStatus(status?: string) {
  if (status === "mvp_ready") return "MVP 可训练"
  if (status === "experiment_only") return "仅实验可训练"
  if (status === "blocked") return "阻断"
  return "未知"
}

export function translateNextActions(actions: string[]) {
  const labels: Record<string, string> = {
    add_more_natural_home_training_png: "继续补充纯世界训练图",
    improve_or_quarantine_blocked_samples: "修复或隔离阻断样本",
    add_missing_channel_variety: "补齐缺失通道变化",
    train_natural_home_mvp_v1: "继续训练自然家园 MVP v1",
  }
  return actions.map((action) => labels[action] ?? action).join("；")
}
