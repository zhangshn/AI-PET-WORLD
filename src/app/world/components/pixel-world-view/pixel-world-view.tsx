import type { WorldViewModel } from "@/world/world-view-model"

import { PixelWorldCanvas } from "./pixel-world-canvas.client"
import styles from "./pixel-world-view.module.css"

export function PixelWorldView(input: { model: WorldViewModel }) {
  const { model } = input

  return (
    <main className={styles.pixelWorldShell} aria-label="AI-PET-WORLD">
      <section className={styles.pixelWorldStageSection} aria-label="像素主世界">
        <div
          className={styles.pixelWorldStageFrame}
          style={{
            width: `${model.canvas.width}px`,
            maxWidth: "100%",
          }}
        >
          <PixelWorldCanvas model={model} />
        </div>
      </section>

      <section className={styles.worldSurfaceNotes} aria-label="世界记录">
        <article className={styles.butlerExplanation} aria-label="butler explanation">
          <span className={styles.noteEyebrow}>管家</span>
          <strong>{model.butlerExplanation.title}</strong>
          <p>{model.butlerExplanation.body}</p>
        </article>
        <article className={styles.pPhoneEntry} aria-label="p-phone">
          <span className={styles.noteEyebrow}>P-Phone</span>
          <strong>{model.pPhone.latestMessageTitle}</strong>
          <p>{model.pPhone.latestMessageBody}</p>
          {model.pPhone.unreadCount > 0 ? (
            <span className={styles.pPhoneLight}>新记录</span>
          ) : null}
        </article>
      </section>
    </main>
  )
}
