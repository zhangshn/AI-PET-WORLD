/**
 * ======================================================
 * AI-PET-WORLD
 * Timeline System - State Updater
 * ======================================================
 *
 * 【文件职责】
 * 这是时间线系统里的“状态更新器”。
 *
 * 它负责：
 * 1. 根据时间推进做基础状态漂移
 * 2. 根据 fortune.phaseTag 做阶段偏移
 * 3. 根据事件做定向修正
 * 4. 根据 playerRelation 做轻量关系/情绪偏移
 * 5. 做情绪自然回落
 * 6. 最终输出新的 PetState
 *
 * ------------------------------------------------------
 * 【这一版目标】
 *
 * 1. 保持现有 state 系统稳定
 * 2. 保持恢复曲线自然
 * 3. 增加情绪回落层
 * 4. 避免 excited / alert / irritated 长期常驻
 * ======================================================
 */

import type { TemporalInfluence } from "../fortune/fortune-types"
import type {
  CognitiveLabel,
  EmotionalLabel,
  PetState,
  PhysicalLabel,
  PrimaryDrive,
  RelationalLabel
} from "./state-types"

/**
 * ======================================================
 * 玩家关系（最小接入版）
 * ======================================================
 */
export type PlayerRelationInput = {
  familiarity: number
  attachment: number
  trust: number
  distance: number
}

/**
 * ======================================================
 * 事件类型
 * ======================================================
 */
export type TimelineStateEventType =
  | "time_passed"
  | "fed"
  | "rested"
  | "comforted"
  | "disturbed"
  | "bonding"
  | "ignored"
  | "stimulated"

/**
 * ======================================================
 * 单次状态更新事件
 * ======================================================
 */
export type StateUpdateEvent = {
  type: TimelineStateEventType
  intensity?: number
}

/**
 * ======================================================
 * 更新输入
 * ======================================================
 */
export interface UpdatePetStateInput {
  currentState: PetState
  fortune: TemporalInfluence
  events?: StateUpdateEvent[]
  tickDelta?: number
  playerRelation?: PlayerRelationInput
}

/**
 * ======================================================
 * 内部标签阶梯
 * ======================================================
 */
const EMOTIONAL_ORDER: readonly EmotionalLabel[] = [
  "low",
  "anxious",
  "irritated",
  "alert",
  "neutral",
  "curious",
  "content",
  "relaxed",
  "excited"
]

const COGNITIVE_ORDER: readonly CognitiveLabel[] = [
  "avoidant",
  "stressed",
  "hesitant",
  "idle",
  "observing",
  "curious",
  "focused"
]

const RELATIONAL_ORDER: readonly RelationalLabel[] = [
  "distant",
  "guarded",
  "neutral",
  "secure",
  "attached"
]

/**
 * ======================================================
 * 常量：自然衰减缓冲
 * ======================================================
 */
const NATURAL_MIN_ENERGY = 8
const NATURAL_MAX_HUNGER = 92

/**
 * ======================================================
 * 数值工具
 * ======================================================
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function round(value: number): number {
  return Math.round(value)
}

/**
 * ======================================================
 * 阶梯推进工具
 * ======================================================
 */
function shiftLabelInOrder<T extends string>(
  current: T,
  order: readonly T[],
  step: number
): T {
  const index = Math.max(0, order.indexOf(current))
  const nextIndex = clamp(index + step, 0, order.length - 1)
  return order[nextIndex]
}

/**
 * ======================================================
 * 根据 energy / hunger 推导 physical.label
 * ======================================================
 */
function derivePhysicalLabel(
  energy: number,
  hunger: number
): PhysicalLabel {
  if (energy <= 14 || hunger >= 90) {
    return "weak"
  }

  if (energy <= 30) {
    return "tired"
  }

  if (energy <= 46 && hunger <= 58) {
    return "recovering"
  }

  if (hunger >= 66) {
    return "hungry"
  }

  if (energy >= 82 && hunger <= 26) {
    return "energetic"
  }

  return "stable"
}

/**
 * ======================================================
 * 轻量 phase 偏移
 * ======================================================
 */
