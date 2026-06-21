import styles from "../page.module.css"

export function InfoCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <article className={styles.infoCard}>
      <small>{label}</small>
      <strong>{value}</strong>
      <span>{detail}</span>
    </article>
  )
}
