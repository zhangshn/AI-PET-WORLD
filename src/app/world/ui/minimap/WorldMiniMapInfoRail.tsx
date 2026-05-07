/**
 * 当前文件负责：展示圆形小地图一侧信息栏。
 */

import type { WorldMiniMapInfoItem } from "./WorldMiniMapTypes"

import styles from "@/styles/world-styles/minimap/world-mini-map-info-rail.module.css"

type Props = {
  items: WorldMiniMapInfoItem[]
}

export default function WorldMiniMapInfoRail({ items }: Props) {
  return (
    <div className={styles.infoRail} aria-label="地图信息">
      {items.map((item) => (
        <div className={styles.infoItem} key={item.id}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
        </div>
      ))}
    </div>
  )
}