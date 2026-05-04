/**
 * 当前文件负责：转换 world 观察记录的展示文案。
 */

import type { NarrativeType, WorldEvent } from "@/types/event"

export type WorldObservationViewModel = {
  id: string
  category: string
  timeLabel: string
  focus: string | null
  title: string
  summary: string
  detail: string
}

function getPayloadNumber(
  payload: Record<string, unknown> | undefined,
  key: string
): number | null {
  const value = payload?.[key]

  return typeof value === "number" ? value : null
}

function getPayloadString(
  payload: Record<string, unknown> | undefined,
  key: string
): string | null {
  const value = payload?.[key]

  return typeof value === "string" ? value : null
}

function getNarrativeLabel(narrativeType?: NarrativeType): string {
  if (narrativeType === "observe_environment") return "观察"
  if (narrativeType === "discover") return "发现"
  if (narrativeType === "approach_target") return "靠近"
  if (narrativeType === "keep_distance") return "保持距离"
  if (narrativeType === "satisfy_need") return "满足需求"
  if (narrativeType === "recover") return "恢复"
  if (narrativeType === "linger") return "停留"

  return "自然反应"
}

function getActionTitle(action?: string): string {
  if (action === "sleeping") return "进入休息"
  if (action === "eating") return "开始进食"
  if (action === "walking") return "移动中"
  if (action === "exploring") return "探索区域"
  if (action === "approaching") return "尝试靠近"
  if (action === "idle") return "短暂停留"
  if (action === "observing") return "观察环境"
  if (action === "resting") return "恢复状态"
  if (action === "alert_idle") return "保持警觉"

  return "行为变化"
}

function getActionSummary(action?: string): string {
  if (action === "sleeping") return "外界刺激影响降低。"
  if (action === "eating") return "生存需求正在牵引行为。"
  if (action === "walking") return "正在重新确认周围位置。"
  if (action === "exploring") return "活动范围正在扩大。"
  if (action === "approaching") return "接触意愿正在出现。"
  if (action === "idle") return "暂时没有进入新行为。"
  if (action === "observing") return "行动前的判断更明显。"
  if (action === "resting") return "正在降低消耗并恢复。"
  if (action === "alert_idle") return "仍在保持距离和警觉。"

  return "状态正在自然切换。"
}

function getIntensityText(intensity?: number): string {
  if (typeof intensity !== "number") return ""

  if (intensity >= 0.75) return "反应明显"
  if (intensity >= 0.45) return "反应中等"
  if (intensity > 0) return "轻微反应"

  return ""
}

function getContinuityText(payload?: Record<string, unknown>): string {
  const continuityStep = payload?.continuityStep

  if (typeof continuityStep === "number" && continuityStep > 1) {
    return `连续行为 ${continuityStep}`
  }

  return ""
}

function joinSummaryParts(parts: string[]): string {
  return parts.filter(Boolean).join(" · ")
}

function getButlerOpportunityTitle(event: WorldEvent): string {
  const opportunityType = event.payload?.opportunityType

  if (opportunityType === "food_offer") return "食物机会"
  if (opportunityType === "rest_offer") return "恢复机会"
  if (opportunityType === "approach_offer") return "接近机会"

  return "管家机会"
}

function getButlerOpportunitySummary(event: WorldEvent): string {
  const accepted = event.payload?.accepted
  const opportunityType = event.payload?.opportunityType

  if (opportunityType === "food_offer") {
    return accepted === true
      ? "宠物自主接受了食物。"
      : "宠物这次没有接受食物。"
  }

  if (opportunityType === "rest_offer") {
    return accepted === true
      ? "宠物正在利用恢复环境。"
      : "恢复环境存在，但宠物还未停下。"
  }

  if (opportunityType === "approach_offer") {
    return accepted === true
      ? "关系距离正在缩短。"
      : "宠物仍在保持距离。"
  }

  return "管家创造了一个机会。"
}

function getButlerOpportunityDetail(event: WorldEvent): string {
  const petName = event.petName ?? "宠物"
  const accepted = event.payload?.accepted

  if (accepted === true) {
    return `管家只是提供机会，真正的选择来自 ${petName} 自己。`
  }

  return `管家无法直接控制 ${petName}，只能创造条件。`
}

function getIncubatorCareSummary(event: WorldEvent): string {
  const progressAdded = getPayloadNumber(event.payload, "progressAdded")
  const stabilityAdded = getPayloadNumber(event.payload, "stabilityAdded")

  return joinSummaryParts([
    "管家正在维持孵化器稳定。",
    progressAdded !== null ? `孵化 +${progressAdded}` : "",
    stabilityAdded !== null ? `稳定 +${stabilityAdded}` : "",
  ])
}

