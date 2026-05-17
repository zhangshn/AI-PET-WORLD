"use client"

/**
 * 当前文件负责：正式世界首屏入口。
 */

import { useMemo, useSyncExternalStore } from "react"
import Link from "next/link"

import { HomeMapRenderer } from "@/app/world/components/home-map-renderer/HomeMapRenderer"
import {
  CREATE_WORLD_STORAGE_KEY,
  parseCreateWorldInput,
} from "@/world/creation/world-creation-runtime"
import { buildWorldFirstSceneModel } from "@/world/runtime/world-first-scene-model"

import styles from "./world-route-page.styles.module.css"

const CREATE_WORLD_INPUT_PENDING = "__ai_pet_world_create_input_pending__"
const CREATE_WORLD_INPUT_EMPTY = "__ai_pet_world_create_input_empty__"

export default function WorldRoutePage() {
  const createWorldInputSnapshot = useSyncExternalStore(
    subscribeCreateWorldInput,
    getCreateWorldInputSnapshot,
    getCreateWorldInputServerSnapshot
  )

  const createWorldInput = useMemo(() => {
    if (createWorldInputSnapshot === CREATE_WORLD_INPUT_PENDING) return null
    if (createWorldInputSnapshot === CREATE_WORLD_INPUT_EMPTY) return null

    return parseCreateWorldInput(createWorldInputSnapshot)
  }, [createWorldInputSnapshot])

  const firstSceneModel = useMemo(() => {
    if (!createWorldInput) return null

    return buildWorldFirstSceneModel({ createWorldInput })
  }, [createWorldInput])

  if (!firstSceneModel) {
    return (
      <main className={styles.worldPage} aria-label="AI-PET-WORLD">
        <section className={styles.emptyStatePanel}>
          <div className={styles.eyebrow}>AI-PET-WORLD</div>
          <h1 className={styles.title}>世界尚未创建</h1>
          <p className={styles.description}>
            请先输入出生信息。系统会据此生成管家、孵化器和第一片家园。
          </p>
          <Link className={styles.primaryLink} href="/create-world">
            创建世界
          </Link>
        </section>
      </main>
    )
  }

  return (
    <main className={styles.worldPage} aria-label="AI-PET-WORLD">
      <section className={styles.heroPanel}>
        <div className={styles.eyebrow}>AI-PET-WORLD / FIRST SCENE</div>
        <h1 className={styles.title}>{firstSceneModel.title}</h1>
        <p className={styles.description}>{firstSceneModel.subtitle}</p>

        <div className={styles.statusStrip}>
          <span>{firstSceneModel.worldStatus}</span>
          <span>世界编号：{firstSceneModel.worldId}</span>
        </div>

        <div className={styles.summaryGrid}>
          <SummaryCard label="地图规格" value={firstSceneModel.homeSummary.mapSizeLabel} />
          <SummaryCard
            label="初始区域"
            value={String(firstSceneModel.homeSummary.zoneCount)}
          />
          <SummaryCard
            label="生成对象"
            value={String(firstSceneModel.homeSummary.placementCount)}
          />
        </div>
      </section>

      <HomeMapRenderer homeMapState={firstSceneModel.homeMapState} />

      <section className={styles.contentGrid}>
        <article className={styles.panel}>
          <h2>第一幕状态</h2>
          <div className={styles.milestoneList}>
            {firstSceneModel.milestones.map((milestone) => (
              <div className={styles.milestoneItem} key={milestone.title}>
                <span className={styles.statusDot} data-status={milestone.status} />
                <div>
                  <strong>{milestone.title}</strong>
                  <p>{milestone.description}</p>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className={styles.panel}>
          <h2>初始区域</h2>
          <div className={styles.zoneList}>
            {firstSceneModel.zones.map((zone) => (
              <div className={styles.zoneItem} key={zone.id}>
                <strong>{zone.label}</strong>
                <p>{zone.purpose}</p>
              </div>
            ))}
          </div>
        </article>

        <article className={styles.panel}>
          <h2>建设计划</h2>
          <div className={styles.planList}>
            {firstSceneModel.plans.map((plan) => (
              <div className={styles.planItem} key={plan.id}>
                <div className={styles.planHeader}>
                  <strong>{plan.title}</strong>
                  <span>{plan.statusLabel}</span>
                </div>
                <div className={styles.meter}>
                  <span style={{ width: `${Math.min(100, plan.progress)}%` }} />
                </div>
                <p>{plan.reason}</p>
              </div>
            ))}
          </div>
        </article>

        <article className={styles.panel}>
          <h2>家园资源</h2>
          <div className={styles.resourceList}>
            {firstSceneModel.resources.map((resource) => (
              <div className={styles.resourceItem} key={resource.label}>
                <div className={styles.resourceHeader}>
                  <strong>{resource.label}</strong>
                  <span>{resource.value}</span>
                </div>
                <p>{resource.description}</p>
              </div>
            ))}
          </div>
        </article>
      </section>
    </main>
  )
}

function SummaryCard(input: { label: string; value: string }) {
  return (
    <article className={styles.summaryCard}>
      <span>{input.label}</span>
      <strong>{input.value}</strong>
    </article>
  )
}

function subscribeCreateWorldInput(onStoreChange: () => void): () => void {
  if (typeof window === "undefined") return () => undefined

  window.addEventListener("storage", onStoreChange)

  return () => {
    window.removeEventListener("storage", onStoreChange)
  }
}

function getCreateWorldInputSnapshot(): string {
  if (typeof window === "undefined") return CREATE_WORLD_INPUT_PENDING

  return (
    window.localStorage.getItem(CREATE_WORLD_STORAGE_KEY) ??
    CREATE_WORLD_INPUT_EMPTY
  )
}

function getCreateWorldInputServerSnapshot(): string {
  return CREATE_WORLD_INPUT_PENDING
}
