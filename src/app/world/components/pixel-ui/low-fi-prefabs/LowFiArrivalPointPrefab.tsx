/**
 * 当前文件负责：组合低保真宠物抵达点对象。
 */

import { PixelArrivalPointPrototype } from "../pixel-art-prototypes"
import type { LowFiPrefabProps } from "./low-fi-prefab.types"

import styles from "./low-fi-prefabs.module.css"

export function LowFiArrivalPointPrefab({
  className,
  debug = false,
}: LowFiPrefabProps) {
  return (
    <div
      className={`${styles.prefab} ${styles.arrivalPoint} ${className ?? ""}`}
      data-low-fi-prefab="arrival-point"
      data-debug={debug ? "true" : "false"}
    >
      <PixelArrivalPointPrototype className={styles.sprite} />
    </div>
  )
}
