/**
 * 当前文件负责：展示 /world 左下角小地图与世界轻量状态。
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
      x: 34,
      y: 62,
      tone: "home",
      isVisible: Boolean(world.home),
    },
    {
      id: "incubator",
      label: "孵化器",
      helperText: world.pet ? "孵化完成" : "生命舱运行中",
      x: 45,
      y: 48,
      tone: "incubator",
      isVisible: Boolean(world.incubator),
    },
    {
      id: "butler",
      label: "管家",
      helperText: world.butler?.task ?? "管理中",
      x: 58,
      y: 54,
      tone: "butler",
      isVisible: Boolean(world.butler),
    },
    {
      id: "pet",
      label: "宠物",
      helperText: world.pet?.action ?? "等待诞生",
      x: 67,
      y: 39,
      tone: "pet",
      isVisible: Boolean(world.pet),
    },
  ]
}

export default function WorldMiniMap({ world, hud }: Props) {
  const markers = buildMarkers(world)

  return (
    <aside className={styles.minimap} aria-label="世界小地图">
      <div className={styles.header}>
        <div>
          <p className={styles.eyebrow}>MINI MAP</p>
          <h2>初始生态区</h2>
        </div>

        <span className={styles.pulse}>{hud.world.pulseLabel}</span>
      </div>

      <div className={styles.mapCanvas}>
        <div className={styles.gridLayer} />
        <div className={styles.homeZone} />
        <div className={styles.waterZone} />
        <div className={styles.pathLine} />

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

      <div className={styles.statusGrid}>
        <div>
          <span>日期</span>
          <strong>{hud.world.dayLabel}</strong>
        </div>

        <div>
          <span>时间</span>
          <strong>{hud.world.timeLabel}</strong>
        </div>

        <div>
          <span>时段</span>
          <strong>{hud.world.periodLabel}</strong>
        </div>

        <div>
          <span>天气</span>
          <strong>{hud.world.weatherLabel}</strong>
        </div>
      </div>

      <p className={styles.footerNote}>
        管家只维护环境与机会，宠物行为由自身状态自主决定。
      </p>
    </aside>
  )
}