/**
 * 当前文件负责：绘制管家像素美术原型。
 */

import type { PixelArtPrototypeProps } from "./pixel-art-prototype.types"

import styles from "./pixel-art-prototypes.module.css"

export function PixelButlerPrototype({
  className,
  debug = false,
}: PixelArtPrototypeProps) {
  return (
    <div
      className={`${styles.prototype} ${styles.butler} ${className ?? ""}`}
      data-pixel-prototype="butler"
      data-debug={debug ? "true" : "false"}
    >
      <span className={styles.butlerHair} />
      <span className={styles.butlerHead} />
      <span className={styles.butlerEyeLeft} />
      <span className={styles.butlerEyeRight} />
      <span className={styles.butlerMouth} />
      <span className={styles.butlerBody} />
      <span className={styles.butlerOutfit} />
      <span className={styles.butlerHandLeft} />
      <span className={styles.butlerHandRight} />
      <span className={styles.butlerFootLeft} />
      <span className={styles.butlerFootRight} />
    </div>
  )
}
