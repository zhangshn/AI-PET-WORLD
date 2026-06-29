import type { ZiweiStarGroupView } from "@/ai/destiny-core/ziwei-core/contracts"

import styles from "../_styles/ziwei-page.module.css"

export function StarGroupList(props: {
  groups: ZiweiStarGroupView[]
  compact?: boolean
  showDetails?: boolean
  emptyText?: string
}) {
  if (props.groups.length === 0) {
    return <p className={styles.metaText}>{props.emptyText ?? "暂无星曜"}</p>
  }

  return (
    <div className={styles.starGroups}>
      {props.groups.map((group) => (
        <div key={group.category}>
          <div className={styles.starGroupTitle}>
            {group.label}{props.compact ? ` ${group.stars.length}` : ""}
          </div>
          {props.showDetails ? (
            <div className={styles.starDetailGrid}>
              {group.stars.map((star) => (
                <article className={styles.starDetailCard} key={star.starId}>
                  <div className={styles.starDetailHeader}>
                    <strong>{star.label}</strong>
                    <span>{star.categoryLabel}</span>
                  </div>
                  <div className={styles.starMetaLine}>
                    <span>星曜 ID</span>
                    <code className={styles.ruleCode}>{star.starId}</code>
                  </div>
                  <div className={styles.starMetaLine}>
                    <span>规则来源</span>
                    <code className={styles.ruleCode}>{star.placementRuleId}</code>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className={styles.starList}>
              {group.stars.slice(0, props.compact ? 8 : undefined).map((star) => (
                <span className={styles.starPill} key={star.starId}>
                  {star.label}
                </span>
              ))}
              {props.compact && group.stars.length > 8 ? (
                <span className={styles.starPill}>+{group.stars.length - 8}</span>
              ) : null}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
