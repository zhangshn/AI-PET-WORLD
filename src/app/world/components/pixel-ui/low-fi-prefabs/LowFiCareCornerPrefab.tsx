/**
 * 当前文件负责：组合低保真照护区对象。
 */

import { PixelCareCornerPrototype } from "../pixel-art-prototypes"
import type { LowFiPrefabProps } from "./low-fi-prefab.types"

import styles from "./low-fi-prefabs.module.css"

export function LowFiCareCornerPrefab({
  className,
  debug = false,
}: LowFiPrefabProps) {
  return (
    <div
      className={`${styles.prefab} ${styles.careCorner} ${className ?? ""}`}
      data-low-fi-prefab="care-corner"
      data-debug={debug ? "true" : "false"}
    >
      <PixelCareCornerPrototype className={styles.sprite} />
    </div>
  )
}