function applyFortunePhaseBias(
  state: PetState,
  phaseTag?: string
): PetState {
  let emotionalLabel: EmotionalLabel = state.emotional.label
  let cognitiveLabel: CognitiveLabel = state.cognitive.label
  let relationalLabel: RelationalLabel = state.relational.label
  let energy = state.physical.energy
  let hunger = state.physical.hunger

  switch (phaseTag) {
    case "growth_phase":
      emotionalLabel = shiftLabelInOrder(emotionalLabel, EMOTIONAL_ORDER, 1)
      cognitiveLabel = shiftLabelInOrder(cognitiveLabel, COGNITIVE_ORDER, 1)
      hunger = clamp(hunger + 1, 0, 100)
      break

    case "withdrawal_phase":
      relationalLabel = shiftLabelInOrder(relationalLabel, RELATIONAL_ORDER, -1)
      cognitiveLabel = shiftLabelInOrder(cognitiveLabel, COGNITIVE_ORDER, -1)
      break

    case "recovery_phase":
      /**
       * 这里只做很轻的背景恢复，不做暴力回血
       */
      energy = clamp(energy + 0.5, 0, 100)
      break

    case "attachment_phase":
      relationalLabel = shiftLabelInOrder(relationalLabel, RELATIONAL_ORDER, 1)
      emotionalLabel = shiftLabelInOrder(emotionalLabel, EMOTIONAL_ORDER, 1)
      break

    case "sensitive_phase":
      emotionalLabel = shiftLabelInOrder(emotionalLabel, EMOTIONAL_ORDER, -1)
      break

    case "stable_phase":
    default:
      break
  }

  return {
    ...state,
    emotional: {
      ...state.emotional,
      label: emotionalLabel
    },
    cognitive: {
      ...state.cognitive,
      label: cognitiveLabel
    },
    relational: {
      ...state.relational,
      label: relationalLabel
    },
    physical: {
      ...state.physical,
      energy: round(energy),
      hunger: round(hunger),
      label: derivePhysicalLabel(energy, hunger)
    }
  }
}

/**
 * ======================================================
 * playerRelation 轻量偏移
 * ======================================================
 */
function applyPlayerRelationBias(
  state: PetState,
  playerRelation?: PlayerRelationInput
): PetState {
  if (!playerRelation) {
    return state
  }

  const { familiarity, attachment, trust, distance } = playerRelation

  let emotionalLabel: EmotionalLabel = state.emotional.label
  let relationalLabel: RelationalLabel = state.relational.label

  if (trust >= 70) {
    if (emotionalLabel === "anxious" || emotionalLabel === "irritated") {
      emotionalLabel = shiftLabelInOrder(emotionalLabel, EMOTIONAL_ORDER, 1)
    } else if (emotionalLabel === "low") {
      emotionalLabel = "anxious"
    }
  } else if (trust >= 50) {
    if (emotionalLabel === "anxious") {
      emotionalLabel = "alert"
    }
  }

  if (attachment >= 75) {
    relationalLabel = shiftLabelInOrder(relationalLabel, RELATIONAL_ORDER, 1)
  } else if (attachment >= 55) {
    if (relationalLabel === "neutral") {
      relationalLabel = "secure"
    }
  }

  if (familiarity >= 65) {
    if (relationalLabel === "guarded") {
      relationalLabel = "neutral"
    }
  }

  if (distance >= 75) {
    relationalLabel = shiftLabelInOrder(relationalLabel, RELATIONAL_ORDER, -1)

    if (
      emotionalLabel === "neutral" ||
      emotionalLabel === "relaxed" ||
      emotionalLabel === "content"
    ) {
      emotionalLabel = shiftLabelInOrder(emotionalLabel, EMOTIONAL_ORDER, -1)
    }
  } else if (distance >= 55) {
    if (relationalLabel === "secure") {
      relationalLabel = "neutral"
    }
  }

  return {
    ...state,
    emotional: {
      ...state.emotional,
      label: emotionalLabel
    },
    relational: {
      ...state.relational,
      label: relationalLabel
    }
  }
}

