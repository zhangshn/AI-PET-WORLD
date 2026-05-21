/**
 * 当前文件职责：提供未来玩家主视觉 FormalWorldView 的组件骨架。
 */
import type { ReactNode } from "react"

import type {
  RenderableWorldSnapshot,
  VisualActorGeometryProjection,
  VisualPlacement,
} from "@/world/rendering/renderer-gateway"

import styles from "./formal-world-view.styles.module.css"

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

export function FormalWorldView(input: FormalWorldViewProps) {
  const { snapshot } = input
  const visualState = snapshot.visualState
  const summary = buildFormalWorldSummary(snapshot)
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
        <div className={styles.formalCanvas}>
          <div className={styles.formalGround} />
          <div className={styles.formalCanvasHint}>
            <strong>自主世界画布骨架</strong>
            <span>后续 P8-I2 会在这里接入干净的程序化世界对象。</span>
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

function buildFormalActorSummaries(
  projections: VisualActorGeometryProjection[]
): FormalActorSummary[] {
  return projections
    .filter((projection) => projection.canProject && projection.geometryProjection)
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
