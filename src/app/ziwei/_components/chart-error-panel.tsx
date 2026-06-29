import styles from "../_styles/ziwei-page.module.css"

export function ChartErrorPanel(props: {
  message?: string
}) {
  if (!props.message) {
    return null
  }

  return (
    <div className={styles.error}>
      {props.message}
    </div>
  )
}