/**
 * ======================================================
 * 判断是否处于恢复类行为
 * ======================================================
 */
function detectRecoveryMode(events: StateUpdateEvent[]): {
  isSleepingLike: boolean
  isRestingLike: boolean
  isEatingLike: boolean
} {
  let restedIntensity = 0
  let fedIntensity = 0
  let stimulatedIntensity = 0
  let disturbedIntensity = 0

  for (const event of events) {
    const intensity = clamp(event.intensity ?? 0.5, 0, 1.5)

    if (event.type === "rested") {
      restedIntensity += intensity
    }

    if (event.type === "fed") {
      fedIntensity += intensity
    }

    if (event.type === "stimulated") {
      stimulatedIntensity += intensity
    }

    if (event.type === "disturbed") {
      disturbedIntensity += intensity
    }
  }

  const isSleepingLike =
    restedIntensity >= 0.8 &&
    stimulatedIntensity < 0.2 &&
    disturbedIntensity < 0.2

  const isRestingLike =
    restedIntensity >= 0.35 &&
    !isSleepingLike

  const isEatingLike =
    fedIntensity >= 0.45

  return {
    isSleepingLike,
    isRestingLike,
    isEatingLike
  }
}

/**
 * ======================================================
 * 识别当前事件对情绪的整体语气
 * ======================================================
 */
function analyzeEmotionalContext(events: StateUpdateEvent[]) {
  let stimulated = 0
  let disturbed = 0
  let rested = 0
  let fed = 0
  let comforted = 0
  let bonding = 0
  let ignored = 0
  let timePassed = 0

  for (const event of events) {
    const intensity = clamp(event.intensity ?? 0.5, 0, 1.5)

    switch (event.type) {
      case "stimulated":
        stimulated += intensity
        break
      case "disturbed":
        disturbed += intensity
        break
      case "rested":
        rested += intensity
        break
      case "fed":
        fed += intensity
        break
      case "comforted":
        comforted += intensity
        break
      case "bonding":
        bonding += intensity
        break
      case "ignored":
        ignored += intensity
        break
      case "time_passed":
      default:
        timePassed += intensity
        break
    }
  }

  return {
    stimulated,
    disturbed,
    rested,
    fed,
    comforted,
    bonding,
    ignored,
    timePassed,
  }
}

/**
 * ======================================================
 * 计算时间推进对生理层的影响
 * ======================================================
 */
function computeNaturalDecay(params: {
  tickDelta: number
  hasEvents: boolean
  events: StateUpdateEvent[]
}): { energyLoss: number; hungerGain: number } {
  const { tickDelta, hasEvents, events } = params

  if (tickDelta <= 0) {
    return {
      energyLoss: 0,
      hungerGain: 0
    }
  }

  const recoveryMode = detectRecoveryMode(events)

  if (hasEvents && recoveryMode.isSleepingLike) {
    if (tickDelta <= 1) {
      return {
        energyLoss: 0.15,
        hungerGain: 1.0
      }
    }

    if (tickDelta <= 6) {
      return {
        energyLoss: 0.8 + tickDelta * 0.15,
        hungerGain: 2 + tickDelta * 0.45
      }
    }
  }

  if (hasEvents && recoveryMode.isRestingLike) {
    if (tickDelta <= 1) {
      return {
        energyLoss: 0.35,
        hungerGain: 1.15
      }
    }

    if (tickDelta <= 6) {
      return {
        energyLoss: 1.4 + tickDelta * 0.25,
        hungerGain: 2.4 + tickDelta * 0.5
      }
    }
  }

  if (hasEvents) {
    if (tickDelta <= 1) {
      return {
        energyLoss: 1.2,
        hungerGain: 1.4
      }
    }

    if (tickDelta <= 6) {
      return {
        energyLoss: 3.5 + tickDelta * 0.55,
        hungerGain: 4 + tickDelta * 0.9
      }
    }

    const dayCount = Math.floor(tickDelta / 24)
    const hourRemainder = tickDelta % 24

    return {
      energyLoss: dayCount * 10 + hourRemainder * 0.7,
      hungerGain: dayCount * 13 + hourRemainder * 0.95
    }
  }

  if (tickDelta <= 1) {
    return {
      energyLoss: 1.6,
      hungerGain: 2.2
    }
  }

  if (tickDelta <= 6) {
    return {
      energyLoss: 7.5,
      hungerGain: 10
    }
  }

  const dayCount = Math.floor(tickDelta / 24)
  const hourRemainder = tickDelta % 24

  const energyLoss = dayCount * 15 + hourRemainder * 1.3
  const hungerGain = dayCount * 19 + hourRemainder * 1.7

  return {
    energyLoss,
    hungerGain
  }
}

