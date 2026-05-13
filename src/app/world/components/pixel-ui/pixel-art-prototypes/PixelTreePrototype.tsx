/**
 * 当前文件负责：绘制树木像素美术原型。
 */

import type { PixelArtPrototypeProps } from "./pixel-art-prototype.types"

import styles from "./pixel-art-prototypes.module.css"

export function PixelTreePrototype({
  className,
  debug = false,
}: PixelArtPrototypeProps) {
  return (
    <div
      className={`${styles.prototype} ${styles.tree} ${className ?? ""}`}
      data-pixel-prototype="tree"
      data-debug={debug ? "true" : "false"}
    >
      <span className={styles.treeShadow} />
      <span className={styles.treeTrunk} />
      <span className={styles.treeCanopyBack} />
      <span className={styles.treeCanopyFront} />
      <span className={styles.treeLeafLight} />
    </div>
  )
}
