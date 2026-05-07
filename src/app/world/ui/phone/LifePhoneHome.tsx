"use client"

/**
 * 当前文件负责：展示 Life Phone 首页模块与详情预览。
 */

import { useMemo, useState } from "react"

import type { WorldEngineViewState } from "../../hooks/useWorldEngineState"
import type { PhoneDetailPageData } from "../../utils/phoneDetailMappers"
import type {
  PhoneHomeScreenModuleData,
  PhoneModuleCard,
  PhoneObservationEntryModuleData,
} from "../../utils/phoneModuleMappers"
import type { PhoneObservationGroup } from "../../utils/phoneObservationMappers"
import type { WorldHudBundle } from "../../utils/worldHudMappers"

import { buildPhoneDetailBundle } from "../../utils/phoneDetailMappers"
import { buildPhoneHomeScreenModuleData } from "../../utils/phoneModuleMappers"
import { getLifePhoneStatusLabel, type LifePhoneModuleId } from "./LifePhoneTypes"

import styles from "@/styles/world-styles/phone/life-phone-home.module.css"

type Props = {
  world: WorldEngineViewState
  hud: WorldHudBundle
}

function getDetailByModule(
  activeModule: LifePhoneModuleId,
  details: {
    pet: PhoneDetailPageData
    butler: PhoneDetailPageData
    home: PhoneDetailPageData
  }
): PhoneDetailPageData | null {
  if (activeModule === "pet") return details.pet
  if (activeModule === "butler") return details.butler
  if (activeModule === "home") return details.home

  return null
}

function getObservationModule(
  phoneData: PhoneHomeScreenModuleData
): PhoneObservationEntryModuleData {
  return phoneData.modules[3]
}

function getModuleStatusClass(status: PhoneModuleCard["status"]): string {
  if (status === "active") return styles.active
  if (status === "warning") return styles.warning
  if (status === "quiet") return styles.quiet
  if (status === "locked") return styles.locked

  return styles.normal
}

function ModuleButton({
  module,
  isSelected,
  onSelect,
}: {
  module: PhoneModuleCard
  isSelected: boolean
  onSelect: (moduleId: LifePhoneModuleId) => void
}) {
  return (
    <button
      className={`${styles.moduleButton} ${isSelected ? styles.selected : ""}`}
      type="button"
      onClick={() => onSelect(module.id)}
    >
      <span className={styles.moduleTopRow}>
        <span>{module.title}</span>

        <strong
          className={`${styles.statusPill} ${getModuleStatusClass(
            module.status
          )}`}
        >
          {getLifePhoneStatusLabel(module.status)}
        </strong>
      </span>

      <strong className={styles.modulePrimary}>{module.primaryText}</strong>

      <span className={styles.moduleSecondary}>{module.secondaryText}</span>
    </button>
  )
}

function MeterRow({
  label,
  valueLabel,
  value,
}: {
  label: string
  valueLabel: string
  value?: number
}) {
  return (
    <div className={styles.metricItem}>
      <div className={styles.metricTopRow}>
        <span>{label}</span>
        <strong>{valueLabel}</strong>
      </div>

      {typeof value === "number" && (
        <div className={styles.meterTrack}>
          <div
            className={styles.meterFill}
            style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
          />
        </div>
      )}
    </div>
  )
}

function GenericModulePreview({ module }: { module: PhoneModuleCard }) {
  return (
    <section className={styles.detailCard}>
      <div className={styles.detailHeader}>
        <div>
          <p className={styles.detailEyebrow}>{module.routeKey}</p>
          <h3>{module.title}</h3>
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
            <MeterRow
              key={metric.label}
              label={metric.label}
              valueLabel={metric.valueLabel}
              value={metric.value}
            />
          ))}
        </div>
      )}
    </section>
  )
}

function StructuredDetailPreview({ detail }: { detail: PhoneDetailPageData }) {
  return (
    <section className={styles.detailCard}>
      <div className={styles.detailHeader}>
        <div>
          <p className={styles.detailEyebrow}>{detail.routeKey}</p>
          <h3>{detail.title}</h3>
        </div>

        <span className={styles.detailStatus}>{detail.statusLabel}</span>
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
            <h4>{section.title}</h4>

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

                  {row.meter && (
                    <div className={styles.meterTrack}>
                      <div
                        className={styles.meterFill}
                        style={{
                          width: `${Math.min(
                            100,
                            Math.max(0, row.meter.value)
                          )}%`,
                        }}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </section>
  )
}

function ObservationPreview({
  module,
}: {
  module: PhoneObservationEntryModuleData
}) {
  const observation = module.observation

  return (
    <section className={styles.detailCard}>
      <div className={styles.detailHeader}>
        <div>
          <p className={styles.detailEyebrow}>phone.observation</p>
          <h3>{observation.moduleTitle}</h3>
        </div>

        <span className={styles.detailStatus}>{observation.totalCount}</span>
      </div>

      <p className={styles.detailPrimary}>{observation.latestTitle}</p>
      <p className={styles.detailSecondary}>{observation.latestSummary}</p>

      <div className={styles.observationList}>
        {observation.groups.length === 0 && (
          <div className={styles.empty}>暂无观察记录。</div>
        )}

        {observation.groups.slice(0, 3).map((group: PhoneObservationGroup) => (
          <section className={styles.observationGroup} key={group.groupLabel}>
            <h4>{group.groupLabel}</h4>

            {group.items.slice(0, 3).map((item) => (
              <article className={styles.logItem} key={item.id}>
                <div className={styles.logTopRow}>
                  <span>{item.category}</span>
                  <strong>{item.timeLabel}</strong>
                </div>

                <h5>{item.title}</h5>
                <p>{item.summary}</p>
              </article>
            ))}
          </section>
        ))}
      </div>
    </section>
  )
}

export default function LifePhoneHome({ world, hud }: Props) {
  const [activeModule, setActiveModule] = useState<LifePhoneModuleId>("pet")

  const { phoneData, detailBundle } = useMemo(() => {
    return {
      phoneData: buildPhoneHomeScreenModuleData({
        hud,
        events: world.events,
      }),
      detailBundle: buildPhoneDetailBundle(hud),
    }
  }, [hud, world.events])

  const selectedModule =
    phoneData.modules.find((module) => module.id === activeModule) ??
    phoneData.modules[0]

  const selectedDetail = getDetailByModule(activeModule, detailBundle)
  const observationModule = getObservationModule(phoneData)

  return (
    <div className={styles.home}>
      <section className={styles.screenIntro}>
        <div>
          <p className={styles.eyebrow}>WORLD DEVICE</p>
          <h2>{phoneData.screenTitle}</h2>
        </div>

        <span className={styles.alphaBadge}>Alpha</span>
      </section>

      <p className={styles.subtitle}>{phoneData.screenSubtitle}</p>

      <div className={styles.moduleGrid}>
        {phoneData.modules.map((module) => (
          <ModuleButton
            key={module.id}
            module={module}
            isSelected={module.id === selectedModule.id}
            onSelect={setActiveModule}
          />
        ))}
      </div>

      {activeModule === "observation" ? (
        <ObservationPreview module={observationModule} />
      ) : selectedDetail ? (
        <StructuredDetailPreview detail={selectedDetail} />
      ) : (
        <GenericModulePreview module={selectedModule} />
      )}
    </div>
  )
}