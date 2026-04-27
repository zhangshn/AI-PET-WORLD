/**
 * 当前文件负责：根据宠物行为结束时的状态生成行为结束事件文案。
 */

import type { NarrativeType } from "@/types/event"
import type { PetAction } from "@/types/pet"
import type { PetStateLike } from "./event-schema"
import {
  getEmotionalLabel,
  getPhaseTag,
} from "./event-pet-context-runner"

function buildWalkingEndMessage(params: {
  petName: string
  narrativeType: NarrativeType
  phaseTag: string | null
  emotionalLabel: string | null
  drivePrimary: string | null
  sourceDrive: string | null
}): string {
  const {
    petName,
    narrativeType,
    phaseTag,
    emotionalLabel,
    drivePrimary,
    sourceDrive,
  } = params

  if (
    sourceDrive === "approach" ||
    drivePrimary === "approach" ||
    narrativeType === "approach_target"
  ) {
    return `${petName}把刚才那阵试着靠近的步子慢慢收住了，没有再继续把距离往前压近。`
  }

  if (sourceDrive === "avoid") {
    return `${petName}把原本带着防备的移动慢慢收了回来，像是暂时先把距离稳在了这里。`
  }

  if (phaseTag === "recovery_phase") {
    return `${petName}慢慢把脚步收了回来，像是觉得现在先把状态稳住更重要。`
  }

  if (emotionalLabel === "alert") {
    return `${petName}没有再继续走动，刚才那阵带着留意的活动也慢慢停了下来。`
  }

  if (narrativeType === "observe_environment") {
    return `${petName}绕着附近确认了一阵后，慢慢停下了脚步，注意力也没有再继续往外铺开。`
  }

  if (narrativeType === "linger") {
    return `${petName}那阵低强度的活动渐渐收住了，最后又把自己留回了原地。`
  }

  return `${petName}慢慢停下了脚步，刚才那阵来回活动也跟着收了下来。`
}

function buildExploringEndMessage(params: {
  petName: string
  narrativeType: NarrativeType
  phaseTag: string | null
  emotionalLabel: string | null
}): string {
  const { petName, narrativeType, phaseTag, emotionalLabel } = params

  if (narrativeType === "discover") {
    if (phaseTag === "growth_phase") {
      return `${petName}把刚才那阵探索慢慢收住了，像是已经把这一轮新鲜变化看得差不多了。`
    }

    return `${petName}把刚才那阵探索慢慢收住了，像是暂时看够了周围的新变化。`
  }

  if (emotionalLabel === "alert" || phaseTag === "sensitive_phase") {
    return `${petName}没有再继续把注意力往外放开，刚才那阵探索也在谨慎里慢慢停了下来。`
  }

  if (phaseTag === "attachment_phase") {
    return `${petName}把向外探索的劲头先收了一些，像是开始把注意力转回更亲近的方向。`
  }

  return `${petName}慢慢停下了探索，注意力没有再继续向外扩开。`
}

function buildApproachingEndMessage(params: {
  petName: string
  phaseTag: string | null
  emotionalLabel: string | null
  drivePrimary: string | null
}): string {
  const { petName, phaseTag, emotionalLabel, drivePrimary } = params

  if (phaseTag === "attachment_phase") {
    return `${petName}没有再继续靠近，像是在已经足够安心的位置上慢慢停了下来。`
  }

  if (emotionalLabel === "alert" || drivePrimary === "avoid") {
    return `${petName}原本想缩短距离的动作慢慢收住了，像是又重新留出了一点观察空间。`
  }

  return `${petName}没有再继续靠近，刚才那股想缩短距离的动作慢慢停了下来。`
}

function buildIdleEndMessage(params: {
  petName: string
  phaseTag: string | null
  emotionalLabel: string | null
  sourceDrive: string | null
}): string {
  const { petName, phaseTag, emotionalLabel, sourceDrive } = params

  if (sourceDrive === "observe") {
    return `${petName}结束了刚才那段安静观察，像是已经准备把注意力转向新的方向。`
  }

  if (phaseTag === "recovery_phase") {
    return `${petName}结束了刚才那段安静回收的停留，像是准备把状态重新向外放一点。`
  }

  if (emotionalLabel === "low") {
    return `${petName}从刚才那阵安静里慢慢缓了出来，像是终于愿意再向外动一点。`
  }

  return `${petName}结束了刚才那段停留，像是准备转向新的动作。`
}

