/**
 * 当前文件职责：提供正式 ProceduralRenderer 组件骨架。
 */

import type { ReactNode } from "react"

import type { MapPlacementLayer } from "@/world/map-state/home-map-state-schema"
import type {
  DrawCommand,
  RenderableWorldSnapshot,
  VisualPlacement,
} from "@/world/rendering/renderer-gateway"
import type { Point2D } from "@/world/spatial/spatial-gateway"

import styles from "./procedural-renderer-view.styles.module.css"

const VIEW_SCALE = 24
const VIEW_PADDING = 24
const MAX_VISIBLE_COMMANDS = 400
const FORMAL_VIEW_SCALE = 32
const FORMAL_VIEW_PADDING = 32
const LAYER_RENDER_ORDER: MapPlacementLayer[] = [
  "ground",
  "edge",
  "zone",
  "path",
  "nature",
  "structure",
  "facility",
  "surface-decoration",
  "actor",
  "atmosphere",
]

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
  const visibleCommands = snapshot.drawCommands.slice(0, MAX_VISIBLE_COMMANDS)
  const proceduralVisualItems = buildProceduralVisualItems({
    placements: visualState.placements,
    tileSize: visualState.mapSize.tileSize,
  })
  const proceduralVisualSummary =
    buildProceduralVisualSummary(proceduralVisualItems)
  const svgWidth =
    visualState.mapSize.columns * VIEW_SCALE + VIEW_PADDING * 2
  const svgHeight = visualState.mapSize.rows * VIEW_SCALE + VIEW_PADDING * 2
  const formalViewportWidth =
    visualState.mapSize.columns * FORMAL_VIEW_SCALE + FORMAL_VIEW_PADDING * 2
  const formalViewportHeight =
    visualState.mapSize.rows * FORMAL_VIEW_SCALE + FORMAL_VIEW_PADDING * 2

  return (
    <section
      className={styles.rendererShell}
      aria-label="AI-PET-WORLD procedural renderer"
    >
      <div className={styles.header}>
        <span className={styles.eyebrow}>PROCEDURAL RENDERER / SUMMARY</span>
        <h2>ProceduralRenderer 正式组件摘要</h2>
        <p>
          ProceduralRenderer 正式组件已接收 RenderableWorldSnapshot。
          当前 Renderer 按定版文档改为几何 / 程序化绘制：它只读取
          RenderableWorldSnapshot、VisualState 与 DrawCommand，不读取 PNG
          图片，不把素材贴图当作世界。
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

      <section
        className={styles.summarySection}
        aria-labelledby="formal-visual-preview"
      >
        <h3 className={styles.sectionTitle} id="formal-visual-preview">
          几何 / 程序化视觉预览 v1
        </h3>
        <p className={styles.sectionDescription}>
          当前视图只读取 VisualState.placements 与几何派生信息，并用程序化
          CSS 形状绘制世界对象；不读取 PNG 图片，不读取 proposal，不生成
          placement，不修改 HomeMapState。
        </p>

        <div className={styles.formalViewport}>
          <div
            className={styles.formalWorldCanvas}
            style={{
              width: formalViewportWidth,
              height: formalViewportHeight,
            }}
          >
            {proceduralVisualItems.map(renderProceduralVisualItem)}
          </div>
        </div>

        <dl className={styles.metricGrid}>
          <div className={styles.metricItem}>
            <dt>procedural visuals</dt>
            <dd>{proceduralVisualSummary.total}</dd>
          </div>
          <div className={styles.metricItem}>
            <dt>kind ground</dt>
            <dd>{getCount(proceduralVisualSummary.byKind, "ground")}</dd>
          </div>
          <div className={styles.metricItem}>
            <dt>kind path</dt>
            <dd>{getCount(proceduralVisualSummary.byKind, "path")}</dd>
          </div>
          <div className={styles.metricItem}>
            <dt>kind structure</dt>
            <dd>{getCount(proceduralVisualSummary.byKind, "structure")}</dd>
          </div>
          <div className={styles.metricItem}>
            <dt>kind facility</dt>
            <dd>{getCount(proceduralVisualSummary.byKind, "facility")}</dd>
          </div>
          <div className={styles.metricItem}>
            <dt>kind nature</dt>
            <dd>{getCount(proceduralVisualSummary.byKind, "nature")}</dd>
          </div>
          <div className={styles.metricItem}>
            <dt>kind surface_decoration</dt>
            <dd>
              {getCount(proceduralVisualSummary.byKind, "surface_decoration")}
            </dd>
          </div>
          <div className={styles.metricItem}>
            <dt>kind actor</dt>
            <dd>{getCount(proceduralVisualSummary.byKind, "actor")}</dd>
          </div>
          <div className={styles.metricItem}>
            <dt>kind zone</dt>
            <dd>{getCount(proceduralVisualSummary.byKind, "zone")}</dd>
          </div>
        </dl>

        <dl className={styles.metricGrid}>
          <div className={styles.metricItem}>
            <dt>layer path</dt>
            <dd>{getCount(proceduralVisualSummary.byLayer, "path")}</dd>
          </div>
          <div className={styles.metricItem}>
            <dt>layer structure</dt>
            <dd>{getCount(proceduralVisualSummary.byLayer, "structure")}</dd>
          </div>
          <div className={styles.metricItem}>
            <dt>layer facility</dt>
            <dd>{getCount(proceduralVisualSummary.byLayer, "facility")}</dd>
          </div>
          <div className={styles.metricItem}>
            <dt>layer actor</dt>
            <dd>{getCount(proceduralVisualSummary.byLayer, "actor")}</dd>
          </div>
        </dl>
      </section>

      <section
        className={styles.summarySection}
        aria-labelledby="wireframe-preview"
      >
        <h3 className={styles.sectionTitle} id="wireframe-preview">
          基础线框预览
        </h3>
        <p className={styles.sectionDescription}>
          线框作为 debug overlay 保留；几何 / 程序化视觉预览读取
          VisualState.placements、anchor、footprint、collision、support、
          influence 与 DrawCommand 派生信息。
        </p>
        <div className={styles.wireframeViewport}>
          <svg
            className={styles.wireframeSvg}
            width={svgWidth}
            height={svgHeight}
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            role="img"
            aria-label="ProceduralRenderer 基础线框预览"
          >
            {visibleCommands.map(renderDrawCommand)}
          </svg>
        </div>
        <dl className={styles.metricGrid}>
          <div className={styles.metricItem}>
            <dt>visible commands</dt>
            <dd>{visibleCommands.length}</dd>
          </div>
          <div className={styles.metricItem}>
            <dt>max visible</dt>
            <dd>{MAX_VISIBLE_COMMANDS}</dd>
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

type ProceduralVisualKind =
  | "ground"
  | "path"
  | "structure"
  | "facility"
  | "nature"
  | "surface_decoration"
  | "actor"
  | "zone"
  | "edge"
  | "atmosphere"
  | "unknown"

type ProceduralVisualItem = {
  placement: VisualPlacement
  kind: ProceduralVisualKind
  left: number
  top: number
  width: number
  height: number
  zIndex: number
  label: string
  tags: string[]
}

type ProceduralVisualSummary = {
  total: number
  byKind: CountMap
  byLayer: CountMap
}

function renderProceduralVisualItem(item: ProceduralVisualItem): ReactNode {
  return (
    <div
      key={item.placement.placementId}
      className={`${styles.proceduralVisualItem} ${getProceduralVisualClassName(
        item.kind
      )}`}
      style={{
        left: item.left,
        top: item.top,
        width: item.width,
        height: item.height,
        opacity: item.placement.alpha,
        zIndex: item.zIndex,
      }}
      title={`${item.label} / ${item.placement.assetId} / ${item.kind}`}
    >
      {renderProceduralVisualInner(item)}
      <span className={styles.visualAssetLabel}>{item.label}</span>
    </div>
  )
}

function getProceduralVisualClassName(kind: ProceduralVisualKind): string {
  if (kind === "ground") return styles.proceduralGround
  if (kind === "path") return styles.proceduralPath
  if (kind === "structure") return styles.proceduralStructure
  if (kind === "facility") return styles.proceduralFacility
  if (kind === "nature") return styles.proceduralNature
  if (kind === "surface_decoration") return styles.proceduralSurfaceDecoration
  if (kind === "actor") return styles.proceduralActor
  if (kind === "zone") return styles.proceduralZone
  if (kind === "edge") return styles.proceduralEdge
  if (kind === "atmosphere") return styles.proceduralAtmosphere

  return styles.proceduralUnknown
}

function renderProceduralVisualInner(item: ProceduralVisualItem): ReactNode {
  if (item.kind === "ground") {
    return <div className={styles.proceduralGrassNoise} />
  }

  if (item.kind === "path") {
    return <div className={styles.proceduralPathLine} />
  }

  if (item.kind === "structure") {
    return (
      <>
        <div className={styles.proceduralStructureRoof} />
        <div className={styles.proceduralStructureBody} />
      </>
    )
  }

  if (item.kind === "facility") {
    return <div className={styles.proceduralFacilityCore} />
  }

  if (item.kind === "nature") {
    return (
      <>
        <div className={styles.proceduralTreeCrown} />
        <div className={styles.proceduralTreeTrunk} />
      </>
    )
  }

  if (item.kind === "surface_decoration") {
    return <div className={styles.proceduralDecorationDot} />
  }

  if (item.kind === "actor") {
    return <div className={styles.proceduralActorBody} />
  }

  if (item.kind === "zone") {
    return <div className={styles.proceduralZoneCore} />
  }

  if (item.kind === "edge") {
    return <div className={styles.proceduralEdgeCore} />
  }

  if (item.kind === "atmosphere") {
    return <div className={styles.proceduralAtmosphereCore} />
  }

  return <span className={styles.visualAssetFallbackText}>unknown</span>
}

function buildProceduralVisualItems(input: {
  placements: VisualPlacement[]
  tileSize: number
}): ProceduralVisualItem[] {
  return [...input.placements]
    .sort(sortVisualPlacementsForRender)
    .map((placement, index) => {
      const kind = resolveProceduralVisualKind(placement)
      const baseSize = getProceduralVisualBaseSize({
        placement,
        kind,
        tileSize: input.tileSize,
      })
      const width = baseSize.width * placement.scale
      const height = baseSize.height * placement.scale
      const position = computeProceduralVisualPosition({
        placement,
        kind,
        width,
        height,
      })

      return {
        placement,
        kind,
        left: position.left,
        top: position.top,
        width,
        height,
        zIndex: buildProceduralVisualZIndex({
          layer: placement.layer,
          orderIndex: index,
        }),
        label: placement.label,
        tags: [
          "procedural_visual_item_v1",
          `procedural_kind:${kind}`,
          `placement_layer:${placement.layer}`,
          ...placement.tags,
        ],
      }
    })
}

function resolveProceduralVisualKind(
  placement: VisualPlacement
): ProceduralVisualKind {
  if (placement.layer === "ground") return "ground"
  if (placement.layer === "path") return "path"
  if (placement.layer === "structure") return "structure"
  if (placement.layer === "facility") return "facility"
  if (placement.layer === "nature") return "nature"
  if (placement.layer === "surface-decoration") return "surface_decoration"
  if (placement.layer === "actor") return "actor"
  if (placement.layer === "zone") return "zone"
  if (placement.layer === "edge") return "edge"
  if (placement.layer === "atmosphere") return "atmosphere"

  return "unknown"
}

function getProceduralVisualBaseSize(input: {
  placement: VisualPlacement
  kind: ProceduralVisualKind
  tileSize: number
}): { width: number; height: number } {
  if (
    input.kind === "ground" ||
    input.kind === "path" ||
    input.kind === "edge" ||
    input.kind === "zone"
  ) {
    return { width: input.tileSize, height: input.tileSize }
  }

  if (input.kind === "surface_decoration") {
    return { width: input.tileSize, height: input.tileSize }
  }

  if (input.kind === "facility") {
    return { width: input.tileSize * 1.6, height: input.tileSize * 1.4 }
  }

  if (input.kind === "nature") {
    return { width: input.tileSize * 2, height: input.tileSize * 2.4 }
  }

  if (input.kind === "structure") {
    return { width: input.tileSize * 3, height: input.tileSize * 2.6 }
  }

  if (input.kind === "actor") {
    return { width: input.tileSize * 1.4, height: input.tileSize * 1.8 }
  }

  return { width: input.tileSize, height: input.tileSize }
}

function computeProceduralVisualPosition(input: {
  placement: VisualPlacement
  kind: ProceduralVisualKind
  width: number
  height: number
}): { left: number; top: number } {
  const anchorPoint = {
    x: input.placement.anchor.x * FORMAL_VIEW_SCALE + FORMAL_VIEW_PADDING,
    y: input.placement.anchor.y * FORMAL_VIEW_SCALE + FORMAL_VIEW_PADDING,
  }

  if (
    input.kind === "ground" ||
    input.kind === "path" ||
    input.kind === "edge" ||
    input.kind === "zone"
  ) {
    return {
      left: anchorPoint.x,
      top: anchorPoint.y,
    }
  }

  if (
    input.kind === "structure" ||
    input.kind === "facility" ||
    input.kind === "nature" ||
    input.kind === "actor" ||
    input.kind === "surface_decoration"
  ) {
    return {
      left: anchorPoint.x - input.width / 2,
      top: anchorPoint.y - input.height,
    }
  }

  return {
    left: anchorPoint.x - input.width / 2,
    top: anchorPoint.y - input.height / 2,
  }
}

function buildProceduralVisualSummary(
  items: ProceduralVisualItem[]
): ProceduralVisualSummary {
  return {
    total: items.length,
    byKind: countBy(items.map((item) => item.kind)),
    byLayer: countBy(items.map((item) => item.placement.layer)),
  }
}

function sortVisualPlacementsForRender(
  left: VisualPlacement,
  right: VisualPlacement
): number {
  const leftLayerOrder = getLayerRenderOrder(left.layer)
  const rightLayerOrder = getLayerRenderOrder(right.layer)

  if (leftLayerOrder !== rightLayerOrder) {
    return leftLayerOrder - rightLayerOrder
  }

  if (left.anchor.y !== right.anchor.y) {
    return left.anchor.y - right.anchor.y
  }

  if (left.anchor.x !== right.anchor.x) {
    return left.anchor.x - right.anchor.x
  }

  return left.placementId.localeCompare(right.placementId)
}

function getLayerRenderOrder(layer: MapPlacementLayer): number {
  const index = LAYER_RENDER_ORDER.indexOf(layer)

  return index >= 0 ? index : LAYER_RENDER_ORDER.length
}

function buildProceduralVisualZIndex(input: {
  layer: MapPlacementLayer
  orderIndex: number
}): number {
  return getLayerRenderOrder(input.layer) * 1000 + input.orderIndex
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

function toScreenPoint(point: Point2D): Point2D {
  return {
    x: point.x * VIEW_SCALE + VIEW_PADDING,
    y: point.y * VIEW_SCALE + VIEW_PADDING,
  }
}

function toSvgPoints(points: Point2D[]): string {
  return points
    .map(toScreenPoint)
    .map((point) => `${point.x},${point.y}`)
    .join(" ")
}

function dashToStrokeDasharray(dash?: number[]): string | undefined {
  return dash?.join(" ")
}

function renderDrawCommand(command: DrawCommand): ReactNode {
  if (command.kind === "point") {
    return renderPointCommand(command)
  }

  if (command.kind === "line") {
    return renderLineCommand(command)
  }

  if (command.kind === "polygon" || command.kind === "bounds") {
    return renderShapeCommand(command)
  }

  if (command.kind === "label") {
    return renderLabelCommand(command)
  }

  return null
}

function renderShapeCommand(command: DrawCommand): ReactNode {
  const commonProps = {
    fill: "none",
    stroke: "currentColor",
    strokeDasharray: dashToStrokeDasharray(command.debugStyle.dash),
    strokeWidth: command.debugStyle.strokeWidth,
    opacity: command.debugStyle.opacity,
  }

  if (command.geometry.kind === "polygon") {
    return (
      <polygon
        key={command.id}
        points={toSvgPoints(command.geometry.polygon.points)}
        {...commonProps}
      />
    )
  }

  if (command.geometry.kind === "multiPolygon") {
    return command.geometry.multiPolygon.polygons.map((polygon, index) => (
      <polygon
        key={`${command.id}-polygon-${index}`}
        points={toSvgPoints(polygon.points)}
        {...commonProps}
      />
    ))
  }

  return null
}

function renderPointCommand(command: DrawCommand): ReactNode {
  if (command.geometry.kind !== "point") {
    return null
  }

  const point = toScreenPoint(command.geometry.point)

  return (
    <circle
      key={command.id}
      cx={point.x}
      cy={point.y}
      r={3}
      fill="currentColor"
      opacity={command.debugStyle.opacity}
    />
  )
}

function renderLineCommand(command: DrawCommand): ReactNode {
  if (command.geometry.kind !== "line") {
    return null
  }

  return (
    <polyline
      key={command.id}
      points={toSvgPoints(command.geometry.line.points)}
      fill="none"
      stroke="currentColor"
      strokeDasharray={dashToStrokeDasharray(command.debugStyle.dash)}
      strokeWidth={command.debugStyle.strokeWidth}
      opacity={command.debugStyle.opacity}
    />
  )
}

function renderLabelCommand(command: DrawCommand): ReactNode {
  if (command.geometry.kind !== "point") {
    return null
  }

  const point = toScreenPoint(command.geometry.point)

  return (
    <text
      key={command.id}
      x={point.x}
      y={point.y}
      fill="currentColor"
      fontSize={10}
      opacity={0.85}
    >
      {command.label ?? command.id}
    </text>
  )
}
