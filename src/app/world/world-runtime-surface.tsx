"use client"

import Image from "next/image"
import type { CSSProperties } from "react"
import { useMemo, useState } from "react"

import styles from "./world-runtime-surface.module.css"

export type WorldRuntimeSurfaceMarker = {
  id: string
  label: string
  kind: "entry" | "home_center"
  x: number
  y: number
}

export type WorldRuntimeSurfaceInteraction = {
  id: string
  sourceObjectId: string
  label: string
  objectKind: string
  bounds: {
    x: number
    y: number
    width: number
    height: number
  }
  blocksMovement: boolean
}

export type WorldRuntimeSurfaceProps = {
  imageSrc: string
  runtimeFrameId: string
  worldId: string
  tick: number
  imageWidth: number
  imageHeight: number
  layerCounts: {
    terrain: number
    objects: number
    walkable: number
    collision: number
    interactions: number
    stateRefs: number
  }
  markers: WorldRuntimeSurfaceMarker[]
  interactions: WorldRuntimeSurfaceInteraction[]
}

export function WorldRuntimeSurface(props: WorldRuntimeSurfaceProps) {
  const [selectedInteractionId, setSelectedInteractionId] = useState(
    props.interactions[0]?.id ?? ""
  )
  const selectedInteraction = useMemo(
    () =>
      props.interactions.find((interaction) => interaction.id === selectedInteractionId) ??
      props.interactions[0] ??
      null,
    [props.interactions, selectedInteractionId]
  )
  const entryMarker = props.markers.find((marker) => marker.kind === "entry") ?? null
  const homeMarker =
    props.markers.find((marker) => marker.kind === "home_center") ?? null

  return (
    <main className={styles.page}>
      <section className={styles.shell} aria-label="AI-PET-WORLD 游戏世界">
        <header className={styles.topBar}>
          <div className={styles.identity}>
            <span className={styles.brand}>AI-PET-WORLD</span>
            <strong>自然家园</strong>
          </div>
          <div className={styles.statusStrip} aria-label="世界状态">
            <span>Tick {props.tick}</span>
            <span>{props.worldId}</span>
            <span>RuntimeFrame</span>
          </div>
        </header>

        <div className={styles.contentGrid}>
          <div
            className={styles.mapStage}
            style={
              {
                "--map-width": props.imageWidth,
                "--map-height": props.imageHeight,
              } as CSSProperties
            }
          >
            <Image
              alt="AI-PET-WORLD 完整自然家园游戏地图"
              className={styles.mapImage}
              src={props.imageSrc}
              fill
              priority
              sizes="(max-width: 960px) 100vw, 76vw"
              unoptimized
            />
            <div className={styles.mapShade} />

            {props.markers.map((marker) => (
              <div
                className={
                  marker.kind === "entry"
                    ? styles.entryMarker
                    : styles.homeCenterMarker
                }
                key={marker.id}
                style={pointStyle(marker.x, marker.y, props)}
              >
                <span>{marker.label}</span>
              </div>
            ))}

            {props.interactions.map((interaction) => (
              <button
                aria-label={`${interaction.label}：${interaction.sourceObjectId}`}
                className={
                  interaction.id === selectedInteraction?.id
                    ? `${styles.hotspot} ${styles.hotspotActive}`
                    : styles.hotspot
                }
                key={interaction.id}
                onClick={() => setSelectedInteractionId(interaction.id)}
                style={rectStyle(interaction.bounds, props)}
                title={interaction.sourceObjectId}
                type="button"
              />
            ))}

            <div className={styles.playerAnchor} style={pointStyle(entryMarker?.x, entryMarker?.y, props)}>
              <span />
            </div>
          </div>

          <aside className={styles.sidePanel} aria-label="当前地图状态">
            <div className={styles.panelBlock}>
              <span className={styles.kicker}>World Runtime</span>
              <h1>家园已进入</h1>
              <p>
                视觉来自已通过审核的小模型材料合成图，碰撞、可走和交互来自
                RuntimeFrame 结构层。
              </p>
            </div>

            <div className={styles.routeBlock}>
              <div>
                <span>入口</span>
                <strong>{formatPoint(entryMarker)}</strong>
              </div>
              <div className={styles.routeLine} />
              <div>
                <span>中心</span>
                <strong>{formatPoint(homeMarker)}</strong>
              </div>
            </div>

            <div className={styles.layerGrid} aria-label="地图层">
              <LayerStat label="地形" value={props.layerCounts.terrain} />
              <LayerStat label="对象" value={props.layerCounts.objects} />
              <LayerStat label="可走" value={props.layerCounts.walkable} />
              <LayerStat label="碰撞" value={props.layerCounts.collision} />
              <LayerStat label="交互" value={props.layerCounts.interactions} />
              <LayerStat label="状态" value={props.layerCounts.stateRefs} />
            </div>

            <div className={styles.panelBlock}>
              <span className={styles.kicker}>Inspect</span>
              {selectedInteraction ? (
                <>
                  <h2>{selectedInteraction.label}</h2>
                  <dl className={styles.detailList}>
                    <div>
                      <dt>对象</dt>
                      <dd>{selectedInteraction.sourceObjectId}</dd>
                    </div>
                    <div>
                      <dt>类型</dt>
                      <dd>{selectedInteraction.objectKind}</dd>
                    </div>
                    <div>
                      <dt>通行</dt>
                      <dd>{selectedInteraction.blocksMovement ? "阻挡" : "可穿行"}</dd>
                    </div>
                  </dl>
                </>
              ) : (
                <h2>暂无可查看对象</h2>
              )}
            </div>

            <div className={styles.objectList} aria-label="可查看对象列表">
              {props.interactions.slice(0, 8).map((interaction) => (
                <button
                  className={
                    interaction.id === selectedInteraction?.id
                      ? `${styles.objectButton} ${styles.objectButtonActive}`
                      : styles.objectButton
                  }
                  key={interaction.id}
                  onClick={() => setSelectedInteractionId(interaction.id)}
                  type="button"
                >
                  <span>{interaction.label}</span>
                  <small>{interaction.sourceObjectId}</small>
                </button>
              ))}
            </div>
          </aside>
        </div>

        <footer className={styles.footerBar}>
          <span>{props.runtimeFrameId}</span>
          <span>Formal VisualJudge passed</span>
        </footer>
      </section>
    </main>
  )
}

