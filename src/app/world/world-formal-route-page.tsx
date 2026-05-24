"use client"

/**
 * 当前文件职责：展示 AI-PET-WORLD 的正式产品世界页面。
 */

import { useMemo, useSyncExternalStore } from "react"
import Link from "next/link"

import { FormalWorldView } from "@/app/world/components/formal-world-view"
import { buildFormalVisualModelFromSnapshot } from "@/world/formal-visual-model/formal-visual-model-gateway"
import {
  CREATE_WORLD_STORAGE_KEY,
  parseCreateWorldInput,
  type CreateWorldInput,
} from "@/world/creation/world-creation-runtime"
import { runAiPetWorldMvpPipeline } from "@/world/mvp-core/mvp-core-gateway"
import { buildWorldFirstSceneModel } from "@/world/runtime/world-first-scene-model"

import {
  buildMvpWorldViewModel,
  type MvpWorldViewModel,
} from "./mvp-world-view-model"
import styles from "./world-route-page.styles.module.css"

const CREATE_WORLD_INPUT_PENDING = "__ai_pet_world_create_input_pending__"
const CREATE_WORLD_INPUT_EMPTY = "__ai_pet_world_create_input_empty__"

const DEFAULT_WORLD_PREVIEW_INPUT: CreateWorldInput = {
  year: 1991,
  month: 6,
  day: 18,
  time: "08:00",
  perspective: "unspecified",
  createdAt: 1000,
}

