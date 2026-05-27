"use client"

/**
 * 当前文件职责：展示 AI-PET-WORLD 的只读 MVP 世界运行页面。
 */

import { useMemo, useState, useSyncExternalStore } from "react"
import Link from "next/link"

import { ProceduralRendererView } from "@/app/world/components/procedural-renderer/procedural-renderer-view"
import { runAiPetWorldMvpPipeline } from "@/world/mvp-core/mvp-core-gateway"
import {
  buildWorldCreationRuntime,
  CREATE_WORLD_STORAGE_KEY,
  parseCreateWorldInput,
  type CreateWorldInput,
} from "@/world/creation/world-creation-runtime"
import {
  buildWorldFirstSceneModel,
  type WorldFirstSceneModel,
} from "@/world/runtime/world-first-scene-model"
import {
  buildButlerIntentContextFromRuntime,
  buildButlerRuntimeContextSummary,
  buildDefaultButlerRuntimeContext,
  validateButlerRuntimeContext,
  type ButlerRuntimeContextSummary,
} from "@/world/runtime-context/runtime-context-gateway"
import {
  applyWorldLoopStep,
  buildRuntimeWorldState,
  buildWorldLoopRenderableState,
  buildWorldLoopStep,
  loadPersistedWorldLoopState,
  savePersistedWorldLoopState,
  type RuntimeWorldState,
} from "@/world/world-loop/world-loop-gateway"

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

type WorldPersistenceUiState = {
  status: "memory_only" | "restored" | "saved" | "restore_failed" | "save_failed"
  message: string
  key?: string
  savedAt?: number
  tags: string[]
}

type WorldRuntimeContextUiState = {
  status: "not_used" | "used_runtime_context" | "runtime_context_invalid"
  message: string
  butlerSummary?: ButlerRuntimeContextSummary
  tags: string[]
}

type WorldViewMode = "formal" | "debug" | "both"

export default function WorldRoutePage() {
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

    return parseCreateWorldInput(createWorldInputSnapshot)
  }, [createWorldInputSnapshot])

  const firstSceneModel = useMemo(() => {
    if (!createWorldInput) return null

    return buildWorldFirstSceneModel({ createWorldInput })
  }, [createWorldInput])

  if (!firstSceneModel || !createWorldInput) {
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
    <WorldRuntimeShell
      key={firstSceneModel.worldId}
      firstSceneModel={firstSceneModel}
      createWorldInput={createWorldInput}
    />
  )
}

