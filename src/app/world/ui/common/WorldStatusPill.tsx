/**
 * 当前文件负责：提供 /world 页面通用状态标签。
 */

import type { ReactNode } from "react"

import styles from "@/styles/world-styles/world-status-pill.module.css"

type Tone = "warm" | "green" | "blue" | "amber" | "muted"

type Props = {
  label: string
  value: ReactNode
  tone?: Tone
}

export default function WorldStatusPill({
  label,
  value,
  tone = "warm",
}: Props) {
  return (
    <div className={`${styles.pill} ${styles[tone]}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}