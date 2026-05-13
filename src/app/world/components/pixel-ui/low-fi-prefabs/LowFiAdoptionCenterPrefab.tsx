/**
 * 当前文件负责：组合低保真领养中心对象。
 */

import { PixelAdoptionCenterPrototype } from "../pixel-art-prototypes"
import type { LowFiPrefabProps } from "./low-fi-prefab.types"

import styles from "./low-fi-prefabs.module.css"

export function LowFiAdoptionCenterPrefab({
  className,
  debug = false,
}: LowFiPrefabProps) {
  return (
    <div
      className={`${styles.prefab} ${styles.adoptionCenter} ${className ?? ""}`}
      data-low-fi-prefab="adoption-center"
      data-debug={debug ? "true" : "false"}
    >
      <PixelAdoptionCenterPrototype className={styles.sprite} />
    </div>
  )
}
