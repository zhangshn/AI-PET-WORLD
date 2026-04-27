/**
 * 当前文件负责：处理宠物行为切换的稳定控制，避免行为每个 Tick 频繁跳变。
 */

import type { PetAction } from "../../../types/pet"

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

const ACTION_MIN_DURATION: Record<PetAction, number> = {
  sleeping: 4,
  eating: 3,
  walking: 3,
  exploring: 4,
  approaching: 3,
  idle: 2,
  observing: 3,
  resting: 3,
  alert_idle: 3,
}

const ACTION_TRANSITIONS: Record<PetAction, PetAction[]> = {
  sleeping: ["idle", "resting", "eating"],
  eating: ["idle", "resting", "walking"],
  resting: ["idle", "sleeping", "walking"],
  idle: [
    "walking",
    "observing",
    "resting",
    "eating",
    "sleeping",
    "alert_idle",
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
  ],
  approaching: [
    "idle",
    "walking",
    "eating",
    "observing",
    "resting",
  ],
  observing: [
    "idle",
    "walking",
    "exploring",
    "approaching",
    "alert_idle",
  ],
  alert_idle: [
    "observing",
    "idle",
    "walking",
    "resting",
  ],
}

export function applyPetActionStability(
  input: ApplyPetActionStabilityInput
): ApplyPetActionStabilityResult {
  if (!input.stability) {
    return {
      action: input.candidate,
      stability: {
        currentAction: input.candidate,
        startedAtTick: input.currentTick,
        lastChangedTick: input.currentTick,
      },
      reason: "stability_accept_transition",
    }
  }

  const current = input.stability.currentAction
  const held = input.currentTick - input.stability.startedAtTick
  const min = ACTION_MIN_DURATION[current]

  if (input.energy <= 6 && current !== "sleeping") {
    return {
      action: "sleeping",
      stability: {
        currentAction: "sleeping",
        startedAtTick: input.currentTick,
        lastChangedTick: input.currentTick,
      },
      reason: "hard_low_energy",
    }
  }

  if (input.hunger >= 95 && current !== "eating") {
    return {
      action: "eating",
      stability: {
        currentAction: "eating",
        startedAtTick: input.currentTick,
        lastChangedTick: input.currentTick,
      },
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

  if (held < min) {
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
      stability: {
        currentAction: bridgeAction,
        startedAtTick: input.currentTick,
        lastChangedTick: input.currentTick,
      },
      reason: "stability_accept_transition",
    }
  }

  return {
    action: input.candidate,
    stability: {
      currentAction: input.candidate,
      startedAtTick: input.currentTick,
      lastChangedTick: input.currentTick,
    },
    reason: "stability_accept_transition",
  }
}

function resolveBridgeAction(
  current: PetAction,
  candidate: PetAction
): PetAction {
  if (current === "sleeping") return "idle"
  if (current === "eating") return "idle"
  if (current === "resting") return "idle"
  if (candidate === "exploring" || candidate === "approaching") return "walking"
  if (candidate === "sleeping") return "resting"
  if (candidate === "eating") return "walking"
  if (candidate === "alert_idle") return "observing"

  return "idle"
}