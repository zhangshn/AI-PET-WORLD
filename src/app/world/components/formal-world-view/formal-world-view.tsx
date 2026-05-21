/**
 * 当前文件职责：只读 FormalVisualModel 渲染未来玩家主视觉壳层。
 */
import type { ReactNode } from "react"

import type {
  FormalActorModel,
  FormalVisualModel,
  FormalWorldObjectModel,
} from "@/world/formal-visual-model/formal-visual-model-gateway"

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
          这里只读 FormalVisualModel 渲染玩家主视觉壳层，不生成世界对象，
          不显示工程诊断。
        </p>
      </header>

      <div className={styles.formalCanvasShell}>
        <div
          className={styles.formalCanvas}
          style={{
            width: model.canvas.width,
            height: model.canvas.height,
          }}
          aria-label="formal world canvas"
        >
          <div className={styles.formalGround} />
          <div className={styles.formalAtmosphere} />
          {model.objects.map((objectModel) =>
            renderFormalWorldObject(model, objectModel)
          )}
          {model.actors.map((actorModel) =>
            renderFormalActor(model, actorModel)
          )}
        </div>
      </div>

      <section className={styles.formalHud} aria-label="formal world summary">
        <FormalInfoCard label="世界阶段" value={model.hudSummary.worldPhaseLabel} />
        <FormalInfoCard
          label="管家状态"
          value={model.hudSummary.butlerStatusLabel}
        />
        <FormalInfoCard label="宠物状态" value={model.hudSummary.petStatusLabel} />
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

function renderFormalWorldObject(
  model: FormalVisualModel,
  objectModel: FormalWorldObjectModel
): ReactNode {
  return (
    <div
      className={`${styles.formalWorldObject} ${getObjectClassName(
        objectModel
      )}`}
      key={objectModel.id}
      style={{
        left: objectModel.anchor.x * model.canvas.tileSize,
        top: objectModel.anchor.y * model.canvas.tileSize,
        opacity: objectModel.opacity,
      }}
      aria-label={objectModel.label}
    />
  )
}

function renderFormalActor(
  model: FormalVisualModel,
  actorModel: FormalActorModel
): ReactNode {
  if (!actorModel.canRender) {
    return null
  }

  return (
    <div
      className={`${styles.formalActor} ${getActorClassName(actorModel)}`}
      key={actorModel.actorId}
      style={{
        left: actorModel.anchor.x * model.canvas.tileSize,
        top: actorModel.anchor.y * model.canvas.tileSize,
      }}
      aria-label={actorModel.label}
    >
      <span className={styles.formalActorCore} />
    </div>
  )
}

function getObjectClassName(objectModel: FormalWorldObjectModel): string {
  if (objectModel.kind === "terrain") return styles.formalObjectTerrain
  if (objectModel.kind === "path") return styles.formalObjectPath
  if (objectModel.kind === "shelter") return styles.formalObjectShelter
  if (objectModel.kind === "structure") return styles.formalObjectStructure
  if (objectModel.kind === "facility") return styles.formalObjectFacility
  if (objectModel.kind === "tree") return styles.formalObjectTree
  if (objectModel.kind === "bush") return styles.formalObjectBush
  if (objectModel.kind === "surfaceDecoration") {
    return styles.formalObjectSurfaceDecoration
  }
  if (objectModel.kind === "resource") return styles.formalObjectResource
  if (objectModel.kind === "lifeTrace") return styles.formalObjectLifeTrace
  if (objectModel.kind === "boundary") return styles.formalObjectBoundary

  return styles.formalObjectUnknown
}

function getActorClassName(actorModel: FormalActorModel): string {
  if (actorModel.actorKind === "butler") return styles.formalActorButler
  if (actorModel.actorKind === "pet") return styles.formalActorPet

  return styles.formalActorUnknown
}

function FormalInfoCard(input: { label: string; value: string }) {
  return (
    <article className={styles.formalInfoCard}>
      <span>{input.label}</span>
      <strong>{input.value}</strong>
    </article>
  )
}
