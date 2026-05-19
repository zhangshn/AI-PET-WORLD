/**
 * 当前文件负责：提供正式 ProceduralRenderer 组件骨架。
 */

import type {
  DrawCommand,
  RenderableWorldSnapshot,
  VisualPlacement,
} from "@/world/rendering/renderer-gateway"

import styles from "./procedural-renderer-view.styles.module.css"

export type ProceduralRendererViewProps = {
  snapshot: RenderableWorldSnapshot
}

export function ProceduralRendererView(input: ProceduralRendererViewProps) {
  const { snapshot } = input
  const visualState = snapshot.visualState
  const drawCommandSummary = buildDrawCommandSummary(snapshot.drawCommands)
  const placementRuleSummary = buildPlacementRuleSummary(visualState.placements)
  const enabledOverlays = visualState.overlays
    .filter((overlay) => overlay.enabled)
    .map((overlay) => overlay.type)

  return (
    <section
      className={styles.rendererShell}
      aria-label="AI-PET-WORLD procedural renderer"
    >
      <div className={styles.header}>
        <span className={styles.eyebrow}>PROCEDURAL RENDERER / SUMMARY</span>
        <h2>ProceduralRenderer 正式组件摘要</h2>
        <p>
          ProceduralRenderer 正式组件已接收 RenderableWorldSnapshot，
          但当前阶段仍不绘制世界。
        </p>
      </div>

      <section className={styles.summarySection} aria-labelledby="base-summary">
        <h3 className={styles.sectionTitle} id="base-summary">
          基础 Summary
        </h3>
        <dl className={styles.summaryGrid}>
          <div className={styles.summaryItem}>
            <dt>世界编号</dt>
            <dd>{visualState.worldId}</dd>
          </div>
          <div className={styles.summaryItem}>
            <dt>DrawCommand</dt>
            <dd>{snapshot.drawCommands.length}</dd>
          </div>
          <div className={styles.summaryItem}>
            <dt>Placement</dt>
            <dd>{visualState.placements.length}</dd>
          </div>
          <div className={styles.summaryItem}>
            <dt>Terrain Cell</dt>
            <dd>{visualState.terrainCells.length}</dd>
          </div>
          <div className={styles.summaryItem}>
            <dt>Zone</dt>
            <dd>{visualState.zones.length}</dd>
          </div>
          <div className={styles.summaryItem}>
            <dt>Overlay</dt>
            <dd>{visualState.overlays.length}</dd>
          </div>
          <div className={styles.summaryItem}>
            <dt>Enabled Overlay</dt>
            <dd>{enabledOverlays.length}</dd>
          </div>
          <div className={styles.summaryItem}>
            <dt>Source</dt>
            <dd>{visualState.sources.length}</dd>
          </div>
        </dl>
      </section>

      <section className={styles.summarySection} aria-labelledby="rule-summary">
        <h3 className={styles.sectionTitle} id="rule-summary">
          Placement Rule Summary
        </h3>
        <dl className={styles.metricGrid}>
          <div className={styles.metricItem}>
            <dt>accepted</dt>
            <dd>{placementRuleSummary.accepted}</dd>
          </div>
          <div className={styles.metricItem}>
            <dt>rejected</dt>
            <dd>{placementRuleSummary.rejected}</dd>
          </div>
          <div className={styles.metricItem}>
            <dt>unmapped</dt>
            <dd>{placementRuleSummary.unmapped}</dd>
          </div>
          <div className={styles.metricItem}>
            <dt>unknown</dt>
            <dd>{placementRuleSummary.unknown}</dd>
          </div>
        </dl>
      </section>

      <section
        className={styles.summarySection}
        aria-labelledby="draw-command-summary"
      >
        <h3 className={styles.sectionTitle} id="draw-command-summary">
          DrawCommand Summary
        </h3>
        <dl className={styles.metricGrid}>
          <div className={styles.metricItem}>
            <dt>total</dt>
            <dd>{drawCommandSummary.total}</dd>
          </div>
          <div className={styles.metricItem}>
            <dt>kind point</dt>
            <dd>{getCount(drawCommandSummary.byKind, "point")}</dd>
          </div>
          <div className={styles.metricItem}>
            <dt>kind line</dt>
            <dd>{getCount(drawCommandSummary.byKind, "line")}</dd>
          </div>
          <div className={styles.metricItem}>
            <dt>kind polygon</dt>
            <dd>{getCount(drawCommandSummary.byKind, "polygon")}</dd>
          </div>
          <div className={styles.metricItem}>
            <dt>kind bounds</dt>
            <dd>{getCount(drawCommandSummary.byKind, "bounds")}</dd>
          </div>
          <div className={styles.metricItem}>
            <dt>kind label</dt>
            <dd>{getCount(drawCommandSummary.byKind, "label")}</dd>
          </div>
          <div className={styles.metricItem}>
            <dt>layer terrain</dt>
            <dd>{getCount(drawCommandSummary.byLayer, "terrain")}</dd>
          </div>
          <div className={styles.metricItem}>
            <dt>layer zone</dt>
            <dd>{getCount(drawCommandSummary.byLayer, "zone")}</dd>
          </div>
          <div className={styles.metricItem}>
            <dt>layer placement</dt>
            <dd>{getCount(drawCommandSummary.byLayer, "placement")}</dd>
          </div>
          <div className={styles.metricItem}>
            <dt>layer geometry</dt>
            <dd>{getCount(drawCommandSummary.byLayer, "geometry")}</dd>
          </div>
          <div className={styles.metricItem}>
            <dt>layer debug</dt>
            <dd>{getCount(drawCommandSummary.byLayer, "debug")}</dd>
          </div>
          <div className={styles.metricItem}>
            <dt>layer label</dt>
            <dd>{getCount(drawCommandSummary.byLayer, "label")}</dd>
          </div>
          <div className={styles.metricItem}>
            <dt>source home_map_state</dt>
            <dd>{getCount(drawCommandSummary.bySource, "home_map_state")}</dd>
          </div>
          <div className={styles.metricItem}>
            <dt>source entity_geometry</dt>
            <dd>{getCount(drawCommandSummary.bySource, "entity_geometry")}</dd>
          </div>
          <div className={styles.metricItem}>
            <dt>source terrain_state</dt>
            <dd>{getCount(drawCommandSummary.bySource, "terrain_state")}</dd>
          </div>
          <div className={styles.metricItem}>
            <dt>source placement_geometry_audit</dt>
            <dd>
              {getCount(
                drawCommandSummary.bySource,
                "placement_geometry_audit"
              )}
            </dd>
          </div>
          <div className={styles.metricItem}>
            <dt>source map_diff_history</dt>
            <dd>{getCount(drawCommandSummary.bySource, "map_diff_history")}</dd>
          </div>
        </dl>
      </section>

      <section className={styles.summarySection} aria-labelledby="meta-summary">
        <h3 className={styles.sectionTitle} id="meta-summary">
          Tags / Sources
        </h3>
        <dl className={styles.metaList}>
          <div>
            <dt>sources</dt>
            <dd>{visualState.sources.join(" / ")}</dd>
          </div>
          <div>
            <dt>snapshot tags</dt>
            <dd>
              <ul className={styles.tagList}>
                {snapshot.tags.slice(0, 8).map((tag) => (
                  <li key={`snapshot-${tag}`}>{tag}</li>
                ))}
              </ul>
            </dd>
          </div>
          <div>
            <dt>visualState tags</dt>
            <dd>
              <ul className={styles.tagList}>
                {visualState.tags.slice(0, 8).map((tag) => (
                  <li key={`visual-${tag}`}>{tag}</li>
                ))}
              </ul>
            </dd>
          </div>
        </dl>
      </section>
    </section>
  )
}

type CountMap = Record<string, number>

type PlacementRuleSummary = {
  accepted: number
  rejected: number
  unmapped: number
  unknown: number
}

type DrawCommandSummary = {
  total: number
  byKind: CountMap
  byLayer: CountMap
  bySource: CountMap
}

function buildPlacementRuleSummary(
  placements: VisualPlacement[]
): PlacementRuleSummary {
  const summary: PlacementRuleSummary = {
    accepted: 0,
    rejected: 0,
    unmapped: 0,
    unknown: 0,
  }

  for (const placement of placements) {
    summary[placement.ruleStatus] += 1
  }

  return summary
}

function buildDrawCommandSummary(
  drawCommands: DrawCommand[]
): DrawCommandSummary {
  return {
    total: drawCommands.length,
    byKind: countBy(drawCommands.map((command) => command.kind)),
    byLayer: countBy(drawCommands.map((command) => command.layer)),
    bySource: countBy(drawCommands.map((command) => command.source)),
  }
}

function countBy<TValue extends string>(values: TValue[]): CountMap {
  return values.reduce<CountMap>((counts, value) => {
    counts[value] = getCount(counts, value) + 1
    return counts
  }, {})
}

function getCount(counts: CountMap, key: string): number {
  return counts[key] ?? 0
}
