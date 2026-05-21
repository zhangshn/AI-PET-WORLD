/**
 * 当前文件职责：从正式视觉模型片段生成玩家可读 HUD 摘要。
 */

import type { VisualState } from "@/world/rendering/renderer-gateway"

import type {
  FormalActorModel,
  FormalHudSummary,
  FormalPetStatusToken,
  FormalVisualSourceTrace,
  FormalWorldObjectModel,
} from "./formal-visual-model-schema"

export type BuildFormalHudSummaryInput = {
  visualState: VisualState
  actorModels: FormalActorModel[]
  objectModels: FormalWorldObjectModel[]
}

export function buildFormalHudSummary(
  input: BuildFormalHudSummaryInput
): FormalHudSummary {
  const petStatus = buildFormalPetStatus(input.actorModels)

  return {
    worldId: input.visualState.worldId,
    worldPhaseLabel: buildWorldPhaseLabel(input),
    butlerStatusLabel: buildButlerStatusLabel(input.actorModels),
    petStatus,
    petStatusLabel: buildPetStatusLabel(petStatus),
    recentLogHint: buildRecentLogHint(input),
    playerFacingNotes: buildPlayerFacingNotes(input),
    source: buildHudSourceTrace(input.visualState),
    auditTags: [
      "formal_hud_summary_v0",
      "source:visual_state",
    ],
  }
}

function buildWorldPhaseLabel(input: BuildFormalHudSummaryInput): string {
  if (input.objectModels.length === 0) {
    return "世界正在等待生成"
  }

  return "家园正在稳定运行"
}

function buildButlerStatusLabel(actorModels: FormalActorModel[]): string {
  const hasButler = actorModels.some(
    (actorModel) => actorModel.actorKind === "butler"
  )

  if (hasButler) {
    return "管家已进入家园"
  }

  return "管家暂未进入可视范围"
}

function buildFormalPetStatus(
  actorModels: FormalActorModel[]
): FormalPetStatusToken {
  const hasPet = actorModels.some(
    (actorModel) => actorModel.actorKind === "pet"
  )

  return hasPet ? "present" : "notEntered"
}

function buildPetStatusLabel(petStatus: FormalPetStatusToken): string {
  if (petStatus === "present") return "宠物已进入主世界"
  if (petStatus === "accepted") return "宠物已被接纳"
  if (petStatus === "lifeTraceOnly") return "出现生命痕迹"
  if (petStatus === "notEntered") return "宠物尚未进入主世界"

  return "宠物状态未知"
}

function buildRecentLogHint(input: BuildFormalHudSummaryInput): string {
  if (input.objectModels.length === 0) {
    return "暂无可观察的家园变化"
  }

  return "可以查看最近的家园变化"
}

function buildPlayerFacingNotes(input: BuildFormalHudSummaryInput): string[] {
  return [
    `当前可视世界对象：${input.objectModels.length}`,
    `当前可视生命对象：${input.actorModels.length}`,
  ]
}

function buildHudSourceTrace(visualState: VisualState): FormalVisualSourceTrace {
  return {
    source: "visual_state",
    sourceId: visualState.worldId,
    worldId: visualState.worldId,
  }
}
