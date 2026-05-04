/**
 * 当前文件负责：展示手机模块详情页结构。
 */

import type { PhoneDetailPageData, PhoneDetailRow } from "../../utils/phoneDetailMappers"
import type { PhoneModuleCard } from "../../utils/phoneModuleMappers"

import styles from "@/styles/world-styles/phone-home-mock-panel.module.css"

type Props = {
  module: PhoneModuleCard
  detail: PhoneDetailPageData | null
}

function getModuleStatusClass(status: PhoneModuleCard["status"]): string {
  if (status === "active") return styles.active
  if (status === "warning") return styles.warning
  if (status === "quiet") return styles.quiet
  if (status === "locked") return styles.locked

  return styles.normal
}

function DetailMeter({ row }: { row: PhoneDetailRow }) {
  if (!row.meter) return null

  return (
    <div className={styles.detailMeter}>
      <div
        className={styles.detailMeterFill}
        style={{ width: `${row.meter.value}%` }}
      />
    </div>
  )
}

function GenericModuleDetail({ module }: { module: PhoneModuleCard }) {
  return (
    <section className={styles.detailPanel}>
      <div className={styles.detailHeader}>
        <div>
          <p className={styles.detailEyebrow}>{module.routeKey}</p>
          <h4>{module.title}</h4>
        </div>

        <span
          className={`${styles.detailStatus} ${getModuleStatusClass(
            module.status
          )}`}
        >
          {module.statusLabel}
        </span>
      </div>

      <p className={styles.detailPrimary}>{module.primaryText}</p>
      <p className={styles.detailSecondary}>{module.secondaryText}</p>

      {module.tags.length > 0 && (
        <div className={styles.tags}>
          {module.tags.slice(0, 5).map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </div>
      )}

      {module.metrics.length > 0 && (
        <div className={styles.metrics}>
          {module.metrics.map((metric) => (
            <div className={styles.metricItem} key={metric.label}>
              <div className={styles.metricTopRow}>
                <span>{metric.label}</span>
                <strong>{metric.valueLabel}</strong>
              </div>

              {metric.meter && (
                <div className={styles.meterTrack}>
                  <div
                    className={styles.meterFill}
                    style={{ width: `${metric.meter.value}%` }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function StructuredDetailPage({ detail }: { detail: PhoneDetailPageData }) {
  return (
    <section className={styles.detailPage}>
      <div className={styles.detailPageHeader}>
        <div>
          <p className={styles.detailEyebrow}>{detail.routeKey}</p>
          <h4>{detail.title}</h4>
        </div>

        <span className={styles.detailStatus}>
          {detail.statusLabel}
        </span>
      </div>

      <p className={styles.detailPrimary}>{detail.subtitle}</p>
      <p className={styles.detailSecondary}>{detail.summary}</p>

      {detail.tags.length > 0 && (
        <div className={styles.tags}>
          {detail.tags.slice(0, 6).map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </div>
      )}

      <div className={styles.detailSections}>
        {detail.sections.map((section) => (
          <section className={styles.detailSection} key={section.title}>
            <h5>{section.title}</h5>

            {section.description && (
              <p className={styles.sectionDescription}>
                {section.description}
              </p>
            )}

            <div className={styles.detailRows}>
              {section.rows.map((row) => (
                <div
                  className={styles.detailRow}
                  key={`${section.title}-${row.label}`}
                >
                  <div className={styles.detailRowTop}>
                    <span>{row.label}</span>
                    <strong>{row.value}</strong>
                  </div>

                  {row.helperText && (
                    <p className={styles.rowHelper}>{row.helperText}</p>
                  )}

                  <DetailMeter row={row} />
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </section>
  )
}

export default function PhoneModuleDetail({ module, detail }: Props) {
  if (detail) {
    return <StructuredDetailPage detail={detail} />
  }

  return <GenericModuleDetail module={module} />
}