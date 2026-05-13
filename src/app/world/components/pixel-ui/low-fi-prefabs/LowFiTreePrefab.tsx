/**
 * 当前文件负责：组合低保真树木对象。
 */

import { PixelTreePrototype } from "../pixel-art-prototypes"
import type { LowFiPrefabProps } from "./low-fi-prefab.types"

import styles from "./low-fi-prefabs.module.css"

export function LowFiTreePrefab({
  className,
  debug = false,
}: LowFiPrefabProps) {
  return (
    <div
      className={`${styles.prefab} ${styles.tree} ${className ?? ""}`}
      data-low-fi-prefab="tree"
      data-debug={debug ? "true" : "false"}
    >
      <PixelTreePrototype className={styles.sprite} />
    </div>
  )
}
