"use client"

/**
 * 当前文件职责：正式世界首屏入口。
 */

import { useMemo, useState, useSyncExternalStore } from "react"
import Link from "next/link"

import { FormalWorldView } from "@/app/world/components/formal-world-view"
import { ProceduralRendererView } from "@/app/world/components/procedural-renderer/procedural-renderer-view"
import { buildFormalVisualModelFromSnapshot } from "@/world/formal-visual-model/formal-visual-model-gateway"
import {
  buildMvpPresentationModel,
  runMvpCoreDebugRunner,
  type MvpPresentationModel,
} from "@/world/mvp-core/mvp-core-gateway"
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

import styles from "./world-route-page.styles.module.css"

const CREATE_WORLD_INPUT_PENDING = "__ai_pet_world_create_input_pending__"
const CREATE_WORLD_INPUT_EMPTY = "__ai_pet_world_create_input_empty__"

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
    if (createWorldInputSnapshot === CREATE_WORLD_INPUT_EMPTY) return null

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
      message: "尚未在 Tick 中使用真实 runtime context。",
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
  const rendererSnapshotTickLabel = lastStepResult
    ? `tick:${lastStepResult.context.tickIndex}`
    : "initial_world"
  const formalVisualModel = useMemo(
    () =>
      buildFormalVisualModelFromSnapshot(
        runtimeState.currentRenderableSnapshot
      ),
    [runtimeState.currentRenderableSnapshot]
  )
  const mvpCoreResult = useMemo(
    () =>
      runMvpCoreDebugRunner({
        homeMapState: runtimeState.currentHomeMapState,
        constructionStyle: worldCreationRuntime.butlerConstructionStyle,
        worldDay: runtimeState.tickIndex + 1,
        now:
          runtimeState.currentHomeMapState.updatedAt +
          runtimeState.tickIndex +
          1,
        tags: [
          "world_route_mvp_core_preview",
          "read_only_debug_dry_run",
        ],
      }),
    [
      runtimeState.currentHomeMapState,
      runtimeState.tickIndex,
      worldCreationRuntime.butlerConstructionStyle,
    ]
  )
  const mvpPresentationModel = useMemo(
    () => buildMvpPresentationModel(mvpCoreResult),
    [mvpCoreResult]
  )
  const shouldShowFormalView = viewMode === "formal" || viewMode === "both"
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
        ? "本次 Tick 已使用 ButlerRuntimeContext 转换后的 intent context；宠物 runtime 后置等待。"
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
        <div className={styles.eyebrow}>AI-PET-WORLD / FIRST SCENE</div>
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
            label="生成对象"
            value={String(firstSceneModel.homeSummary.placementCount)}
          />
        </div>
      </section>

      <section className={styles.viewModePanel} aria-label="World view mode">
        <div>
          <div className={styles.eyebrow}>WORLD VIEW MODE</div>
          <h2>视图模式</h2>
          <p>
            默认显示正式主视觉；Debug 视图保留给开发调试，双视图用于开发对照。
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

      {shouldShowFormalView ? (
        <section
          className={styles.formalWorldPanel}
          aria-label="Formal World View"
        >
          <div className={styles.formalWorldPanelHeader}>
            <div className={styles.eyebrow}>FORMAL WORLD VIEW</div>
            <h2>正式主视觉</h2>
            <p>
              这里从当前真实 RenderableWorldSnapshot 派生 FormalVisualModel，
              并交给 FormalWorldView 只读渲染。
            </p>
          </div>
          <FormalWorldView model={formalVisualModel} />
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
              ProceduralRendererView 仍然保留，用于验证真实世界链路与几何诊断。
            </p>
          </div>
          <ProceduralRendererView
            snapshot={runtimeState.currentRenderableSnapshot}
          />
        </section>
      ) : null}

      <MvpCorePanel model={mvpPresentationModel} />

      <section className={styles.contentGrid}>
        <article className={styles.panel}>
          <h2>世界运行态</h2>
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
              label="Last Tick Source"
              value={lastStepResult?.context.source ?? "initial_world"}
            />
            <RuntimeInfoItem
              label="Renderer Snapshot"
              value={rendererSnapshotTickLabel}
            />
            <RuntimeInfoItem
              label="Placement Delta"
              value={lastStepResult ? String(placementDelta) : "0"}
            />
            <RuntimeInfoItem
              label="MapDiff Delta"
              value={lastStepResult ? String(mapDiffDelta) : "0"}
            />
            <RuntimeInfoItem
              label="Persistence"
              value={persistenceState.status}
            />
            <RuntimeInfoItem
              label="Persisted Key"
              value={persistenceState.key ?? "none"}
            />
            <RuntimeInfoItem
              label="Saved At"
              value={
                persistenceState.savedAt !== undefined
                  ? String(persistenceState.savedAt)
                  : "none"
              }
            />
            <RuntimeInfoItem
              label="Runtime Context"
              value={runtimeContextState.status}
            />
            <RuntimeInfoItem
              label="Butler Runtime Task"
              value={runtimeContextState.butlerSummary?.currentTask ?? "not_used"}
            />
            <RuntimeInfoItem
              label="Butler Runtime Mood"
              value={runtimeContextState.butlerSummary?.mood ?? "not_used"}
            />
            <RuntimeInfoItem
              label="Pet Life Stage"
              value="后置等待"
            />
            <RuntimeInfoItem
              label="Pet Runtime Drive"
              value="后置等待"
            />
            <RuntimeInfoItem
              label="Pet Runtime Action"
              value="后置等待"
            />
          </div>
          <p>
            RuntimeWorldState 已建立；当前 Tick 只能手动触发，不自动推进，
            不自动持久化，不绕过 SafeApply。
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
              <RuntimeInfoItem label="SafeApply" value={lastSafeApplyTag} />
              <RuntimeInfoItem
                label="Previous Placement"
                value={String(
                  lastStepResult.previousHomeMapState.placements.length
                )}
              />
              <RuntimeInfoItem
                label="Next Placement"
                value={String(lastStepResult.nextHomeMapState.placements.length)}
              />
              <RuntimeInfoItem
                label="Previous MapDiff"
                value={String(lastStepResult.previousHomeMapState.mapDiffs.length)}
              />
              <RuntimeInfoItem
                label="Next MapDiff"
                value={String(lastStepResult.nextHomeMapState.mapDiffs.length)}
              />
              <RuntimeInfoItem
                label="Blocker Count"
                value={String(lastStepResult.auditTrail.blockers.length)}
              />
              <RuntimeInfoItem
                label="Warning Count"
                value={String(lastStepResult.auditTrail.warnings.length)}
              />
              <RuntimeInfoItem
                label="Note Count"
                value={String(lastStepResult.auditTrail.notes.length)}
              />
              <RuntimeInfoItem
                label="Context Source"
                value={runtimeContextState.status}
              />
              <RuntimeInfoItem
                label="Butler Context Tick"
                value={
                  runtimeContextState.butlerSummary
                    ? String(runtimeContextState.butlerSummary.tickIndex)
                    : "not_used"
                }
              />
              <RuntimeInfoItem
                label="Pet Context Tick"
                value="后置等待"
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
                  value={`${stage.status}｜${stage.message}`}
                />
              ))}
            </div>
          ) : (
            <p>尚未生成 Tick 阶段链路。</p>
          )}
        </article>

        <article className={styles.panel}>
          <h2>Tick 结果说明</h2>
          {lastStepResult ? (
            <div className={styles.resourceList}>
              <RuntimeTextList
                title="Blockers"
                items={lastStepResult.auditTrail.blockers}
                emptyText="没有阻塞原因。"
              />
              <RuntimeTextList
                title="Warnings"
                items={lastStepResult.auditTrail.warnings}
                emptyText="没有警告。"
              />
              <RuntimeTextList
                title="Notes"
                items={lastStepResult.auditTrail.notes}
                emptyText="没有补充说明。"
              />
            </div>
          ) : (
            <p>手动推进 Tick 后，这里会显示阻塞、警告和说明。</p>
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

function RuntimeTextList(input: {
  title: string
  items: string[]
  emptyText: string
}) {
  return (
    <div className={styles.resourceItem}>
      <div className={styles.resourceHeader}>
        <strong>{input.title}</strong>
        <span>{input.items.length}</span>
      </div>
      {input.items.length > 0 ? (
        <ul>
          {input.items.slice(0, 6).map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <p>{input.emptyText}</p>
      )}
    </div>
  )
}

function MvpCorePanel(input: { model: MvpPresentationModel }) {
  const { model } = input

  return (
    <section className={styles.mvpCorePanel} aria-label="MVP core closure">
      <div className={styles.mvpCoreHeader}>
        <div className={styles.eyebrow}>MVP CORE / DRY-RUN</div>
        <h2>MVP 核心闭环</h2>
        <p>
          这里只读展示 MVP 核心 dry-run：建设、持久化预检查、视觉刷新请求、
          生命事件后置候选和 P-Phone 摘要。它不写入世界事实，也不生成宠物。
        </p>
      </div>

      <div className={styles.mvpCoreGrid}>
        <article className={styles.mvpCoreCard}>
          <span>P-Phone</span>
          <strong>{model.pPhoneData.statusLabel}</strong>
          <p>{model.pPhoneData.primaryActionLabel}</p>
        </article>
        <article className={styles.mvpCoreCard}>
          <span>Butler</span>
          <strong>{model.pPhoneData.butlerExplanation.title}</strong>
          <p>{model.pPhoneData.butlerExplanation.summary}</p>
        </article>
        <article className={styles.mvpCoreCard}>
          <span>Warnings</span>
          <strong>{String(model.warnings.length)}</strong>
          <p>
            {model.warnings.length === 0
              ? "MVP core dry-run audit passed."
              : "MVP core dry-run still has warnings."}
          </p>
        </article>
      </div>

      <div className={styles.mvpCoreColumns}>
        <article className={styles.mvpCoreSubPanel}>
          <h3>World Log</h3>
          <div className={styles.mvpCoreList}>
            {model.pPhoneData.logEntries.map((entry) => (
              <div className={styles.mvpCoreListItem} key={entry.id}>
                <strong>{entry.title}</strong>
                <p>{entry.body}</p>
              </div>
            ))}
          </div>
        </article>

        <article className={styles.mvpCoreSubPanel}>
          <h3>Full MVP Report</h3>
          <div className={styles.mvpCoreList}>
            {model.report.sections.map((section) => (
              <div className={styles.mvpCoreListItem} key={section.title}>
                <strong>{section.title}</strong>
                <p>{section.lines[0] ?? section.status}</p>
              </div>
            ))}
          </div>
        </article>
      </div>
    </section>
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
