/**
 * 当前文件负责：根据认知结果创建行为内部过程，推进行为阶段，并输出行为对身体与情绪的影响
 */

import type {
  ActiveBehaviorProcess,
  BuildBehaviorProcessInput,
  StepBehaviorProcessInput,
  StepBehaviorProcessResult,
  BehaviorProcessStage,
} from "./behavior-types"

function resolveProcessStage(
  tick: number,
  startedAtTick: number,
  endAtTick: number
): BehaviorProcessStage {
  const totalDuration = Math.max(1, endAtTick - startedAtTick)
  const livedTick = tick - startedAtTick
  const progress = livedTick / totalDuration

  if (progress <= 0) {
    return "start"
  }

  if (progress < 0.4) {
    return "engaged"
  }

  if (progress < 0.75) {
    return "peak"
  }

  if (progress < 1) {
    return "cooldown"
  }

  return "finished"
}

export function buildBehaviorProcessFromCognition(
  input: BuildBehaviorProcessInput
): ActiveBehaviorProcess | null {
  const { cognition, tick, energy, hunger } = input

  if (energy <= 10) {
    return null
  }

  if (hunger >= 92) {
    return null
  }

  if (cognition.reactionTendency === "chase") {
    return {
      type: "chasing_target",
      stage: "start",
      sourceStimulusId: cognition.stimulusId,
      sourceStimulusType: cognition.stimulusType,
      startedAtTick: tick,
      updatedAtTick: tick,
      endAtTick: tick + 5,
      summary: "它开始被一个移动目标持续吸引。",
    }
  }

  if (cognition.reactionTendency === "observe") {
    return {
      type: "careful_observation",
      stage: "start",
      sourceStimulusId: cognition.stimulusId,
      sourceStimulusType: cognition.stimulusType,
      startedAtTick: tick,
      updatedAtTick: tick,
      endAtTick: tick + 4,
      summary: "它进入了更集中的观察状态。",
    }
  }

  if (cognition.reactionTendency === "rest_nearby") {
    return {
      type: "seeking_comfort_zone",
      stage: "start",
      sourceStimulusId: cognition.stimulusId,
      sourceStimulusType: cognition.stimulusType,
      startedAtTick: tick,
      updatedAtTick: tick,
      endAtTick: tick + 5,
      summary: "它开始靠近一个让自己更舒服的区域。",
    }
  }

  return null
}