/**
 * ======================================================
 * 应用自然时间流逝
 * ======================================================
 */
function applyNaturalTimeDrift(
  state: PetState,
  tickDelta: number,
  hasEvents: boolean,
  events: StateUpdateEvent[]
): PetState {
  const decay = computeNaturalDecay({
    tickDelta,
    hasEvents,
    events
  })

  const nextEnergy = clamp(
    state.physical.energy - decay.energyLoss,
    NATURAL_MIN_ENERGY,
    100
  )

  const nextHunger = clamp(
    state.physical.hunger + decay.hungerGain,
    0,
    NATURAL_MAX_HUNGER
  )

  return {
    ...state,
    physical: {
      ...state.physical,
      energy: round(nextEnergy),
      hunger: round(nextHunger),
      label: derivePhysicalLabel(nextEnergy, nextHunger)
    }
  }
}

/**
 * ======================================================
 * 计算恢复事件的动态恢复值
 * ======================================================
 */
function computeRestedRecovery(energy: number, intensity: number): number {
  if (energy <= 15) {
    return 7.5 * intensity
  }

  if (energy <= 30) {
    return 6.2 * intensity
  }

  if (energy <= 45) {
    return 5.0 * intensity
  }

  if (energy <= 60) {
    return 4.0 * intensity
  }

  if (energy <= 75) {
    return 2.8 * intensity
  }

  if (energy <= 88) {
    return 1.8 * intensity
  }

  return 0.9 * intensity
}

/**
 * ======================================================
 * 应用单个事件
 * ======================================================
 */
