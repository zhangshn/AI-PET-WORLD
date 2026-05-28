import type { WorldViewModel } from "@/world/world-view-model"

import { PixelWorldCanvas } from "./pixel-world-canvas.client"
import styles from "./pixel-world-view.module.css"

export function PixelWorldView(input: { model: WorldViewModel }) {
  const { model } = input

  return (
    <main className={styles.pixelWorldShell} aria-label="AI-PET-WORLD">
      <header className={styles.worldHeader} aria-label="世界概览">
        <div>
          <span className={styles.worldEyebrow}>AI-PET-WORLD</span>
          <h1 className={styles.worldTitle}>你的自主像素家园正在运行</h1>
          <p className={styles.worldDescription}>
            管家会根据世界状态自主判断，行动会经过世界规则验证，并在家园里留下可观察的痕迹。
          </p>
        </div>
        <div className={styles.worldStatusCard} aria-label="世界状态">
          <span>当前记录</span>
          <strong>第 {model.tick} 次运行</strong>
          <small>打开页面只会读取世界，不会强行推进时间。</small>
        </div>
      </header>

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
        <article className={styles.butlerExplanation} aria-label="管家说明">
          <span className={styles.noteEyebrow}>管家说明</span>
          <strong>{model.butlerExplanation.title}</strong>
          <p>{model.butlerExplanation.body}</p>
        </article>
        <article className={styles.pPhoneEntry} aria-label="P-Phone">
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
