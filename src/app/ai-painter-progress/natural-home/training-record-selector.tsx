"use client"

import { useRouter } from "next/navigation"
import styles from "../page.module.css"

type TrainingRecordSelectorProps = {
  records: Array<{
    id: string
    label: string
  }>
  selectedId: string
}

export function TrainingRecordSelector(props: TrainingRecordSelectorProps) {
  const router = useRouter()

  return (
    <div className={styles.toolbar}>
      <label className={styles.field}>
        <span>训练记录</span>
        <select
          value={props.selectedId}
          onChange={(event) => {
            const selectedId = event.currentTarget.value
            router.push(`/ai-painter-progress/natural-home?run=${encodeURIComponent(selectedId)}`)
          }}
        >
          {props.records.map((record) => (
            <option key={record.id} value={record.id}>
              {record.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}
