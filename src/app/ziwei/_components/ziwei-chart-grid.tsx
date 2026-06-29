"use client"

import type { CSSProperties } from "react"
import type {
  BranchPalace,
  ZiweiChartMetaView,
  ZiweiPalaceCellView
} from "@/ai/destiny-core/ziwei-core/contracts"

import {
  getZiweiPalaceGridArea,
  ZIWEI_DESKTOP_GRID_TEMPLATE_ROWS,
  ZIWEI_MOBILE_GRID_TEMPLATE_ROWS
} from "../_lib/ziwei-palace-layout"
import styles from "../_styles/ziwei-page.module.css"
import { StarGroupList } from "./star-group-list"

type ZiweiChartGridStyle = CSSProperties & {
  "--ziwei-desktop-grid-areas": string
  "--ziwei-mobile-grid-areas": string
}

export function ZiweiChartGrid(props: {
  chartMeta: ZiweiChartMetaView
  palaces: ZiweiPalaceCellView[]
  selectedBranch: BranchPalace
  totalStarCount: number
  onSelect: (branch: BranchPalace) => void
}) {
  const selectedPalace = props.palaces.find((palace) => {
    return palace.branch === props.selectedBranch
  })
  const lifePalace = props.palaces.find((palace) => palace.isLifePalace)
  const bodyPalace = props.palaces.find((palace) => palace.isBodyPalace)
  const chartGridStyle: ZiweiChartGridStyle = {
    "--ziwei-desktop-grid-areas": formatGridTemplateAreas(
      ZIWEI_DESKTOP_GRID_TEMPLATE_ROWS
    ),
    "--ziwei-mobile-grid-areas": formatGridTemplateAreas(
      ZIWEI_MOBILE_GRID_TEMPLATE_ROWS
    )
  }

  return (
    <section className={styles.panel}>
      <div className={styles.panelHeader}>
        <h2 className={styles.panelTitle}>十二宫盘</h2>
      </div>
      <div className={styles.panelBody}>
        <div className={styles.chartGrid} style={chartGridStyle}>
          <div className={styles.chartCenter}>
            <span className={styles.centerLabel}>中宫</span>
            {selectedPalace ? (
              <div className={styles.centerBlock}>
                <span className={styles.centerTitle}>
                  {selectedPalace.sectorLabel} · {selectedPalace.palaceStemLabel}
                  {selectedPalace.branchLabel}
                </span>
                <span className={styles.centerMeta}>
                  {selectedPalace.starGroups.length} 组星曜 · 全盘 {props.totalStarCount} 颗
                </span>
              </div>
            ) : null}
            <div className={styles.centerInfo}>
              <span>{props.chartMeta.inputSummary}</span>
              <span>{props.chartMeta.ruleSetVersion}</span>
            </div>
            <div className={styles.centerBadges}>
              {lifePalace ? (
                <span className={styles.badge}>命 {lifePalace.branchLabel}</span>
              ) : null}
              {bodyPalace ? (
                <span className={styles.badge}>身 {bodyPalace.branchLabel}</span>
              ) : null}
            </div>
          </div>

          {props.palaces.map((palace) => (
            <button
              key={palace.branch}
              className={`${styles.palaceCell} ${
                props.selectedBranch === palace.branch
                  ? styles.palaceCellSelected
                  : ""
              }`}
              style={{
                gridArea: getZiweiPalaceGridArea(palace.branch)
              }}
              type="button"
              onClick={() => props.onSelect(palace.branch)}
            >
              <div className={styles.palaceTop}>
                <span className={styles.palaceName}>{palace.sectorLabel}</span>
                <span className={styles.palaceBranch}>
                  {palace.palaceStemLabel}
                  {palace.branchLabel}
                </span>
              </div>
              <div className={styles.badges}>
                {palace.isLifePalace ? (
                  <span className={styles.badge}>命</span>
                ) : null}
                {palace.isBodyPalace ? (
                  <span className={styles.badge}>身</span>
                ) : null}
              </div>
              <StarGroupList groups={palace.starGroups} compact />
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}

function formatGridTemplateAreas(rows: readonly string[]): string {
  return rows.map((row) => `"${row}"`).join(" ")
}
