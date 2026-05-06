/**
 * 当前文件负责：处理宠物行为切换的稳定控制，避免行为每个 Tick 频繁跳变。
 */

import type { PetAction } from "../../../types/pet"

import {
  ACTION_MIN_DURATION_TUNING,
} from "./pet-action-tuning"

export type ActionDecisionReason =
  | "bootstrap_default"
  | "hard_low_energy"
  | "hard_extreme_hunger"
  | "goal_guided_selection"
  | "stability_hold_min_duration"
  | "stability_accept_transition"
  | "attention_hold_current"

export type ActionStabilityState = {
  currentAction: PetAction
  startedAtTick: number
  lastChangedTick: number
}

export type ShouldHoldCurrentActionInput = {
  tick: number
  currentAction: PetAction
  candidateAction: PetAction
}

export type ApplyPetActionStabilityInput = {
  currentTick: number
  candidate: PetAction
  currentPetAction: PetAction
  energy: number
  hunger: number
  stability: ActionStabilityState | null
  shouldHoldCurrentAction: (input: ShouldHoldCurrentActionInput) => boolean
}

export type ApplyPetActionStabilityResult = {
  action: PetAction
  stability: ActionStabilityState
  reason: ActionDecisionReason
}

/**
 * 行为转换图。
 *
 * 这里控制的是“可见行为是否能自然过渡”，不是决定宠物想做什么。
 * 内部意图已经由 selector / expression 决定，这里只负责让动作变化看起来不跳。
 */
const ACTION_TRANSITIONS: Record<PetAction, PetAction[]> = {
  sleeping: [
    "idle",
    "resting",
    "observing",
    "eating",
  ],

  eating: [
    "idle",
    "resting",
    "walking",
    "observing",
  ],

  resting: [
    "idle",
    "sleeping",
    "walking",
    "observing",
    "alert_idle",
    "eating",
  ],

  idle: [
    "walking",
    "observing",
    "resting",
    "eating",
    "sleeping",
    "alert_idle",
    "approaching",
  ],

  walking: [
    "idle",
    "observing",
    "exploring",
    "approaching",
    "eating",
    "resting",
    "alert_idle",
  ],

  exploring: [
    "walking",
    "observing",
    "approaching",
    "idle",
    "resting",
    "alert_idle",
  ],

  approaching: [
    "idle",
    "walking",
    "eating",
    "observing",
    "resting",
    "alert_idle",
  ],

  observing: [
    "idle",
    "walking",
    "exploring",
    "approaching",
    "alert_idle",
    "resting",
    "eating",
  ],

  alert_idle: [
    "observing",
    "idle",
    "walking",
    "resting",
    "approaching",
  ],
}

function buildStabilityState(input: {
  action: PetAction
  currentTick: number
}): ActionStabilityState {
  return {
    currentAction: input.action,
    startedAtTick: input.currentTick,
    lastChangedTick: input.currentTick,
  }
}

function isUrgentCandidate(action: PetAction): boolean {
  return (
    action === "sleeping" ||
    action === "eating" ||
    action === "alert_idle"
  )
}

function shouldBypassMinDuration(input: {
  current: PetAction
  candidate: PetAction
  energy: number
  hunger: number
}): boolean {
  if (input.energy <= 10 && input.candidate === "resting") {
    return true
  }

  if (input.energy <= 6 && input.candidate === "sleeping") {
    return true
  }

  if (input.hunger >= 90 && input.candidate === "eating") {
    return true
  }

  if (
    input.candidate === "alert_idle" &&
    (
      input.current === "walking" ||
      input.current === "exploring" ||
      input.current === "approaching" ||
      input.current === "observing"
    )
  ) {
    return true
  }

  return false
}