function applySingleEvent(
  state: PetState,
  event: StateUpdateEvent
): PetState {
  const intensity = clamp(event.intensity ?? 0.5, 0, 1.5)

  let energy = state.physical.energy
  let hunger = state.physical.hunger
  let emotionalLabel: EmotionalLabel = state.emotional.label
  let cognitiveLabel: CognitiveLabel = state.cognitive.label
  let relationalLabel: RelationalLabel = state.relational.label

  switch (event.type) {
    case "fed": {
      hunger = clamp(hunger - 24 * intensity, 0, 100)
      energy = clamp(energy + 2.2 * intensity, 0, 100)

      if (hunger < 62) {
        emotionalLabel = shiftLabelInOrder(emotionalLabel, EMOTIONAL_ORDER, 1)
      }

      break
    }

    case "rested": {
      const recoveredEnergy = computeRestedRecovery(energy, intensity)

      energy = clamp(energy + recoveredEnergy, 0, 100)
      hunger = clamp(hunger + 1.6 * intensity, 0, 100)

      cognitiveLabel = shiftLabelInOrder(cognitiveLabel, COGNITIVE_ORDER, 1)

      if (energy >= 38) {
        emotionalLabel = shiftLabelInOrder(emotionalLabel, EMOTIONAL_ORDER, 1)
      }

      break
    }

    case "comforted": {
      emotionalLabel = shiftLabelInOrder(emotionalLabel, EMOTIONAL_ORDER, 1)
      relationalLabel = shiftLabelInOrder(relationalLabel, RELATIONAL_ORDER, 1)

      if (
        cognitiveLabel === "avoidant" ||
        cognitiveLabel === "stressed" ||
        cognitiveLabel === "hesitant"
      ) {
        cognitiveLabel = shiftLabelInOrder(cognitiveLabel, COGNITIVE_ORDER, 1)
      }

      if (energy <= 35) {
        energy = clamp(energy + 2.5 * intensity, 0, 100)
      } else if (energy <= 55) {
        energy = clamp(energy + 1 * intensity, 0, 100)
      }

      hunger = clamp(hunger + 0.3 * intensity, 0, 100)
      break
    }

    case "bonding": {
      relationalLabel = shiftLabelInOrder(relationalLabel, RELATIONAL_ORDER, 1)
      emotionalLabel = shiftLabelInOrder(emotionalLabel, EMOTIONAL_ORDER, 1)

      if (
        cognitiveLabel === "hesitant" ||
        cognitiveLabel === "stressed"
      ) {
        cognitiveLabel = shiftLabelInOrder(cognitiveLabel, COGNITIVE_ORDER, 1)
      }

      if (energy <= 18) {
        energy = clamp(energy + 0.5 * intensity, 0, 100)
      } else {
        energy = clamp(energy - 1.6 * intensity, 0, 100)
      }

      hunger = clamp(hunger + 1.5 * intensity, 0, 100)
      break
    }

    case "disturbed": {
      emotionalLabel = shiftLabelInOrder(emotionalLabel, EMOTIONAL_ORDER, -1)
      cognitiveLabel = shiftLabelInOrder(cognitiveLabel, COGNITIVE_ORDER, -1)
      relationalLabel = shiftLabelInOrder(relationalLabel, RELATIONAL_ORDER, -1)

      energy = clamp(energy - 3 * intensity, 0, 100)
      hunger = clamp(hunger + 1.5 * intensity, 0, 100)
      break
    }

    case "ignored": {
      relationalLabel = shiftLabelInOrder(relationalLabel, RELATIONAL_ORDER, -1)
      emotionalLabel = shiftLabelInOrder(emotionalLabel, EMOTIONAL_ORDER, -1)

      energy = clamp(energy - 0.4 * intensity, 0, 100)
      hunger = clamp(hunger + 0.5 * intensity, 0, 100)
      break
    }

    case "stimulated": {
      cognitiveLabel = shiftLabelInOrder(cognitiveLabel, COGNITIVE_ORDER, 1)
      emotionalLabel = shiftLabelInOrder(emotionalLabel, EMOTIONAL_ORDER, 1)

      energy = clamp(energy - 3.2 * intensity, 0, 100)
      hunger = clamp(hunger + 2.2 * intensity, 0, 100)
      break
    }

    case "time_passed":
    default:
      break
  }

  return {
    ...state,
    emotional: {
      ...state.emotional,
      label: emotionalLabel
    },
    cognitive: {
      ...state.cognitive,
      label: cognitiveLabel
    },
    relational: {
      ...state.relational,
      label: relationalLabel
    },
    physical: {
      ...state.physical,
      energy: round(energy),
      hunger: round(hunger),
      label: derivePhysicalLabel(energy, hunger)
    }
  }
}

/**
 * ======================================================
 * 批量应用事件
 * ======================================================
 */
function applyEvents(
  state: PetState,
  events: StateUpdateEvent[]
): PetState {
  return events.reduce((acc, event) => {
    return applySingleEvent(acc, event)
  }, state)
}

/**
 * ======================================================
 * 情绪自然回落
 *
 * 目标：
 * - excited 不是永久常驻
 * - alert / irritated 在没有持续威胁时会慢慢回落
 * - resting / sleeping / eating / observing 有助于回到中性
 * ======================================================
 */
