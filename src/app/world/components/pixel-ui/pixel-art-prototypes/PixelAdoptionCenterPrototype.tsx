/**
 * 当前文件负责：绘制小镇宠物领养中心像素美术原型。
 */

import type { PixelArtPrototypeProps } from "./pixel-art-prototype.types"

import styles from "./pixel-art-prototypes.module.css"

export function PixelAdoptionCenterPrototype({
  className,
  debug = false,
}: PixelArtPrototypeProps) {
  return (
    <div
      className={`${styles.prototype} ${styles.adoptionCenter} ${className ?? ""}`}
      data-pixel-prototype="adoption-center"
      data-debug={debug ? "true" : "false"}
    >
      <span className={styles.adoptionShadow} />
      <span className={styles.adoptionBody} />
      <span className={styles.adoptionRoof} />
      <span className={styles.adoptionSign} />
      <span className={styles.adoptionCounter} />
      <span className={styles.adoptionNotice} />
      <span className={styles.adoptionBench} />
    </div>
  )
}
