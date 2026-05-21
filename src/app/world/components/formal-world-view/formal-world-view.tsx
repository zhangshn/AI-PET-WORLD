/**
 * 当前文件职责：提供未来玩家主视觉 FormalWorldView 的组件骨架。
 */
import type { ReactNode } from "react"

import type {
  RenderableWorldSnapshot,
  VisualActorGeometryProjection,
  VisualPlacement,
} from "@/world/rendering/renderer-gateway"
import type { Point2D } from "@/world/spatial/spatial-gateway"

import styles from "./formal-world-view.styles.module.css"

const FORMAL_WORLD_TILE_SIZE = 32
const FORMAL_WORLD_MIN_ITEM_SIZE = 18

export type FormalWorldViewProps = {
  snapshot: RenderableWorldSnapshot
}

type FormalWorldSummary = {
  mapSizeLabel: string
  placementCount: number
  projectedButlerCount: number
  projectedPetCount: number
  petStatusLabel: string
}

type FormalActorSummary = {
  actorId: string
  actorKind: VisualActorGeometryProjection["actorKind"]
  statusLabel: string
  canShow: boolean
}

type FormalWorldVisualKind =
  | "ground"
  | "path"
  | "structure"
  | "facility"
  | "nature"
  | "surfaceDecoration"
  | "actor"
  | "other"

type FormalWorldVisualItem = {
  placementId: string
  kind: FormalWorldVisualKind
  label: string
  left: number
  top: number
  width: number
  height: number
  opacity: number
  zIndex: number
}

