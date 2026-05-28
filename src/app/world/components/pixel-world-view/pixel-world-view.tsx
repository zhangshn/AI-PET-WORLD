import type { WorldViewModel } from "@/world/world-view-model"

import styles from "./pixel-world-view.module.css"

export function PixelWorldView(input: { model: WorldViewModel }) {
  void input

  return (
    <main
      aria-label="AI-PET-WORLD"
      className={styles.pixelWorldShell}
      data-surface-state="cleared"
    />
  )
}
