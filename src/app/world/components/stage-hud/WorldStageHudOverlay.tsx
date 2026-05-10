"use client"

/**
 * 当前文件负责：展示主世界舞台的极简状态角标。
 */

import type {
  WorldStageViewModel,
} from "../../view-models/worldStageViewModel"

import styles from "@/styles/world-styles/layout/world-pixel-stage.module.css"

type Props = {
  viewModel: WorldStageViewModel
}

export default function WorldStageHudOverlay({ viewModel }: Props) {
  return (
    <div className={styles.stageHudLayer} aria-label="世界舞台极简状态">
      <div className={styles.stageHudTopRight}>
        <span>{viewModel.environment.timeLabel}</span>
      </div>

      <div className={styles.stageHudBottomLeft}>
        <span>{viewModel.pet.name}: {viewModel.pet.actionLabel}</span>
        <span>{viewModel.butler.name}: {viewModel.butler.actionLabel}</span>
        <span>{viewModel.home.statusLabel}</span>
      </div>
    </div>
  )
}
