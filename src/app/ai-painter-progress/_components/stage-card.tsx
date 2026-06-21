import Link from "next/link"
import styles from "../page.module.css"

export function StageCard(props: {
  href: string
  label: string
  title: string
  status: string
  description: string
  actionLabel?: string
  disabled?: boolean
  onAction?: () => void
  danger?: boolean
}) {
  return (
    <article className={styles.stageCard}>
      <p className={styles.kicker}>{props.label}</p>
      <div className={styles.stageTitle}>
        <h2>{props.title}</h2>
        <span data-danger={props.danger}>{props.status}</span>
      </div>
      <p>{props.description}</p>
      <div className={styles.stageActions}>
        <Link href={props.href}>进入详情</Link>
        {props.actionLabel ? (
          <button disabled={props.disabled} onClick={props.onAction}>
            {props.actionLabel}
          </button>
        ) : null}
      </div>
    </article>
  )
}
