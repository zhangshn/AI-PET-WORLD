import type {
  ZiweiStarBrightness,
  ZiweiStarGroupView
} from "@/ai/destiny-core/ziwei-core/contracts"

import styles from "../_styles/ziwei-page.module.css"

export function StarGroupList(props: {
  groups: ZiweiStarGroupView[]
  compact?: boolean
  compactGroupLimit?: number
  compactStarLimit?: number
  dense?: boolean
  mixedOrientation?: boolean
  hideGroupTitle?: boolean
  showDetails?: boolean
  emptyText?: string
}) {
  if (props.groups.length === 0) {
    return <p className={styles.metaText}>{props.emptyText ?? "暂无星曜"}</p>
  }

  const compactGroupLimit = props.compactGroupLimit ?? 3
  const compactStarLimit = props.compactStarLimit ?? 3
  const visibleGroups = props.compact
    ? props.groups.slice(0, compactGroupLimit)
    : props.groups
  const hiddenGroupCount = props.groups.length - visibleGroups.length

  return (
    <div
      className={
        props.dense
          ? `${styles.starGroups} ${styles.starGroupsDense}`
          : styles.starGroups
      }
    >
      {visibleGroups.map((group) => (
        <div
          className={getStarGroupClassName(group, props.mixedOrientation)}
          key={group.category}
        >
          {props.hideGroupTitle ? null : (
            <div className={styles.starGroupTitle}>
              {group.label}{props.compact ? ` ${group.stars.length}` : ""}
            </div>
          )}
          {props.showDetails ? (
            <div className={styles.starDetailGrid}>
              {group.stars.map((star) => (
                <article className={styles.starDetailCard} key={star.starId}>
                  <div className={styles.starDetailHeader}>
                    <strong>{star.displayLabel}</strong>
                    <span>{star.categoryLabel}</span>
                  </div>
                  {star.category === "transformation" ? (
                    <>
                      <div className={styles.starMetaLine}>
                        <span>四化来源</span>
                        <strong>{star.sourceLabel}</strong>
                      </div>
                      <div className={styles.starMetaLine}>
                        <span>被化星曜</span>
                        <strong>{star.targetStarLabel ?? "未记录"}</strong>
                      </div>
                    </>
                  ) : (
                    <div className={styles.starMetaLine}>
                      <span>庙旺落陷</span>
                      <strong className={styles.brightnessBadge}>
                        {formatBrightnessLabel(star.brightness)}
                      </strong>
                    </div>
                  )}
                  <div className={styles.starMetaLine}>
                    <span>排盘来源</span>
                    <strong>{star.sourceLabel}</strong>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className={getStarListClassName(group, props.mixedOrientation)}>
              {group.stars.slice(0, props.compact ? compactStarLimit : undefined).map((star) => (
                <span className={styles.starPill} key={star.starId}>
                  {star.displayLabel}
                  {shouldShowCompactBrightness(star) ? (
                    <em>{star.brightness?.label}</em>
                  ) : null}
                </span>
              ))}
              {props.compact && group.stars.length > compactStarLimit ? (
                <span className={styles.starPill}>+{group.stars.length - compactStarLimit}</span>
              ) : null}
            </div>
          )}
        </div>
      ))}
      {props.compact && hiddenGroupCount > 0 ? (
        <span className={styles.starPill}>另 {hiddenGroupCount} 组</span>
      ) : null}
    </div>
  )
}

function getStarGroupClassName(
  group: ZiweiStarGroupView,
  mixedOrientation?: boolean
): string | undefined {
  const categoryClassName = getStarGroupCategoryClassName(group.category)

  if (!mixedOrientation) {
    return categoryClassName
  }

  return [
    categoryClassName,
    isHorizontalStarGroup(group)
      ? styles.starGroupHorizontal
      : styles.starGroupVertical
  ].join(" ")
}

function getStarListClassName(
  group: ZiweiStarGroupView,
  mixedOrientation?: boolean
): string {
  if (!mixedOrientation) {
    return styles.starList
  }

  return isHorizontalStarGroup(group)
    ? `${styles.starList} ${styles.starListHorizontal}`
    : `${styles.starList} ${styles.starListVertical}`
}

function isHorizontalStarGroup(group: ZiweiStarGroupView): boolean {
  return group.category === "main" || group.category === "misc"
}

function getStarGroupCategoryClassName(
  category: ZiweiStarGroupView["category"]
): string {
  if (category === "main") return styles.starGroupMain
  if (category === "assistant") return styles.starGroupAssistant
  if (category === "malefic") return styles.starGroupMalefic
  if (category === "transformation") return styles.starGroupTransformation
  if (category === "misc") return styles.starGroupMisc
  if (category === "lifecycle") return styles.starGroupLifecycle
  if (category === "yearly") return styles.starGroupYearly
  if (category === "monthly") return styles.starGroupMonthly
  if (category === "dailyHourly") return styles.starGroupDailyHourly
  return styles.starGroupEmpty
}

function formatBrightnessLabel(brightness?: ZiweiStarBrightness): string {
  return brightness?.label ?? "未定"
}

function shouldShowCompactBrightness(
  star: ZiweiStarGroupView["stars"][number]
): boolean {
  return Boolean(
    star.category !== "transformation" &&
      star.brightness &&
      star.brightness.level !== "unmapped"
  )
}
