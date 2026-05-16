/**
 * 当前文件负责展示 MVP 逻辑可视化调试按钮。
 */

import { LOGIC_VISUALIZATION_STYLES as styles } from "./logic-visualization-styles"

type LogicVisualizationControlsProps = {
  onManualAdvanceConstruction: () => void
  onResetLocalHomeMap: () => void
}

export function LogicVisualizationControls({
  onManualAdvanceConstruction,
  onResetLocalHomeMap,
}: LogicVisualizationControlsProps) {
  return (
    <section style={styles.card}>
      <h2 style={styles.cardTitle}>MVP Controls</h2>
      <p style={styles.sectionHint}>
        这些按钮仅用于 MVP 调试。正式产品中，玩家不会直接建造。
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
          style={{ ...styles.button, ...styles.dangerButton }}
          onClick={onResetLocalHomeMap}
        >
          重置本地家园
        </button>
      </div>
    </section>
  )
}
