"use client"

import type {
  BranchPalace,
  ZiweiChartInterpretation
} from "@/ai/destiny-core/ziwei-core/contracts"

import styles from "../_styles/ziwei-page.module.css"
import { InterpretationPanel } from "./interpretation-panel"

export function InterpretationModal(props: {
  interpretation: ZiweiChartInterpretation
  selectedBranch: BranchPalace
  open: boolean
  onClose: () => void
}) {
  if (!props.open) {
    return null
  }

  return (
    <div className={styles.dictionaryOverlay} role="presentation">
      <section
        aria-modal="true"
        className={styles.dictionaryDialog}
        role="dialog"
      >
        <header className={styles.dictionaryHeader}>
          <div>
            <p className={styles.dictionaryEyebrow}>盘面分析</p>
            <h2>整盘与当前宫位分析</h2>
            <span>{props.interpretation.debug.totalItems} 条解释</span>
          </div>
          <button
            className={styles.dictionaryCloseButton}
            type="button"
            onClick={props.onClose}
          >
            关闭
          </button>
        </header>

        <div className={styles.dictionaryBodySingle}>
          <InterpretationPanel
            interpretation={props.interpretation}
            selectedBranch={props.selectedBranch}
          />
        </div>
      </section>
    </div>
  )
}
