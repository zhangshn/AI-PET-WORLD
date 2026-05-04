/**
 * 当前文件负责：展示手机主页四个模块入口。
 */

import type { PhoneModuleCard } from "../../utils/phoneModuleMappers"

import {
  getPhoneMockStatusLabel,
  type PhoneMockModuleId,
} from "./PhoneMockTypes"

import styles from "@/styles/world-styles/phone-home-mock-panel.module.css"

type Props = {
  modules: PhoneModuleCard[]
  activeModule: PhoneMockModuleId
  onSelectModule: (moduleId: PhoneMockModuleId) => void
}

function getModuleStatusClass(status: PhoneModuleCard["status"]): string {
  if (status === "active") return styles.active
  if (status === "warning") return styles.warning
  if (status === "quiet") return styles.quiet
  if (status === "locked") return styles.locked

  return styles.normal
}

export default function PhoneModuleGrid({
  modules,
  activeModule,
  onSelectModule,
}: Props) {
  return (
    <div className={styles.moduleGrid}>
      {modules.map((module) => (
        <button
          className={`${styles.moduleButton} ${
            module.id === activeModule ? styles.selected : ""
          }`}
          key={module.id}
          type="button"
          onClick={() => onSelectModule(module.id)}
        >
          <div className={styles.moduleButtonTop}>
            <span>{module.title}</span>

            <strong
              className={`${styles.statusDot} ${getModuleStatusClass(
                module.status
              )}`}
            >
              {getPhoneMockStatusLabel(module.status)}
            </strong>
          </div>

          <p>{module.primaryText}</p>
        </button>
      ))}
    </div>
  )
}