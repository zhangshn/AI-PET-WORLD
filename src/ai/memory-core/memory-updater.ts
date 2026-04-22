/**
 * ======================================================
 * AI-PET-WORLD
 * Memory Core Updater
 * ======================================================
 *
 * 当前文件负责：
 * 1. 根据当前行为与行为结果更新记忆
 * 2. 把经验沉淀为长期偏压
 * 3. 生成可供后续判断使用的内部经验
 * ======================================================
 */

import type {
  MemoryActionRecord,
  MemoryEventRecord,
  PetMemoryState,
  UpdateMemoryInput,
} from "./memory-types"

import { clampZeroToHundred } from "../../shared/math/clamp"

function clamp(value: number, min = -100, max = 100): number {
  return Math.max(min, Math.min(max, value))
}



function pushLimited<T>(list: T[], item: T, max: number): T[] {
  const next = [...list, item]
  if (next.length <= max) {
    return next
  }
  return next.slice(next.length - max)
}

function buildActionRecord(input: UpdateMemoryInput): MemoryActionRecord {
  return {
    tick: input.tick,
    day: input.time.day,
    hour: input.time.hour,
    action: input.action,
    energy: input.energyAfter,
    hunger: input.hungerAfter,
    mood: input.moodAfter,
  }
}

function buildEventRecords(input: UpdateMemoryInput): MemoryEventRecord[] {
  const records: MemoryEventRecord[] = []

  const energyDelta = input.energyAfter - input.energyBefore
  const hungerDelta = input.hungerAfter - input.hungerBefore

  if (
    (input.action === "exploring" || input.action === "walking") &&
    input.time.period === "Night"
  ) {
    records.push({
      tick: input.tick,
      day: input.time.day,
      hour: input.time.hour,
      kind: "night_activity",
      summary: "夜晚仍持续向外活动。",
      weight: 0.8,
    })
  }

  if (
    (input.action === "resting" || input.action === "sleeping") &&
    input.time.period === "Night"
  ) {
    records.push({
      tick: input.tick,
      day: input.time.day,
      hour: input.time.hour,
      kind: "night_recovery",
      summary: "夜晚恢复行为带来了明显回收。",
      weight: 1,
    })
  }

  if (
    (input.action === "exploring" || input.action === "walking") &&
    energyDelta <= -3
  ) {
    records.push({
      tick: input.tick,
      day: input.time.day,
      hour: input.time.hour,
      kind: "exploration_result",
      summary: "持续向外行动会明显消耗体力。",
      weight: 1,
    })
  }

  if (
    input.action === "observing" &&
    energyDelta >= -1 &&
    hungerDelta <= 2
  ) {
    records.push({
      tick: input.tick,
      day: input.time.day,
      hour: input.time.hour,
      kind: "observation_result",
      summary: "观察行为整体代价较低。",
      weight: 0.7,
    })
  }

  if (
    (input.action === "resting" || input.action === "sleeping") &&
    energyDelta >= 2
  ) {
    records.push({
      tick: input.tick,
      day: input.time.day,
      hour: input.time.hour,
      kind: "recovery",
      summary: "恢复行为确实提升了能量。",
      weight: 1,
    })
  }

  if (input.wasFed) {
    records.push({
      tick: input.tick,
      day: input.time.day,
      hour: input.time.hour,
      kind: "feeding_received",
      summary: "外部照料在需求升高时提供了补给。",
      weight: 1,
    })
  }

  if (
    input.hungerBefore >= 58 &&
    input.hungerAfter <= input.hungerBefore - 10
  ) {
    records.push({
      tick: input.tick,
      day: input.time.day,
      hour: input.time.hour,
      kind: "need_relief",
      summary: "进食有效缓解了当前身体需求。",
      weight: 0.9,
    })
  }

  if (
    input.action === "approaching" &&
    (input.moodAfter === "relaxed" || input.moodAfter === "content" || input.moodAfter === "curious")
  ) {
    records.push({
      tick: input.tick,
      day: input.time.day,
      hour: input.time.hour,
      kind: "approach_result",
      summary: "靠近行为没有立即带来明显负面结果。",
      weight: 0.7,
    })
  }

  return records
}

function updateWorldImpression(
  memory: PetMemoryState,
  input: UpdateMemoryInput,
  events: MemoryEventRecord[]
): PetMemoryState["worldImpression"] {
  let nightSafetyBias = memory.worldImpression.nightSafetyBias
  let explorationConfidence = memory.worldImpression.explorationConfidence
  let observationConfidence = memory.worldImpression.observationConfidence

  for (const event of events) {
    if (event.kind === "night_recovery") {
      nightSafetyBias = clamp(nightSafetyBias + 4)
    }

    if (event.kind === "night_activity" && input.energyAfter < input.energyBefore - 2) {
      nightSafetyBias = clamp(nightSafetyBias - 3)
    }

    if (event.kind === "exploration_result") {
      explorationConfidence = clamp(explorationConfidence - 2)
    }

    if (
      event.kind === "exploration_result" &&
      input.moodAfter === "excited"
    ) {
      explorationConfidence = clamp(explorationConfidence + 1)
    }

    if (event.kind === "observation_result") {
      observationConfidence = clamp(observationConfidence + 2)
    }
  }

  return {
    nightSafetyBias,
    explorationConfidence,
    observationConfidence,
  }
}

