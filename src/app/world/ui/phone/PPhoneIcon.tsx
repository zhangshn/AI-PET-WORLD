/**
 * 当前文件负责：展示 P-Phone 原创几何图标。
 */

import type { PPhoneIconKind } from "./PPhoneTypes"

import styles from "@/styles/world-styles/phone/p-phone-icon.module.css"

type Props = {
  kind: PPhoneIconKind
}

function getIconClassName(kind: PPhoneIconKind): string {
  if (kind === "messages") return styles.messages
  if (kind === "contacts") return styles.contacts
  if (kind === "pet") return styles.pet
  if (kind === "profile") return styles.profile
  if (kind === "home") return styles.home
  if (kind === "settings") return styles.settings
  if (kind === "phone") return styles.phone
  if (kind === "system") return styles.system

  return styles.world
}

export default function PPhoneIcon({ kind }: Props) {
  return (
    <span className={`${styles.icon} ${getIconClassName(kind)}`}>
      <span className={styles.partA} />
      <span className={styles.partB} />
      <span className={styles.partC} />
    </span>
  )
}