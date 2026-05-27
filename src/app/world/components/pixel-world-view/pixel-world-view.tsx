import type { CSSProperties } from "react"

import type {
  PixelWorldObject,
  PixelWorldSprite,
  PixelWorldTile,
  PixelWorldTraceOverlay,
  PixelWorldViewModel,
} from "@/world/pixel-world"

import styles from "./pixel-world-view.module.css"

type PixelStyle = CSSProperties & Record<string, string | number>

export function PixelWorldView(input: { model: PixelWorldViewModel }) {
  const { model } = input

  return (
    <main className={styles.pixelWorldShell} aria-label="AI-PET-WORLD">
      <section className={styles.pixelWorldStageSection} aria-label="像素主世界">
        <div className={styles.pixelWorldStageFrame}>
          <div
            className={[
              styles.pixelWorldStage,
              getAtmosphereMoodClassName(model.atmosphere.mood),
            ].join(" ")}
            style={
              {
                "--world-width": `${model.map.width}px`,
                "--world-height": `${model.map.height}px`,
              } as PixelStyle
            }
          >
            <div className={styles.tileLayer} aria-label="tile layer">
              {model.tiles.map(renderTile)}
            </div>
            <div className={styles.traceLayer} aria-label="trace layer">
              {model.traceOverlays.map(renderTraceOverlay)}
            </div>
            <div className={styles.objectLayer} aria-label="object layer">
              {model.objects.map(renderObject)}
            </div>
            <div className={styles.spriteLayer} aria-label="sprite layer">
              {model.sprites.filter((sprite) => sprite.visible).map(renderSprite)}
            </div>
            <div
              className={styles.atmosphereLayer}
              aria-label="atmosphere layer"
              style={{ opacity: model.atmosphere.opacity }}
            />
          </div>
        </div>
      </section>

      <section className={styles.worldSurfaceNotes} aria-label="世界记录">
        <article className={styles.butlerExplanation} aria-label="butler explanation">
          <span className={styles.noteEyebrow}>管家</span>
          <strong>{model.butlerExplanation.title}</strong>
          <p>{model.butlerExplanation.body}</p>
        </article>
        <article className={styles.pPhoneEntry} aria-label="p-phone">
          <span className={styles.noteEyebrow}>P-Phone</span>
          <strong>{model.pPhone.latestMessageTitle}</strong>
          <p>{model.pPhone.latestMessageBody}</p>
          {model.pPhone.unreadCount > 0 ? (
            <span className={styles.pPhoneLight}>新记录</span>
          ) : null}
        </article>
      </section>
    </main>
  )
}

function renderTile(tile: PixelWorldTile) {
  return (
    <span
      className={[styles.pixelTile, getTileKindClassName(tile.kind)].join(" ")}
      data-passable={tile.passable ? "true" : "false"}
      key={tile.id}
      style={
        {
          "--x": `${tile.x}px`,
          "--y": `${tile.y}px`,
          "--w": `${tile.width}px`,
          "--h": `${tile.height}px`,
          "--variant": tile.variant,
          "--trace-intensity": tile.traceIntensity / 100,
        } as PixelStyle
      }
    />
  )
}

function renderTraceOverlay(traceOverlay: PixelWorldTraceOverlay) {
  const diameter = traceOverlay.radius * 2

  return (
    <span
      className={[
        styles.pixelTrace,
        getTraceVisualClassName(traceOverlay.visualKind),
      ].join(" ")}
      key={traceOverlay.id}
      style={
        {
          "--x": `${traceOverlay.x - traceOverlay.radius}px`,
          "--y": `${traceOverlay.y - traceOverlay.radius}px`,
          "--w": `${diameter}px`,
          "--h": `${diameter}px`,
          "--trace-intensity": traceOverlay.intensity / 100,
          opacity: traceOverlay.opacity,
        } as PixelStyle
      }
    />
  )
}

