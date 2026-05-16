/**
 * 当前文件负责展示正式页底部 MVP 调试入口。
 */

import { WORLD_EXPERIENCE_STYLES as styles } from "./world-experience-styles"

type WorldExperienceControlsProps = {
  onManualAdvanceConstruction: () => void
  onResetLocalHomeMap: () => void
}

export function WorldExperienceControls({
  onManualAdvanceConstruction,
  onResetLocalHomeMap,
}: WorldExperienceControlsProps) {
  return (
    <section style={{ ...styles.card, ...styles.fullWidth }}>
      <div style={styles.controls}>
        <p style={styles.body}>
          MVP 调试入口，正式产品不会让玩家直接建造。
        </p>
        <div style={styles.buttonRow}>
          <button
            type="button"
            style={styles.button}
            onClick={onManualAdvanceConstruction}
          >
            手动推进管家建设 +1 阶段
          </button>
          <button
            type="button"
            style={{ ...styles.button, ...styles.resetButton }}
            onClick={onResetLocalHomeMap}
          >
            重置本地家园
          </button>
        </div>
      </div>
    </section>
  )
}
