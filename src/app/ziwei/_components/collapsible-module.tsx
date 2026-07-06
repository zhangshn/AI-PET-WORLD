import type { ReactNode } from "react"

import type { ZiweiPageModuleId } from "../_lib/ziwei-module-registry"
import styles from "../_styles/ziwei-page.module.css"

export function CollapsibleModule(props: {
  moduleId: ZiweiPageModuleId
  title: string
  collapsed: boolean
  onToggle: (moduleId: ZiweiPageModuleId) => void
  children: ReactNode
}) {
  return (
    <section
      className={styles.moduleFrame}
      id={`ziwei-module-${props.moduleId}`}
    >
      <button
        className={styles.moduleToggle}
        type="button"
        aria-expanded={!props.collapsed}
        aria-controls={`ziwei-module-body-${props.moduleId}`}
        onClick={() => props.onToggle(props.moduleId)}
      >
        <span>{props.title}</span>
        <strong>{props.collapsed ? "展开" : "收起"}</strong>
      </button>
      {props.collapsed ? null : (
        <div
          className={styles.moduleBody}
          id={`ziwei-module-body-${props.moduleId}`}
        >
          {props.children}
        </div>
      )}
    </section>
  )
}
