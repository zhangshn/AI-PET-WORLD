/**
 * 当前文件职责：处理管家推进家园建造等管理交互。
 */

import type { TimeState } from "../../timeSystem"
import type { ButlerState } from "@/types/butler"

import type {
  PetSystem,
  ButlerSystem,
  EventSystem,
  HomeSystem,
} from "@/systems/systems-gateway"

import { runHomeConstruction } from "../world-engine-gateway"

export type RunManagementInteractionsInput = {
  tick: number
  time: TimeState
  butler: ButlerState
  petSystem: PetSystem
  butlerSystem: ButlerSystem
  homeSystem: HomeSystem
  eventSystem: EventSystem
}

export function runManagementInteractions(
  input: RunManagementInteractionsInput
) {
  handleHomeBuilding(input)
}

function handleHomeBuilding(input: RunManagementInteractionsInput) {
  if (input.butler.task !== "building_home") return

  const butlerName = input.butler.name
  const result = runHomeConstruction({
    homeSystem: input.homeSystem,
    pet: input.petSystem.getPet(),
    butler: input.butler,
  })

  if (result.didBuild) {
    input.eventSystem.addInteractionEvent({
      tick: input.tick,
      day: input.time.day,
      hour: input.time.hour,
      message:
        `${butlerName}推进了家园建设，` +
        `投入 ${result.buildAmount}，进度 +${result.progressAdded}，` +
        `当前阶段：${result.currentHome.constructionStage}。`,
      payload: {
        interactionKind: "home_construction",
        butlerName,
        buildAmount: result.buildAmount,
        progressAdded: result.progressAdded,
        constructionStage: result.currentHome.constructionStage,
        completed: result.completed,
      },
    })
  }

  if (result.completed) {
    input.eventSystem.addInteractionEvent({
      tick: input.tick,
      day: input.time.day,
      hour: input.time.hour,
      message: "家园第一阶段建设完成。",
      payload: {
        interactionKind: "home_completed",
        level: result.currentHome.level,
        constructionStage: result.currentHome.constructionStage,
      },
    })
  }
}