function resolveBridgeAction(
  current: PetAction,
  candidate: PetAction
): PetAction {
  if (current === candidate) {
    return current
  }

  if (current === "sleeping") {
    if (candidate === "resting") return "resting"
    if (candidate === "observing") return "observing"
    if (candidate === "eating") return "eating"

    return "idle"
  }

  if (current === "eating") {
    if (candidate === "resting") return "resting"
    if (candidate === "observing") return "observing"
    if (candidate === "walking") return "walking"

    return "idle"
  }

  if (current === "resting") {
    if (candidate === "observing") return "observing"
    if (candidate === "alert_idle") return "alert_idle"
    if (candidate === "walking") return "walking"
    if (candidate === "sleeping") return "sleeping"
    if (candidate === "eating") return "eating"

    return "idle"
  }

  if (current === "idle") {
    if (candidate === "exploring") return "walking"
    if (candidate === "approaching") return "walking"
    if (candidate === "sleeping") return "resting"

    return candidate
  }

  if (current === "walking") {
    if (candidate === "sleeping") return "resting"
    if (candidate === "eating") return "eating"
    if (candidate === "alert_idle") return "alert_idle"

    return candidate
  }

  if (current === "exploring") {
    if (candidate === "sleeping") return "resting"
    if (candidate === "eating") return "walking"
    if (candidate === "alert_idle") return "observing"
    if (candidate === "approaching") return "walking"

    return candidate
  }

  if (current === "approaching") {
    if (candidate === "sleeping") return "resting"
    if (candidate === "exploring") return "walking"
    if (candidate === "alert_idle") return "observing"

    return candidate
  }

  if (current === "observing") {
    if (candidate === "sleeping") return "resting"
    if (candidate === "eating") return "eating"

    return candidate
  }

  if (current === "alert_idle") {
    if (candidate === "exploring") return "walking"
    if (candidate === "approaching") return "observing"
    if (candidate === "sleeping") return "resting"

    return candidate
  }

  return "idle"
}

export function applyPetActionStability(
  input: ApplyPetActionStabilityInput
): ApplyPetActionStabilityResult {
  if (!input.stability) {
    return {
      action: input.candidate,
      stability: buildStabilityState({
        action: input.candidate,
        currentTick: input.currentTick,
      }),
      reason: "stability_accept_transition",
    }
  }

  const current = input.stability.currentAction
  const held = input.currentTick - input.stability.startedAtTick
  const min = ACTION_MIN_DURATION_TUNING[current]

  if (input.energy <= 6 && current !== "sleeping") {
    return {
      action: "sleeping",
      stability: buildStabilityState({
        action: "sleeping",
        currentTick: input.currentTick,
      }),
      reason: "hard_low_energy",
    }
  }

  if (input.hunger >= 95 && current !== "eating") {
    return {
      action: "eating",
      stability: buildStabilityState({
        action: "eating",
        currentTick: input.currentTick,
      }),
      reason: "hard_extreme_hunger",
    }
  }

  if (
    input.shouldHoldCurrentAction({
      tick: input.currentTick,
      currentAction: current,
      candidateAction: input.candidate,
    })
  ) {
    return {
      action: current,
      stability: input.stability,
      reason: "attention_hold_current",
    }
  }

  if (input.candidate === current) {
    return {
      action: current,
      stability: input.stability,
      reason: "stability_hold_min_duration",
    }
  }

  const canBypassMinDuration = shouldBypassMinDuration({
    current,
    candidate: input.candidate,
    energy: input.energy,
    hunger: input.hunger,
  })

  if (
    held < min &&
    !canBypassMinDuration &&
    !isUrgentCandidate(input.candidate)
  ) {
    return {
      action: current,
      stability: input.stability,
      reason: "stability_hold_min_duration",
    }
  }

  const allowedNextActions = ACTION_TRANSITIONS[current] ?? ["idle"]

  if (!allowedNextActions.includes(input.candidate)) {
    const bridgeAction = resolveBridgeAction(current, input.candidate)

    return {
      action: bridgeAction,
      stability: buildStabilityState({
        action: bridgeAction,
        currentTick: input.currentTick,
      }),
      reason: "stability_accept_transition",
    }
  }

  return {
    action: input.candidate,
    stability: buildStabilityState({
      action: input.candidate,
      currentTick: input.currentTick,
    }),
    reason: "stability_accept_transition",
  }
}