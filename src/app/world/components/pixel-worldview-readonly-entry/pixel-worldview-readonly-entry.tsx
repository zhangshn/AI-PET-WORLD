import type { WorldViewModel } from "@/world/world-view-model"
import {
  buildPixelWorldPixelBufferFrame,
  buildPixelWorldRenderPlan,
  buildPixelWorldRendererFrame,
  mapPixelWorldViewModelFromSnapshot,
  mapWorldViewModelToPixelWorldSourceSnapshot,
} from "@/world/pixel-worldview"

import { PixiPixelWorldRendererClient } from "../pixi-pixel-world-renderer/pixi-pixel-world-renderer.client"

export function PixelWorldViewReadonlyEntry(input: {
  worldViewModel: WorldViewModel
}) {
  const source = mapWorldViewModelToPixelWorldSourceSnapshot(
    input.worldViewModel
  )
  const pixelModel = mapPixelWorldViewModelFromSnapshot(source)
  const renderPlan = buildPixelWorldRenderPlan(pixelModel)
  const rendererResult = buildPixelWorldRendererFrame({ plan: renderPlan })
  const bufferResult = buildPixelWorldPixelBufferFrame({
    plan: renderPlan,
    frame: rendererResult.frame,
  })

  return (
    <main style={styles.page}>
      <section style={styles.worldPanel}>
        <header style={styles.header}>
          <div>
            <div style={styles.brand}>AI-PET-WORLD</div>
            <h1 style={styles.title}>你的自主像素世界</h1>
          </div>
          <div style={styles.status}>Tick {input.worldViewModel.tick}</div>
        </header>

        <PixiPixelWorldRendererClient buffer={bufferResult.buffer} />
      </section>

      <aside style={styles.sidePanel}>
        <section style={styles.card}>
          <h2 style={styles.cardTitle}>P-Phone</h2>
          <p style={styles.messageTitle}>
            {input.worldViewModel.pPhone.latestMessageTitle}
          </p>
          <p style={styles.body}>
            {input.worldViewModel.pPhone.latestMessageBody}
          </p>
        </section>

        <section style={styles.card}>
          <h2 style={styles.cardTitle}>管家说明</h2>
          <p style={styles.messageTitle}>
            {input.worldViewModel.butlerExplanation.title}
          </p>
          <p style={styles.body}>
            {input.worldViewModel.butlerExplanation.body}
          </p>
        </section>

        <section style={styles.card}>
          <h2 style={styles.cardTitle}>世界状态</h2>
          <p style={styles.body}>世界：{input.worldViewModel.worldId}</p>
          <p style={styles.body}>最近保存：{input.worldViewModel.savedAt}</p>
        </section>
      </aside>
    </main>
  )
}

const styles = {
  page: {
    background: "#17231f",
    color: "#d8ead8",
    display: "grid",
    gap: 20,
    gridTemplateColumns: "minmax(0, 1fr) 340px",
    minHeight: "100vh",
    padding: 24,
  },
  worldPanel: {
    background: "#13201c",
    border: "1px solid #31554e",
    minWidth: 0,
    padding: 16,
  },
  header: {
    alignItems: "center",
    display: "flex",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  brand: {
    color: "rgba(216, 234, 216, 0.68)",
    fontSize: 13,
  },
  title: {
    fontSize: 28,
    margin: "4px 0 0",
  },
  status: {
    border: "1px solid #3f6861",
    color: "#c8df8f",
    padding: "8px 10px",
  },
  sidePanel: {
    display: "grid",
    alignContent: "start",
    gap: 16,
  },
  card: {
    background: "#1f302a",
    border: "1px solid #3f6861",
    padding: 16,
  },
  cardTitle: {
    color: "#c8df8f",
    fontSize: 16,
    margin: "0 0 10px",
  },
  messageTitle: {
    color: "#f0f7df",
    fontWeight: 700,
    lineHeight: 1.6,
    margin: "0 0 8px",
  },
  body: {
    color: "rgba(216, 234, 216, 0.82)",
    lineHeight: 1.7,
    margin: "0 0 6px",
  },
} as const
