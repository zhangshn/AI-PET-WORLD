/**
 * 当前文件负责：组合低保真基础小屋对象。
 */

import { PixelBasicHousePrototype } from "../pixel-art-prototypes"
import type { LowFiPrefabProps } from "./low-fi-prefab.types"

import styles from "./low-fi-prefabs.module.css"

export function LowFiBasicHousePrefab({
  className,
  debug = false,
}: LowFiPrefabProps) {
  return (
    <div
      className={`${styles.prefab} ${styles.basicHouse} ${className ?? ""}`}
      data-low-fi-prefab="basic-house"
      data-debug={debug ? "true" : "false"}
    >
      <PixelBasicHousePrototype className={styles.sprite} />
    </div>
  )
}
