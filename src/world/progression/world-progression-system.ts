/**
 * 当前文件负责：维护世界进度系统状态。
 */

import type { TimeState } from "@/engine/timeSystem"
import type { HomeState } from "@/types/home"
import type { PetState } from "@/types/pet"

import {
  createInitialWorldProgressionState,
} from "./world-facility-registry"

import {
  runWorldProgression,
} from "./world-progression-runner"

import type {
  WorldProgressionNotice,
  WorldProgressionState,
} from "./world-progression-types"

export type WorldProgressionSystemUpdateInput = {
  tick: number
  time: TimeState
  home: HomeState
  pet: PetState | null
}

export class WorldProgressionSystem {
  private state: WorldProgressionState = createInitialWorldProgressionState()

  update(input: WorldProgressionSystemUpdateInput): WorldProgressionNotice[] {
    const result = runWorldProgression({
      state: this.state,
      tick: input.tick,
      time: input.time,
      home: input.home,
      pet: input.pet,
    })

    this.state = result.state

    return result.notices
  }

  getState(): WorldProgressionState {
    return {
      ...this.state,
      facilities: {
        home_base: { ...this.state.facilities.home_base },
        community_board: { ...this.state.facilities.community_board },
        pet_park: { ...this.state.facilities.pet_park },
        pet_clinic: { ...this.state.facilities.pet_clinic },
        small_town: { ...this.state.facilities.small_town },
      },
    }
  }

  reset(): void {
    this.state = createInitialWorldProgressionState()
  }
}

export default WorldProgressionSystem