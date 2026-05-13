/**
 * 当前文件负责：绘制宠物抵达点像素美术原型。
 */

import type { PixelArtPrototypeProps } from "./pixel-art-prototype.types"

import styles from "./pixel-art-prototypes.module.css"

export function PixelArrivalPointPrototype({
  className,
  debug = false,
}: PixelArtPrototypeProps) {
  return (
    <div
      className={`${styles.prototype} ${styles.arrivalPoint} ${className ?? ""}`}
      data-pixel-prototype="arrival-point"
      data-debug={debug ? "true" : "false"}
    >
      <span className={styles.arrivalGlow} />
      <span className={styles.arrivalMat} />
      <span className={styles.arrivalMarker} />
    </div>
  )
}
