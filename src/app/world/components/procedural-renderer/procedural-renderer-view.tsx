/**
 * 当前文件负责：提供正式 ProceduralRenderer 组件骨架。
 */

import type { RenderableWorldSnapshot } from "@/world/rendering/renderer-gateway"

import styles from "./procedural-renderer-view.styles.module.css"

export type ProceduralRendererViewProps = {
  snapshot: RenderableWorldSnapshot
}

export function ProceduralRendererView(input: ProceduralRendererViewProps) {
  const { snapshot } = input

  return (
    <section
      className={styles.rendererShell}
      aria-label="AI-PET-WORLD procedural renderer"
    >
      <div className={styles.header}>
        <span className={styles.eyebrow}>
          PROCEDURAL RENDERER / SKELETON
        </span>
        <h2>ProceduralRenderer 正式组件骨架</h2>
        <p>ProceduralRenderer 正式组件骨架已接入，但尚未绘制世界。</p>
      </div>

      <dl className={styles.summaryGrid}>
        <div className={styles.summaryItem}>
          <dt>世界编号</dt>
          <dd>{snapshot.visualState.worldId}</dd>
        </div>
        <div className={styles.summaryItem}>
          <dt>DrawCommand</dt>
          <dd>{snapshot.drawCommands.length}</dd>
        </div>
        <div className={styles.summaryItem}>
          <dt>Placement</dt>
          <dd>{snapshot.visualState.placements.length}</dd>
        </div>
        <div className={styles.summaryItem}>
          <dt>Terrain Cell</dt>
          <dd>{snapshot.visualState.terrainCells.length}</dd>
        </div>
      </dl>
    </section>
  )
}
