import type {
  ZiweiPageModuleColumn,
  ZiweiPageModuleDefinition,
  ZiweiPageModuleId
} from "../_lib/ziwei-module-registry"
import styles from "../_styles/ziwei-page.module.css"

const COLUMN_LABELS: Record<ZiweiPageModuleColumn, string> = {
  left: "左栏",
  center: "中宫",
  right: "右栏"
}

const COLUMN_ORDER: ZiweiPageModuleColumn[] = ["left", "center", "right"]

export function ModuleNavigationPanel(props: {
  modules: readonly ZiweiPageModuleDefinition[]
  collapsedModuleIds: ReadonlySet<ZiweiPageModuleId>
  onOpenModule: (moduleId: ZiweiPageModuleId) => void
  onToggleModule: (moduleId: ZiweiPageModuleId) => void
}) {
  return (
    <section className={styles.panel}>
      <div className={styles.panelHeader}>
        <h2 className={styles.panelTitle}>模块导航</h2>
        <p className={styles.metaText}>{props.modules.length} 项</p>
      </div>
      <div className={styles.panelBody}>
        <div className={styles.moduleNavGrid}>
          {COLUMN_ORDER.map((column) => {
            const modules = props.modules.filter((module) => {
              return module.column === column
            })

            return (
              <section className={styles.moduleNavGroup} key={column}>
                <h3>{COLUMN_LABELS[column]}</h3>
                <div className={styles.moduleNavList}>
                  {modules.map((module) => {
                    const moduleId = module.id as ZiweiPageModuleId
                    const collapsed = props.collapsedModuleIds.has(moduleId)

                    return (
                      <div className={styles.moduleNavItem} key={module.id}>
                        <button
                          className={`${styles.moduleNavButton} ${
                            collapsed ? styles.moduleNavButtonCollapsed : ""
                          }`}
                          type="button"
                          onClick={() => props.onOpenModule(moduleId)}
                        >
                          <span>{module.label}</span>
                          <strong>{collapsed ? "折叠" : "展开"}</strong>
                        </button>
                        <button
                          className={styles.moduleNavMiniButton}
                          type="button"
                          aria-label={`${module.label}${collapsed ? "展开" : "折叠"}`}
                          onClick={() => props.onToggleModule(moduleId)}
                        >
                          {collapsed ? "+" : "-"}
                        </button>
                      </div>
                    )
                  })}
                </div>
              </section>
            )
          })}
        </div>
      </div>
    </section>
  )
}
