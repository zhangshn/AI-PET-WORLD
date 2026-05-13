/**
 * 当前文件负责：组合低保真管家对象。
 */

import { PixelButlerPrototype } from "../pixel-art-prototypes"
import type { LowFiPrefabProps } from "./low-fi-prefab.types"

import styles from "./low-fi-prefabs.module.css"

export function LowFiButlerPrefab({
  className,
  debug = false,
}: LowFiPrefabProps) {
  return (
    <div
      className={`${styles.prefab} ${styles.butler} ${className ?? ""}`}
      data-low-fi-prefab="butler"
      data-debug={debug ? "true" : "false"}
    >
      <PixelButlerPrototype className={styles.sprite} />
    </div>
  )
}
