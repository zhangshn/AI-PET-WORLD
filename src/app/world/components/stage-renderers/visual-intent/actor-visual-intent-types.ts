/**
 * 当前文件负责：定义角色与世界视觉意图类型。
 *
 * VisualIntent 只描述前端像素表现倾向，不改变后台行为。
 */

import type {
  TimeState,
} from "@/engine/timeSystem"
import type {
  ButlerState,
} from "@/types/butler"
import type {
  HomeState,
} from "@/types/home"
import type {
  IncubatorState,
} from "@/types/incubator"
import type {
  PetState,
} from "@/types/pet"
import type {
  WorldRuntimeState,
} from "@/world/runtime/world-runtime"

export type ActorVisualIntentActor = "pet" | "butler"

export type ActorVisualIntentPose =
  | "idle"
  | "walk"
  | "observe"
  | "sleep"
  | "eat"
  | "work"
  | "offer"
  | "alert"
  | "rest"

export type ActorVisualIntentMotionStyle =
  | "still"
  | "wander"
  | "targeted"
  | "slow"
  | "quick"
  | "hesitate"

export type ActorVisualIntentFocusTarget =
  | "incubator"
  | "garden"
  | "shelter"
  | "pet"
  | "butler"
  | "boundary"
  | "home"
  | null

export type ActorVisualIntentEmotionTone =
  | "calm"
  | "curious"
  | "alert"
  | "tired"
  | "warm"
  | "focused"

export type ActorVisualIntent = {
  actor: ActorVisualIntentActor
  pose: ActorVisualIntentPose
  motionStyle: ActorVisualIntentMotionStyle
  focusTarget: ActorVisualIntentFocusTarget
  emotionTone: ActorVisualIntentEmotionTone
  intensity: number
  reasonTags: string[]
}

export type WorldVisualIntentTimeTone =
  | "morning"
  | "day"
  | "evening"
  | "night"

export type WorldVisualIntentHomeGrowthFocus =
  | "shelter"
  | "foundation"
  | "frame"
  | "roof"
  | "interior"
  | "garden"
  | "completed"
  | null

export type WorldVisualIntentActiveFocusArea =
  | "incubator"
  | "garden"
  | "shelter"
  | "home"
  | null

export type WorldVisualIntentAtmosphere =
  | "calm"
  | "active"
  | "warm"
  | "quiet"

export type WorldVisualIntent = {
  timeTone: WorldVisualIntentTimeTone
  homeGrowthFocus: WorldVisualIntentHomeGrowthFocus
  activeFocusArea: WorldVisualIntentActiveFocusArea
  atmosphere: WorldVisualIntentAtmosphere
  intensity: number
  reasonTags: string[]
}

export type BuildWorldVisualIntentInput = {
  time: TimeState | null
  home: HomeState | null
  incubator: IncubatorState | null
  worldRuntime: WorldRuntimeState | null
}

export type StageVisualIntentSnapshot = {
  pet: ActorVisualIntent | null
  butler: ActorVisualIntent | null
  world: WorldVisualIntent
}

export type BuildStageVisualIntentSnapshotInput = {
  pet: PetState | null
  butler: ButlerState | null
  time: TimeState | null
  home: HomeState | null
  incubator: IncubatorState | null
  worldRuntime: WorldRuntimeState | null
}
