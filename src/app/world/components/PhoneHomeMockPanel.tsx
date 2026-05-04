"use client"

/**
 * 当前文件负责：预览未来手机主页、模块入口与详情页结构。
 */

import { useMemo, useState } from "react"

import type { WorldEngineViewState } from "../hooks/useWorldEngineState"
import type {
  PhoneHomeScreenModuleData,
  PhoneModuleCard,
} from "../utils/phoneModuleMappers"
import type {
  PhoneDetailPageData,
  PhoneDetailRow,
} from "../utils/phoneDetailMappers"

import { buildWorldHudBundle } from "../utils/worldHudMappers"
import { buildPhoneHomeScreenModuleData } from "../utils/phoneModuleMappers"
import { buildPhoneDetailBundle } from "../utils/phoneDetailMappers"

import styles from "@/styles/world-styles/phone-home-mock-panel.module.css"

type Props = {
  world: WorldEngineViewState
}

type ModuleId = PhoneModuleCard["id"]

function getModuleStatusLabel(status: PhoneModuleCard["status"]): string {
  if (status === "active") return "活跃"
  if (status === "warning") return "注意"
  if (status === "quiet") return "安静"
  if (status === "locked") return "未开放"

  return "正常"
}

function getModuleStatusClass(status: PhoneModuleCard["status"]): string {
  if (status === "active") return styles.active
  if (status === "warning") return styles.warning
  if (status === "quiet") return styles.quiet
  if (status === "locked") return styles.locked

  return styles.normal
}

function findModule(
  phoneData: PhoneHomeScreenModuleData,
  activeModule: ModuleId
): PhoneModuleCard {
  return (
    phoneData.modules.find((module) => module.id === activeModule) ??
    phoneData.modules[0]
  )
}

function getDetailByModule(
  activeModule: ModuleId,
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

function DetailPage({ detail }: { detail: PhoneDetailPageData }) {
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
                <div className={styles.detailRow} key={`${section.title}-${row.label}`}>
                  <div className={styles.detailRowTop}>
                    <span>{row.label}</span>
                    <strong>{row.value}</strong>
                  </div>

                  {row.helperText && (
                    <p className={styles.rowHelper}>
                      {row.helperText}
                    </p>
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

export default function PhoneHomeMockPanel({ world }: Props) {
  const [activeModule, setActiveModule] = useState<ModuleId>("observation")

  const { phoneData, detailBundle } = useMemo(() => {
    const hud = buildWorldHudBundle({
      time: world.time,
      pet: world.pet,
      butler: world.butler,
      home: world.home,
      stimuli: world.stimuli,
      ecology: world.ecology,
    })

    return {
      phoneData: buildPhoneHomeScreenModuleData({
        hud,
        events: world.events,
      }),
      detailBundle: buildPhoneDetailBundle(hud),
    }
  }, [
    world.time,
    world.pet,
    world.butler,
    world.home,
    world.stimuli,
    world.ecology,
    world.events,
  ])

  const selectedModule = findModule(phoneData, activeModule)
  const selectedDetail = getDetailByModule(activeModule, detailBundle)
  const observationModule = phoneData.modules.find(
    (module) => module.id === "observation"
  )

  return (
    <section className={styles.panel}>
      <div className={styles.header}>
        <div>
          <p className={styles.eyebrow}>PHONE HOME MOCK</p>
          <h2 className={styles.title}>手机主页模块预览</h2>
        </div>

        <span className={styles.badge}>
          {phoneData.modules.length}
        </span>
      </div>

      <div className={styles.phone}>
        <div className={styles.phoneTopBar}>
          <span>AI-PET-WORLD</span>
          <strong>世界终端</strong>
        </div>

        <div className={styles.screenHeader}>
          <div>
            <p className={styles.screenEyebrow}>WORLD DEVICE</p>
            <h3>{phoneData.screenTitle}</h3>
          </div>

          <span className={styles.screenBadge}>Alpha</span>
        </div>

        <p className={styles.screenSubtitle}>
          {phoneData.screenSubtitle}
        </p>

        <div className={styles.moduleGrid}>
          {phoneData.modules.map((module) => (
            <button
              className={`${styles.moduleButton} ${
                module.id === activeModule ? styles.selected : ""
              }`}
              key={module.id}
              type="button"
              onClick={() => setActiveModule(module.id)}
            >
              <div className={styles.moduleButtonTop}>
                <span>{module.title}</span>

                <strong
                  className={`${styles.statusDot} ${getModuleStatusClass(
                    module.status
                  )}`}
                >
                  {getModuleStatusLabel(module.status)}
                </strong>
              </div>

              <p>{module.primaryText}</p>
            </button>
          ))}
        </div>

        {selectedDetail ? (
          <DetailPage detail={selectedDetail} />
        ) : (
          <section className={styles.detailPanel}>
            <div className={styles.detailHeader}>
              <div>
                <p className={styles.detailEyebrow}>
                  {selectedModule.routeKey}
                </p>

                <h4>{selectedModule.title}</h4>
              </div>

              <span
                className={`${styles.detailStatus} ${getModuleStatusClass(
                  selectedModule.status
                )}`}
              >
                {selectedModule.statusLabel}
              </span>
            </div>

            <p className={styles.detailPrimary}>
              {selectedModule.primaryText}
            </p>

            <p className={styles.detailSecondary}>
              {selectedModule.secondaryText}
            </p>

            {selectedModule.tags.length > 0 && (
              <div className={styles.tags}>
                {selectedModule.tags.slice(0, 5).map((tag) => (
                  <span key={tag}>{tag}</span>
                ))}
              </div>
            )}

            {selectedModule.metrics.length > 0 && (
              <div className={styles.metrics}>
                {selectedModule.metrics.map((metric) => (
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
        )}

        {activeModule === "observation" &&
          observationModule?.id === "observation" && (
            <section className={styles.observationPanel}>
              <div className={styles.observationHeader}>
                <span>观察列表</span>
                <strong>
                  {observationModule.observation.totalCount}
                </strong>
              </div>

              <div className={styles.observationList}>
                {observationModule.observation.groups.length === 0 && (
                  <div className={styles.empty}>
                    暂无观察记录。
                  </div>
                )}

                {observationModule.observation.groups.map((group) => (
                  <section className={styles.group} key={group.groupLabel}>
                    <h5>{group.groupLabel}</h5>

                    <div className={styles.groupItems}>
                      {group.items.map((item) => (
                        <article className={styles.logItem} key={item.id}>
                          <div className={styles.logTopRow}>
                            <span>{item.category}</span>
                            <strong>{item.timeLabel}</strong>
                          </div>

                          <div className={styles.logTitleRow}>
                            {item.focus && (
                              <span className={styles.focus}>
                                {item.focus}
                              </span>
                            )}

                            <h6>{item.title}</h6>
                          </div>

                          <p>{item.summary}</p>
                        </article>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            </section>
          )}
      </div>
    </section>
  )
}