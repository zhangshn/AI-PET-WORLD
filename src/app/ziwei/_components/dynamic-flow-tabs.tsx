"use client"

import type {
  ZiweiDynamicDebugView,
  ZiweiDynamicTabView
} from "@/ai/destiny-core/ziwei-core/contracts"

import styles from "../_styles/ziwei-page.module.css"

export function DynamicFlowTabs(props: {
  tabs: ZiweiDynamicTabView[]
  dynamicDebug?: ZiweiDynamicDebugView
  selectedType: ZiweiDynamicTabView["type"]
  onSelect: (tab: ZiweiDynamicTabView) => void
}) {
  const selectedTab = props.tabs.find((tab) => tab.type === props.selectedType)

  return (
    <section className={styles.panel}>
      <div className={styles.panelHeader}>
        <h2 className={styles.panelTitle}>动态流</h2>
        {selectedTab ? (
          <p className={styles.metaText}>
            当前：{selectedTab.label} · {selectedTab.palaceLabel}
          </p>
        ) : null}
      </div>
      <div className={styles.panelBody}>
        {props.dynamicDebug ? (
          <div className={styles.dynamicSummary}>
            <DynamicFact label="行运方向" value={props.dynamicDebug.directionLabel} />
            <DynamicFact label="起运岁数" value={`${props.dynamicDebug.startAge} 岁`} />
            <DynamicFact label="当前年龄" value={`${props.dynamicDebug.currentAge} 岁`} />
            <DynamicFact
              label="启用流"
              value={`${props.dynamicDebug.activeFlowCount}/${props.dynamicDebug.totalFlowCount}`}
            />
          </div>
        ) : null}

        <div className={styles.tabs}>
          {props.tabs.map((tab) => (
            <button
              key={tab.type}
              className={`${styles.tab} ${props.selectedType === tab.type ? styles.tabActive : ""}`}
              type="button"
              onClick={() => props.onSelect(tab)}
            >
              <span className={styles.tabLabel}>
                {tab.label}
                <span className={tab.isActive ? styles.flowStatusActive : styles.flowStatusInactive}>
                  {tab.isActive ? "启用" : "未启用"}
                </span>
              </span>
              <span className={styles.tabMeta}>
                {tab.isActive ? tab.palaceLabel : tab.inactiveReason}
              </span>
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}

function DynamicFact(props: {
  label: string
  value: string
}) {
  return (
    <div className={styles.dynamicFact}>
      <span>{props.label}</span>
      <strong>{props.value}</strong>
    </div>
  )
}
