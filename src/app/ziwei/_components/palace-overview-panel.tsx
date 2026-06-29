import type { ZiweiPalaceDetailView } from "@/ai/destiny-core/ziwei-core/contracts"

import styles from "../_styles/ziwei-page.module.css"
import {
  CORE_DETAIL_CATEGORIES,
  FLOW_DETAIL_CATEGORIES,
  countSourceRules,
  countStars,
  filterStarGroups
} from "../_lib/ziwei-star-group-filters"
import { StarGroupList } from "./star-group-list"

export function PalaceOverviewPanel(props: {
  palaces: ZiweiPalaceDetailView[]
  selectedBranch: string
  onSelect: (branch: ZiweiPalaceDetailView["branch"]) => void
}) {
  return (
    <section className={styles.panel}>
      <div className={styles.panelHeader}>
        <h2 className={styles.panelTitle}>十二宫完整明细</h2>
        <span className={styles.metaText}>{props.palaces.length} 宫</span>
      </div>
      <div className={styles.panelBody}>
        <div className={styles.overviewGrid}>
          {props.palaces.map((palace) => {
            const coreGroups = filterStarGroups(
              palace.starGroups,
              CORE_DETAIL_CATEGORIES
            )
            const flowGroups = filterStarGroups(
              palace.starGroups,
              FLOW_DETAIL_CATEGORIES
            )
            const starCount = countStars(palace.starGroups)
            const ruleCount = countSourceRules(palace.starGroups)
            const relationText = palace.relations
              .filter((relation) => relation.kind !== "self")
              .map((relation) => {
                return `${relation.kindLabel}${relation.branchLabel}${relation.sectorLabel}`
              })
              .join(" / ")

            return (
              <article
                className={
                  palace.branch === props.selectedBranch
                    ? `${styles.overviewCard} ${styles.overviewCardSelected}`
                    : styles.overviewCard
                }
                key={palace.branch}
              >
                <button
                  className={styles.overviewHeader}
                  type="button"
                  onClick={() => props.onSelect(palace.branch)}
                >
                  <span className={styles.overviewTitle}>
                    {palace.sectorLabel} · {palace.palaceStemLabel}
                    {palace.branchLabel}
                  </span>
                  <span className={styles.overviewMeta}>
                    {starCount} 星 · {ruleCount} 规则
                  </span>
                </button>

                <div className={styles.badges}>
                  {palace.isLifePalace ? (
                    <span className={styles.badge}>命宫</span>
                  ) : null}
                  {palace.isBodyPalace ? (
                    <span className={styles.badge}>身宫</span>
                  ) : null}
                  <span className={styles.badge}>{palace.branchLabel}</span>
                  <span className={styles.badge}>{palace.starGroups.length} 组</span>
                </div>

                <p className={styles.overviewRelations}>{relationText}</p>

                <div className={styles.overviewSections}>
                  <section>
                    <h3>核心星曜</h3>
                    <StarGroupList
                      groups={coreGroups}
                      emptyText="本宫暂无核心星曜"
                    />
                  </section>
                  <section>
                    <h3>周期与流系</h3>
                    <StarGroupList
                      groups={flowGroups}
                      emptyText="本宫暂无周期与流系星曜"
                    />
                  </section>
                </div>
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}
