/**
 * 当前文件负责：绘制临时住所像素美术原型。
 */

import type { PixelArtPrototypeProps } from "./pixel-art-prototype.types"

import styles from "./pixel-art-prototypes.module.css"

export function PixelTemporaryShelterPrototype({
  className,
  debug = false,
}: PixelArtPrototypeProps) {
  return (
    <div
      className={`${styles.prototype} ${styles.temporaryShelter} ${className ?? ""}`}
      data-pixel-prototype="temporary-shelter"
      data-debug={debug ? "true" : "false"}
    >
      <span className={styles.shelterShadow} />
      <span className={styles.shelterRoof} />
      <span className={styles.shelterWall} />
      <span className={styles.shelterSupportLeft} />
      <span className={styles.shelterSupportRight} />
      <span className={styles.shelterDoor} />
    </div>
  )
}