function WorldRuntimeShell(input: {
  firstSceneModel: WorldFirstSceneModel
  createWorldInput: CreateWorldInput
}) {
  const { firstSceneModel, createWorldInput } = input
  const worldCreationRuntime = useMemo(
    () => buildWorldCreationRuntime({ createWorldInput }),
    [createWorldInput]
  )
  const [runtimeState, setRuntimeState] = useState<RuntimeWorldState>(() =>
    buildInitialRuntimeState({ firstSceneModel })
  )
  const [persistenceState, setPersistenceState] =
    useState<WorldPersistenceUiState>(() =>
      buildInitialPersistenceUiState({ firstSceneModel })
    )
  const [runtimeContextState, setRuntimeContextState] =
    useState<WorldRuntimeContextUiState>(() => ({
      status: "not_used",
      message: "尚未在手动 Tick 中使用 runtime context。",
      tags: ["world_runtime_context_ui_state", "not_used"],
    }))
  const [viewMode, setViewMode] = useState<WorldViewMode>("formal")
  const lastStepResult = runtimeState.lastStepResult
  const lastSafeApplyTag =
    lastStepResult?.auditTrail.tags.find((tag) =>
      tag.startsWith("safe_apply:")
    ) ?? "not_started"
  const placementDelta = lastStepResult
    ? lastStepResult.nextHomeMapState.placements.length -
      lastStepResult.previousHomeMapState.placements.length
    : 0
  const mapDiffDelta = lastStepResult
    ? lastStepResult.nextHomeMapState.mapDiffs.length -
      lastStepResult.previousHomeMapState.mapDiffs.length
    : 0
  const mvpPipelineResult = useMemo(
    () =>
      runAiPetWorldMvpPipeline({
        playerId: runtimeState.ownerId,
        ownerId: runtimeState.ownerId,
        worldId: runtimeState.worldId,
        birthYear: createWorldInput.year,
        birthMonth: createWorldInput.month,
        birthDay: createWorldInput.day,
        birthHour: parseBirthHour(createWorldInput.time),
        timezone: "Asia/Shanghai",
        worldDay: runtimeState.tickIndex + 1,
        now:
          runtimeState.currentHomeMapState.updatedAt +
          runtimeState.tickIndex +
          1,
        seed: runtimeState.currentHomeMapState.seed,
        runMode: "preview",
        persistenceMode: "memory_preview",
        visualMode: "formal_precheck",
        tags: [
          "world_route_mvp_pipeline_preview",
          "read_only_world_view",
          "no_default_adoption_entry",
        ],
      }),
    [
      createWorldInput,
      runtimeState.currentHomeMapState,
      runtimeState.ownerId,
      runtimeState.tickIndex,
      runtimeState.worldId,
    ]
  )
  const mvpWorldViewModel = useMemo(
    () => buildMvpWorldViewModel(mvpPipelineResult),
    [mvpPipelineResult]
  )
  const shouldShowFormalView = viewMode === "both"
  const shouldShowDebugView = viewMode === "debug" || viewMode === "both"

  function handleManualTick() {
    const tickNow =
      runtimeState.currentHomeMapState.updatedAt + runtimeState.tickIndex + 1
    const nextTickIndex = runtimeState.tickIndex + 1
    const butlerRuntimeContext = buildDefaultButlerRuntimeContext({
      worldId: runtimeState.worldId,
      ownerId: runtimeState.ownerId,
      tickIndex: nextTickIndex,
      now: tickNow,
      constructionStyle: worldCreationRuntime.butlerConstructionStyle,
    })
    const butlerValidation = validateButlerRuntimeContext({
      context: butlerRuntimeContext,
      expectedWorldId: runtimeState.worldId,
      expectedOwnerId: runtimeState.ownerId,
    })
    const butlerSummary = buildButlerRuntimeContextSummary(
      butlerRuntimeContext
    )
    const canUseRuntimeContext = butlerValidation.isValid
    const butlerIntentContext = buildButlerIntentContextFromRuntime({
      butlerRuntimeContext,
    })
    const stepResult = buildWorldLoopStep({
      runtimeState,
      now: tickNow,
      source: "manual_tick",
      butlerIntentContext: canUseRuntimeContext
        ? butlerIntentContext
        : undefined,
      petIntentContext: undefined,
    })

    setRuntimeState(
      applyWorldLoopStep({
        runtimeState,
        stepResult,
      })
    )

    setRuntimeContextState({
      status: canUseRuntimeContext
        ? "used_runtime_context"
        : "runtime_context_invalid",
      message: canUseRuntimeContext
        ? "本次 Tick 已使用管家 runtime context；小镇领养入口仍保持后置等待。"
        : butlerValidation.reasons.join("；") ||
          "runtime context 校验未通过。",
      butlerSummary,
      tags: [
        "world_runtime_context_ui_state",
        canUseRuntimeContext
          ? "used_runtime_context"
          : "runtime_context_invalid",
        "pet_runtime_context_not_constructed",
        "pet_intent_context_deferred",
        ...butlerIntentContext.tags,
      ],
    })
  }

  function handleManualSave() {
    if (typeof window === "undefined") return

    const saveResult = savePersistedWorldLoopState({
      storage: window.localStorage,
      runtimeState,
      savedAt:
        runtimeState.currentHomeMapState.updatedAt + runtimeState.tickIndex + 1,
    })

    setPersistenceState({
      status: saveResult.ok ? "saved" : "save_failed",
      message: saveResult.message,
      key: saveResult.key,
      savedAt: saveResult.persistedState?.savedAt,
      tags: [
        "world_persistence_ui_state",
        saveResult.ok ? "saved" : "save_failed",
        ...saveResult.tags,
      ],
    })
  }

  return (
    <main className={styles.worldPage} aria-label="AI-PET-WORLD">
      <section className={styles.heroPanel}>
        <div className={styles.eyebrow}>AI-PET-WORLD / MVP WORLD</div>
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

      <section className={styles.viewModePanel} aria-label="视图模式">
        <div>
          <div className={styles.eyebrow}>WORLD VIEW MODE</div>
          <h2>视图模式</h2>
          <p>
            默认显示正式主视觉。Debug 视图保留给链路和几何诊断，双视图用于开发对照。
          </p>
        </div>
        <div className={styles.viewModeActions}>
          <button
            className={styles.viewModeButton}
            data-active={viewMode === "formal"}
            type="button"
            onClick={() => setViewMode("formal")}
          >
            正式主视觉
          </button>
          <button
            className={styles.viewModeButton}
            data-active={viewMode === "debug"}
            type="button"
            onClick={() => setViewMode("debug")}
          >
            Debug 视图
          </button>
          <button
            className={styles.viewModeButton}
            data-active={viewMode === "both"}
            type="button"
            onClick={() => setViewMode("both")}
          >
            双视图
          </button>
        </div>
      </section>

      <ProductWorldPanel model={mvpWorldViewModel} />

      {shouldShowFormalView ? (
        <section
          className={styles.formalWorldPanel}
          aria-label="正式主视觉"
        >
          <div className={styles.formalWorldPanelHeader}>
            <div className={styles.eyebrow}>FORMAL WORLD VIEW</div>
            <h2>正式主视觉</h2>
            <p>
              这里展示家园当前的形状、道路、自然边界和管家所在位置。画面只读取世界状态，不改变世界。
            </p>
          </div>
          <p>
            FormalWorldView debug asset is not mounted here; the formal /world
            surface now uses PixelWorldView.
          </p>
        </section>
      ) : null}

      {shouldShowDebugView ? (
        <section
          className={styles.debugWorldPanel}
          aria-label="Debug renderer view"
        >
          <div className={styles.debugWorldPanelHeader}>
            <div className={styles.eyebrow}>DEBUG VIEW / 开发调试</div>
            <h2>Debug 视图</h2>
            <p>
              ProceduralRendererView 保留用于验证真实世界链路与几何诊断，不作为默认玩家主视觉。
            </p>
          </div>
          <ProceduralRendererView
            snapshot={runtimeState.currentRenderableSnapshot}
          />
        </section>
      ) : null}

      <MvpCorePanel model={mvpWorldViewModel} />

      <section className={styles.contentGrid}>
        <article className={styles.panel}>
          <h2>世界运行</h2>
          <div className={styles.resourceList}>
            <RuntimeInfoItem
              label="Runtime Tick"
              value={String(runtimeState.tickIndex)}
            />
            <RuntimeInfoItem label="Owner" value={runtimeState.ownerId} />
            <RuntimeInfoItem
              label="Current Placement"
              value={String(
                runtimeState.currentHomeMapState.placements.length
              )}
            />
            <RuntimeInfoItem
              label="MapDiff History"
              value={String(runtimeState.currentHomeMapState.mapDiffs.length)}
            />
            <RuntimeInfoItem
              label="Audit Trail"
              value={String(runtimeState.auditTrail.length)}
            />
            <RuntimeInfoItem
              label="Last Step"
              value={lastStepResult?.status ?? "not_started"}
            />
            <RuntimeInfoItem
              label="Last SafeApply"
              value={lastSafeApplyTag}
            />
            <RuntimeInfoItem
              label="Placement Delta"
              value={String(placementDelta)}
            />
            <RuntimeInfoItem
              label="MapDiff Delta"
              value={String(mapDiffDelta)}
            />
            <RuntimeInfoItem
              label="Persistence"
              value={persistenceState.status}
            />
            <RuntimeInfoItem
              label="Runtime Context"
              value={runtimeContextState.status}
            />
            <RuntimeInfoItem
              label="Butler Task"
              value={runtimeContextState.butlerSummary?.currentTask ?? "未使用"}
            />
            <RuntimeInfoItem label="Adoption" value="后置等待" />
          </div>
          <p>
            RuntimeWorldState 已建立；手动 Tick 会走管家意图、MapDiff、
            SafeApply 和快照刷新链路。这里不会默认接入宠物，也不会绕过世界事实容器。
          </p>
          <p>{persistenceState.message}</p>
          <p>{runtimeContextState.message}</p>
          <button
            className={styles.primaryLink}
            type="button"
            onClick={handleManualTick}
          >
            手动推进 Tick
          </button>
          <button
            className={styles.primaryLink}
            type="button"
            onClick={handleManualSave}
          >
            手动保存世界状态
          </button>
        </article>

        <article className={styles.panel}>
          <h2>最近 Tick 审计</h2>
          {lastStepResult ? (
            <div className={styles.resourceList}>
              <RuntimeInfoItem
                label="Step Status"
                value={lastStepResult.status}
              />
              <RuntimeInfoItem
                label="Tick ID"
                value={lastStepResult.context.tickId}
              />
              <RuntimeInfoItem
                label="Intent"
                value={lastStepResult.intentDecision.selectedIntent.type}
              />
              <RuntimeInfoItem
                label="Plan"
                value={lastStepResult.worldChangePlan.type}
              />
              <RuntimeInfoItem
                label="Proposal MapDiff"
                value={String(lastStepResult.worldDiffProposal.mapDiffs.length)}
              />
              <RuntimeInfoItem
                label="Applied MapDiff"
                value={String(
                  lastStepResult.worldEvolutionExecution.appliedMapDiffCount
                )}
              />
              <RuntimeInfoItem
                label="Audit Risk"
                value={lastStepResult.worldEvolutionAudit.summary.riskLevel}
              />
              <RuntimeInfoItem
                label="Can Apply Safely"
                value={String(
                  lastStepResult.worldEvolutionAudit.summary.canApplySafely
                )}
              />
              <RuntimeInfoItem
                label="Blockers"
                value={String(lastStepResult.auditTrail.blockers.length)}
              />
              <RuntimeInfoItem
                label="Warnings"
                value={String(lastStepResult.auditTrail.warnings.length)}
              />
            </div>
          ) : (
            <p>尚未手动推进 Tick。</p>
          )}
        </article>

        <article className={styles.panel}>
          <h2>Tick 阶段链路</h2>
          {lastStepResult ? (
            <div className={styles.resourceList}>
              {lastStepResult.auditTrail.stages.map((stage) => (
                <RuntimeInfoItem
                  key={`${stage.stage}-${stage.status}-${stage.message}`}
                  label={stage.stage}
                  value={`${stage.status} / ${stage.message}`}
                />
              ))}
            </div>
          ) : (
            <p>手动推进 Tick 后，这里会显示阶段链路。</p>
          )}
        </article>

        <article className={styles.panel}>
          <h2>第一幕状态</h2>
          <div className={styles.milestoneList}>
            {firstSceneModel.milestones.map((milestone) => (
              <div className={styles.milestoneItem} key={milestone.title}>
                <span
                  className={styles.statusDot}
                  data-status={milestone.status}
                />
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

function buildInitialRuntimeState(input: {
  firstSceneModel: WorldFirstSceneModel
}): RuntimeWorldState {
  const { firstSceneModel } = input
  const fallbackRuntimeState = buildRuntimeWorldState({
    worldId: firstSceneModel.worldId,
    ownerId: firstSceneModel.homeMapState.ownerId,
    initialHomeMapState: firstSceneModel.homeMapState,
    initialRenderableSnapshot: firstSceneModel.renderableWorldSnapshot,
    now: firstSceneModel.homeMapState.updatedAt,
  })

  if (typeof window === "undefined") return fallbackRuntimeState

  const loadResult = loadPersistedWorldLoopState({
    storage: window.localStorage,
    worldId: firstSceneModel.worldId,
    ownerId: firstSceneModel.homeMapState.ownerId,
  })

  if (!loadResult.ok || !loadResult.persistedState) {
    return fallbackRuntimeState
  }

  const renderableState = buildWorldLoopRenderableState({
    homeMapState: loadResult.persistedState.currentHomeMapState,
    now: loadResult.persistedState.savedAt,
  })

  return {
    ...fallbackRuntimeState,
    tickIndex: loadResult.persistedState.tickIndex,
    currentHomeMapState: loadResult.persistedState.currentHomeMapState,
    currentRenderableSnapshot: renderableState.renderableWorldSnapshot,
    auditTrail: fallbackRuntimeState.auditTrail,
    tags: Array.from(
      new Set([
        ...fallbackRuntimeState.tags,
        "runtime_world_state_restored_from_persistence",
      ])
    ),
  }
}

function buildInitialPersistenceUiState(input: {
  firstSceneModel: WorldFirstSceneModel
}): WorldPersistenceUiState {
  const { firstSceneModel } = input

  if (typeof window === "undefined") {
    return {
      status: "memory_only",
      message: "当前使用内存运行态。",
      tags: ["world_persistence_ui_state", "memory_only"],
    }
  }

  const loadResult = loadPersistedWorldLoopState({
    storage: window.localStorage,
    worldId: firstSceneModel.worldId,
    ownerId: firstSceneModel.homeMapState.ownerId,
  })

  if (loadResult.ok) {
    return {
      status: "restored",
      message: loadResult.message,
      key: loadResult.key,
      savedAt: loadResult.persistedState?.savedAt,
      tags: ["world_persistence_ui_state", "restored", ...loadResult.tags],
    }
  }

  return {
    status: "restore_failed",
    message: loadResult.message,
    key: loadResult.key,
    tags: ["world_persistence_ui_state", "restore_failed", ...loadResult.tags],
  }
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

function ProductWorldPanel(input: { model: MvpWorldViewModel }) {
  const delivery = input.model.formalVisualDeliveryModel
  const mapSize = delivery.overview.mapSize
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
            label="领养"
            value={delivery.overview.townAdoptionLabel}
          />
        </div>
      </header>

      <div className={styles.productWorldGrid}>
        <article className={styles.productMapPanel}>
          <div className={styles.productMapHeader}>
            <div>
              <h3>家园地图</h3>
              <p>
                地图由 HomeMapState 投影而来：UI 只读展示，不生成世界事实。
              </p>
            </div>
            <span>{mapSize.columns} × {mapSize.rows}</span>
          </div>

          <div
            className={styles.lowFiMap}
            style={{
              aspectRatio: `${mapSize.columns} / ${mapSize.rows}`,
            }}
          >
            {delivery.zones.map((zone) => (
              <div
                className={styles.mapZone}
                data-zone={zone.zoneType}
                key={zone.id}
                style={{
                  left: `${(zone.x / mapSize.columns) * 100}%`,
                  top: `${(zone.y / mapSize.rows) * 100}%`,
                  width: `${(zone.width / mapSize.columns) * 100}%`,
                  height: `${(zone.height / mapSize.rows) * 100}%`,
                }}
              >
                <span>{zone.label}</span>
              </div>
            ))}

            {delivery.mapItems.map((item) => {
              const shouldShowMapItemLabel =
                item.visualTone !== "path" && item.visualTone !== "atmosphere"

              return (
                <div
                  className={styles.mapItem}
                  data-tone={item.visualTone}
                  key={item.id}
                  style={{
                    left: `${(item.x / mapSize.columns) * 100}%`,
                    top: `${(item.y / mapSize.rows) * 100}%`,
                    opacity: item.opacity,
                  }}
                  title={item.label}
                >
                  {shouldShowMapItemLabel ? (
                    <span className={styles.mapItemLabel}>{item.label}</span>
                  ) : null}
                </div>
              )
            })}
          </div>

          <div className={styles.mapLegend} aria-label="地图图例">
            <MapLegendItem tone="home" label="住所" />
            <MapLegendItem tone="path" label="道路" />
            <MapLegendItem tone="care" label="照护点" />
            <MapLegendItem tone="nature" label="自然边界" />
            <MapLegendItem tone="work" label="储物/工作" />
          </div>
        </article>

        <article className={styles.productExplainPanel}>
          <h3>管家建设解释</h3>
          <div className={styles.productExplanation}>
            <strong>{delivery.construction.title}</strong>
            <span>{delivery.construction.statusLabel}</span>
            <p>{delivery.construction.explanation}</p>
            <p>
              目标区域：{delivery.construction.targetLabel}；已应用变化：
              {delivery.construction.acceptedDiffCount}；等待确认：
              {delivery.construction.rejectedDiffCount}
            </p>
          </div>

          <h3>房屋偏好</h3>
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

          <AdoptionProductPanel summary={input.model.adoptionSummary} />
        </article>
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
      <MvpDemoChecklistPanel model={input.model} />
      <MvpAcceptancePanel model={input.model} />
    </section>
  )
}

function MapLegendItem(input: {
  tone: "home" | "path" | "care" | "nature" | "work"
  label: string
}) {
  return (
    <div className={styles.mapLegendItem}>
      <span className={styles.mapLegendSwatch} data-tone={input.tone} />
      <strong>{input.label}</strong>
    </div>
  )
}

function AdoptionProductPanel(input: {
  summary: MvpWorldViewModel["adoptionSummary"]
}) {
  const { summary } = input
  const blockerText =
    summary.blockers.length > 0
      ? `${summary.blockers.length} 个等待项`
      : "没有关键阻塞"

  return (
    <article className={styles.adoptionPanel}>
      <div className={styles.adoptionHeader}>
        <div>
          <h3>{summary.title}</h3>
          <p>
            当前不会默认生成宠物事实，只记录世界是否具备未来接纳条件。
          </p>
        </div>
        <div className={styles.adoptionScore}>
          <strong>{summary.readinessScore}</strong>
          <span>/ 100</span>
        </div>
      </div>

      <div className={styles.adoptionMetaGrid}>
        <div className={styles.adoptionReasonCard}>
          <span>准备状态</span>
          <strong>{summary.statusLabel}</strong>
          <p>{summary.readinessLabel}</p>
        </div>
        <div className={styles.adoptionReasonCard}>
          <span>下一步</span>
          <strong>{summary.recommendedNextStepLabel}</strong>
          <p>{blockerText}</p>
        </div>
      </div>

      <div className={styles.adoptionReasonGrid}>
        <div className={styles.adoptionReasonCard}>
          <span>领养机会观察</span>
          <strong>{summary.adoptionOpportunityLabel}</strong>
          <p>{summary.adoptionOpportunityReason}</p>
        </div>
        <div className={styles.adoptionReasonCard}>
          <span>管家判断</span>
          <strong>{summary.decisionLabel}</strong>
          <p>{summary.decisionReason}</p>
          <p>{summary.nextCheckHint}</p>
        </div>
      </div>

      <div className={styles.adoptionReasonGrid}>
        <div className={styles.adoptionReasonCard}>
          <span>资源理由</span>
          {summary.resourceReasons.length > 0 ? (
            <ul className={styles.adoptionReasonList}>
              {summary.resourceReasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          ) : (
            <p>当前没有资源理由。</p>
          )}
        </div>
        <div className={styles.adoptionReasonCard}>
          <span>世界理由</span>
          {summary.worldReasons.length > 0 ? (
            <ul className={styles.adoptionReasonList}>
              {summary.worldReasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          ) : (
            <p>当前没有世界理由。</p>
          )}
        </div>
      </div>

      <div className={styles.adoptionBlockerList}>
        {summary.blockers.length > 0 ? (
          summary.blockers.map((blocker) => (
            <div
              className={styles.adoptionBlocker}
              data-tone={blocker.tone}
              key={`${blocker.sourceLabel}-${blocker.reason}`}
            >
              <strong>
                {blocker.severityLabel} / {blocker.sourceLabel}
              </strong>
              <p>{blocker.reason}</p>
            </div>
          ))
        ) : (
          <div className={styles.adoptionBlocker} data-tone="info">
            <strong>后置观察</strong>
            <p>
              当前没有关键阻塞项，但 MVP 阶段仍不会让领养机会观察默认进入世界。
            </p>
          </div>
        )}
      </div>
    </article>
  )
}

function MvpDemoChecklistPanel(input: { model: MvpWorldViewModel }) {
  const { model } = input

  return (
    <article className={styles.demoChecklistPanel}>
      <div className={styles.demoChecklistHeader}>
        <div>
          <h3>MVP 演示闭环</h3>
          <p>
            这里用于最终验收：用户是否能从一个页面看懂世界生成、管家建设、资源状态、房屋偏好与小镇领养观察。
          </p>
        </div>
        <strong>{model.demoStatusLabel}</strong>
      </div>

      <div className={styles.demoChecklistGrid}>
        {model.demoChecklist.map((item) => (
          <div
            className={styles.demoChecklistItem}
            data-status={item.status}
            key={item.id}
          >
            <div className={styles.demoChecklistItemHeader}>
              <strong>{item.title}</strong>
              <span>{item.status === "passed" ? "通过" : "提醒"}</span>
            </div>
            <p>{item.description}</p>
            <small>{item.evidence}</small>
          </div>
        ))}
      </div>
    </article>
  )
}

function MvpAcceptancePanel(input: { model: MvpWorldViewModel }) {
  const { model } = input
  const passedCount = model.acceptanceItems.filter(
    (item) => item.status === "passed"
  ).length
  const followUpCount = model.acceptanceItems.length - passedCount

  return (
    <article className={styles.acceptancePanel}>
      <div className={styles.acceptanceHeader}>
        <div>
          <h3>MVP 最终验收</h3>
          <p>
            这不是新增功能，而是最终验收缓冲：确认当前版本是否已经能作为
            AI-PET-WORLD V2.0 MVP 演示版本。
          </p>
        </div>
        <div className={styles.acceptanceBadge}>
          <strong>{model.acceptanceStatusLabel}</strong>
          <span>
            {passedCount} 项通过 / {followUpCount} 项后续
          </span>
        </div>
      </div>

      <div className={styles.acceptanceGrid}>
        {model.acceptanceItems.map((item) => (
          <div
            className={styles.acceptanceItem}
            data-status={item.status}
            key={item.id}
          >
            <div className={styles.acceptanceItemHeader}>
              <strong>{item.title}</strong>
              <span>{item.status === "passed" ? "通过" : "后续"}</span>
            </div>
            <p>{item.description}</p>
          </div>
        ))}
      </div>

      <div className={styles.acceptanceFooter}>
        <strong>验收地址</strong>
        <p>
          打开 <code>http://localhost:3000/world</code>，确认世界地图、资源状态、管家建设解释、房屋偏好、小镇领养等待原因和本验收面板都能正常显示。
        </p>
      </div>
    </article>
  )
}

function MvpCorePanel(input: { model: MvpWorldViewModel }) {
  const { model } = input

  return (
    <section className={styles.mvpCorePanel} aria-label="MVP core">
      <div className={styles.mvpCoreHeader}>
        <div className={styles.eyebrow}>MVP CORE / READONLY</div>
        <h2>MVP 核心闭环</h2>
        <p>
          这里读取 MVP 总入口输出：管家人格、初始世界、建设运行、持久化
          dry-run、视觉刷新预检、日志、P-Phone、小镇领养观察与管家领养意愿预检查。
        </p>
      </div>

      <div className={styles.mvpCoreGrid}>
        <article className={styles.mvpCoreCard}>
          <span>World</span>
          <strong>世界摘要</strong>
          <p>{model.worldSummary}</p>
        </article>
        <article className={styles.mvpCoreCard}>
          <span>Butler</span>
          <strong>管家摘要</strong>
          <p>{model.butlerSummary}</p>
        </article>
        <article className={styles.mvpCoreCard}>
          <span>Construction</span>
          <strong>建设摘要</strong>
          <p>{model.constructionSummary}</p>
        </article>
        <article className={styles.mvpCoreCard}>
          <span>Audit</span>
          <strong>审计摘要</strong>
          <p>{model.auditSummary}</p>
        </article>
        <article className={styles.mvpCoreCard}>
          <span>Atmosphere</span>
          <strong>{model.currentWorldPhaseLabel}</strong>
          <p>
            {model.atmosphereLabel}；领养状态：{model.townAdoptionStatusLabel}
          </p>
        </article>
      </div>

      <div className={styles.mvpCoreColumns}>
        <article className={styles.mvpCoreSubPanel}>
          <h3>World Log</h3>
          <div className={styles.mvpCoreList}>
            {model.logItems.map((entry) => (
              <div className={styles.mvpCoreListItem} key={entry}>
                <strong>世界日志</strong>
                <p>{entry}</p>
              </div>
            ))}
          </div>
        </article>

        <article className={styles.mvpCoreSubPanel}>
          <h3>P-Phone</h3>
          <div className={styles.mvpCoreList}>
            {model.pPhoneMessages.map((message) => (
              <div
                className={styles.mvpCoreListItem}
                key={`${message.title}-${message.body}`}
              >
                <strong>{message.title}</strong>
                <p>{message.body}</p>
              </div>
            ))}
          </div>
        </article>
      </div>
    </section>
  )
}

function parseBirthHour(time: string): number {
  const [hourText] = time.split(":")
  const hour = Number(hourText)

  if (!Number.isInteger(hour) || hour < 0 || hour > 23) return 0

  return hour
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