function updateRelationImpression(
  memory: PetMemoryState,
  input: UpdateMemoryInput,
  events: MemoryEventRecord[]
): PetMemoryState["relationImpression"] {
  let caretakerTrust = memory.relationImpression.caretakerTrust
  let approachSafety = memory.relationImpression.approachSafety

  for (const event of events) {
    if (event.kind === "feeding_received") {
      caretakerTrust = clamp(caretakerTrust + 5)
    }

    if (event.kind === "approach_result") {
      approachSafety = clamp(approachSafety + 2)
    }
  }

  return {
    caretakerTrust,
    approachSafety,
  }
}

function updateSelfImpression(
  memory: PetMemoryState,
  input: UpdateMemoryInput,
  events: MemoryEventRecord[]
): PetMemoryState["selfImpression"] {
  let recoveryConfidence = memory.selfImpression.recoveryConfidence
  let enduranceConfidence = memory.selfImpression.enduranceConfidence
  let rhythmConfidence = memory.selfImpression.rhythmConfidence

  for (const event of events) {
    if (event.kind === "recovery") {
      recoveryConfidence = clamp(recoveryConfidence + 4)
      rhythmConfidence = clamp(rhythmConfidence + 1)
    }

    if (event.kind === "exploration_result") {
      enduranceConfidence = clamp(enduranceConfidence - 2)
    }

    if (
      event.kind === "exploration_result" &&
      input.energyAfter >= 40
    ) {
      enduranceConfidence = clamp(enduranceConfidence + 1)
    }

    if (event.kind === "night_recovery") {
      rhythmConfidence = clamp(rhythmConfidence + 3)
    }
  }

  return {
    recoveryConfidence,
    enduranceConfidence,
    rhythmConfidence,
  }
}

function updatePreferenceBias(
  memory: PetMemoryState,
  input: UpdateMemoryInput,
  events: MemoryEventRecord[]
): PetMemoryState["preferenceBias"] {
  let exploreBias = memory.preferenceBias.exploreBias
  let observeBias = memory.preferenceBias.observeBias
  let approachBias = memory.preferenceBias.approachBias
  let restBias = memory.preferenceBias.restBias
  let eatBias = memory.preferenceBias.eatBias

  for (const event of events) {
    if (event.kind === "exploration_result") {
      if (input.energyAfter <= 25) {
        exploreBias = clamp(exploreBias - 4)
        restBias = clamp(restBias + 3)
      } else if (input.moodAfter === "excited") {
        exploreBias = clamp(exploreBias + 2)
      }
    }

    if (event.kind === "observation_result") {
      observeBias = clamp(observeBias + 2)
    }

    if (event.kind === "approach_result") {
      approachBias = clamp(approachBias + 2)
    }

    if (event.kind === "recovery") {
      restBias = clamp(restBias + 3)
    }

    if (event.kind === "need_relief" || event.kind === "feeding_received") {
      eatBias = clamp(eatBias + 3)
    }
  }

  return {
    exploreBias,
    observeBias,
    approachBias,
    restBias,
    eatBias,
  }
}

function buildMemorySummaries(memory: PetMemoryState): string[] {
  const results: string[] = []

  if (memory.worldImpression.nightSafetyBias >= 8) {
    results.push("夜晚恢复经验正在被内化为相对安全的时间印象。")
  } else if (memory.worldImpression.nightSafetyBias <= -8) {
    results.push("夜晚活动经验更容易被记为高代价时段。")
  }

  if (memory.worldImpression.explorationConfidence >= 8) {
    results.push("探索经验正在累积为较积极的外扩印象。")
  } else if (memory.worldImpression.explorationConfidence <= -8) {
    results.push("探索经验正在累积为高消耗印象。")
  }

  if (memory.relationImpression.caretakerTrust >= 10) {
    results.push("外部照料者在需求升高时被记为可靠来源。")
  }

  if (memory.selfImpression.recoveryConfidence >= 10) {
    results.push("恢复经验正在形成对自我回收能力的信心。")
  }

  if (memory.preferenceBias.restBias >= 10) {
    results.push("近期经验让恢复行为逐渐被偏好。")
  }

  if (memory.preferenceBias.exploreBias >= 10) {
    results.push("近期经验让探索行为逐渐被强化。")
  }

  return results.slice(0, 6)
}

export function updatePetMemoryState(
  input: UpdateMemoryInput
): PetMemoryState {
  const actionRecord = buildActionRecord(input)
  const events = buildEventRecords(input)

  const recentActions = pushLimited(
    input.previousMemory.recentActions,
    actionRecord,
    30
  )

  let recentEvents = input.previousMemory.recentEvents
  for (const event of events) {
    recentEvents = pushLimited(recentEvents, event, 40)
  }

  const nextBase: PetMemoryState = {
    ...input.previousMemory,
    recentActions,
    recentEvents,
    worldImpression: updateWorldImpression(input.previousMemory, input, events),
    relationImpression: updateRelationImpression(input.previousMemory, input, events),
    selfImpression: updateSelfImpression(input.previousMemory, input, events),
    preferenceBias: updatePreferenceBias(input.previousMemory, input, events),
    summaries: [],
  }

  return {
    ...nextBase,
    summaries: buildMemorySummaries(nextBase),
  }
}