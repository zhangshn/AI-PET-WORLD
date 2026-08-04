import type { TrainingStageDetail } from "./current-training-dashboard-types"

export function stageLabel(stage: TrainingStageDetail) {
  if (stage.kind === "failure") return "首次冒烟失败"
  if (
    stage.kind === "smoke" &&
    stage.runId.includes("single-sample-overfit-smoke")
  )
    return `R2单样本Smoke · ${stage.resolution?.width ?? "--"}×${stage.resolution?.height ?? "--"}`
  if (stage.kind === "smoke") return "冒烟重试"
  return `Stage ${stage.resolutionStage ?? "--"} · ${stage.resolution?.width ?? "--"}×${stage.resolution?.height ?? "--"}`
}
