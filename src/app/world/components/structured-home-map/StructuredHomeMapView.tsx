/**
 * 当前文件负责：用 HomeMapState 渲染正式世界的结构化俯视图。
 */

import type {
  HomeMapState,
  MapPlacement,
} from "@/world/map-state/home-map-state-schema"

import styles from "./structured-home-map-view.styles.module.css"

const MAX_VISIBLE_PLACEMENTS = 260

export function StructuredHomeMapView(input: { homeMapState: HomeMapState }) {
  const visiblePlacements = input.homeMapState.placements
    .filter(isVisibleMapPlacement)
    .slice(0, MAX_VISIBLE_PLACEMENTS)

  return (
    <section className={styles.mapPanel}>
      <div className={styles.mapPanelHeader}>
        <div>
          <div className={styles.eyebrow}>STRUCTURED TOP-DOWN VIEW</div>
          <h2>结构化俯视图</h2>
          <p>
            这里不是图片贴图，而是 Renderer 读取 HomeMapState 后，把区域和对象按坐标画出来。
          </p>
        </div>
        <div className={styles.mapLegend}>
          <span data-kind="zone">区域</span>
          <span data-kind="path">路径</span>
          <span data-kind="object">设施 / 建筑 / 角色</span>
        </div>
      </div>

      <div className={styles.mapViewport}>
        <div
          className={styles.structuredMap}
          style={{
            aspectRatio: `${input.homeMapState.mapSize.columns} / ${input.homeMapState.mapSize.rows}`,
          }}
        >
          {input.homeMapState.zones.map((zone) => (
            <div
              className={styles.mapZone}
              key={zone.id}
              style={{
                left: toPercent(zone.bounds.x, input.homeMapState.mapSize.columns),
                top: toPercent(zone.bounds.y, input.homeMapState.mapSize.rows),
                width: toPercent(zone.bounds.width, input.homeMapState.mapSize.columns),
                height: toPercent(zone.bounds.height, input.homeMapState.mapSize.rows),
              }}
              title={`${zone.name}：${zone.purpose}`}
            >
              <span>{zone.name}</span>
            </div>
          ))}

          {visiblePlacements.map((placement) => (
            <span
              className={styles.mapPlacement}
              data-layer={placement.layer}
              key={placement.id}
              style={{
                left: toPercent(placement.x, input.homeMapState.mapSize.columns),
                top: toPercent(placement.y, input.homeMapState.mapSize.rows),
              }}
              title={`${placement.label} / ${placement.layer} / ${placement.assetId}`}
            >
              {getPlacementMark(placement)}
            </span>
          ))}
        </div>
      </div>

      <p className={styles.mapNote}>
        当前显示 {visiblePlacements.length} 个非地面对象；地表底层对象已隐藏，避免画面被基础格子淹没。
      </p>
    </section>
  )
}

function isVisibleMapPlacement(placement: MapPlacement): boolean {
  return !["ground", "atmosphere"].includes(placement.layer)
}

function getPlacementMark(placement: MapPlacement): string {
  if (placement.layer === "actor") return "◆"
  if (placement.layer === "structure") return "▣"
  if (placement.layer === "facility") return "●"
  if (placement.layer === "path") return "─"
  if (placement.layer === "nature") return "✦"
  if (placement.layer === "surface-decoration") return "·"

  return "□"
}

function toPercent(value: number, total: number): string {
  if (total <= 0) return "0%"

  return `${Math.max(0, Math.min(100, (value / total) * 100))}%`
}
