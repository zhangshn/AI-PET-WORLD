/**
 * 当前文件职责：只读 FormalVisualModel 渲染玩家主视觉壳层。
 */
import type { ReactNode } from "react"

import type {
  FormalActorModel,
  FormalVisualLayer,
  FormalVisualModel,
  FormalWorldObjectKind,
  FormalWorldObjectModel,
} from "@/world/formal-visual-model/formal-visual-model-gateway"
import type { Point2D, SpatialShape } from "@/world/spatial/spatial-gateway"

import styles from "./formal-world-view.styles.module.css"

export type FormalWorldViewPresentationMode = "debug" | "product"

export type FormalWorldViewProps = {
  model: FormalVisualModel
  presentationMode?: FormalWorldViewPresentationMode
}

export function FormalWorldView(input: FormalWorldViewProps) {
  const { model } = input
  const copy = getFormalWorldViewCopy(input.presentationMode ?? "debug")

  return (
    <section
      className={[
        styles.formalWorldShell,
        getMoodClassName(model.canvas.mood),
        getAtmosphereClassName(model.environment.atmosphere),
      ].join(" ")}
      aria-label="AI-PET-WORLD formal world view"
    >
      <header className={styles.formalHeader}>
        <div className={styles.eyebrow}>{copy.eyebrow}</div>
        <h2>{copy.title}</h2>
        <p>{copy.description}</p>
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
            {renderFormalDefinitions()}
            {renderFormalObjects(model)}
            {model.actors.map((actorModel) =>
              renderFormalActor(model, actorModel)
            )}
          </svg>
          <div className={styles.pixelVignette} />
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
          label="领养状态"
          value={model.hudSummary.petStatusLabel}
        />
        <FormalInfoCard
          label="环境"
          value={`${model.environment.mood} / ${model.environment.weatherLabel}`}
        />
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

function getFormalWorldViewCopy(mode: FormalWorldViewPresentationMode): {
  eyebrow: string
  title: string
  description: string
} {
  if (mode === "product") {
    return {
      eyebrow: "AI-PET-WORLD / HOME VIEW",
      title: "家园主世界",
      description:
        "这里展示家园当前的地貌、道路、自然边界与管家位置。画面会随着世界状态自然更新。",
    }
  }

  return {
    eyebrow: "AI-PET-WORLD / WORLD VIEW",
    title: "主世界视图",
    description:
      "这里只读 FormalVisualModel 渲染玩家主视觉，不生成模型、世界事实、placement 或 actor。",
  }
}

function renderFormalDefinitions(): ReactNode {
  return (
    <defs>
      <pattern
        id="formalPixelGrass"
        width="16"
        height="16"
        patternUnits="userSpaceOnUse"
      >
        <rect width="16" height="16" fill="rgba(104, 158, 82, 0.66)" />
        <rect x="2" y="3" width="3" height="3" fill="rgba(151, 192, 104, 0.48)" />
        <rect x="10" y="9" width="3" height="3" fill="rgba(70, 130, 76, 0.42)" />
      </pattern>
      <pattern
        id="formalPixelPath"
        width="14"
        height="14"
        patternUnits="userSpaceOnUse"
      >
        <rect width="14" height="14" fill="rgba(156, 118, 78, 0.76)" />
        <rect x="1" y="2" width="4" height="2" fill="rgba(202, 165, 108, 0.38)" />
        <rect x="8" y="9" width="5" height="2" fill="rgba(112, 78, 50, 0.28)" />
      </pattern>
      <pattern
        id="formalPixelStorage"
        width="12"
        height="12"
        patternUnits="userSpaceOnUse"
      >
        <rect width="12" height="12" fill="rgba(135, 111, 73, 0.6)" />
        <rect x="2" y="2" width="3" height="3" fill="rgba(216, 177, 104, 0.56)" />
        <rect x="7" y="7" width="3" height="3" fill="rgba(92, 72, 50, 0.32)" />
      </pattern>
    </defs>
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
      getObjectKindClassName(objectModel.kind),
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

  const anchor = toCanvasPoint(actorModel.anchor, model.canvas.tileSize)

  return (
    <g
      key={`actor-${actorModel.actorId}`}
      aria-label={actorModel.label}
      className={styles.formalActorGroup}
    >
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
            opacity: 0.24,
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
        opacity: 0.96,
      })}
      <circle
        className={styles.formalActorHead}
        cx={anchor.x}
        cy={anchor.y - model.canvas.tileSize * 0.18}
        r={Math.max(4, model.canvas.tileSize * 0.16)}
      >
        <title>{actorModel.label}</title>
      </circle>
      <rect
        className={styles.formalActorApron}
        x={anchor.x - model.canvas.tileSize * 0.1}
        y={anchor.y}
        width={model.canvas.tileSize * 0.2}
        height={model.canvas.tileSize * 0.28}
        rx="2"
      />
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
        r={Math.max(4, input.tileSize * 0.2)}
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

function getObjectKindClassName(kind: FormalWorldObjectKind): string {
  if (kind === "terrain") return styles.formalKindTerrain
  if (kind === "path") return styles.formalKindPath
  if (kind === "shelter") return styles.formalKindShelter
  if (kind === "structure") return styles.formalKindStructure
  if (kind === "facility") return styles.formalKindFacility
  if (kind === "tree") return styles.formalKindTree
  if (kind === "bush") return styles.formalKindBush
  if (kind === "surfaceDecoration") return styles.formalKindSurfaceDecoration
  if (kind === "resource") return styles.formalKindResource
  if (kind === "lifeTrace") return styles.formalKindLifeTrace
  if (kind === "boundary") return styles.formalKindBoundary

  return styles.formalKindUnknown
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

function getMoodClassName(mood: FormalVisualModel["canvas"]["mood"]): string {
  if (mood === "warm") return styles.formalMoodWarm
  if (mood === "quiet") return styles.formalMoodQuiet
  if (mood === "active") return styles.formalMoodActive
  if (mood === "alert") return styles.formalMoodAlert

  return styles.formalMoodCalm
}

function getAtmosphereClassName(
  atmosphere: FormalVisualModel["environment"]["atmosphere"]
): string {
  if (atmosphere === "morning") return styles.formalAtmosphereMorning
  if (atmosphere === "evening") return styles.formalAtmosphereEvening
  if (atmosphere === "night") return styles.formalAtmosphereNight
  if (atmosphere === "rain") return styles.formalAtmosphereRain

  return styles.formalAtmosphereDay
}

function FormalInfoCard(input: { label: string; value: string }) {
  return (
    <article className={styles.formalInfoCard}>
      <span>{input.label}</span>
      <strong>{input.value}</strong>
    </article>
  )
}
