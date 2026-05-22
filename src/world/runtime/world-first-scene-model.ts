/**
 * 当前文件负责：生成正式世界首屏所需的可展示状态模型。
 */

import { buildWorldCreationRuntime } from "@/world/creation/world-creation-runtime"
import type { CreateWorldInput } from "@/world/creation/world-creation-schema"
import { buildEnvironmentStateFromHomeMap } from "@/world/environment/environment-gateway"
import { generateInitialHomeMap } from "@/world/generation/initial-home-generator"
import { buildPlacementGeometryAuditReport } from "@/world/geometry-audit/geometry-audit-gateway"
import type {
  ConstructionPlanSummary,
  HomeMapState,
  HomeResourceState,
  HomeZone,
} from "@/world/map-state/home-map-state-schema"
import {
  buildRenderableWorldSnapshot,
  buildVisualState,
  type RenderableWorldSnapshot,
} from "@/world/rendering/renderer-gateway"

export type WorldFirstSceneMilestone = {
  title: string
  description: string
  status: "ready" | "waiting" | "running"
}

export type WorldFirstSceneZone = {
  id: string
  label: string
  purpose: string
}

export type WorldFirstScenePlan = {
  id: string
  title: string
  progress: number
  statusLabel: string
  reason: string
}

export type WorldFirstSceneResource = {
  label: string
  value: number
  description: string
}

export type WorldFirstSceneModel = {
  title: string
  subtitle: string
  worldStatus: string
  worldId: string
  homeSummary: {
    mapSizeLabel: string
    zoneCount: number
    placementCount: number
  }
  milestones: WorldFirstSceneMilestone[]
  zones: WorldFirstSceneZone[]
  plans: WorldFirstScenePlan[]
  resources: WorldFirstSceneResource[]
  homeMapState: HomeMapState
  renderableWorldSnapshot: RenderableWorldSnapshot
}

export function buildWorldFirstSceneModel(input: {
  createWorldInput: CreateWorldInput
}): WorldFirstSceneModel {
  const runtime = buildWorldCreationRuntime({
    createWorldInput: input.createWorldInput,
  })
  const homeMapState = generateInitialHomeMap({
    worldId: runtime.worldId,
    ownerId: runtime.ownerId,
    birthSignature: runtime.birthSignature,
    worldSalt: runtime.worldSalt,
    butlerConstructionStyle: runtime.butlerConstructionStyle,
    now: runtime.now,
  })
  const environmentState = buildEnvironmentStateFromHomeMap({
    homeMapState,
    generatedAt: homeMapState.updatedAt,
  })
  const placementGeometryAudit = buildPlacementGeometryAuditReport({
    homeMapState,
    checkedAt: homeMapState.updatedAt,
  })
  const visualState = buildVisualState({
    homeMapState,
    environmentState,
    placementGeometryAudit,
    generatedAt: homeMapState.updatedAt,
  })
  const renderableWorldSnapshot = buildRenderableWorldSnapshot({
    visualState,
  })

  return {
    title: "世界已经启动",
    subtitle:
      "管家和第一片家园区域已经根据你的输入生成。这里是正式世界的第一幕，不是调试数据页。",
    worldStatus: buildWorldStatus(runtime.styleSource),
    worldId: runtime.worldId,
    homeSummary: {
      mapSizeLabel: `${homeMapState.mapSize.columns} × ${homeMapState.mapSize.rows}`,
      zoneCount: homeMapState.zones.length,
      placementCount: homeMapState.placements.length,
    },
    milestones: buildMilestones(),
    zones: homeMapState.zones.map(toFirstSceneZone),
    plans: homeMapState.constructionPlans.map(toFirstScenePlan),
    resources: buildResourceItems(homeMapState.resources),
    homeMapState,
    renderableWorldSnapshot,
  }
}

function buildWorldStatus(
  styleSource: "life_profile_core" | "deterministic_fallback"
): string {
  if (styleSource === "life_profile_core") {
    return "生命核心已连接，世界参数已生成。"
  }

  return "世界使用稳定备用参数生成。"
}

function buildMilestones(): WorldFirstSceneMilestone[] {
  return [
    {
      title: "管家已生成",
      description:
        "管家会作为世界管理者观察家园，并根据世界状态形成建设倾向。",
      status: "ready",
    },
    {
      title: "初始家园已形成",
      description:
        "系统已经生成初始区域、基础资源、临时住所和自然边界。",
      status: "ready",
    },
    {
      title: "世界状态已建立",
      description:
        "HomeMapState、VisualState 与 RenderableWorldSnapshot 已经建立。",
      status: "ready",
    },
    {
      title: "自主建设待启动",
      description: "后续将由管家的意图生成 MapDiff，再由 Renderer 渲染真实变化。",
      status: "waiting",
    },
  ]
}

function toFirstSceneZone(zone: HomeZone): WorldFirstSceneZone {
  return {
    id: zone.id,
    label: zone.name,
    purpose: zone.purpose,
  }
}

function toFirstScenePlan(plan: ConstructionPlanSummary): WorldFirstScenePlan {
  return {
    id: plan.id,
    title: plan.title,
    progress: Math.round(plan.progress),
    statusLabel: buildPlanStatusLabel(plan.status),
    reason: plan.reason,
  }
}

function buildPlanStatusLabel(status: ConstructionPlanSummary["status"]): string {
  if (status === "active") return "进行中"
  if (status === "completed") return "已完成"
  if (status === "paused") return "暂停"

  return "计划中"
}

function buildResourceItems(resources: HomeResourceState): WorldFirstSceneResource[] {
  return [
    {
      label: "地面稳定",
      value: Math.round(resources.groundHealth),
      description: "影响家园基础区域的可持续状态。",
    },
    {
      label: "自然生长",
      value: Math.round(resources.naturalGrowth),
      description: "影响草地、花草和自然边界的成长趋势。",
    },
    {
      label: "材料准备",
      value: Math.round(resources.materialReadiness),
      description: "影响管家后续建设和维护的启动速度。",
    },
    {
      label: "照护准备",
      value: Math.round(resources.careReadiness),
      description: "影响食物、水、休息点等照护设施的准备度。",
    },
  ]
}