type FormalBounds = {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export function FormalWorldView(input: FormalWorldViewProps) {
  const { snapshot } = input
  const visualState = snapshot.visualState
  const summary = buildFormalWorldSummary(snapshot)
  const visualItems = buildFormalWorldVisualItems(visualState.placements)
  const actors = buildFormalActorSummaries(
    visualState.actorGeometryProjections
  )

  return (
    <section
      className={styles.formalWorldShell}
      aria-label="AI-PET-WORLD formal world view"
    >
      <header className={styles.formalHeader}>
        <div className={styles.eyebrow}>AI-PET-WORLD / FORMAL WORLD VIEW</div>
        <h2>主世界视图</h2>
        <p>
          这里是未来玩家主视觉的组件骨架。它只读取已经存在的
          RenderableWorldSnapshot / VisualState，不生成世界对象，不显示工程诊断。
        </p>
      </header>

      <div
        className={styles.formalCanvasShell}
        aria-label="formal world canvas shell"
      >
        <div
          className={styles.formalCanvas}
          style={{
            width: buildFormalCanvasWidth(visualState.mapSize.columns),
            height: buildFormalCanvasHeight(visualState.mapSize.rows),
          }}
        >
          <div className={styles.formalGround} />
          <div className={styles.formalAtmosphere} />
          {visualItems.map(renderFormalWorldVisualItem)}
          <div className={styles.formalCanvasHint}>
            <strong>自主世界画布</strong>
            <span>
              当前只读 VisualState.placements，以干净程序化样式显示世界对象。
            </span>
          </div>
        </div>
      </div>

      <section className={styles.formalHud} aria-label="formal world summary">
        <FormalInfoCard label="世界编号" value={visualState.worldId} />
        <FormalInfoCard label="地图规模" value={summary.mapSizeLabel} />
        <FormalInfoCard
          label="世界对象"
          value={String(summary.placementCount)}
        />
        <FormalInfoCard
          label="可显示管家"
          value={String(summary.projectedButlerCount)}
        />
        <FormalInfoCard label="宠物状态" value={summary.petStatusLabel} />
      </section>

      <section
        className={styles.formalActorPanel}
        aria-label="formal actor summary"
      >
        <h3>管家状态</h3>
        {actors.length > 0 ? (
          <ul className={styles.formalActorList}>
            {actors.map(renderFormalActorSummary)}
          </ul>
        ) : (
          <p className={styles.formalEmptyText}>
            当前没有可显示的 actor。FormalWorldView 不会伪造管家或宠物。
          </p>
        )}
      </section>
    </section>
  )
}

function buildFormalCanvasWidth(columns: number): number {
  return columns * FORMAL_WORLD_TILE_SIZE
}

function buildFormalCanvasHeight(rows: number): number {
  return rows * FORMAL_WORLD_TILE_SIZE
}

function buildFormalWorldSummary(
  snapshot: RenderableWorldSnapshot
): FormalWorldSummary {
  const visualState = snapshot.visualState
  const projectedActors = visualState.actorGeometryProjections.filter(
    (projection) => projection.canProject && projection.geometryProjection
  )
  const projectedButlerCount = projectedActors.filter(
    (projection) => projection.actorKind === "butler"
  ).length
  const projectedPetCount = projectedActors.filter(
    (projection) => projection.actorKind === "pet"
  ).length

  return {
    mapSizeLabel: `${visualState.mapSize.columns} × ${visualState.mapSize.rows}`,
    placementCount: countPlayerFacingPlacements(visualState.placements),
    projectedButlerCount,
    projectedPetCount,
    petStatusLabel: projectedPetCount > 0 ? "已进入世界" : "尚未进入主世界",
  }
}

function countPlayerFacingPlacements(placements: VisualPlacement[]): number {
  return placements.filter((placement) =>
    isPlayerFacingPlacementLayer(placement.layer)
  ).length
}

function isPlayerFacingPlacementLayer(
  layer: VisualPlacement["layer"]
): boolean {
  return (
    layer === "ground" ||
    layer === "path" ||
    layer === "structure" ||
    layer === "facility" ||
    layer === "nature" ||
    layer === "surface-decoration" ||
    layer === "actor"
  )
}

function buildFormalWorldVisualItems(
  placements: VisualPlacement[]
): FormalWorldVisualItem[] {
  return placements
    .filter((placement) => isPlayerFacingPlacementLayer(placement.layer))
    .map(buildFormalWorldVisualItem)
    .sort((left, right) => left.zIndex - right.zIndex)
}

function buildFormalWorldVisualItem(
  placement: VisualPlacement
): FormalWorldVisualItem {
  const bounds = buildFormalPlacementBounds(placement)
  const width = Math.max(
    FORMAL_WORLD_MIN_ITEM_SIZE,
    (bounds.maxX - bounds.minX) * FORMAL_WORLD_TILE_SIZE
  )
  const height = Math.max(
    FORMAL_WORLD_MIN_ITEM_SIZE,
    (bounds.maxY - bounds.minY) * FORMAL_WORLD_TILE_SIZE
  )

  return {
    placementId: placement.placementId,
    kind: mapPlacementLayerToFormalKind(placement.layer),
    label: buildPlayerFacingPlacementLabel(placement),
    left: bounds.minX * FORMAL_WORLD_TILE_SIZE,
    top: bounds.minY * FORMAL_WORLD_TILE_SIZE,
    width,
    height,
    opacity: placement.alpha,
    zIndex: buildFormalZIndex(placement.layer),
  }
}

function buildFormalPlacementBounds(placement: VisualPlacement): FormalBounds {
  if (placement.footprint) {
    return buildBoundsFromVisualShape(placement.footprint, placement.anchor)
  }

  return buildBoundsAroundAnchor(placement.anchor, placement.scale)
}

function buildBoundsAroundAnchor(
  anchor: Point2D,
  scale: number
): FormalBounds {
  const halfSize = Math.max(0.35, scale * 0.5)

  return {
    minX: anchor.x - halfSize,
    minY: anchor.y - halfSize,
    maxX: anchor.x + halfSize,
    maxY: anchor.y + halfSize,
  }
}

function buildBoundsFromVisualShape(
  shape: NonNullable<VisualPlacement["footprint"]>,
  fallbackAnchor: Point2D
): FormalBounds {
  if (shape.kind === "point") {
    return buildBoundsAroundAnchor(shape.point, 1)
  }

  if (shape.kind === "line") {
    return buildBoundsFromPoints(shape.line.points, fallbackAnchor)
  }

  if (shape.kind === "polygon") {
    return buildBoundsFromPoints(shape.polygon.points, fallbackAnchor)
  }

  return buildBoundsFromPoints(
    shape.multiPolygon.polygons.flatMap((polygon) => polygon.points),
    fallbackAnchor
  )
}

function buildBoundsFromPoints(
  points: readonly Point2D[],
  fallbackAnchor: Point2D
): FormalBounds {
  if (points.length === 0) {
    return buildBoundsAroundAnchor(fallbackAnchor, 1)
  }

  const xValues = points.map((point) => point.x)
  const yValues = points.map((point) => point.y)

  return {
    minX: Math.min(...xValues),
    minY: Math.min(...yValues),
    maxX: Math.max(...xValues),
    maxY: Math.max(...yValues),
  }
}

function mapPlacementLayerToFormalKind(
  layer: VisualPlacement["layer"]
): FormalWorldVisualKind {
  if (layer === "ground") return "ground"
  if (layer === "path") return "path"
  if (layer === "structure") return "structure"
  if (layer === "facility") return "facility"
  if (layer === "nature") return "nature"
  if (layer === "surface-decoration") return "surfaceDecoration"
  if (layer === "actor") return "actor"

  return "other"
}

function buildPlayerFacingPlacementLabel(placement: VisualPlacement): string {
  if (placement.layer === "ground") return "地面"
  if (placement.layer === "path") return "道路"
  if (placement.layer === "structure") return "建筑"
  if (placement.layer === "facility") return "设施"
  if (placement.layer === "nature") return "树木"
  if (placement.layer === "surface-decoration") return "小物"
  if (placement.layer === "actor") return "角色"

  return "世界对象"
}

function buildFormalZIndex(layer: VisualPlacement["layer"]): number {
  if (layer === "ground") return 1
  if (layer === "path") return 2
  if (layer === "surface-decoration") return 3
  if (layer === "facility") return 4
  if (layer === "nature") return 5
  if (layer === "structure") return 6
  if (layer === "actor") return 8

  return 7
}

function renderFormalWorldVisualItem(item: FormalWorldVisualItem): ReactNode {
  return (
    <div
      className={`${styles.formalWorldObject} ${getFormalWorldObjectClassName(
        item.kind
      )}`}
      key={item.placementId}
      style={{
        left: item.left,
        top: item.top,
        width: item.width,
        height: item.height,
        opacity: item.opacity,
        zIndex: item.zIndex,
      }}
      aria-label={item.label}
    >
      {renderFormalWorldObjectInner(item)}
    </div>
  )
}

function getFormalWorldObjectClassName(kind: FormalWorldVisualKind): string {
  if (kind === "ground") return styles.formalObjectGround
  if (kind === "path") return styles.formalObjectPath
  if (kind === "structure") return styles.formalObjectStructure
  if (kind === "facility") return styles.formalObjectFacility
  if (kind === "nature") return styles.formalObjectNature
  if (kind === "surfaceDecoration") {
    return styles.formalObjectSurfaceDecoration
  }
  if (kind === "actor") return styles.formalObjectActor

  return styles.formalObjectOther
}

function renderFormalWorldObjectInner(
  item: FormalWorldVisualItem
): ReactNode {
  if (item.kind === "path") {
    return <span className={styles.formalObjectPathLine} />
  }

  if (item.kind === "structure") {
    return (
      <>
        <span className={styles.formalObjectRoof} />
        <span className={styles.formalObjectHouseBody} />
      </>
    )
  }

  if (item.kind === "facility") {
    return <span className={styles.formalObjectFacilityCore} />
  }

  if (item.kind === "nature") {
    return (
      <>
        <span className={styles.formalObjectTreeCrown} />
        <span className={styles.formalObjectTreeTrunk} />
      </>
    )
  }

  if (item.kind === "surfaceDecoration") {
    return <span className={styles.formalObjectDot} />
  }

  if (item.kind === "actor") {
    return <span className={styles.formalObjectActorCore} />
  }

  return null
}

function buildFormalActorSummaries(
  projections: VisualActorGeometryProjection[]
): FormalActorSummary[] {
  return projections
    .filter(
      (projection) => projection.canProject && projection.geometryProjection
    )
    .filter((projection) => projection.actorKind === "butler")
    .map((projection) => ({
      actorId: projection.actorId,
      actorKind: projection.actorKind,
      statusLabel: buildActorStatusLabel(projection),
      canShow: true,
    }))
}

function buildActorStatusLabel(
  projection: VisualActorGeometryProjection
): string {
  if (!projection.canProject || !projection.geometryProjection) {
    return "尚未进入主世界显示"
  }

  if (projection.actorKind === "butler") {
    return "正在观察家园"
  }

  return "尚未进入主世界"
}

function renderFormalActorSummary(actor: FormalActorSummary): ReactNode {
  return (
    <li className={styles.formalActorItem} key={actor.actorId}>
      <span>{actor.actorKind === "butler" ? "管家" : "宠物"}</span>
      <strong>{actor.statusLabel}</strong>
    </li>
  )
}

function FormalInfoCard(input: { label: string; value: string }) {
  return (
    <article className={styles.formalInfoCard}>
      <span>{input.label}</span>
      <strong>{input.value}</strong>
    </article>
  )
}
