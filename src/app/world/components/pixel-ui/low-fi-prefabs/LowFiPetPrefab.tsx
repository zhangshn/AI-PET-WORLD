/**
 * 当前文件负责：组合低保真宠物对象。
 */

import { PixelPetPrototype } from "../pixel-art-prototypes"
import type { LowFiPrefabProps } from "./low-fi-prefab.types"

import styles from "./low-fi-prefabs.module.css"

export function LowFiPetPrefab({
  className,
  debug = false,
}: LowFiPrefabProps) {
  return (
    <div
      className={`${styles.prefab} ${styles.pet} ${className ?? ""}`}
      data-low-fi-prefab="pet"
      data-debug={debug ? "true" : "false"}
    >
      <PixelPetPrototype className={styles.sprite} />
    </div>
  )
}
