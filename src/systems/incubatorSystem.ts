/**
 * 当前文件负责：作为孵化器系统对外入口，协调 incubator runners。
 */

import type { IncubatorState } from "../types/incubator"
import {
  canHatchIncubator,
  refreshIncubatorState,
} from "./incubator/incubator-rules"
import {
  applyIncubatorCare,
  runIncubatorTick,
} from "./incubator/incubator-runner"

export class IncubatorSystem {
  private incubator: IncubatorState

  constructor() {
    this.incubator = refreshIncubatorState({
      hasEmbryo: true,
      embryoName: "Mochi",
      progress: 0,
      stability: 85,
      status: "incubating",
    })
  }

  update() {
    this.incubator = runIncubatorTick(this.incubator)

    console.log(
      `孵化器状态：进度=${this.incubator.progress} 稳定度=${this.incubator.stability} 状态=${this.incubator.status}`
    )
  }

  care(amountProgress: number, amountStability: number) {
    this.incubator = applyIncubatorCare(
      this.incubator,
      amountProgress,
      amountStability
    )
  }

  canHatch(): boolean {
    return canHatchIncubator(this.incubator)
  }

  hatch(): string | null {
    if (!this.canHatch()) {
      return null
    }

    this.incubator = {
      ...this.incubator,
      status: "hatched",
    }

    return this.incubator.embryoName
  }

  hasActiveEmbryo(): boolean {
    return this.incubator.hasEmbryo && this.incubator.status !== "hatched"
  }

  getIncubator(): IncubatorState {
    return { ...this.incubator }
  }
}