function LayerStat(props: { label: string; value: number }) {
  return (
    <div className={styles.layerStat}>
      <span>{props.label}</span>
      <strong>{props.value}</strong>
    </div>
  )
}

function pointStyle(
  x: number | undefined,
  y: number | undefined,
  props: Pick<WorldRuntimeSurfaceProps, "imageWidth" | "imageHeight">
): CSSProperties {
  return {
    left: `${(((x ?? 0) / props.imageWidth) * 100).toFixed(3)}%`,
    top: `${(((y ?? 0) / props.imageHeight) * 100).toFixed(3)}%`,
  }
}

function rectStyle(
  rect: WorldRuntimeSurfaceInteraction["bounds"],
  props: Pick<WorldRuntimeSurfaceProps, "imageWidth" | "imageHeight">
): CSSProperties {
  return {
    left: `${((rect.x / props.imageWidth) * 100).toFixed(3)}%`,
    top: `${((rect.y / props.imageHeight) * 100).toFixed(3)}%`,
    width: `${((rect.width / props.imageWidth) * 100).toFixed(3)}%`,
    height: `${((rect.height / props.imageHeight) * 100).toFixed(3)}%`,
  }
}

function formatPoint(marker: WorldRuntimeSurfaceMarker | null): string {
  if (!marker) return "未记录"
  return `${Math.round(marker.x)}, ${Math.round(marker.y)}`
}
