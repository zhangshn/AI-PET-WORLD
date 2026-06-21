import type { Progress, TrainingAction } from "./progress-types"

export function buildNaturalHomeStatus(data: Progress | null) {
  const quality = data?.naturalHomeQuality
  if (quality?.status === "blocked") return "质量阻断"
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
  if (data?.naturalHomeRefiner?.inferenceReady) {
    return "纯世界本地训练链已跑通：数据、基础模型、结构引导、RGB 细化。当前仍需继续提升画质，并通过 VisualJudge 与 ApprovedFrame。"
  }
  if (quality) {
    const optional = quality.optionalLowVarietyChannels?.length ?? 0
    return `质量报告：样本 ${quality.sampleCount ?? 0}/${quality.minimumMvpSampleCount ?? 50}，阻断 ${
      quality.blockedSampleCount ?? 0
    }，可选低变化通道 ${optional}。`
  }
  return (
    data?.naturalHomeReadiness?.goalZh ??
    "只允许草地、树木、石头、花草、水体、水岸和自然小径。当前阶段禁止建筑、施工、人物和动物。"
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
  return { label: "刷新质量报告", action: "report_natural_home_quality" }
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
  if (data.control.action === "full_natural_home_v18_source_expert_bank") {
    const sourceCount = data.naturalHomeSourceExpertBank?.latest?.sourceCount ?? 0
    return Math.min(100, Math.round((sourceCount / 3) * 100))
  }
  if (data.control.action === "full_natural_home_v19_promoted_source") {
    const sourceCount = data.naturalHomePromotedSource?.latest?.sourceCount ?? 0
    return Math.min(100, Math.round((sourceCount / 1) * 100))
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
