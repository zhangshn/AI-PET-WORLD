import type { ReactNode } from "react"
import type {
  ZiweiPalaceDetailView
} from "@/ai/destiny-core/ziwei-core/contracts"

import styles from "../_styles/ziwei-page.module.css"
import {
  CORE_DETAIL_CATEGORIES,
  FLOW_DETAIL_CATEGORIES,
  countStars,
  filterStarGroups
} from "../_lib/ziwei-star-group-filters"
import { StarGroupList } from "./star-group-list"

export function PalaceDetailPanel(props: {
  palace?: ZiweiPalaceDetailView
}) {
  if (!props.palace) {
    return null
  }

  const coreStarGroups = filterStarGroups(
    props.palace.starGroups,
    CORE_DETAIL_CATEGORIES
  )
  const flowStarGroups = filterStarGroups(
    props.palace.starGroups,
    FLOW_DETAIL_CATEGORIES
  )
  const starCount = countStars(props.palace.starGroups)

  return (
    <section className={styles.panel}>
      <div className={styles.panelHeader}>
        <h2 className={styles.panelTitle}>宫位详情</h2>
      </div>
      <div className={styles.panelBody}>
        <div className={styles.detailStack}>
          <div className={styles.detailHero}>
            <h3 className={styles.detailTitle}>
              {props.palace.sectorLabel} · {props.palace.palaceStemLabel}
              {props.palace.branchLabel}
            </h3>
            <div className={styles.detailMeta}>
              {props.palace.isLifePalace ? <span className={styles.badge}>命宫</span> : null}
              {props.palace.isBodyPalace ? <span className={styles.badge}>身宫</span> : null}
              <span className={styles.badge}>{starCount} 颗星曜</span>
            </div>
          </div>

          <div className={styles.detailSectionGrid}>
            <DetailSection title="宫位基础">
              <dl className={styles.detailFacts}>
                <div>
                  <dt>宫名</dt>
                  <dd>{props.palace.sectorLabel}</dd>
                </div>
                <div>
                  <dt>宫干地支</dt>
                  <dd>
                    {props.palace.palaceStemLabel}
                    {props.palace.branchLabel}
                  </dd>
                </div>
                <div>
                  <dt>星曜分组</dt>
                  <dd>{props.palace.starGroups.length} 组</dd>
                </div>
              </dl>
            </DetailSection>

            <DetailSection title="三方四正">
              <div className={styles.relationGrid}>
                {props.palace.relations.map((relation, index) => (
                  <article
                    className={styles.relationCard}
                    key={`${relation.kind}-${relation.branch}-${index}`}
                  >
                    <div className={styles.relationHeader}>
                      <strong>{relation.kindLabel}</strong>
                      <span>
                        {relation.branchLabel} · {relation.sectorLabel}
                      </span>
                    </div>
                    <p>{relation.note}</p>
                  </article>
                ))}
              </div>
            </DetailSection>
          </div>

          <DetailSection title="核心星曜">
            <StarGroupList
              groups={coreStarGroups}
              showDetails
              emptyText="本宫暂无主星、辅曜、煞曜、四化或杂曜。"
            />
          </DetailSection>

          <DetailSection title="周期与流系星曜">
            <StarGroupList
              groups={flowStarGroups}
              showDetails
              emptyText="本宫暂无长生、年系、月系或日时系星曜。"
            />
          </DetailSection>

          <DetailSection title="安星调试">
            {props.palace.detailLines.length > 0 ? (
              <ul className={styles.detailLineList}>
                {props.palace.detailLines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            ) : (
              <p className={styles.metaText}>
                暂无额外调试记录；每颗星曜的规则来源可在星曜总表中查看。
              </p>
            )}
          </DetailSection>
        </div>
      </div>
    </section>
  )
}

function DetailSection(props: {
  title: string
  children: ReactNode
}) {
  return (
    <section className={styles.detailSection}>
      <h4 className={styles.detailSectionTitle}>{props.title}</h4>
      {props.children}
    </section>
  )
}
