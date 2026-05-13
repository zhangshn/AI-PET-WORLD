/**
 * 当前文件负责：绘制宠物像素美术原型。
 */

import type { PixelArtPrototypeProps } from "./pixel-art-prototype.types"

import styles from "./pixel-art-prototypes.module.css"

export function PixelPetPrototype({
  className,
  debug = false,
}: PixelArtPrototypeProps) {
  return (
    <div
      className={`${styles.prototype} ${styles.pet} ${className ?? ""}`}
      data-pixel-prototype="pet"
      data-debug={debug ? "true" : "false"}
    >
      <span className={styles.petTail} />
      <span className={styles.petBody} />
      <span className={styles.petHead} />
      <span className={styles.petEarLeft} />
      <span className={styles.petEarRight} />
      <span className={styles.petEyeLeft} />
      <span className={styles.petEyeRight} />
      <span className={styles.petNose} />
      <span className={styles.petMouth} />
      <span className={styles.petPawLeft} />
      <span className={styles.petPawRight} />
    </div>
  )
}