function applyEmotionalSettling(
  state: PetState,
  events: StateUpdateEvent[],
  phaseTag?: string
): PetState {
  if (events.length === 0) {
    return state
  }

  const context = analyzeEmotionalContext(events)
  let emotionalLabel: EmotionalLabel = state.emotional.label

  const recoveryMode = detectRecoveryMode(events)

  const hasStrongStimulus = context.stimulated >= 0.7
  const hasStrongDisturbance = context.disturbed >= 0.55
  const hasRecoverySupport =
    recoveryMode.isSleepingLike ||
    recoveryMode.isRestingLike ||
    recoveryMode.isEatingLike ||
    context.comforted >= 0.35 ||
    context.bonding >= 0.35

  const isMostlyPassive =
    context.timePassed > 0 &&
    context.stimulated < 0.2 &&
    context.disturbed < 0.2 &&
    context.rested < 0.2 &&
    context.fed < 0.2

  /**
   * 正向高情绪回落
   */
  if (!hasStrongStimulus) {
    if (emotionalLabel === "excited") {
      if (hasRecoverySupport) {
        emotionalLabel = "relaxed"
      } else if (isMostlyPassive) {
        emotionalLabel = "content"
      }
    } else if (emotionalLabel === "relaxed") {
      if (isMostlyPassive) {
        emotionalLabel = "content"
      }
    } else if (emotionalLabel === "content") {
      if (isMostlyPassive && phaseTag !== "attachment_phase") {
        emotionalLabel = "curious"
      }
    }
  }

  /**
   * 警觉 / 烦躁回落
   */
  if (!hasStrongDisturbance) {
    if (emotionalLabel === "irritated") {
      if (hasRecoverySupport || isMostlyPassive) {
        emotionalLabel = "alert"
      }
    } else if (emotionalLabel === "alert") {
      if (hasRecoverySupport || isMostlyPassive) {
        emotionalLabel = "neutral"
      }
    } else if (emotionalLabel === "anxious") {
      if (hasRecoverySupport) {
        emotionalLabel = "alert"
      }
    }
  }

  /**
   * recovery_phase 下再给一点额外平滑
   */
  if (phaseTag === "recovery_phase") {
    if (emotionalLabel === "excited") {
      emotionalLabel = "relaxed"
    } else if (emotionalLabel === "irritated") {
      emotionalLabel = "alert"
    }
  }

  /**
   * deep recovery（sleeping/resting）时，如果没有外部刺激，
   * 更容易往 neutral / relaxed 收束
   */
  if (
    !hasStrongStimulus &&
    !hasStrongDisturbance &&
    (recoveryMode.isSleepingLike || recoveryMode.isRestingLike)
  ) {
    if (emotionalLabel === "curious") {
      emotionalLabel = "neutral"
    } else if (emotionalLabel === "content") {
      emotionalLabel = "relaxed"
    }
  }

  return {
    ...state,
    emotional: {
      ...state.emotional,
      label: emotionalLabel
    }
  }
}

/**
 * ======================================================
 * 根据最终状态推导 drive
 * ======================================================
 */
function deriveDrivePrimary(
  state: PetState,
  phaseTag?: string,
  playerRelation?: PlayerRelationInput
): PrimaryDrive {
  const energy = state.physical.energy
  const hunger = state.physical.hunger
  const emotional: EmotionalLabel = state.emotional.label
  const cognitive: CognitiveLabel = state.cognitive.label
  const relational: RelationalLabel = state.relational.label

  if (hunger >= 90) return "eat"
  if (energy <= 10) return "rest"

  const mediumHunger = hunger >= 70
  const strongHunger = hunger >= 85
  const lowEnergy = energy <= 20

  if (playerRelation) {
    const { attachment, trust, distance } = playerRelation

    if (
      attachment >= 70 &&
      trust >= 60 &&
      !mediumHunger &&
      relational !== "guarded" &&
      relational !== "distant"
    ) {
      return "approach"
    }

    if (
      distance >= 75 &&
      (emotional === "anxious" ||
        emotional === "low" ||
        emotional === "irritated")
    ) {
      return "avoid"
    }
  }

  if (phaseTag === "growth_phase") {
    if (energy > 60 && hunger < 60) {
      return "explore"
    }

    if (energy > 35 && hunger < 75) {
      return "idle"
    }

    if (energy <= 35) {
      return "rest"
    }

    if (hunger >= 75) {
      return "eat"
    }
  }

  if (phaseTag === "sensitive_phase") {
    if (emotional === "irritated" || emotional === "anxious" || emotional === "low") {
      return "avoid"
    }

    if (emotional === "alert") {
      return "idle"
    }
  }

  if (phaseTag === "recovery_phase") {
    if (energy < 60) {
      return "rest"
    }

    if (
      relational === "secure" ||
      relational === "attached"
    ) {
      return "approach"
    }
  }

  if (phaseTag === "withdrawal_phase" && relational === "guarded") {
    return "avoid"
  }

  if (phaseTag === "attachment_phase") {
    if (!mediumHunger) {
      return "approach"
    }
  }

  if (
    emotional === "curious" ||
    emotional === "excited" ||
    emotional === "content"
  ) {
    if (!mediumHunger && !lowEnergy) {
      return "explore"
    }
  }

  if (
    emotional === "anxious" ||
    emotional === "irritated" ||
    emotional === "low"
  ) {
    return "avoid"
  }

  if (emotional === "alert") {
    if (relational === "guarded" || relational === "distant") {
      return "avoid"
    }

    return "idle"
  }

  if (
    relational === "secure" ||
    relational === "attached"
  ) {
    if (!strongHunger) {
      return "approach"
    }
  }

  if (
    relational === "guarded" ||
    relational === "distant"
  ) {
    return "avoid"
  }

  if (
    cognitive === "curious" ||
    cognitive === "focused"
  ) {
    if (!mediumHunger && !lowEnergy) {
      return "explore"
    }
  }

  if (strongHunger) return "eat"
  if (lowEnergy) return "rest"

  if (energy > 60 && hunger < 70) {
    if (relational === "secure" || relational === "attached") {
      return "approach"
    }

    return "explore"
  }

  if (energy > 35 && hunger < 80) {
    return "idle"
  }

  return "rest"
}

