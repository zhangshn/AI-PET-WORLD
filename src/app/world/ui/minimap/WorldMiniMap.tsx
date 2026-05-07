/**
 * 当前文件负责：展示 /world 圆形小地图与环绕式世界信息。
 */

import type { WorldEngineViewState } from "../../hooks/useWorldEngineState"
import type { WorldHudBundle } from "../../utils/worldHudMappers"

import type { WorldMiniMapMarker } from "./WorldMiniMapTypes"

import styles from "@/styles/world-styles/minimap/world-mini-map.module.css"

type Props = {
  world: WorldEngineViewState
  hud: WorldHudBundle
}

function getMarkerToneClass(marker: WorldMiniMapMarker): string {
  if (marker.tone === "pet") return styles.pet
  if (marker.tone === "butler") return styles.butler
  if (marker.tone === "incubator") return styles.incubator
  if (marker.tone === "home") return styles.home

  return styles.quiet
}

function buildMarkers(world: WorldEngineViewState): WorldMiniMapMarker[] {
  return [
    {
      id: "home",
      label: "家园",
      helperText: world.home ? "家园区域" : "等待生成",
      x: 38,
      y: 62,
      tone: "home",
      isVisible: Boolean(world.home),
    },
    {
      id: "incubator",
      label: "孵化器",
      helperText: world.pet ? "孵化完成" : "生命舱运行中",
      x: 49,
      y: 49,
      tone: "incubator",
      isVisible: Boolean(world.incubator),
    },
    {
      id: "butler",
      label: "管家",
      helperText: world.butler?.task ?? "管理中",
      x: 58,
      y: 56,
      tone: "butler",
      isVisible: Boolean(world.butler),
    },
    {
      id: "pet",
      label: "宠物",
      helperText: world.pet?.action ?? "等待诞生",
      x: 64,
      y: 40,
      tone: "pet",
      isVisible: Boolean(world.pet),
    },
  ]
}

export default function WorldMiniMap({ world, hud }: Props) {
  const markers = buildMarkers(world)

  return (
    <aside className={styles.minimap} aria-label="世界小地图">
      <div className={`${styles.orbitLabel} ${styles.topLabel}`}>
        <span>日期</span>
        <strong>{hud.world.dayLabel}</strong>
      </div>

      <div className={`${styles.orbitLabel} ${styles.rightLabel}`}>
        <span>天气</span>
        <strong>{hud.world.weatherLabel}</strong>
      </div>

      <div className={`${styles.orbitLabel} ${styles.bottomLabel}`}>
        <span>时间</span>
        <strong>{hud.world.timeLabel}</strong>
      </div>

      <div className={`${styles.orbitLabel} ${styles.leftLabel}`}>
        <span>时段</span>
        <strong>{hud.world.periodLabel}</strong>
      </div>

      <div className={styles.mapCircle}>
        <div className={styles.mapInner}>
          <div className={styles.scanGrid} />
          <div className={styles.homePatch} />
          <div className={styles.waterPatch} />
          <div className={styles.pathCurve} />

          {markers.map((marker) => {
            if (!marker.isVisible) return null

            return (
              <div
                className={`${styles.marker} ${getMarkerToneClass(marker)}`}
                key={marker.id}
                style={{
                  left: `${marker.x}%`,
                  top: `${marker.y}%`,
                }}
                title={`${marker.label}：${marker.helperText}`}
              >
                <span />
              </div>
            )
          })}
        </div>
      </div>

      <div className={styles.centerTitle}>
        <p>MINI MAP</p>
        <strong>初始生态区</strong>
      </div>
    </aside>
  )
}