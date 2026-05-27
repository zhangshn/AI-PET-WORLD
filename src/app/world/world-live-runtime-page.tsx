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
        <div className={styles.eyebrow}>AI-PET-WORLD / WORLD VIEW</div>
        <h1 className={styles.title}>Current world</h1>
        <p className={styles.description}>
          This page observes the saved HomeMapState and visual projection. It
          does not advance world time or write new world facts.
        </p>

        <div className={styles.statusStrip}>
          <span>World Tick: {saveRecord.tick}</span>
          <span>Last saved at: {saveRecord.savedAt}</span>
          <span>
            Butler motivation:{" "}
            {saveRecord.lastButlerRuntimeDecision?.selectedMotivation ?? "none"}
          </span>
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

      <section className={styles.viewModePanel} aria-label="World observation status">
        <div>
          <div className={styles.eyebrow}>WORLD STATE</div>
          <h2>Current saved world</h2>
          <p>
            The main world entrance reads the current runtime save only. Runtime
            ticks are reserved for explicit scripts, smoke checks, or future
            background jobs.
          </p>
        </div>
        <div className={styles.productStatusGrid}>
          <RuntimeInfoItem
            label="Source"
            value={runtimeView.isPersisted ? "saved world" : "initial preview"}
          />
          <RuntimeInfoItem
            label="Read mode"
            value="read-only"
          />
          <RuntimeInfoItem
            label="World changes"
            value={String(homeMapState.mapDiffs.length)}
          />
        </div>
      </section>

      <WorldPainterReadonlyPreview
        adapterResult={worldPainterAdapterResult}
        sceneSvg={worldPainterSceneSvg}
      />

      <section className={styles.contentGrid} aria-label="World surface signals">
        <FormalTraceSurfaceSummary formalVisualModel={formalVisualModel} />
        <article className={styles.panel}>
          <h2>Observation note</h2>
          <p>
            World traces are read from the formal visual projection. This view
            does not create traces, change movement, or write new world facts.
          </p>
        </article>
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
          <h2>Recent world note</h2>
          <div className={styles.resourceList}>
            <RuntimeInfoItem
              label="Note"
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
          <p>{lastEvent?.body ?? "The world is waiting for the next explicit tick."}</p>
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