function renderObject(object: PixelWorldObject) {
  return (
    <span
      className={[
        styles.pixelObject,
        getObjectKindClassName(object.kind),
        getLayerClassName(object.layer),
      ].join(" ")}
      key={object.id}
      aria-label={object.label}
      style={
        {
          "--x": `${object.x}px`,
          "--y": `${object.y}px`,
          "--scale": object.scale,
          opacity: object.opacity,
        } as PixelStyle
      }
    >
      <span className={styles.pixelObjectTop} />
      <span className={styles.pixelObjectBase} />
    </span>
  )
}

function renderSprite(sprite: PixelWorldSprite) {
  return (
    <span
      className={[
        styles.pixelSprite,
        getSpriteKindClassName(sprite.kind),
        getSpritePoseClassName(sprite.pose),
      ].join(" ")}
      key={sprite.id}
      aria-label={sprite.label}
      style={
        {
          "--x": `${sprite.x}px`,
          "--y": `${sprite.y}px`,
        } as PixelStyle
      }
    >
      <span className={styles.pixelSpriteHead} />
      <span className={styles.pixelSpriteBody} />
      <span className={styles.pixelSpriteTool} />
    </span>
  )
}

function getTileKindClassName(kind: PixelWorldTile["kind"]): string {
  if (kind === "pressed_grass") return styles.tilePressedGrass
  if (kind === "worn_grass") return styles.tileWornGrass
  if (kind === "exposed_soil") return styles.tileExposedSoil
  if (kind === "ecology_transition") return styles.tileEcologyTransition
  if (kind === "recovery_growth") return styles.tileRecoveryGrowth
  if (kind === "soil") return styles.tileSoil
  if (kind === "built") return styles.tileBuilt
  if (kind === "boundary") return styles.tileBoundary

  return styles.tileGrass
}

function getTraceVisualClassName(
  visualKind: PixelWorldTraceOverlay["visualKind"]
): string {
  if (visualKind === "flattened_grass") return styles.traceFlattenedGrass
  if (visualKind === "exposed_soil") return styles.traceExposedSoil
  if (visualKind === "worn_ground") return styles.traceWornGround
  if (visualKind === "moss") return styles.traceMoss
  if (visualKind === "mushroom") return styles.traceMushroom
  if (visualKind === "repaired_ground") return styles.traceRepairedGround
  if (visualKind === "maintained_area") return styles.traceMaintainedArea
  if (visualKind === "faded_area") return styles.traceFadedArea
  if (visualKind === "waiting_spot") return styles.traceWaitingSpot
  if (visualKind === "comfort_spot") return styles.traceComfortSpot
  if (visualKind === "attention_glow") return styles.traceAttentionGlow

  return styles.traceFlattenedGrass
}

function getObjectKindClassName(kind: PixelWorldObject["kind"]): string {
  if (kind === "tree") return styles.objectTree
  if (kind === "bush") return styles.objectBush
  if (kind === "stone") return styles.objectStone
  if (kind === "flower") return styles.objectFlower
  if (kind === "mushroom") return styles.objectMushroom
  if (kind === "insect_signal") return styles.objectInsectSignal
  if (kind === "facility") return styles.objectFacility

  return styles.objectStructure
}

function getLayerClassName(layer: PixelWorldObject["layer"]): string {
  if (layer === "back") return styles.layerBack
  if (layer === "front") return styles.layerFront

  return styles.layerMiddle
}

function getSpriteKindClassName(kind: PixelWorldSprite["kind"]): string {
  if (kind === "pet") return styles.spritePet

  return styles.spriteButler
}

function getSpritePoseClassName(pose: PixelWorldSprite["pose"]): string {
  if (pose === "observe") return styles.poseObserve
  if (pose === "maintain") return styles.poseMaintain
  if (pose === "wait") return styles.poseWait
  if (pose === "walk") return styles.poseWalk

  return styles.poseIdle
}

function getAtmosphereMoodClassName(
  mood: PixelWorldViewModel["atmosphere"]["mood"]
): string {
  if (mood === "warm") return styles.moodWarm
  if (mood === "recovering") return styles.moodRecovering
  if (mood === "busy") return styles.moodBusy

  return styles.moodCalm
}
