/**
 * 当前文件负责：展示 P-Phone 原创像素图标。
 */

import type { PPhoneIconKind } from "./PPhoneTypes"

import styles from "@/styles/world-styles/phone/p-phone-icon.module.css"

type Props = {
  kind: PPhoneIconKind
  size?: "small" | "normal" | "large"
}

const ICON_CLASS_NAMES: Record<PPhoneIconKind, string> = {
  messages: styles.messages,
  contacts: styles.contacts,
  pet: styles.pet,
  profile: styles.profile,
  home: styles.home,
  settings: styles.settings,
  phone: styles.phone,
  system: styles.system,
  world: styles.world,
  weather: styles.weather,
  calendar: styles.calendar,
  open: styles.open,
  build: styles.build,
  future: styles.future,
  eco: styles.eco,
  community: styles.community,
  park: styles.park,
  clinic: styles.clinic,
  town: styles.town,
  board: styles.board,
}

function getSizeClassName(size: Props["size"]): string {
  if (size === "small") return styles.small
  if (size === "large") return styles.large

  return styles.normal
}

export default function PPhoneIcon({ kind, size = "normal" }: Props) {
  return (
    <span
      className={`${styles.icon} ${getSizeClassName(size)} ${ICON_CLASS_NAMES[kind]}`}
      aria-hidden="true"
    >
      <span className={styles.partA} />
      <span className={styles.partB} />
      <span className={styles.partC} />
      <span className={styles.partD} />
    </span>
  )
}