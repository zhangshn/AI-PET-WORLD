/**
 * 当前文件负责：把世界状态整理成圆形小地图展示数据。
 */

import type { WorldEngineViewState } from "../../hooks/useWorldEngineState"
import type { WorldHudBundle } from "../../utils/worldHudMappers"

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

function resolvePetMarker(input: {
  world: WorldEngineViewState
}): Pick<WorldMiniMapMarker, "helperText" | "x" | "y"> {
  const pet = input.world.pet

  if (!pet) {
    return {
      helperText: "等待抵达",
      x: 64,
      y: 40,
    }
  }

  if (pet.currentGoal?.type === "expand_territory") {
    return {
      helperText: "短程探索中",
      x: 78,
      y: 32,
    }
  }

  if (pet.currentGoal?.type === "observe_boundary") {
    return {
      helperText: "边界观察中",
      x: 73,
      y: 38,
    }
  }

  if (pet.action === "sleeping" || pet.action === "resting") {
    return {
      helperText: pet.action,
      x: 42,
      y: 61,
    }
  }

  if (pet.action === "eating") {
    return {
      helperText: pet.action,
      x: 50,
      y: 66,
    }
  }

  if (pet.action === "exploring" || pet.action === "walking") {
    return {
      helperText: pet.action,
      x: 70,
      y: 36,
    }
  }

  if (pet.action === "observing" || pet.action === "alert_idle") {
    return {
      helperText: pet.action,
      x: 66,
      y: 42,
    }
  }

  return {
    helperText: pet.action ?? "活动中",
    x: 64,
    y: 40,
  }
}

function resolveButlerMarker(input: {
  world: WorldEngineViewState
}): Pick<WorldMiniMapMarker, "helperText" | "x" | "y"> {
  const butler = input.world.butler
  const petGoalType = input.world.pet?.currentGoal?.type

  if (!butler) {
    return {
      helperText: "管理中",
      x: 58,
      y: 56,
    }
  }

  if (
    petGoalType === "expand_territory" ||
    petGoalType === "observe_boundary"
  ) {
    return {
      helperText: `${butler.task} · 关注边界`,
      x: 64,
      y: 48,
    }
  }

  if (butler.task === "watching_incubator") {
    return {
      helperText: butler.task,
      x: 49,
      y: 52,
    }
  }

  if (butler.task === "building_home") {
    return {
      helperText: butler.task,
      x: 40,
      y: 63,
    }
  }

  return {
    helperText: butler.task ?? "管理中",
    x: 58,
    y: 56,
  }
}

function buildMarkers(world: WorldEngineViewState): WorldMiniMapMarker[] {
  const petMarker = resolvePetMarker({ world })
  const butlerMarker = resolveButlerMarker({ world })

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
      label: "领养抵达",
      helperText: world.pet
        ? "宠物已抵达"
        : world.adoptionState.status,
      x: 49,
      y: 50,
      tone: "incubator",
      isVisible: Boolean(world.adoptionState),
    },
    {
      id: "butler",
      label: "管家",
      helperText: butlerMarker.helperText,
      x: butlerMarker.x,
      y: butlerMarker.y,
      tone: "butler",
      isVisible: Boolean(world.butler),
    },
    {
      id: "pet",
      label: "宠物",
      helperText: petMarker.helperText,
      x: petMarker.x,
      y: petMarker.y,
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