function buildObservingEndMessage(params: {
  petName: string
  emotionalLabel: string | null
}): string {
  const { petName, emotionalLabel } = params

  if (emotionalLabel === "alert") {
    return `${petName}把刚才那阵持续留意周围的状态慢慢放了下来，像是确认眼前暂时没有更近一步的变化。`
  }

  return `${petName}结束了刚才那段安静观察，注意力也慢慢从周围收了回来。`
}

function buildRestingEndMessage(params: {
  petName: string
  phaseTag: string | null
}): string {
  const { petName, phaseTag } = params

  if (phaseTag === "recovery_phase") {
    return `${petName}从刚才那阵缓慢恢复里慢慢抽离出来，像是已经把状态稍微稳住了一些。`
  }

  return `${petName}结束了刚才那段安静休整，像是准备重新把注意力放回外界。`
}

function buildAlertIdleEndMessage(params: {
  petName: string
  emotionalLabel: string | null
}): string {
  const { petName, emotionalLabel } = params

  if (emotionalLabel === "alert" || emotionalLabel === "anxious") {
    return `${petName}原本绷着的那点警惕慢慢松下去了一些，没有继续把自己停在那种紧绷状态里。`
  }

  return `${petName}把刚才那阵带着防备的停留慢慢收住了。`
}

function buildSleepingEndMessage(params: {
  petName: string
  emotionalLabel: string | null
}): string {
  const { petName, emotionalLabel } = params

  if (emotionalLabel === "relaxed" || emotionalLabel === "content") {
    return `${petName}从刚才那阵安稳的休息里慢慢醒转过来，状态也显得比先前更松一点。`
  }

  return `${petName}从刚才那阵安静休息里慢慢醒转过来。`
}

function buildEatingEndMessage(params: {
  petName: string
  phaseTag: string | null
  emotionalLabel: string | null
}): string {
  const { petName, phaseTag, emotionalLabel } = params

  if (phaseTag === "recovery_phase" || emotionalLabel === "content") {
    return `${petName}慢慢停下了进食，刚才那阵回应身体需求的状态也像是被安稳地补回来了一些。`
  }

  if (emotionalLabel === "excited") {
    return `${petName}把进食的动作慢慢收住了，像是这一轮需求已经先被回应住了。`
  }

  return `${petName}慢慢停下了进食，刚才那阵专注回应需求的状态也收了下来。`
}

export function buildActionEndMessage(params: {
  pet: PetStateLike
  action: PetAction
  narrativeType: NarrativeType
  drivePrimary: string | null
  sourceDrive: string | null
}): string {
  const { pet, action, narrativeType, drivePrimary, sourceDrive } = params

  const petName = pet.name
  const phaseTag = getPhaseTag(pet)
  const emotionalLabel = getEmotionalLabel(pet)

  if (action === "walking") {
    return buildWalkingEndMessage({
      petName,
      narrativeType,
      phaseTag,
      emotionalLabel,
      drivePrimary,
      sourceDrive,
    })
  }

  if (action === "exploring") {
    return buildExploringEndMessage({
      petName,
      narrativeType,
      phaseTag,
      emotionalLabel,
    })
  }

  if (action === "approaching") {
    return buildApproachingEndMessage({
      petName,
      phaseTag,
      emotionalLabel,
      drivePrimary,
    })
  }

  if (action === "idle") {
    return buildIdleEndMessage({
      petName,
      phaseTag,
      emotionalLabel,
      sourceDrive,
    })
  }

  if (action === "observing") {
    return buildObservingEndMessage({
      petName,
      emotionalLabel,
    })
  }

  if (action === "resting") {
    return buildRestingEndMessage({
      petName,
      phaseTag,
    })
  }

  if (action === "alert_idle") {
    return buildAlertIdleEndMessage({
      petName,
      emotionalLabel,
    })
  }

  if (action === "sleeping") {
    return buildSleepingEndMessage({
      petName,
      emotionalLabel,
    })
  }

  if (action === "eating") {
    return buildEatingEndMessage({
      petName,
      phaseTag,
      emotionalLabel,
    })
  }

  return `${petName}慢慢停下了刚才的行动。`
}