function getIncubatorCareDetail(event: WorldEvent): string {
  const butlerName = getPayloadString(event.payload, "butlerName") ?? "管家"

  return `${butlerName}正在照看孵化器。这个阶段的重点不是干预生命性格，而是保证生命能稳定完成孵化。`
}

function getHomeConstructionSummary(event: WorldEvent): string {
  const buildAmount = getPayloadNumber(event.payload, "buildAmount")
  const progressAdded = getPayloadNumber(event.payload, "progressAdded")
  const constructionStage =
    getPayloadString(event.payload, "constructionStage") ?? "建设中"

  return joinSummaryParts([
    `家园正在推进到「${constructionStage}」。`,
    buildAmount !== null ? `投入 ${buildAmount}` : "",
    progressAdded !== null ? `进度 +${progressAdded}` : "",
  ])
}

function getHomeConstructionDetail(event: WorldEvent): string {
  const butlerName = getPayloadString(event.payload, "butlerName") ?? "管家"
  const constructionStage =
    getPayloadString(event.payload, "constructionStage") ?? "当前阶段"

  return `${butlerName}正在维护和建设家园。家园建设不会优先于宠物的明确生存需求；当宠物状态稳定时，管家会继续推进「${constructionStage}」。`
}

function getHomeCompletedDetail(event: WorldEvent): string {
  const level = getPayloadNumber(event.payload, "level")
  const levelText = level !== null ? `Lv.${level}` : "新的阶段"

  return `家园第一阶段已经完成，当前进入 ${levelText}。它会继续作为宠物活动、恢复和建立关系的基础空间。`
}

function getInteractionTitle(event: WorldEvent): string {
  const interactionKind = event.payload?.interactionKind

  if (interactionKind === "butler_opportunity") {
    return getButlerOpportunityTitle(event)
  }

  if (interactionKind === "pet_recovery") {
    return "自主恢复"
  }

  if (interactionKind === "incubator_care") {
    return "孵化照看"
  }

  if (interactionKind === "home_construction") {
    return "家园建设"
  }

  if (interactionKind === "home_completed") {
    return "家园完成"
  }

  return "世界互动"
}

function getInteractionSummary(event: WorldEvent): string {
  const interactionKind = event.payload?.interactionKind

  if (interactionKind === "butler_opportunity") {
    return getButlerOpportunitySummary(event)
  }

  if (interactionKind === "pet_recovery") {
    return "宠物正在恢复精力。"
  }

  if (interactionKind === "incubator_care") {
    return getIncubatorCareSummary(event)
  }

  if (interactionKind === "home_construction") {
    return getHomeConstructionSummary(event)
  }

  if (interactionKind === "home_completed") {
    return "家园第一阶段已经完成。"
  }

  return event.message
}

function getInteractionDetail(event: WorldEvent): string {
  const interactionKind = event.payload?.interactionKind

  if (interactionKind === "butler_opportunity") {
    return getButlerOpportunityDetail(event)
  }

  if (interactionKind === "incubator_care") {
    return getIncubatorCareDetail(event)
  }

  if (interactionKind === "home_construction") {
    return getHomeConstructionDetail(event)
  }

  if (interactionKind === "home_completed") {
    return getHomeCompletedDetail(event)
  }

  return event.message
}

export function getWorldObservationCategoryLabel(event: WorldEvent): string {
  const interactionKind = event.payload?.interactionKind

  if (interactionKind === "butler_opportunity") return "管家机会"
  if (interactionKind === "pet_recovery") return "恢复记录"
  if (interactionKind === "incubator_care") return "孵化管理"
  if (interactionKind === "home_construction") return "家园管理"
  if (interactionKind === "home_completed") return "家园管理"

  switch (event.type) {
    case "pet_hatched":
    case "pet_action_changed":
    case "pet_action_narrative":
    case "pet_action_end":
    case "pet_mood_changed":
    case "pet_fortune_phase_changed":
    case "pet_trajectory_branch_changed":
      return "生命观察"
    case "incubator_progress_changed":
      return "孵化记录"
    case "time_period_changed":
      return "环境变化"
    case "interaction":
      return "世界互动"
    default:
      return "世界记录"
  }
}

