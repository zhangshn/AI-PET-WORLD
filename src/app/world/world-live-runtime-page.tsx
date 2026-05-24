import { FormalWorldView } from "@/app/world/components/formal-world-view"
import { buildFormalVisualModelFromSnapshot } from "@/world/formal-visual-model/formal-visual-model-gateway"
import { buildWorldLoopRenderableState } from "@/world/world-loop/world-loop-gateway"
import { runAndPersistOneRuntimeTick } from "@/world/runtime/world-runtime-gateway"

import styles from "./world-route-page.styles.module.css"

export async function WorldLiveRuntimePage() {
  const runtimeResult = await runAndPersistOneRuntimeTick()
  const saveRecord = runtimeResult.nextSaveRecord
  const homeMapState = saveRecord.homeMapState
  const renderableState = buildWorldLoopRenderableState({
    homeMapState,
    now: homeMapState.updatedAt,
  })
  const formalVisualModel = buildFormalVisualModelFromSnapshot(
    renderableState.renderableWorldSnapshot
  )
  const lastEvent = saveRecord.recentEvents[saveRecord.recentEvents.length - 1]
  const acceptedDiffCount =
    runtimeResult.runtimeTick?.constructionResult.fullPipelineAudit
      .acceptedDiffIds.length ?? 0

  return (
    <main className={styles.worldPage} aria-label="AI-PET-WORLD">
      <section className={styles.heroPanel}>
        <div className={styles.eyebrow}>AI-PET-WORLD / LIVE WORLD</div>
        <h1 className={styles.title}>Live world running</h1>
        <p className={styles.description}>
          The butler continues the saved HomeMapState through MapDiff,
          SafeApply, and audit. The page is a read-only projection.
        </p>

        <div className={styles.statusStrip}>
          <span>Live Runtime Tick: {saveRecord.tick}</span>
          <span>Last saved at: {saveRecord.savedAt}</span>
        </div>

        <div className={styles.summaryGrid}>
          <SummaryCard label="World" value={saveRecord.worldId} />
          <SummaryCard
            label="World objects"
            value={String(homeMapState.placements.length)}
          />
          <SummaryCard
            label="MapDiff history"
            value={String(homeMapState.mapDiffs.length)}
          />
        </div>
      </section>

      <section className={styles.viewModePanel} aria-label="Live runtime status">
        <div>
          <div className={styles.eyebrow}>LIVE RUNTIME</div>
          <h2>World state saved</h2>
          <p>
            This request reads the runtime save. If the save already exists, it
            runs one world tick and persists the next HomeMapState only after
            audit and SafeApply.
          </p>
        </div>
        <div className={styles.productStatusGrid}>
          <RuntimeInfoItem
            label="Persisted"
            value={runtimeResult.persisted ? "yes" : "no"}
          />
          <RuntimeInfoItem
            label="SafeApply changes"
            value={String(acceptedDiffCount)}
          />
          <RuntimeInfoItem
            label="Warnings"
            value={String(runtimeResult.audit.warnings.length)}
          />
        </div>
      </section>

      <section className={styles.formalWorldPanel} aria-label="Home world view">
        <div className={styles.formalWorldPanelHeader}>
          <div className={styles.eyebrow}>FORMAL WORLD VIEW</div>
          <h2>Current saved world</h2>
          <p>
            Visuals read from the saved HomeMapState projection. They do not
            create placements or world facts.
          </p>
        </div>
        <FormalWorldView model={formalVisualModel} presentationMode="product" />
      </section>

      <section className={styles.contentGrid}>
        <article className={styles.panel}>
          <h2>Butler runtime event</h2>
          <div className={styles.resourceList}>
            <RuntimeInfoItem
              label="Event"
              value={lastEvent?.title ?? "No event"}
            />
            <RuntimeInfoItem
              label="Source"
              value={lastEvent?.source ?? "runtime"}
            />
            <RuntimeInfoItem
              label="Tick"
              value={String(lastEvent?.tick ?? saveRecord.tick)}
            />
          </div>
          <p>{lastEvent?.body ?? "Runtime is waiting for the next tick."}</p>
        </article>

        <article className={styles.panel}>
          <h2>Resource state</h2>
          <div className={styles.resourceList}>
            <RuntimeInfoItem
              label="Material"
              value={String(homeMapState.resources.materialReadiness)}
            />
            <RuntimeInfoItem
              label="Care"
              value={String(homeMapState.resources.careReadiness)}
            />
            <RuntimeInfoItem
              label="Ground"
              value={String(homeMapState.resources.groundHealth)}
            />
            <RuntimeInfoItem
              label="Space pressure"
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
