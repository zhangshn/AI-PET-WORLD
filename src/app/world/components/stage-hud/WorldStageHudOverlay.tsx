"use client"

/**
 * 当前文件负责：展示主世界舞台 HUD。
 */

import type {
  WorldStageViewModel,
} from "../../view-models/worldStageViewModel"

import styles from "@/styles/world-styles/layout/world-pixel-stage.module.css"

type Props = {
  viewModel: WorldStageViewModel
}

function ActorCard(input: {
  title: string
  name: string
  actionLabel: string
  moodLabel: string
  intentionSummary: string
  interpretationSummary: string | null
  lifeLineSummary?: string | null
}) {
  return (
    <article className={styles.stageHudCard}>
      <div className={styles.stageHudCardHeader}>
        <span>{input.title}</span>
        <strong>{input.name}</strong>
      </div>
      <p className={styles.stageHudMainLine}>
        {input.actionLabel} · {input.moodLabel}
      </p>
      <p className={styles.stageHudText}>{input.intentionSummary}</p>
      {input.interpretationSummary && (
        <p className={styles.stageHudSubText}>{input.interpretationSummary}</p>
      )}
      {input.lifeLineSummary && (
        <p className={styles.stageHudSubText}>{input.lifeLineSummary}</p>
      )}
    </article>
  )
}

export default function WorldStageHudOverlay({ viewModel }: Props) {
  return (
    <div className={styles.stageHudLayer} aria-label="世界舞台状态">
      <section className={styles.stageHudTopBar}>
        <div>
          <span className={styles.stageHudEyebrow}>{viewModel.tickLabel}</span>
          <h2>{viewModel.title}</h2>
        </div>
        <div className={styles.stageHudTimeBlock}>
          <strong>{viewModel.environment.timeLabel}</strong>
          <span>{viewModel.environment.summary}</span>
        </div>
      </section>

      <section className={styles.stageHudStoryCard}>
        <span className={styles.stageHudEyebrow}>当前世界</span>
        <p>{viewModel.visibleStorySummary}</p>
      </section>

      <section className={styles.stageHudActorGrid}>
        <ActorCard
          title="宠物"
          name={viewModel.pet.name}
          actionLabel={viewModel.pet.actionLabel}
          moodLabel={viewModel.pet.moodLabel}
          intentionSummary={viewModel.pet.intentionSummary}
          interpretationSummary={viewModel.pet.interpretationSummary}
          lifeLineSummary={viewModel.pet.lifeLineSummary}
        />
        <ActorCard
          title="管家"
          name={viewModel.butler.name}
          actionLabel={viewModel.butler.actionLabel}
          moodLabel={viewModel.butler.moodLabel}
          intentionSummary={viewModel.butler.intentionSummary}
          interpretationSummary={viewModel.butler.interpretationSummary}
        />
      </section>

      <section className={styles.stageHudBottomBar}>
        <div>
          <span className={styles.stageHudEyebrow}>家园</span>
          <strong>{viewModel.home.statusLabel}</strong>
          <p>{viewModel.home.summary}</p>
        </div>
        <div>
          <span className={styles.stageHudEyebrow}>孵化器</span>
          <strong>{viewModel.incubator.statusLabel}</strong>
          <p>{viewModel.incubator.summary}</p>
        </div>
      </section>
    </div>
  )
}
