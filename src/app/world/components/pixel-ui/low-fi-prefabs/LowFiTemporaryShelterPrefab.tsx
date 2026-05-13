/**
 * 当前文件负责：组合低保真临时住所对象。
 */

import { PixelTemporaryShelterPrototype } from "../pixel-art-prototypes"
import type { LowFiPrefabProps } from "./low-fi-prefab.types"

import styles from "./low-fi-prefabs.module.css"

export function LowFiTemporaryShelterPrefab({
  className,
  debug = false,
}: LowFiPrefabProps) {
  return (
    <div
      className={`${styles.prefab} ${styles.temporaryShelter} ${className ?? ""}`}
      data-low-fi-prefab="temporary-shelter"
      data-debug={debug ? "true" : "false"}
    >
      <PixelTemporaryShelterPrototype className={styles.sprite} />
    </div>
  )
}
