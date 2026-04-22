/**
 * ======================================================
 * AI-PET-WORLD
 * Goal System
 * ======================================================
 *
 * 当前文件负责：
 * 1. 基于紫微意识核 + 当前状态 + 世界时间 + 记忆 生成当前目标
 * 2. 让行为围绕目标持续，而不是每 tick 临时投票
 * 3. 让“过去经验”开始进入下一轮目标判断
 * ======================================================
 */

import type { TimeState } from "../engine/timeSystem"
import type { PetState } from "../types/pet"
import type { ZiweiConsciousnessKernel } from "../ai/consciousness/consciousness-gateway"
import type { PetMemoryState } from "../ai/memory-core/memory-gateway"

export type PetGoalType =
  | "expand_territory"
  | "observe_boundary"
  | "restore_self"
  | "satisfy_need"
  | "secure_attachment"
  | "preserve_distance"
  | "stabilize_state"
  | "idle_drift"

export type GoalPriority = "low" | "medium" | "high" | "critical"

export type PetGoalState = {
  type: PetGoalType
  priority: GoalPriority
  startedAtTick: number
  holdUntilTick: number
  summary: string
  source: "consciousness" | "body" | "world" | "relation" | "memory"
}

export type GoalSystemInput = {
  tick: number
  pet: Pick<
    PetState,
    | "energy"
    | "hunger"
    | "mood"
    | "timelineSnapshot"
    | "consciousnessProfile"
    | "memoryState"
  >
  time: TimeState
  previousGoal?: PetGoalState | null
}

function getEnergy(input: GoalSystemInput): number {
  return input.pet.timelineSnapshot?.state.physical.energy ?? input.pet.energy
}

function getHunger(input: GoalSystemInput): number {
  return input.pet.timelineSnapshot?.state.physical.hunger ?? input.pet.hunger
}

function getEmotion(input: GoalSystemInput): string {
  return input.pet.timelineSnapshot?.state.emotional.label ?? input.pet.mood
}

function getRelation(input: GoalSystemInput): string {
  return input.pet.timelineSnapshot?.state.relational.label ?? "neutral"
}

function getPhaseTag(input: GoalSystemInput): string {
  return input.pet.timelineSnapshot?.fortune.phaseTag ?? "stable_phase"
}

function getBranchTag(input: GoalSystemInput): string {
  return input.pet.timelineSnapshot?.trajectory.branchTag ?? "balanced"
}

function getKernel(input: GoalSystemInput): ZiweiConsciousnessKernel {
  return input.pet.consciousnessProfile
}

function getMemory(input: GoalSystemInput): PetMemoryState {
  return input.pet.memoryState
}

function buildGoalDuration(
  goalType: PetGoalType,
  kernel: ZiweiConsciousnessKernel,
  memory: PetMemoryState
): number {
  const baseMap: Record<PetGoalType, number> = {
    expand_territory: 4,
    observe_boundary: 3,
    restore_self: 4,
    satisfy_need: 3,
    secure_attachment: 3,
    preserve_distance: 3,
    stabilize_state: 4,
    idle_drift: 2,
  }

  let duration = baseMap[goalType]

  if (goalType === "expand_territory" && kernel.bias.changeSeeking >= 72) {
    duration += 2
  }

  if (goalType === "observe_boundary" && kernel.bias.observationBias >= 72) {
    duration += 2
  }

  if (goalType === "restore_self" && kernel.bias.restResistance >= 72) {
    duration -= 1
  }

  if (
    goalType === "restore_self" &&
    memory.selfImpression.recoveryConfidence >= 10
  ) {
    duration += 1
  }

  if (
    goalType === "expand_territory" &&
    memory.preferenceBias.exploreBias >= 10
  ) {
    duration += 1
  }

  return Math.max(2, duration)
}

function buildMemoryGoalOverride(
  input: GoalSystemInput
): Omit<PetGoalState, "startedAtTick" | "holdUntilTick"> | null {
  const time = input.time
  const memory = getMemory(input)
  const energy = getEnergy(input)
  const hunger = getHunger(input)
  const relation = getRelation(input)

  /**
   * 夜晚恢复经验很好：
   * 夜里更容易主动把目标切到恢复
   */
  if (
    (time.period === "Night" || time.hour >= 22 || time.hour <= 5) &&
    memory.worldImpression.nightSafetyBias >= 8 &&
    energy <= 70 &&
    hunger < 70
  ) {
    return {
      type: "restore_self",
      priority: "high",
      summary: "记忆表明夜晚恢复通常有效，当前目标偏向夜间回收。",
      source: "memory",
    }
  }

  /**
   * 探索长期被记成高代价：
   * 会更早转向恢复 / 观察
   */
  if (
    memory.worldImpression.explorationConfidence <= -8 &&
    energy <= 45
  ) {
    return {
      type: "restore_self",
      priority: "high",
      summary: "过去经验表明持续探索代价偏高，当前目标提前转向恢复。",
      source: "memory",
    }
  }

  /**
   * 观察长期有效：
   * 在不确定时更愿意先观察
   */
  if (
    memory.worldImpression.observationConfidence >= 8 &&
    (relation === "guarded" || relation === "distant")
  ) {
    return {
      type: "observe_boundary",
      priority: "medium",
      summary: "过去经验表明观察通常有效，当前目标倾向先看边界。",
      source: "memory",
    }
  }

  /**
   * 照料者可靠感高：
   * 更容易走向关系靠近 / 需求满足
   */
  if (
    memory.relationImpression.caretakerTrust >= 10 &&
    hunger >= 50
  ) {
    return {
      type: "satisfy_need",
      priority: "high",
      summary: "记忆表明外部照料在需求升高时可靠，当前目标偏向优先满足身体需要。",
      source: "memory",
    }
  }

  /**
   * 靠近经验总体安全：
   * 关系稳定时更容易设为关系目标
   */
  if (
    memory.relationImpression.approachSafety >= 8 &&
    (relation === "secure" || relation === "attached")
  ) {
    return {
      type: "secure_attachment",
      priority: "medium",
      summary: "靠近经验整体安全，当前目标偏向维持连接。",
      source: "memory",
    }
  }

  /**
   * 恢复经验强：
   * 在低能量时更果断地切恢复目标
   */
  if (
    memory.selfImpression.recoveryConfidence >= 10 &&
    energy <= 38
  ) {
    return {
      type: "restore_self",
      priority: "high",
      summary: "经验表明恢复通常有效，当前目标更快切到回收自身。",
      source: "memory",
    }
  }

  /**
   * 节律感高：
   * 夜晚更容易守节律，不乱冲
   */
  if (
    memory.selfImpression.rhythmConfidence >= 10 &&
    time.period === "Night" &&
    energy <= 60
  ) {
    return {
      type: "stabilize_state",
      priority: "medium",
      summary: "经验正在形成稳定节律，当前目标偏向顺着夜间节奏维持状态。",
      source: "memory",
    }
  }

  return null
}

