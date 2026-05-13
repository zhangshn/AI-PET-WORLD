/**
 * 当前文件负责：绘制基础小屋像素美术原型。
 */

import type { PixelArtPrototypeProps } from "./pixel-art-prototype.types"

import styles from "./pixel-art-prototypes.module.css"

export function PixelBasicHousePrototype({
  className,
  debug = false,
}: PixelArtPrototypeProps) {
  return (
    <div
      className={`${styles.prototype} ${styles.basicHouse} ${className ?? ""}`}
      data-pixel-prototype="basic-house"
      data-debug={debug ? "true" : "false"}
    >
      <span className={styles.houseShadow} />
      <span className={styles.houseFoundation} />
      <span className={styles.houseWall} />
      <span className={styles.houseRoof} />
      <span className={styles.houseDoor} />
      <span className={styles.houseWindowLeft} />
      <span className={styles.houseWindowRight} />
      <span className={styles.houseWindowLight} />
    </div>
  )
}
