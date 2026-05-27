import { ButlerMemoryBiasSurface } from "@/app/world/components/butler-memory-bias-surface"
import { ButlerNaturalExplanation } from "@/app/world/components/butler-natural-explanation"
import { FormalWorldView } from "@/app/world/components/formal-world-view"
import { FormalTraceSurfaceSummary } from "@/app/world/components/formal-trace-surface-summary"
import { WorldPainterReadonlyPreview } from "@/app/world/components/world-painter-readonly-preview"
import { buildFormalVisualModelFromSnapshot } from "@/world/formal-visual-model/formal-visual-model-gateway"
import { buildSceneSvg } from "@/world/procedural-painter/scene-composer/scene-composer-gateway"
import { adaptHomeMapStateToSceneComposerFact } from "@/world/procedural-painter/world-painter-adapter/world-painter-fact-adapter"
import { buildWorldLoopRenderableState } from "@/world/world-loop/world-loop-gateway"
import { readWorldRuntimeForView } from "@/world/runtime/world-runtime-gateway"

import styles from "./world-route-page.styles.module.css"

export async function WorldLiveRuntimePage() {
  const runtimeView = await readWorldRuntimeForView()
  const saveRecord = runtimeView.saveRecord
  const homeMapState = saveRecord.homeMapState
  const renderableState = buildWorldLoopRenderableState({
    homeMapState,
    now: homeMapState.updatedAt,
  })
  const formalVisualModel = buildFormalVisualModelFromSnapshot(
    renderableState.renderableWorldSnapshot,
    {
      traceField: saveRecord.traceField,
    }
  )
  const worldPainterAdapterResult = adaptHomeMapStateToSceneComposerFact({
    homeMapState,
  })
  const worldPainterSceneSvg = buildSceneSvg(worldPainterAdapterResult.sceneFact)
  const lastEvent = saveRecord.recentEvents[saveRecord.recentEvents.length - 1]

  return (
    <main className={styles.worldPage} aria-label="AI-PET-WORLD">
      <section className={styles.heroPanel}>
        <div className={styles.eyebrow}>AI-PET-WORLD / 世界观察</div>
        <h1 className={styles.title}>当前家园</h1>
        <p className={styles.description}>
          这里读取已经保存的家园状态和正式视觉投影。页面只负责观察，
          不推进世界时间，也不写入新的世界事实。
        </p>

        <div className={styles.statusStrip}>
          <span>世界 Tick：{saveRecord.tick}</span>
          <span>最近保存：{saveRecord.savedAt}</span>
          <span>
            管家当前倾向：{" "}
            {toMotivationLabel(saveRecord.lastButlerRuntimeDecision?.selectedMotivation)}
          </span>
        </div>

        <div className={styles.summaryGrid}>
          <SummaryCard label="世界编号" value={saveRecord.worldId} />
          <SummaryCard
            label="家园物件"
            value={String(homeMapState.placements.length)}
          />
          <SummaryCard
            label="世界变化记录"
            value={String(homeMapState.mapDiffs.length)}
          />
        </div>
      </section>

      <section className={styles.viewModePanel} aria-label="世界观察状态">
        <div>
          <div className={styles.eyebrow}>世界状态</div>
          <h2>当前保存的家园</h2>
          <p>
            主世界入口只读取当前 runtime 存档。世界 Tick 只会在显式脚本、
            smoke 验证或未来的受控后台任务中推进。
          </p>
        </div>
        <div className={styles.productStatusGrid}>
          <RuntimeInfoItem
            label="数据来源"
            value={runtimeView.isPersisted ? "已保存世界" : "初始预览"}
          />
          <RuntimeInfoItem
            label="读取模式"
            value="只读"
          />
          <RuntimeInfoItem
            label="世界变化"
            value={String(homeMapState.mapDiffs.length)}
          />
        </div>
      </section>

      <ButlerNaturalExplanation saveRecord={saveRecord} />

      <WorldPainterReadonlyPreview
        adapterResult={worldPainterAdapterResult}
        sceneSvg={worldPainterSceneSvg}
      />

      <section className={styles.contentGrid} aria-label="世界表层信号">
        <FormalTraceSurfaceSummary formalVisualModel={formalVisualModel} />
        <ButlerMemoryBiasSurface saveRecord={saveRecord} />
      </section>

      <section className={styles.formalWorldPanel} aria-label="家园正式视图">
        <div className={styles.formalWorldPanelHeader}>
          <div className={styles.eyebrow}>正式家园视图</div>
          <h2>当前保存的世界画面</h2>
          <p>
            画面来自已保存 HomeMapState 的正式投影。它只展示世界状态，
            不创建物件，也不生成新的世界事实。
          </p>
        </div>
        <FormalWorldView model={formalVisualModel} presentationMode="product" />
      </section>

      <section className={styles.contentGrid}>
        <article className={styles.panel}>
          <h2>最近世界记录</h2>
          <div className={styles.resourceList}>
            <RuntimeInfoItem
              label="记录"
              value={lastEvent?.title ?? "暂无记录"}
            />
            <RuntimeInfoItem
              label="来源"
              value={lastEvent?.source ?? "runtime"}
            />
            <RuntimeInfoItem
              label="Tick"
              value={String(lastEvent?.tick ?? saveRecord.tick)}
            />
          </div>
          <p>{lastEvent?.body ?? "世界正在等待下一次显式 Tick。"}</p>
        </article>

        <article className={styles.panel}>
          <h2>资源状态</h2>
          <div className={styles.resourceList}>
            <RuntimeInfoItem
              label="材料"
              value={String(homeMapState.resources.materialReadiness)}
            />
            <RuntimeInfoItem
              label="照料"
              value={String(homeMapState.resources.careReadiness)}
            />
            <RuntimeInfoItem
              label="地面"
              value={String(homeMapState.resources.groundHealth)}
            />
            <RuntimeInfoItem
              label="空间压力"
              value={String(homeMapState.resources.spacePressure)}
            />
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

function toMotivationLabel(value: string | undefined): string {
  if (value === "continue_construction") return "继续建设"
  if (value === "maintain_home") return "维护家园"
  if (value === "observe_world") return "观察世界"
  if (value === "wait_for_resources") return "谨慎等待"

  return "暂无"
}
