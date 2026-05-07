/**
 * 当前文件负责：把世界状态整理成圆形小地图展示数据。
 */

import type { WorldEngineViewState } from "../hooks/useWorldEngineState"
import type { WorldHudBundle } from "../utils/worldHudMappers"

import type {
  WorldMiniMapInfoItem,
  WorldMiniMapMarker,
  WorldMiniMapViewModel,
} from "./WorldMiniMapTypes"

function toRealLikeTimeLabel(timeLabel: string): string {
  if (!timeLabel || timeLabel === "--") return "--:--"

  return timeLabel
}

function buildInfoItems(hud: WorldHudBundle): WorldMiniMapInfoItem[] {
  return [
    {
      id: "date",
      label: "日期",
      value: "今天",
    },
    {
      id: "time",
      label: "时间",
      value: toRealLikeTimeLabel(hud.world.timeLabel),
    },
    {
      id: "weather",
      label: "天气",
      value: hud.world.weatherLabel,
    },
    {
      id: "period",
      label: "时段",
      value: hud.world.periodLabel,
    },
  ]
}

function buildMarkers(world: WorldEngineViewState): WorldMiniMapMarker[] {
  return [
    {
      id: "home",
      label: "家园",
      helperText: world.home ? "家园区域" : "等待生成",
      x: 37,
      y: 62,
      tone: "home",
      isVisible: Boolean(world.home),
    },
    {
      id: "incubator",
      label: "孵化器",
      helperText: world.pet ? "孵化完成" : "生命舱运行中",
      x: 49,
      y: 50,
      tone: "incubator",
      isVisible: Boolean(world.incubator),
    },
    {
      id: "butler",
      label: "管家",
      helperText: world.butler?.task ?? "管理中",
      x: 58,
      y: 56,
      tone: "butler",
      isVisible: Boolean(world.butler),
    },
    {
      id: "pet",
      label: "宠物",
      helperText: world.pet?.action ?? "等待诞生",
      x: 64,
      y: 40,
      tone: "pet",
      isVisible: Boolean(world.pet),
    },
  ]
}

export function buildWorldMiniMapViewModel(input: {
  world: WorldEngineViewState
  hud: WorldHudBundle
}): WorldMiniMapViewModel {
  return {
    areaName: "初始生态区",
    markers: buildMarkers(input.world),
    infoItems: buildInfoItems(input.hud),
  }
}