/**
 * 当前文件负责：绘制照护区像素美术原型。
 */

import type { PixelArtPrototypeProps } from "./pixel-art-prototype.types"

import styles from "./pixel-art-prototypes.module.css"

export function PixelCareCornerPrototype({
  className,
  debug = false,
}: PixelArtPrototypeProps) {
  return (
    <div
      className={`${styles.prototype} ${styles.careCorner} ${className ?? ""}`}
      data-pixel-prototype="care-corner"
      data-debug={debug ? "true" : "false"}
    >
      <span className={styles.careMat} />
      <span className={styles.foodBowl} />
      <span className={styles.waterBowl} />
      <span className={styles.petBed} />
      <span className={styles.careBoundary} />
    </div>
  )
}