/**
 * ======================================================
 * 最终校正：避免极端锁死 / 软平台锁死
 * ======================================================
 */
function softenExtremeLock(
  state: PetState,
  events: StateUpdateEvent[]
): PetState {
  const hasStrongNegativeEvent = events.some(
    (event) =>
      (event.type === "disturbed" || event.type === "ignored") &&
      (event.intensity ?? 0.5) >= 0.9
  )

  if (hasStrongNegativeEvent) {
    return state
  }

  let energy = state.physical.energy
  let hunger = state.physical.hunger

  if (energy <= 0) {
    energy = 3
  }
  if (hunger >= 100) {
    hunger = 97
  }

  if (energy <= 8) {
    energy = 10
  }
  if (hunger >= 92) {
    hunger = 90
  }

  return {
    ...state,
    physical: {
      ...state.physical,
      energy: round(energy),
      hunger: round(hunger),
      label: derivePhysicalLabel(energy, hunger)
    }
  }
}

/**
 * ======================================================
 * 主函数：更新 PetState
 * ======================================================
 */
export function updatePetState(
  input: UpdatePetStateInput
): PetState {
  const tickDelta = Math.max(0, input.tickDelta ?? 0)
  const events = input.events ?? []
  const hasEvents = events.length > 0

  let nextState = input.currentState

  if (tickDelta > 0) {
    nextState = applyNaturalTimeDrift(
      input.currentState,
      tickDelta,
      hasEvents,
      events
    )
  }

  nextState = applyFortunePhaseBias(nextState, input.fortune.phaseTag)

  if (hasEvents) {
    nextState = applyEvents(nextState, events)
  }

  nextState = applyPlayerRelationBias(
    nextState,
    input.playerRelation
  )

  nextState = applyEmotionalSettling(
    nextState,
    events,
    input.fortune.phaseTag
  )

  nextState = softenExtremeLock(nextState, events)

  const nextDrive = deriveDrivePrimary(
    nextState,
    input.fortune.phaseTag,
    input.playerRelation
  )

  return {
    ...nextState,
    drive: {
      ...nextState.drive,
      primary: nextDrive
    },
    physical: {
      ...nextState.physical,
      energy: round(clamp(nextState.physical.energy, 0, 100)),
      hunger: round(clamp(nextState.physical.hunger, 0, 100)),
      label: derivePhysicalLabel(
        clamp(nextState.physical.energy, 0, 100),
        clamp(nextState.physical.hunger, 0, 100)
      )
    }
  }
}