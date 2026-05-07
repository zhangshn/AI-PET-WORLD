/**
 * 当前文件负责：登记 MVP 阶段的世界设施定义。
 */

import type {
  WorldFacilityDefinition,
  WorldFacilityId,
  WorldFacilityProgressState,
  WorldProgressionState,
} from "./world-progression-types"

export const WORLD_FACILITY_DEFINITIONS: WorldFacilityDefinition[] = [
  {
    id: "home_base",
    title: "家园核心",
    description: "初始生态区的基础生活空间。",
    plannedMessage: "家园核心已经进入整理阶段。",
    completedMessage: "家园核心已经建成，初始生态区具备了稳定生活空间。",
    order: 1,
  },
  {
    id: "community_board",
    title: "社区公告栏",
    description: "用于发布世界消息、活动与公共提示。",
    plannedMessage: "社区公告栏开始搭建，未来世界通知会逐步集中到这里。",
    completedMessage: "社区公告栏已经建成，世界公告与社区活动会从这里发布。",
    order: 2,
  },
  {
    id: "pet_park",
    title: "宠物公园",
    description: "宠物未来进行观察、探索和社交的公共区域。",
    plannedMessage: "宠物公园开始规划，生态区正在整理新的活动空间。",
    completedMessage: "宠物公园已经开放，宠物之后会拥有更多自主活动空间。",
    order: 3,
  },
  {
    id: "pet_clinic",
    title: "宠物诊所",
    description: "未来承载健康、恢复、护理与异常状态处理。",
    plannedMessage: "宠物诊所开始整理，恢复与护理相关设施正在准备。",
    completedMessage: "宠物诊所已经完成基础整理，未来可以承载健康与恢复事件。",
    order: 4,
  },
  {
    id: "small_town",
    title: "小镇入口",
    description: "未来连接更大世界、商店、医院和社区系统的入口。",
    plannedMessage: "小镇入口开始规划，初始生态区正在向外扩展。",
    completedMessage: "小镇入口已经开放，世界后续会逐步连接更多区域。",
    order: 5,
  },
]

export function getWorldFacilityDefinition(
  facilityId: WorldFacilityId
): WorldFacilityDefinition {
  const definition = WORLD_FACILITY_DEFINITIONS.find(
    (facility) => facility.id === facilityId
  )

  if (!definition) {
    throw new Error(`未知世界设施：${facilityId}`)
  }

  return definition
}

function createInitialFacilityState(
  facilityId: WorldFacilityId
): WorldFacilityProgressState {
  return {
    id: facilityId,
    status: facilityId === "home_base" ? "building" : "locked",
    progress: facilityId === "home_base" ? 1 : 0,
    startedAtDay: facilityId === "home_base" ? 1 : null,
    activatedAtDay: null,
    lastProgressDay: null,
  }
}

export function createInitialWorldProgressionState(): WorldProgressionState {
  const entries = WORLD_FACILITY_DEFINITIONS.map((definition) => [
    definition.id,
    createInitialFacilityState(definition.id),
  ])

  return {
    facilities: Object.fromEntries(entries) as Record<
      WorldFacilityId,
      WorldFacilityProgressState
    >,
    lastUpdatedTick: 0,
  }
}