export function stepBehaviorProcess(
  input: StepBehaviorProcessInput
): StepBehaviorProcessResult {
  const { process, tick, energy, hunger } = input

  const nextStage = resolveProcessStage(
    tick,
    process.startedAtTick,
    process.endAtTick
  )

  if (nextStage === "finished") {
    if (process.type === "chasing_target") {
      return {
        nextProcess: null,
        delta: {
          energyDelta: -1,
          hungerDelta: 1,
          emotionalShift: 1,
        },
        suggestedAction: energy <= 28 ? "resting" : "walking",
        summary: energy <= 28
          ? "追逐过程自然结束后，它明显放慢下来，开始回收体力。"
          : "追逐过程自然结束后，它没有立刻停住，而是继续轻微活动。",
      }
    }

    if (process.type === "careful_observation") {
      return {
        nextProcess: null,
        delta: {
          energyDelta: 0,
          hungerDelta: 0,
          emotionalShift: 1,
        },
        suggestedAction: energy >= 45 && hunger < 75 ? "walking" : "idle",
        summary: energy >= 45 && hunger < 75
          ? "观察结束后，它仍保持轻微外放，开始缓慢移动。"
          : "观察结束后，它安静地停了下来。",
      }
    }

    if (process.type === "seeking_comfort_zone") {
      return {
        nextProcess: null,
        delta: {
          energyDelta: 1,
          hungerDelta: 0,
          emotionalShift: 2,
        },
        suggestedAction: energy <= 45 ? "resting" : "idle",
        summary: energy <= 45
          ? "靠近舒适区域后，它顺势进入恢复状态。"
          : "靠近舒适区域后，它安静地停留了一会儿。",
      }
    }

    return {
      nextProcess: null,
      delta: {
        energyDelta: 0,
        hungerDelta: 0,
        emotionalShift: 0,
      },
      suggestedAction: "idle",
      summary: "这个行为过程自然结束了。",
    }
  }

  if (process.type === "chasing_target") {
    const energyDelta =
      nextStage === "start" ? -1 :
      nextStage === "engaged" ? -3 :
      nextStage === "peak" ? -5 :
      -2

    const hungerDelta =
      nextStage === "start" ? 1 :
      nextStage === "engaged" ? 2 :
      nextStage === "peak" ? 3 :
      1

    const emotionalShift =
      nextStage === "start" ? 5 :
      nextStage === "engaged" ? 9 :
      nextStage === "peak" ? 8 :
      3

    const exhausted = energy <= 22 || hunger >= 88

    return {
      nextProcess: exhausted
        ? null
        : {
            ...process,
            stage: nextStage,
            updatedAtTick: tick,
            summary: nextStage === "cooldown"
              ? "它对移动目标的兴趣开始减弱。"
              : "它仍在追逐那个移动目标。",
          },
      delta: {
        energyDelta,
        hungerDelta,
        emotionalShift,
      },
      suggestedAction: exhausted
        ? "resting"
        : nextStage === "cooldown"
          ? "walking"
          : "exploring",
      summary: exhausted
        ? "它在追逐后明显变得疲惫，开始放慢下来。"
        : nextStage === "cooldown"
          ? "追逐热度开始下降，它的动作逐渐放缓。"
          : "它被追逐目标持续吸引，身体消耗明显增加。",
    }
  }

  if (process.type === "careful_observation") {
    const energyDelta =
      nextStage === "start" ? 0 :
      nextStage === "engaged" ? -1 :
      nextStage === "peak" ? -1 :
      0

    const hungerDelta =
      nextStage === "start" ? 0 :
      nextStage === "engaged" ? 0 :
      nextStage === "peak" ? 1 :
      0

    const emotionalShift =
      nextStage === "start" ? 2 :
      nextStage === "engaged" ? 3 :
      nextStage === "peak" ? 2 :
      1

    return {
      nextProcess: {
        ...process,
        stage: nextStage,
        updatedAtTick: tick,
        summary: nextStage === "cooldown"
          ? "它的观察注意力开始慢慢松开。"
          : "它仍保持着更专注的观察。",
      },
      delta: {
        energyDelta,
        hungerDelta,
        emotionalShift,
      },
      suggestedAction: nextStage === "cooldown" ? "idle" : "observing",
      summary: nextStage === "cooldown"
        ? "它已经大致确认了眼前的变化，注意力开始回落。"
        : "它把注意力集中在眼前的变化上。",
    }
  }

  if (process.type === "seeking_comfort_zone") {
    const energyDelta =
      nextStage === "start" ? 0 :
      nextStage === "engaged" ? 1 :
      nextStage === "peak" ? 2 :
      1

    const hungerDelta =
      nextStage === "start" ? 0 :
      nextStage === "engaged" ? 0 :
      nextStage === "peak" ? 1 :
      0

    const emotionalShift =
      nextStage === "start" ? 4 :
      nextStage === "engaged" ? 7 :
      nextStage === "peak" ? 9 :
      5

    return {
      nextProcess: {
        ...process,
        stage: nextStage,
        updatedAtTick: tick,
        summary: nextStage === "cooldown"
          ? "它在舒适区域附近逐渐安静下来。"
          : "它仍停留在更让自己舒服的区域附近。",
      },
      delta: {
        energyDelta,
        hungerDelta,
        emotionalShift,
      },
      suggestedAction: nextStage === "cooldown" ? "resting" : "resting",
      summary: nextStage === "cooldown"
        ? "它的身体节奏开始放慢，逐渐进入恢复。"
        : "它在舒适区域附近逐渐放松下来。",
    }
  }

  return {
    nextProcess: null,
    delta: {
      energyDelta: 0,
      hungerDelta: 0,
      emotionalShift: 0,
    },
    suggestedAction: "idle",
    summary: "没有继续形成稳定行为过程。",
  }
}