export default function WorldFormalRoutePage() {
  const createWorldInputSnapshot = useSyncExternalStore(
    subscribeCreateWorldInput,
    getCreateWorldInputSnapshot,
    getCreateWorldInputServerSnapshot
  )
  const createWorldInput = useMemo(() => {
    if (createWorldInputSnapshot === CREATE_WORLD_INPUT_PENDING) return null
    if (createWorldInputSnapshot === CREATE_WORLD_INPUT_EMPTY) {
      return DEFAULT_WORLD_PREVIEW_INPUT
    }

    return parseCreateWorldInput(createWorldInputSnapshot) ?? DEFAULT_WORLD_PREVIEW_INPUT
  }, [createWorldInputSnapshot])
  const firstSceneModel = useMemo(() => {
    if (!createWorldInput) return null

    return buildWorldFirstSceneModel({ createWorldInput })
  }, [createWorldInput])
  const mvpWorldViewModel = useMemo(() => {
    if (!firstSceneModel || !createWorldInput) return null

    const homeMapState = firstSceneModel.homeMapState
    const mvpPipelineResult = runAiPetWorldMvpPipeline({
      playerId: homeMapState.ownerId,
      ownerId: homeMapState.ownerId,
      worldId: firstSceneModel.worldId,
      birthYear: createWorldInput.year,
      birthMonth: createWorldInput.month,
      birthDay: createWorldInput.day,
      birthHour: parseBirthHour(createWorldInput.time),
      timezone: "Asia/Shanghai",
      worldDay: 1,
      now: homeMapState.updatedAt + 1,
      seed: homeMapState.seed,
      runMode: "preview",
      persistenceMode: "memory_preview",
      visualMode: "formal_precheck",
      tags: [
        "world_formal_route_page",
        "formal_product_view",
        "no_debug_panels",
        "no_default_companion_entry",
      ],
    })

    return buildMvpWorldViewModel(mvpPipelineResult)
  }, [createWorldInput, firstSceneModel])
  const formalVisualModel = useMemo(() => {
    if (!firstSceneModel) return null

    return buildFormalVisualModelFromSnapshot(
      firstSceneModel.renderableWorldSnapshot
    )
  }, [firstSceneModel])

  if (!firstSceneModel || !createWorldInput || !mvpWorldViewModel || !formalVisualModel) {
    return (
      <main className={styles.worldPage} aria-label="AI-PET-WORLD">
        <section className={styles.emptyStatePanel}>
          <div className={styles.eyebrow}>AI-PET-WORLD</div>
          <h1 className={styles.title}>世界尚未创建</h1>
          <p className={styles.description}>
            请先输入出生信息。系统会据此生成管家、第一片家园与初始世界状态。
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
        <div className={styles.eyebrow}>AI-PET-WORLD / FORMAL WORLD</div>
        <h1 className={styles.title}>{firstSceneModel.title}</h1>
        <p className={styles.description}>{firstSceneModel.subtitle}</p>

        <div className={styles.statusStrip}>
          <span>{firstSceneModel.worldStatus}</span>
          <span>世界编号：{firstSceneModel.worldId}</span>
        </div>

        <div className={styles.summaryGrid}>
          <SummaryCard
            label="地图规格"
            value={firstSceneModel.homeSummary.mapSizeLabel}
          />
          <SummaryCard
            label="初始区域"
            value={String(firstSceneModel.homeSummary.zoneCount)}
          />
          <SummaryCard
            label="世界对象"
            value={String(firstSceneModel.homeSummary.placementCount)}
          />
        </div>
      </section>

      <FormalProductWorldPanel
        model={mvpWorldViewModel}
        formalVisualModel={formalVisualModel}
      />
    </main>
  )
}

function FormalProductWorldPanel(input: {
  model: MvpWorldViewModel
  formalVisualModel: Parameters<typeof FormalWorldView>[0]["model"]
}) {
  const delivery = input.model.formalVisualDeliveryModel
  const maxCurrent = Math.max(
    1,
    ...delivery.resources.map((resource) => resource.max)
  )

  return (
    <section className={styles.productWorldPanel} aria-label="主世界">
      <header className={styles.productWorldHeader}>
        <div>
          <div className={styles.eyebrow}>WORLD / READ ONLY</div>
          <h2>{delivery.overview.title}</h2>
          <p>{delivery.overview.subtitle}</p>
        </div>
        <div className={styles.productStatusGrid}>
          <RuntimeInfoItem label="阶段" value={delivery.overview.phaseLabel} />
          <RuntimeInfoItem
            label="世界对象"
            value={String(delivery.overview.worldObjectCount)}
          />
          <RuntimeInfoItem
            label="变化记录"
            value={String(delivery.overview.mapDiffCount)}
          />
          <RuntimeInfoItem
            label="伙伴"
            value={delivery.overview.companionLabel}
          />
        </div>
      </header>

      <section className={styles.formalWorldPanel} aria-label="家园主视觉">
        <div className={styles.formalWorldPanelHeader}>
          <div className={styles.eyebrow}>FORMAL WORLD VIEW</div>
          <h2>家园主视觉</h2>
          <p>
            这里展示家园当前的形状、道路、自然边界和管家所在位置。画面只读取世界状态，不改变世界。
          </p>
        </div>
        <FormalWorldView model={input.formalVisualModel} />
      </section>

      <div className={styles.productWorldGrid}>
        <article className={styles.productExplainPanel}>
          <h3>管家当前行动</h3>
          <div className={styles.productExplanation}>
            <strong>{delivery.construction.title}</strong>
            <span>{delivery.construction.statusLabel}</span>
            <p>{delivery.construction.explanation}</p>
            <p>
              管家会先观察资源、空间和孵化环境，再决定是否整理、等待或推进家园建设。玩家不会直接点击建造。
            </p>
          </div>

          <h3>家园状态</h3>
          {delivery.houseStyle ? (
            <div className={styles.productExplanation}>
              <strong>{delivery.houseStyle.title}</strong>
              <span>{delivery.houseStyle.scaleLabel}</span>
              <p>{delivery.houseStyle.materialLabel}</p>
              <p>{delivery.houseStyle.spatialLabel}</p>
              <p>{delivery.houseStyle.explanation}</p>
            </div>
          ) : (
            <p>管家还在观察资源和地貌，暂未形成房屋偏好。</p>
          )}
        </article>

        <LifeEventProductPanel summary={input.model.lifeEventSummary} />
      </div>

      <article className={styles.productResourcePanel}>
        <h3>资源状态</h3>
        <div className={styles.productResourceGrid}>
          {delivery.resources.map((resource) => (
            <div
              className={styles.productResourceItem}
              data-tone={resource.tone}
              key={resource.key}
            >
              <div className={styles.resourceHeader}>
                <strong>{resource.label}</strong>
                <span>
                  {resource.current} / {resource.max}
                </span>
              </div>
              <div className={styles.productMeter}>
                <span
                  style={{
                    width: `${Math.min(100, (resource.current / maxCurrent) * 100)}%`,
                  }}
                />
              </div>
              <p>{resource.explanation}</p>
            </div>
          ))}
        </div>
      </article>
    </section>
  )
}

function LifeEventProductPanel(input: {
  summary: MvpWorldViewModel["lifeEventSummary"]
}) {
  const { summary } = input
  const blockerText =
    summary.blockers.length > 0
      ? `${summary.blockers.length} 个等待项`
      : "没有关键阻塞"

  return (
    <article className={styles.lifeEventPanel}>
      <div className={styles.lifeEventHeader}>
        <div>
          <h3>{summary.title}</h3>
          <p>
            当前不会默认生成宠物或伙伴，只记录世界是否具备未来接纳条件。
          </p>
        </div>
        <div className={styles.lifeEventScore}>
          <strong>{summary.readinessScore}</strong>
          <span>/ 100</span>
        </div>
      </div>

      <div className={styles.lifeEventMetaGrid}>
        <div className={styles.lifeEventReasonCard}>
          <span>准备状态</span>
          <strong>{summary.statusLabel}</strong>
          <p>{summary.readinessLabel}</p>
        </div>
        <div className={styles.lifeEventReasonCard}>
          <span>下一步</span>
          <strong>{summary.recommendedNextStepLabel}</strong>
          <p>{blockerText}</p>
        </div>
      </div>

      <div className={styles.lifeEventReasonCard}>
        <span>管家判断</span>
        <strong>{summary.decisionLabel}</strong>
        <p>{summary.decisionReason}</p>
        <p>{summary.nextCheckHint}</p>
      </div>
    </article>
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

function RuntimeInfoItem(input: { label: string; value: string }) {
  return (
    <div className={styles.resourceItem}>
      <div className={styles.resourceHeader}>
        <strong>{input.label}</strong>
        <span>{input.value}</span>
      </div>
    </div>
  )
}

function subscribeCreateWorldInput(callback: () => void): () => void {
  if (typeof window === "undefined") return () => undefined

  function handleStorage(event: StorageEvent) {
    if (event.key === CREATE_WORLD_STORAGE_KEY) callback()
  }

  window.addEventListener("storage", handleStorage)

  return () => window.removeEventListener("storage", handleStorage)
}

function getCreateWorldInputSnapshot(): string {
  if (typeof window === "undefined") return CREATE_WORLD_INPUT_PENDING

  return window.localStorage.getItem(CREATE_WORLD_STORAGE_KEY) ??
    CREATE_WORLD_INPUT_EMPTY
}

function getCreateWorldInputServerSnapshot(): string {
  return CREATE_WORLD_INPUT_PENDING
}

function parseBirthHour(time: string): number {
  const [hourText] = time.split(":")
  const parsedHour = Number(hourText)

  if (!Number.isFinite(parsedHour)) return 8

  return Math.min(23, Math.max(0, Math.trunc(parsedHour)))
}