function chooseGoal(
  input: GoalSystemInput
): Omit<PetGoalState, "startedAtTick" | "holdUntilTick"> {
  const energy = getEnergy(input)
  const hunger = getHunger(input)
  const emotion = getEmotion(input)
  const relation = getRelation(input)
  const phaseTag = getPhaseTag(input)
  const branchTag = getBranchTag(input)
  const kernel = getKernel(input)

  /**
   * 先吃记忆层修正
   */
  const memoryOverride = buildMemoryGoalOverride(input)
  if (memoryOverride) {
    return memoryOverride
  }

  if (energy <= 12) {
    return {
      type: "restore_self",
      priority: "critical",
      summary: "生理状态接近极限，当前目标转为恢复自身。",
      source: "body",
    }
  }

  if (hunger >= 68) {
    return {
      type: "satisfy_need",
      priority: "high",
      summary: "身体需求上升，当前目标转为满足进食需求。",
      source: "body",
    }
  }

  if (
    emotion === "alert" ||
    emotion === "irritated" ||
    phaseTag === "sensitive_phase" ||
    branchTag === "defense"
  ) {
    if (
      kernel.threatInterpretation === "observe_first" ||
      kernel.threatInterpretation === "stabilize_first"
    ) {
      return {
        type: "observe_boundary",
        priority: "high",
        summary: "当前世界读数偏不稳定，先观察边界而不直接进入。",
        source: "world",
      }
    }

    return {
      type: "preserve_distance",
      priority: "high",
      summary: "当前世界读数偏压迫，先维持距离与边界。",
      source: "world",
    }
  }

  if (
    relation === "secure" ||
    relation === "attached" ||
    phaseTag === "attachment_phase"
  ) {
    if (
      kernel.attachmentApproach === "warm_and_open" ||
      kernel.attachmentApproach === "relationship_as_anchor"
    ) {
      return {
        type: "secure_attachment",
        priority: "medium",
        summary: "当前目标偏向确认连接与维持关系靠近。",
        source: "relation",
      }
    }
  }

  if (energy <= 32 || phaseTag === "recovery_phase") {
    return {
      type: "restore_self",
      priority: "high",
      summary: "当前目标偏向恢复、回收与重新稳定状态。",
      source: "body",
    }
  }

  if (
    kernel.coreDrive === "expand" ||
    kernel.coreDrive === "breakthrough"
  ) {
    return {
      type: "expand_territory",
      priority: "medium",
      summary: "当前目标偏向向外扩展、试探新边界。",
      source: "consciousness",
    }
  }

  if (kernel.coreDrive === "understand") {
    return {
      type: "observe_boundary",
      priority: "medium",
      summary: "当前目标偏向先理解环境，再决定是否深入。",
      source: "consciousness",
    }
  }

  if (kernel.coreDrive === "stabilize") {
    return {
      type: "stabilize_state",
      priority: "medium",
      summary: "当前目标偏向维持秩序与稳定，不急于外扩。",
      source: "consciousness",
    }
  }

  if (kernel.coreDrive === "connect") {
    return {
      type: "secure_attachment",
      priority: "medium",
      summary: "当前目标偏向寻找连接与可依附的关系锚点。",
      source: "consciousness",
    }
  }

  return {
    type: "idle_drift",
    priority: "low",
    summary: "当前目标较弱，顺着状态缓慢漂移。",
    source: "consciousness",
  }
}

function shouldKeepPreviousGoal(
  input: GoalSystemInput
): boolean {
  const previousGoal = input.previousGoal
  if (!previousGoal) return false

  const energy = getEnergy(input)
  const hunger = getHunger(input)

  /**
   * 生理硬中断
   */
  if (energy <= 12 || hunger >= 68) {
    return false
  }

  /**
   * 目标还没到保持期，尽量保留
   */
  if (input.tick <= previousGoal.holdUntilTick) {
    return true
  }

  return false
}

export class GoalSystem {
  compute(input: GoalSystemInput): PetGoalState {
    if (shouldKeepPreviousGoal(input) && input.previousGoal) {
      return input.previousGoal
    }

    const kernel = getKernel(input)
    const memory = getMemory(input)
    const chosen = chooseGoal(input)
    const duration = buildGoalDuration(chosen.type, kernel, memory)

    return {
      ...chosen,
      startedAtTick: input.tick,
      holdUntilTick: input.tick + duration,
    }
  }
}

export const goalSystem = new GoalSystem()
export default goalSystem