export function buildWorldObservationViewModel(
  event: WorldEvent
): WorldObservationViewModel {
  const focus = event.petName ?? null
  const timeLabel = `Day ${event.day} · ${event.hour}:00`

  if (event.type === "pet_hatched") {
    const name = event.petName ?? "宠物"

    return {
      id: event.id,
      category: getWorldObservationCategoryLabel(event),
      timeLabel,
      focus: name,
      title: "生命诞生",
      summary: "新的生命正在适应世界。",
      detail: `${name}刚刚来到这个世界。它还没有形成稳定的行动节奏，正在通过环境、温度和管家的靠近来建立最初的安全感。`,
    }
  }

  if (
    event.type === "pet_action_changed" ||
    event.type === "pet_action_narrative"
  ) {
    const metaText = joinSummaryParts([
      getNarrativeLabel(event.narrativeType),
      getIntensityText(event.intensity),
      getContinuityText(event.payload),
    ])

    return {
      id: event.id,
      category: getWorldObservationCategoryLabel(event),
      timeLabel,
      focus,
      title: getActionTitle(event.sourceAction),
      summary: joinSummaryParts([
        getActionSummary(event.sourceAction),
        metaText,
      ]),
      detail: event.message,
    }
  }

  if (event.type === "pet_action_end") {
    const name = event.petName ?? "宠物"

    return {
      id: event.id,
      category: getWorldObservationCategoryLabel(event),
      timeLabel,
      focus,
      title: "行为结束",
      summary: "宠物正在重新选择下一段行为。",
      detail: `${name}完成了上一段行为。它没有被直接命令切换动作，而是在当前状态和环境刺激之间重新做出选择。`,
    }
  }

  if (event.type === "pet_mood_changed") {
    const name = event.petName ?? "宠物"

    return {
      id: event.id,
      category: getWorldObservationCategoryLabel(event),
      timeLabel,
      focus,
      title: "情绪变化",
      summary: "情绪会影响后续行为倾向。",
      detail: `${name}的情绪状态发生变化。这个变化会影响它接下来更愿意靠近、观察、探索，还是先恢复。`,
    }
  }

  if (event.type === "pet_fortune_phase_changed") {
    const name = event.petName ?? "宠物"

    return {
      id: event.id,
      category: getWorldObservationCategoryLabel(event),
      timeLabel,
      focus,
      title: "阶段倾向变化",
      summary: "行为概率被轻微改写。",
      detail: `${name}进入了新的生命阶段倾向。后续行为的概率会被轻微改写，但不会变成固定脚本。`,
    }
  }

  if (event.type === "pet_trajectory_branch_changed") {
    const name = event.petName ?? "宠物"

    return {
      id: event.id,
      category: getWorldObservationCategoryLabel(event),
      timeLabel,
      focus,
      title: "成长轨迹分支",
      summary: "长期行为路径出现变化。",
      detail: `${name}的成长轨迹出现了新的分支。它之后可能会更偏向某一种长期行为路径。`,
    }
  }

  if (event.type === "time_period_changed") {
    return {
      id: event.id,
      category: getWorldObservationCategoryLabel(event),
      timeLabel,
      focus: null,
      title: "时间段变化",
      summary: "世界节奏正在调整。",
      detail:
        "光线、温度和环境节奏正在变化。世界进入了新的时间段，生命体的行为优先级也可能随之调整。",
    }
  }

  if (event.type === "incubator_progress_changed") {
    return {
      id: event.id,
      category: getWorldObservationCategoryLabel(event),
      timeLabel,
      focus: null,
      title: "孵化推进",
      summary: "孵化器状态出现变化。",
      detail:
        "孵化器状态有了新的推进。管家会继续优先确认稳定度，但不会替未来的生命决定它将成为什么样。",
    }
  }

  if (event.type === "interaction") {
    return {
      id: event.id,
      category: getWorldObservationCategoryLabel(event),
      timeLabel,
      focus,
      title: getInteractionTitle(event),
      summary: getInteractionSummary(event),
      detail: getInteractionDetail(event),
    }
  }

  return {
    id: event.id,
    category: getWorldObservationCategoryLabel(event),
    timeLabel,
    focus,
    title: "世界记录",
    summary: event.message,
    detail: event.message,
  }
}

export function rewriteWorldObservationMessage(event: WorldEvent): string {
  return buildWorldObservationViewModel(event).detail
}

export function getWorldObservationDisplayKey(event: WorldEvent): string {
  const viewModel = buildWorldObservationViewModel(event)

  return [
    event.type,
    event.petName ?? "",
    event.sourceAction ?? "",
    event.narrativeType ?? "",
    event.continuityId ?? "",
    event.payload?.interactionKind ?? "",
    event.payload?.opportunityType ?? "",
    viewModel.title,
    viewModel.summary,
  ].join("::")
}

export function getDedupedLatestWorldObservations(
  events: WorldEvent[],
  limit = 7
): WorldEvent[] {
  const latestEvents = [...events].reverse()
  const result: WorldEvent[] = []
  const usedKeys = new Set<string>()

  for (const event of latestEvents) {
    const key = getWorldObservationDisplayKey(event)

    if (usedKeys.has(key)) {
      continue
    }

    usedKeys.add(key)
    result.push(event)

    if (result.length >= limit) {
      break
    }
  }

  return result
}

export function buildLatestWorldObservationViewModels(
  events: WorldEvent[],
  limit = 7
): WorldObservationViewModel[] {
  return getDedupedLatestWorldObservations(events, limit).map((event) =>
    buildWorldObservationViewModel(event)
  )
}