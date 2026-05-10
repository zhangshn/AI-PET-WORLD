/**
 * 当前文件负责：把世界后台状态翻译成像素舞台氛围意图。
 */

import type {
  HomeConstructionStage,
} from "@/types/home"

import type {
  BuildWorldVisualIntentInput,
  WorldVisualIntent,
  WorldVisualIntentActiveFocusArea,
  WorldVisualIntentAtmosphere,
  WorldVisualIntentHomeGrowthFocus,
  WorldVisualIntentTimeTone,
} from "./actor-visual-intent-types"

function clampIntensity(value: number): number {
  if (!Number.isFinite(value)) return 0

  return Math.max(0, Math.min(100, Math.round(value)))
}

function resolveTimeTone(
  input: BuildWorldVisualIntentInput
): WorldVisualIntentTimeTone {
  const period = input.time?.period

  if (period === "Morning") return "morning"
  if (period === "Daytime") return "day"
  if (period === "Evening") return "evening"
  if (period === "Night") return "night"

  const hour = input.time?.hour ?? 12

  if (hour >= 6 && hour < 12) return "morning"
  if (hour >= 12 && hour < 18) return "day"
  if (hour >= 18 && hour < 22) return "evening"

  return "night"
}

function mapHomeGrowthFocus(
  stage: HomeConstructionStage | undefined
): WorldVisualIntentHomeGrowthFocus {
  if (stage === "temporary_shelter") return "shelter"
  if (stage === "foundation") return "foundation"
  if (stage === "frame") return "frame"
  if (stage === "roof") return "roof"
  if (stage === "interior") return "interior"
  if (stage === "garden") return "garden"
  if (stage === "completed") return "completed"

  return null
}

function resolveActiveFocusArea(
  input: BuildWorldVisualIntentInput,
  homeGrowthFocus: WorldVisualIntentHomeGrowthFocus
): WorldVisualIntentActiveFocusArea {
  if (input.incubator?.hasEmbryo && input.incubator.status !== "hatched") {
    return "incubator"
  }

  if (
    homeGrowthFocus === "garden" ||
    input.home?.spaceSummary?.primarySpaceId === "garden_area"
  ) {
    return "garden"
  }

  if (
    homeGrowthFocus === "shelter" ||
    input.home?.spaceSummary?.primarySpaceId === "temporary_shelter"
  ) {
    return "shelter"
  }

  if (input.home) return "home"

  return null
}

function resolveAtmosphere(input: {
  timeTone: WorldVisualIntentTimeTone
  homeGrowthFocus: WorldVisualIntentHomeGrowthFocus
  activeFocusArea: WorldVisualIntentActiveFocusArea
}): WorldVisualIntentAtmosphere {
  if (input.timeTone === "night") return "quiet"
  if (input.activeFocusArea === "garden") return "warm"
  if (
    input.homeGrowthFocus === "frame" ||
    input.homeGrowthFocus === "roof" ||
    input.homeGrowthFocus === "interior"
  ) {
    return "active"
  }

  return "calm"
}

export function buildWorldVisualIntent(
  input: BuildWorldVisualIntentInput
): WorldVisualIntent {
  const timeTone = resolveTimeTone(input)
  const homeGrowthFocus = mapHomeGrowthFocus(
    input.home?.constructionStage
  )
  const activeFocusArea = resolveActiveFocusArea(input, homeGrowthFocus)
  const atmosphere = resolveAtmosphere({
    timeTone,
    homeGrowthFocus,
    activeFocusArea,
  })

  return {
    timeTone,
    homeGrowthFocus,
    activeFocusArea,
    atmosphere,
    intensity: clampIntensity(
      (input.home?.progress ?? 0) * 0.35 +
        (input.home?.gardenProgress ?? 0) * 0.25 +
        (input.incubator?.progress ?? 0) * 0.2
    ),
    reasonTags: [
      "world_visual_intent",
      `time_${timeTone}`,
      homeGrowthFocus
        ? `home_growth_${homeGrowthFocus}`
        : "home_growth_none",
      activeFocusArea
        ? `active_focus_${activeFocusArea}`
        : "active_focus_none",
      `atmosphere_${atmosphere}`,
      input.worldRuntime ? "runtime_available" : "runtime_none",
    ],
  }
}
