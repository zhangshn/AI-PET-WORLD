/**
 * 当前文件职责：只读 FormalVisualModel 渲染玩家主视觉壳层。
 */
import type { ReactNode } from "react"

import type {
  FormalActorModel,
  FormalVisualLayer,
  FormalVisualModel,
  FormalWorldObjectModel,
} from "@/world/formal-visual-model/formal-visual-model-gateway"
import type { Point2D, SpatialShape } from "@/world/spatial/spatial-gateway"

import styles from "./formal-world-view.styles.module.css"

export type FormalWorldViewProps = {
  model: FormalVisualModel
}

export function FormalWorldView(input: FormalWorldViewProps) {
  const { model } = input

  return (
    <section
      className={styles.formalWorldShell}
      aria-label="AI-PET-WORLD formal world view"
    >
      <header className={styles.formalHeader}>
        <div className={styles.eyebrow}>AI-PET-WORLD / FORMAL WORLD VIEW</div>
        <h2>主世界视图</h2>
        <p>
          这里只读 FormalVisualModel 渲染玩家主视觉，不生成模型、世界事实、
          placement 或 actor。
        </p>
      </header>

      <div className={styles.formalCanvasShell}>
        <div
          className={styles.formalCanvas}
          style={{
            aspectRatio: `${model.canvas.width} / ${model.canvas.height}`,
          }}
          aria-label="formal world canvas"
        >
          <div className={styles.formalGround} />
          <div className={styles.formalAtmosphere} />
          <svg
            className={styles.formalGeometrySvg}
            role="img"
            aria-label="formal world geometry"
            viewBox={`0 0 ${model.canvas.width} ${model.canvas.height}`}
          >
            {renderFormalObjects(model)}
            {model.actors.map((actorModel) =>
              renderFormalActor(model, actorModel)
            )}
          </svg>
        </div>
      </div>

      <section className={styles.formalHud} aria-label="formal world summary">
        <FormalInfoCard
          label="世界阶段"
          value={model.hudSummary.worldPhaseLabel}
        />
        <FormalInfoCard
          label="管家状态"
          value={model.hudSummary.butlerStatusLabel}
        />
        <FormalInfoCard
          label="伙伴状态"
          value={model.hudSummary.petStatusLabel}
        />
        <FormalInfoCard label="环境" value={model.environment.weatherLabel} />
      </section>

      <section className={styles.formalNotes} aria-label="formal world notes">
        <h3>世界观察</h3>
        <p>{model.hudSummary.recentLogHint}</p>
        {model.hudSummary.playerFacingNotes.length > 0 ? (
          <ul>
            {model.hudSummary.playerFacingNotes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        ) : (
          <p className={styles.formalEmptyText}>暂无新的世界观察。</p>
        )}
      </section>
    </section>
  )
}

function renderFormalObjects(model: FormalVisualModel): ReactNode {
  return [...model.objects]
    .sort((left, right) => getLayerOrder(left.layer) - getLayerOrder(right.layer))
    .map((objectModel) => renderFormalWorldObject(model, objectModel))
}

function renderFormalWorldObject(
  model: FormalVisualModel,
  objectModel: FormalWorldObjectModel
): ReactNode {
  return renderSpatialShape({
    id: `object-${objectModel.id}`,
    label: objectModel.label,
    shape: objectModel.geometry,
    tileSize: model.canvas.tileSize,
    className: [
      styles.formalShape,
      styles.formalObjectShape,
      getLayerClassName(objectModel.layer),
      getStyleTokenClassName(objectModel.styleToken),
    ].join(" "),
    opacity: objectModel.opacity,
  })
}

function renderFormalActor(
  model: FormalVisualModel,
  actorModel: FormalActorModel
): ReactNode {
  if (!actorModel.canRender) {
    return null
  }

  return (
    <g key={`actor-${actorModel.actorId}`} aria-label={actorModel.label}>
      {actorModel.aura
        ? renderSpatialShape({
            id: `actor-${actorModel.actorId}-aura`,
            label: actorModel.label,
            shape: actorModel.aura,
            tileSize: model.canvas.tileSize,
            className: [
              styles.formalShape,
              styles.formalActorAura,
              getStyleTokenClassName(actorModel.styleToken),
            ].join(" "),
            opacity: 0.28,
          })
        : null}
      {renderSpatialShape({
        id: `actor-${actorModel.actorId}-body`,
        label: actorModel.label,
        shape: actorModel.body,
        tileSize: model.canvas.tileSize,
        className: [
          styles.formalShape,
          styles.formalActorBody,
          getStyleTokenClassName(actorModel.styleToken),
        ].join(" "),
        opacity: 0.92,
      })}
    </g>
  )
}

function renderSpatialShape(input: {
  id: string
  label: string
  shape: SpatialShape
  tileSize: number
  className: string
  opacity: number
}): ReactNode {
  if (input.shape.kind === "point") {
    const point = toCanvasPoint(input.shape.point, input.tileSize)

    return (
      <circle
        className={`${input.className} ${styles.formalShapePoint}`}
        cx={point.x}
        cy={point.y}
        key={input.id}
        opacity={input.opacity}
        r={Math.max(3, input.tileSize * 0.16)}
      >
        <title>{input.label}</title>
      </circle>
    )
  }

  if (input.shape.kind === "line") {
    return (
      <polyline
        className={`${input.className} ${styles.formalShapeLine}`}
        fill="none"
        key={input.id}
        opacity={input.opacity}
        points={toCanvasSvgPoints(input.shape.line.points, input.tileSize)}
      >
        <title>{input.label}</title>
      </polyline>
    )
  }

  if (input.shape.kind === "polygon") {
    return renderPolygonShape({
      ...input,
      points: input.shape.polygon.points,
    })
  }

  return input.shape.multiPolygon.polygons.map((polygon, index) =>
    renderPolygonShape({
      ...input,
      id: `${input.id}-polygon-${index}`,
      points: polygon.points,
    })
  )
}

function renderPolygonShape(input: {
  id: string
  label: string
  points: readonly Point2D[]
  tileSize: number
  className: string
  opacity: number
}): ReactNode {
  return (
    <polygon
      className={`${input.className} ${styles.formalShapePolygon}`}
      key={input.id}
      opacity={input.opacity}
      points={toCanvasSvgPoints(input.points, input.tileSize)}
    >
      <title>{input.label}</title>
    </polygon>
  )
}

function toCanvasPoint(point: Point2D, tileSize: number): Point2D {
  return {
    x: point.x * tileSize,
    y: point.y * tileSize,
  }
}

function toCanvasSvgPoints(points: readonly Point2D[], tileSize: number): string {
  return points
    .map((point) => {
      const canvasPoint = toCanvasPoint(point, tileSize)

      return `${canvasPoint.x},${canvasPoint.y}`
    })
    .join(" ")
}

function getLayerOrder(layer: FormalVisualLayer): number {
  if (layer === "ground") return 1
  if (layer === "path") return 2
  if (layer === "surfaceDecoration") return 3
  if (layer === "facility") return 4
  if (layer === "nature") return 5
  if (layer === "structure") return 6
  if (layer === "environment") return 7
  if (layer === "actor") return 8
  if (layer === "hud") return 9

  return 10
}

function getLayerClassName(layer: FormalVisualLayer): string {
  if (layer === "ground") return styles.formalLayerGround
  if (layer === "path") return styles.formalLayerPath
  if (layer === "structure") return styles.formalLayerStructure
  if (layer === "facility") return styles.formalLayerFacility
  if (layer === "nature") return styles.formalLayerNature
  if (layer === "surfaceDecoration") return styles.formalLayerSurfaceDecoration
  if (layer === "actor") return styles.formalLayerActor
  if (layer === "environment") return styles.formalLayerEnvironment
  if (layer === "hud") return styles.formalLayerHud

  return styles.formalLayerUnknown
}

function getStyleTokenClassName(
  styleToken: FormalWorldObjectModel["styleToken"]
): string {
  if (styleToken === "warmNatural") return styles.formalStyleWarmNatural
  if (styleToken === "ordered") return styles.formalStyleOrdered
  if (styleToken === "protective") return styles.formalStyleProtective
  if (styleToken === "quiet") return styles.formalStyleQuiet
  if (styleToken === "exploratory") return styles.formalStyleExploratory
  if (styleToken === "caretaking") return styles.formalStyleCaretaking

  return styles.formalStyleNeutral
}

function FormalInfoCard(input: { label: string; value: string }) {
  return (
    <article className={styles.formalInfoCard}>
      <span>{input.label}</span>
      <strong>{input.value}</strong>
    </article>
  )
}
